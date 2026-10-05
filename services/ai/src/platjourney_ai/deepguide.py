"""The deep guide: full guide pages split into passages and embedded, so Nexo can answer
"where is collectible 37" from the source instead of from memory.

Only pages that are served to a plain client and allowed by robots.txt are read; sites that
answer 403 are left alone. Indexing runs in the background: `ensure` and `start` return at
once, and `indexing` says whether a game's job is still running.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel

from . import guidestore, llm
from .guidestore import Passage, Source
from .guidetext import chunk_text, html_to_text, page_date
from .schemas import Game, Wire

__all__ = ['GuidePage', 'Passage', 'Status', 'ensure', 'retrieve', 'start', 'status']

log = logging.getLogger(__name__)

USER_AGENT = 'platjourney/0.1 (+https://github.com/renatoaug/platjourney)'
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


async def allowed_by_robots(http: httpx.AsyncClient, url: str) -> bool:
    parts = urlsplit(url)
    origin = f'{parts.scheme}://{parts.netloc}'
    robots = _robots.get(origin)
    if robots is None:
        try:
            r = await http.get(f'{origin}/robots.txt')
            robots = r.text if r.is_success else ''
        except httpx.HTTPError:
            robots = ''
        _robots[origin] = robots
    return allowed(robots, parts.path or '/')


async def read_page(http: httpx.AsyncClient, url: str) -> tuple[str, str | None] | None:
    """The page as text and the date it says it was updated."""
    if not await allowed_by_robots(http, url):
        return None
    try:
        r = await http.get(url, headers={'accept': 'text/html'})
    except httpx.HTTPError:
        return None
    return (html_to_text(r.text), page_date(r.text)) if r.is_success else None


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
    async with httpx.AsyncClient(
        headers={'user-agent': USER_AGENT}, follow_redirects=True, timeout=30
    ) as http:
        for page in pages:
            read = await read_page(http, page.url)
            if not read:
                log.info('  skipped %s', page.url)
                continue
            text, updated = read
            parts = chunk_text(text)
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
    if outdated or list_changed:
        if index:
            why = 'behind the trophy list' if list_changed else 'old'
            log.info('deep guide for %s is %s; refreshing', game.name, why)
        start(game, trophy_total)
    return await status(game)


async def retrieve(game: Game, question: str, terms: list[str], limit: int = 6) -> list[Passage]:
    """The passages most relevant to a question about this game. Guides are written in English
    while the player asks in Portuguese, so trophy names found in the question are passed as
    `terms` (their English names) and matched literally; those passages come first, the
    semantic neighbours fill the rest."""
    stats = await guidestore.stats(game.id)
    if stats.chunks == 0:
        return []
    [vector] = await llm.embed([f'{game.name}: {" ".join([question, *terms])}'])
    literal, semantic = await asyncio.gather(
        guidestore.mentioning(game.id, terms, 3),
        guidestore.search(game.id, vector, limit),
    )
    seen: set[int] = set()
    out: list[Passage] = []
    for p in [*literal, *(s for s in semantic if s.score > MIN_SCORE)]:
        if p.position in seen:
            continue
        seen.add(p.position)
        out.append(p)
    return out[:limit]
