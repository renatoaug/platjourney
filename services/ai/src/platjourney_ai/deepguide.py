"""The deep guide: full guide pages split into passages and embedded, so Nexo can answer
"where is collectible 37" from the source instead of from memory.

Only pages that are served to a plain client and allowed by robots.txt are read; sites that
answer 403 are left alone. Indexing runs in the background: `ensure` and `start` return at
once, and `indexing` says whether a game's job is still running.
"""

import asyncio
import io
import ipaddress
import logging
import re
import socket
import time
from datetime import UTC, datetime, timedelta
from http.cookiejar import CookieJar, DefaultCookiePolicy
from typing import Any
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel
from pypdf import PdfReader

from . import chapters, guidestore, keywords, llm
from .guidestore import Passage, Source
from .guidetext import chunk_text, html_to_text, page_date
from .schemas import Game, Wire

__all__ = ['GuidePage', 'Passage', 'Status', 'ensure', 'retrieve', 'start', 'status']

log = logging.getLogger(__name__)

USER_AGENT = 'platjourney/0.1 (+https://github.com/renatoaug/platjourney)'


class _NoCookies(DefaultCookiePolicy):
    def set_ok(self, cookie: object, request: object) -> bool:
        return False


def reader_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    """The client that reads guide pages. It keeps no cookies: the reader needs none, and a site
    that sets one with a non-ASCII value would break every later request to that site."""
    return httpx.AsyncClient(
        headers={'user-agent': USER_AGENT},
        # Redirects are followed by hand in _fetch, so each hop's host is checked.
        follow_redirects=False,
        timeout=30,
        cookies=CookieJar(policy=_NoCookies()),
        transport=transport,
    )


# Pages the model's own search may bring; pages someone chose are all read.
MAX_PAGES = 10
# Guides get corrected after patches and server shutdowns; refresh monthly.
MAX_AGE = timedelta(days=30)
# Semantic neighbours below this similarity are noise, not an answer.
MIN_SCORE = 0.25

SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['pages'],
    'properties': {
        'pages': {
            'type': 'array',
            'description': 'Up to 5 pages with the full written guide for this game, '
            'most complete first',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['url', 'site', 'kind'],
                'properties': {
                    'url': {'type': 'string', 'description': 'Direct URL of the guide page'},
                    'site': {'type': 'string', 'description': 'Site name as it presents itself'},
                    'kind': {
                        'type': 'string',
                        'enum': ['trophy-guide', 'collectibles', 'walkthrough', 'specific-trophy'],
                    },
                },
            },
        },
    },
}

INSTRUCTIONS = 'Find the full written trophy guides for this PlayStation game: the main trophy guide and roadmap, the collectible guides and any page for a specific hard trophy. Prefer sites that publish complete text guides. Return direct page URLs only, never search or category pages.'  # noqa: E501


class GuidePage(BaseModel):
    url: str
    site: str


class Status(Wire):
    """What the server shows about a game's deep guide."""

    chunks: int
    sources: list[Source]
    indexing: bool
    indexed_at: datetime | None = None


def allowed(robots: str, path: str) -> bool:
    """Rules that apply to every agent ("*"); a Disallow prefix that matches blocks the page."""
    applies = False
    for raw in robots.split('\n'):
        line = raw.split('#')[0].strip()
        key, _, value = line.partition(':')
        value = value.strip()
        if key.lower() == 'user-agent':
            applies = value == '*'
        elif applies and key.lower() == 'disallow' and value and path.startswith(value):
            return False
    return True


_robots: dict[str, str] = {}

# A guide page is text; anything bigger is cut off rather than held in memory.
MAX_PAGE_BYTES = 5_000_000
MAX_REDIRECTS = 5
# Guides published as PDFs (walkthroughs, strategy guides) run to tens of megabytes.
MAX_PDF_BYTES = 40_000_000
MAX_PDF_PAGES = 600
# Pages read as text: HTML, and plain text. Some servers send no type at all.
READABLE = {'text/html', 'application/xhtml+xml', 'text/plain', ''}
# A page or a game cannot grow past this many passages: each one is embedded and stored.
MAX_PASSAGES_PER_PAGE = 1500
MAX_PASSAGES = 6000


async def _addresses(host: str, port: int) -> list[str]:
    infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return [str(info[4][0]) for info in infos]


async def public_url(url: str) -> bool:
    """Only http(s) pages on the public internet: no credentials in the address, and a host that
    resolves to no private, loopback, link-local or reserved address. The reader fetches pages
    named by search results and model answers, so it must not reach the database, the other
    services on its network or the machine it runs on."""
    parts = urlsplit(url)
    if (
        parts.scheme not in ('http', 'https')
        or not parts.hostname
        or parts.username
        or parts.password
    ):
        return False
    try:
        found = await _addresses(
            parts.hostname, parts.port or (443 if parts.scheme == 'https' else 80)
        )
    except OSError:
        return False
    return bool(found) and all(ipaddress.ip_address(a.split('%')[0]).is_global for a in found)


class _Fetched(BaseModel):
    status: int
    kind: str
    body: bytes
    encoding: str
    whole: bool

    @property
    def text(self) -> str:
        return self.body.decode(self.encoding, 'replace')


async def _fetch(http: httpx.AsyncClient, url: str, accept: str) -> _Fetched | None:
    """GETs a public URL, following redirects one hop at a time, each hop checked again. Reads
    at most MAX_PDF_BYTES of a PDF and MAX_PAGE_BYTES of anything else."""
    for _ in range(MAX_REDIRECTS + 1):
        if not await public_url(url):
            return None
        async with http.stream('GET', url, headers={'accept': accept}) as r:
            if r.is_redirect and 'location' in r.headers:
                url = str(r.url.join(r.headers['location']))
                continue
            kind = r.headers.get('content-type', '').split(';')[0].strip().lower()
            limit = MAX_PDF_BYTES if kind == 'application/pdf' else MAX_PAGE_BYTES
            body = bytearray()
            async for chunk in r.aiter_bytes():
                body += chunk
                if len(body) > limit:
                    break
            return _Fetched(
                status=r.status_code,
                kind=kind,
                body=bytes(body[:limit]),
                encoding=r.encoding or 'utf-8',
                whole=len(body) <= limit,
            )
    return None


def pdf_text(data: bytes) -> str:
    """A PDF's text, page after page, up to MAX_PDF_PAGES; empty when it cannot be read."""
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = reader.pages[:MAX_PDF_PAGES]
        return '\n\n'.join((page.extract_text() or '').strip() for page in pages).strip()
    except Exception:
        return ''


async def allowed_by_robots(http: httpx.AsyncClient, url: str) -> bool:
    parts = urlsplit(url)
    origin = f'{parts.scheme}://{parts.netloc}'
    robots = _robots.get(origin)
    if robots is None:
        try:
            got = await _fetch(http, f'{origin}/robots.txt', 'text/plain')
            robots = got.text if got and 200 <= got.status < 300 else ''
        except httpx.HTTPError:
            robots = ''
        _robots[origin] = robots
    return allowed(robots, parts.path or '/')


async def read_page(http: httpx.AsyncClient, url: str) -> tuple[str, str | None] | None:
    """The page as text and the date it says it was updated. Web pages and PDFs only: anything
    else (an image, a zip, an unknown type) read as text is noise."""
    if not await public_url(url) or not await allowed_by_robots(http, url):
        return None
    try:
        got = await _fetch(http, url, 'text/html, application/pdf;q=0.9')
    except httpx.HTTPError:
        return None
    if not got or not 200 <= got.status < 300:
        return None
    if got.kind == 'application/pdf':
        # A PDF cut at the size limit cannot be parsed; a guide that big is left out.
        if not got.whole:
            return None
        text = await asyncio.to_thread(pdf_text, got.body)
        return (text, None) if text else None
    if got.kind not in READABLE:
        return None
    # Parsing a big page takes a while: off the event loop, so chat keeps answering meanwhile.
    html = got.text
    return await asyncio.to_thread(lambda: (html_to_text(html), page_date(html)))


async def find_pages(game: Game) -> list[GuidePage]:
    platform = '/'.join(p for p in game.platforms if p.startswith('PS')) or 'PlayStation'
    found = await llm.research_json(
        'guide_pages', INSTRUCTIONS, f'Game: {game.name} ({platform})', SCHEMA
    )
    return [GuidePage(url=p['url'], site=p['site']) for p in found['pages']]


def embed_text(game_name: str, heading: str, content: str) -> str:
    return f'{game_name} — {heading}\n{content}'


async def _index(game: Game, trophy_total: int | None, given: list[GuidePage] | None) -> None:
    log.info('indexing deep guide for %s', game.name)
    pages = given if given is not None else (await find_pages(game))[:MAX_PAGES]
    chunks: list[dict[str, Any]] = []
    async with reader_client() as http:
        for page in pages:
            read = await read_page(http, page.url)
            if not read:
                log.info('  skipped %s', page.url)
                continue
            text, updated = read
            parts = chunk_text(text)[:MAX_PASSAGES_PER_PAGE]
            log.info('  %s: %d passages from %s', page.site, len(parts), page.url)
            for part in parts:
                chunks.append(
                    {
                        'source': page.site,
                        'url': page.url,
                        'position': len(chunks),
                        'heading': part.heading,
                        'content': part.content,
                    }
                    | ({'page_updated_at': updated} if updated else {})
                )
    chunks = chunks[:MAX_PASSAGES]
    if not chunks:
        # Remember the attempt so a game without readable guides is not retried on every request.
        await guidestore.save_index(game.id, trophy_total, [], 0)
        return
    vectors = await llm.embed([embed_text(game.name, c['heading'], c['content']) for c in chunks])
    await guidestore.replace_chunks(
        game.id, [c | {'embedding': v} for c, v in zip(chunks, vectors, strict=True)]
    )
    urls = list(dict.fromkeys(c['url'] for c in chunks))
    await guidestore.save_index(game.id, trophy_total, urls, len(chunks))


_in_flight: dict[str, asyncio.Task[None]] = {}
# A game whose indexing failed is not tried again for a while: each try may search the web.
_failed: dict[str, float] = {}
RETRY_AFTER_FAILURE_S = 3600


def start(
    game: Game, trophy_total: int | None = None, given: list[GuidePage] | None = None
) -> asyncio.Task[None]:
    """Finds the full guides for a game, reads the pages it is allowed to and indexes them, in
    the background. With `given`, the pages are already known (picked by hand or by a person
    researching the game) and the search step is skipped. A game already being indexed keeps
    its running job."""
    running = _in_flight.get(game.id)
    if running:
        return running
    task = asyncio.create_task(_index(game, trophy_total, given))
    _in_flight[game.id] = task

    def done(t: asyncio.Task[None]) -> None:
        _in_flight.pop(game.id, None)
        if not t.cancelled() and (e := t.exception()):
            _failed[game.id] = time.monotonic()
            log.error('deep guide for %s failed: %s', game.name, e)

    task.add_done_callback(done)
    return task


async def status(game: Game) -> Status:
    index = await guidestore.get_index(game.id)
    stats = await guidestore.stats(game.id)
    return Status(
        chunks=stats.chunks,
        sources=stats.sources,
        indexing=game.id in _in_flight,
        indexed_at=index.indexed_at if index else None,
    )


async def ensure(game: Game, trophy_total: int | None = None) -> Status:
    """Indexes the first time, and again when the index is older than MAX_AGE or the game's
    trophy list changed size (a DLC or an update added trophies). While a refresh runs the
    previous passages keep answering."""
    index = await guidestore.get_index(game.id)
    outdated = index is None or datetime.now(UTC) - index.indexed_at > MAX_AGE
    list_changed = (
        trophy_total is not None
        and index is not None
        and index.trophy_total is not None
        and index.trophy_total != trophy_total
    )
    failed_at = _failed.get(game.id)
    if failed_at is not None and time.monotonic() - failed_at < RETRY_AFTER_FAILURE_S:
        return await status(game)
    if outdated or list_changed:
        if index:
            why = 'behind the trophy list' if list_changed else 'old'
            log.info('deep guide for %s is %s; refreshing', game.name, why)
        start(game, trophy_total)
    return await status(game)


def near(found: list[guidestore.ScoredPassage]) -> list[int]:
    """The positions of the vector search's passages close enough to count."""
    return [s.position for s in found if s.score > MIN_SCORE]


# How many passages each search hands to the fusion.
CANDIDATES = 30
# How much the passages of the chapter a question names count in the fusion.
CHAPTER_WEIGHT = 1.0
# How much the passages of the chapter the player is probably in count, when the question names
# none: a guess from their trophies, so it nudges and never leaves anything out.
HERE_WEIGHT = 0.3
# The least a search counts in the fusion, whatever the language of the game's guide.
MIN_WEIGHT = 0.3


def weights(portuguese: float) -> tuple[float, float, float, float]:
    """How much each search counts, from how much of the game's guide is in Portuguese: the
    vectors and keywords of the English question, then the keywords and vectors of the question
    as asked. A guide mostly in English leans on the translation, one mostly in Portuguese on the
    player's own words; each search counts at least MIN_WEIGHT, the vectors as asked only once a
    quarter of the guide is in Portuguese."""
    english = min(1.0, max(MIN_WEIGHT, 2 * (1 - portuguese)))
    own = min(1.0, max(MIN_WEIGHT, 2 * portuguese))
    return english, english, own, own if portuguese >= 0.25 else 0.0


TRANSLATE = (
    'Translate this question about a PlayStation game into English, the way an English-speaking '
    'player would search a trophy guide: game terms as English guides name them (flor → flower, '
    'baú secreto → secret chest), proper nouns as they are. Add nothing the question does not '
    'say. Reply with the translation only. A question already in English comes back unchanged.'
)
_translated: dict[str, str] = {}
_TRANSLATED_MAX = 1000


async def in_english(question: str) -> str | None:
    """The question in English, the language of almost every passage, from a small model. A
    question asked again is not translated again; a failure gives None, so the search goes on
    without it."""
    if question in _translated:
        return _translated[question]
    try:
        reply = await llm.respond(step='search', instructions=TRANSLATE, input=question)
        english = reply.output_text.strip() or question
    except Exception:
        log.warning('question translation failed; searching with it as asked', exc_info=True)
        return None
    if len(_translated) >= _TRANSLATED_MAX:
        _translated.clear()
    _translated[question] = english
    return english


async def retrieve(
    game: Game,
    question: str,
    terms: list[str],
    limit: int = 6,
    here: frozenset[chapters.Chapter] = frozenset(),
) -> list[Passage]:
    """The passages most relevant to a question about this game. Guides are written mostly in
    English while the player asks in Portuguese, so the question is put in English first. The
    searches are fused by rank: the vectors and the keywords of the English question, the keywords
    of the question as asked and, for a guide largely in Portuguese, its vectors too, each weighed
    by how much of the game's guide is in each language (`weights`). Trophy names found in the
    question are passed as `terms` (their English names) and matched literally; those passages
    come first. A question that names a chapter adds the passages under it to the fusion, and
    passages about another chapter are left out. Otherwise `here`, the chapter the player is
    probably in, adds its passages with a lower weight."""
    every = await guidestore.passages(game.id)
    if not every:
        return []
    english = await in_english(question)
    english_vectors, english_words, own_words, own_vectors = weights(
        keywords.portuguese_share(every)
    )
    asked = f'{game.name}: {" ".join([english or question, *terms])}'
    # A guide largely in Portuguese is also searched by the meaning of the question as asked.
    own = f'{game.name}: {" ".join([question, *terms])}' if english and own_vectors else None
    vectors = await llm.embed([asked, own] if own else [asked])
    literal, found = await asyncio.gather(
        guidestore.mentioning(game.id, terms, 3),
        asyncio.gather(*(guidestore.search(game.id, v, CANDIDATES) for v in vectors)),
    )
    semantic, *native = found
    lists: list[list[int]] = [near(semantic)]
    ranks = [english_vectors if english is not None else 1.0]
    # Without a translation (it failed) the vectors rank alone, as before: Portuguese keywords at
    # full weight outrank them with common words.
    if english is not None:
        lists += [keywords.rank(every, english), keywords.rank(every, question)]
        ranks += [english_words, own_words]
        if native:
            lists.append(near(native[0]))
            ranks.append(own_vectors)
    asked = chapters.named(f'{question}\n{english or ""}')
    labels = {p.position: chapters.named(p.heading) for p in every} if asked or here else {}
    units = {unit for found in labels.values() for unit, _ in found}
    asked = chapters.in_terms_of(asked, units)
    if asked:
        lists.append(in_chapter(labels, asked, lists[0]))
        ranks.append(CHAPTER_WEIGHT)
    elif here:
        lists.append(in_chapter(labels, chapters.in_terms_of(here, units), lists[0]))
        ranks.append(HERE_WEIGHT)
    ranked = keywords.fuse(lists, ranks)
    at = {p.position: p for p in every}
    seen: set[int] = set()
    out: list[Passage] = []
    for p in [*literal, *(at[n] for n in ranked if n in at)]:
        if p.position in seen:
            continue
        seen.add(p.position)
        out.append(p)
    # A passage about another chapter is not the answer to a question about this one, unless
    # nothing else came back.
    kept = [p for p in out if not chapters.elsewhere(labels.get(p.position, frozenset()), asked)]
    return await _with_continuation(game, (kept or out)[:limit])


def in_chapter(
    labels: dict[int, frozenset[chapters.Chapter]],
    asked: frozenset[chapters.Chapter],
    semantic: list[int],
) -> list[int]:
    """The passages under every chapter the question names, the ones the vector search found
    first, in its order, then the rest in page order."""
    inside = {position for position, found in labels.items() if asked <= found}
    return [n for n in semantic if n in inside] + sorted(inside - set(semantic))


# The last line of a passage that stops on a title or a label ("Objective: Reach the South
# Tower", "Herbarium #1 (Flower 1/5): Arrowhead", "## Chapter 2") with the text it introduces
# left in the next passage.
_OPEN_LINE = re.compile(r'^(#{1,6}\s.*|[^.!?]*:.*|.*#\d.*)$')
_OPEN_LINE_MAX = 80


def ends_open(content: str) -> bool:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return False
    last = lines[-1]
    return (
        len(last) <= _OPEN_LINE_MAX
        and not last.endswith(('.', '!', '?', '"', '”', ')'))
        and _OPEN_LINE.match(last) is not None
    ) or last.endswith(':')


async def _with_continuation(game: Game, passages: list[Passage]) -> list[Passage]:
    """A passage cut right after a title gets the next one of the same page appended, so the
    model sees the steps and not only where they start (the way a page splits into passages
    can leave a collectible's name in one and its location in the next)."""
    open_ = [p for p in passages if ends_open(p.content)]
    if not open_:
        return passages
    taken = {p.position for p in passages}
    wanted = [p.position + 1 for p in open_ if p.position + 1 not in taken]
    following = {n.position: n for n in await guidestore.at_positions(game.id, wanted)}
    out: list[Passage] = []
    for p in passages:
        n = following.get(p.position + 1)
        if n is not None and n.url == p.url and ends_open(p.content):
            p = p.model_copy(update={'content': f'{p.content}\n{n.content}'})
        out.append(p)
    return out
