"""The deep guide: page text and passages, robots rules, the refresh rules, the background job
and retrieval, with the database, the web and the model mocked."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from platjourney_ai import deepguide, guidestore, llm
from platjourney_ai.config import settings
from platjourney_ai.guidestore import GuideIndex, Passage, ScoredPassage, Source, Stats
from platjourney_ai.guidetext import Part, chunk_text, html_to_text
from platjourney_ai.main import app
from platjourney_ai.schemas import Game

HEADERS = {'x-internal-token': settings.ai_token}
GAME = Game(id='game:1', name='Far Cry 3', platforms=['PS3', 'PS4', 'PC'])


# Page text


def test_html_to_text_keeps_headings_and_list_items() -> None:
    html = (
        '<html><body><nav>Menu</nav><article><h2 class="x">Collectibles</h2>'
        '<p>There are <b>20</b> letters.</p><ul><li>One</li><li>Two</li></ul>'
        '<script>track()</script><!-- ad --></article><footer>Footer</footer></body></html>'
    )
    assert html_to_text(html) == '## Collectibles\n\nThere are 20 letters.\n\n- One\n- Two'


def test_page_date_prefers_the_update_and_falls_back_to_publishing() -> None:
    from platjourney_ai.guidetext import page_date

    both = (
        '<meta property="article:published_time" content="2020-11-10T09:00:00+00:00">'
        '<script type="application/ld+json">{"dateModified": "2025-08-07T10:00:00Z"}</script>'
    )
    assert page_date(both) == '2025-08-07'
    assert page_date('<time datetime="2019-04-25">25 abr</time>') == '2019-04-25'
    assert page_date('<p>no date</p>') is None


def test_passages_carry_the_path_of_headings_and_bold_labels() -> None:
    from platjourney_ai.guidetext import chunk_text

    html = (
        '<article><h2>TEXT GUIDE</h2><p><strong>Chapter 10:</strong></p>'
        '<p>Treasure #33 sits near the start of the chapter, by the fountain.</p>'
        '<h3>Notes</h3><p>A note on the skeleton at the bottom of the well, easy to miss.</p>'
        '<h2>Trophies</h2><p>Every trophy in the game and how to unlock each one of them.</p>'
        '</article>'
    )
    assert [p.heading for p in chunk_text(html_to_text(html))] == [
        'TEXT GUIDE > Chapter 10',
        'TEXT GUIDE > Notes',
        'Trophies',
    ]


def test_html_to_text_reads_a_flarum_forum_post_from_its_noscript_block() -> None:
    html = (
        '<noscript><iframe src="tracker"></iframe></noscript><main><div id="content"></div>'
        '<div id="flarum-loading">Carregando...</div><noscript><div class="container">'
        '<h2>Guia de Troféus</h2><div class="Post-body"><p>Faça a história.</p></div>'
        '</div></noscript></main>'
    )
    assert html_to_text(html) == '## Guia de Troféus\n\nFaça a história.'


def test_html_to_text_reads_an_article_shipped_as_next_js_page_data() -> None:
    data = {
        'props': {
            'pageProps': {
                'page': {
                    'page': {
                        'htmlEntities': [
                            {'values': {'html': '<h2>Masks</h2>'}},
                            {'values': {'html': '<p>Behind the waterfall.</p>'}},
                        ]
                    }
                }
            }
        }
    }
    html = (
        '<nav>Guide | Maps</nav><div id="__next"></div>'
        f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(data)}</script>'
    )
    assert html_to_text(html) == '## Masks\n\nBehind the waterfall.'


def test_html_to_text_reads_the_whole_page_without_an_article() -> None:
    assert html_to_text('<div>A</div><aside>skip</aside><div>B</div>') == 'A \nB'


def test_html_to_text_reads_the_longest_article_over_sidebar_ones() -> None:
    html = (
        '<article><h3>Other news</h3></article>'
        '<article><h1>Platinum guide</h1><p>Every trophy, step by step.</p></article>'
        '<article><h3>More news</h3></article>'
    )
    assert html_to_text(html) == '# Platinum guide\n\nEvery trophy, step by step.'


def test_html_to_text_decodes_entities_and_blanks_unknown_ones() -> None:
    text = html_to_text('<p>Tom &amp; Jerry&#8217;s &quot;guide&quot;&hellip;&nbsp;done</p>')
    assert text == 'Tom & Jerry\u2019s "guide" done'


def test_html_to_text_collapses_blank_lines() -> None:
    assert html_to_text('<p>A</p>\n\n\n\n<p>B</p>') == 'A\n\nB'


# Passages


def test_chunk_text_follows_headings_and_drops_short_sections() -> None:
    body = 'x' * 80
    text = f'intro too short\n\n## First\n\n{body}\n\n## Second\n\ntiny\n\n## Third\n\n{body}'
    assert chunk_text(text) == [Part('First', body), Part('Third', body)]


def test_chunk_text_starts_a_new_passage_before_overflowing() -> None:
    a, b = 'a' * 500, 'b' * 500
    assert chunk_text(f'## H\n\n{a}\n\n{b}') == [Part('H', a), Part('H', b)]


def test_chunk_text_cuts_a_long_block_at_a_line_break() -> None:
    lines = '\n'.join(f'line {i:03d} ' + 'y' * 80 for i in range(30))
    parts = chunk_text(lines, max_chars=900)
    assert len(parts) > 1
    assert all(len(p.content) <= 900 for p in parts)
    assert ''.join(p.content.replace('\n', '') for p in parts) == lines.replace('\n', '')


def test_chunk_text_cuts_a_block_without_breaks_at_the_limit() -> None:
    # Cut only while the buffer passes 1.5x the limit, so the tail can run long.
    parts = chunk_text('z' * 2000, max_chars=900)
    assert [len(p.content) for p in parts] == [900, 1100]


# robots.txt


ROBOTS = """
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /search  # no search pages
Disallow:
"""


def test_robots_blocks_disallowed_prefixes_for_every_agent() -> None:
    assert not deepguide.allowed(ROBOTS, '/search?q=x')
    assert deepguide.allowed(ROBOTS, '/far-cry-3-trophy-guide/')


def test_robots_ignores_rules_for_other_agents_and_empty_files() -> None:
    assert deepguide.allowed('User-agent: Bingbot\nDisallow: /', '/guide')
    assert deepguide.allowed('', '/guide')


async def test_the_reader_keeps_no_cookies() -> None:
    # A site that sets a cookie with a non-ASCII value used to break every later request to it.
    sent: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request.headers.get('cookie'))
        headers = [(b'set-cookie', 'region=São Paulo; Path=/'.encode('latin-1'))]
        return httpx.Response(200, headers=headers, text='<p>guide</p>')

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        await http.get('https://guides.example/robots.txt')
        await http.get('https://guides.example/guide')

    assert sent == [None, None]


# Refresh rules


def index(days_ago: float, total: int | None = 50) -> GuideIndex:
    return GuideIndex(
        indexed_at=datetime.now(UTC) - timedelta(days=days_ago),
        trophy_total=total,
        pages=['https://a'],
        passages=3,
    )


@pytest.fixture
def started(monkeypatch: pytest.MonkeyPatch) -> list[int | None]:
    calls: list[int | None] = []

    def fake_start(game: Game, trophy_total: int | None = None, given: Any = None) -> None:
        calls.append(trophy_total)

    async def fake_stats(game: str) -> Stats:
        return Stats(chunks=3, sources=[Source(source='Trophy Guides', url='https://a')])

    monkeypatch.setattr(deepguide, 'start', fake_start)
    monkeypatch.setattr(guidestore, 'stats', fake_stats)
    return calls


@pytest.mark.parametrize(
    ('existing', 'total', 'indexes'),
    [
        (None, 50, True),
        (index(2), 50, False),
        (index(2), None, False),
        (index(31), 50, True),
        (index(2), 52, True),
        (index(2, total=None), 52, False),
    ],
)
async def test_ensure_indexes_when_missing_old_or_behind_the_list(
    monkeypatch: pytest.MonkeyPatch,
    started: list[int | None],
    existing: GuideIndex | None,
    total: int | None,
    indexes: bool,
) -> None:
    async def fake_index(game: str) -> GuideIndex | None:
        return existing

    monkeypatch.setattr(guidestore, 'get_index', fake_index)
    status = await deepguide.ensure(GAME, total)
    assert started == ([total] if indexes else [])
    assert status.chunks == 3
    assert status.indexed_at == (existing.indexed_at if existing else None)


# The indexing job


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    saved: dict[str, Any] = {}

    async def save_index(game: str, total: int | None, pages: list[str], passages: int) -> None:
        saved['index'] = (game, total, pages, passages)

    async def replace_chunks(game: str, chunks: list[dict[str, Any]]) -> None:
        saved['chunks'] = chunks

    async def embed(texts: list[str]) -> list[list[float]]:
        saved['embedded'] = texts
        return [[float(i)] for i in range(len(texts))]

    monkeypatch.setattr(guidestore, 'save_index', save_index)
    monkeypatch.setattr(guidestore, 'replace_chunks', replace_chunks)
    monkeypatch.setattr(llm, 'embed', embed)
    return saved


PAGE = '## Relics\n\n' + 'There are 120 relics and only 60 count for the trophy. ' * 3


async def test_index_reads_given_pages_and_skips_unreadable_ones(
    monkeypatch: pytest.MonkeyPatch, store: dict[str, Any]
) -> None:
    async def read_page(http: Any, url: str) -> tuple[str, str | None] | None:
        return (PAGE, '2025-08-07') if url.endswith('ok') else None

    async def no_search(game: Game) -> Any:
        raise AssertionError('given pages skip the search')

    monkeypatch.setattr(deepguide, 'read_page', read_page)
    monkeypatch.setattr(deepguide, 'find_pages', no_search)
    pages = [
        deepguide.GuidePage(url='https://guides.example.com/ok', site='Trophy Guides'),
        deepguide.GuidePage(url='https://blocked.com/no', site='Blocked'),
        deepguide.GuidePage(url='https://guides.example.com/ok', site='Trophy Guides'),
    ]
    await deepguide.start(GAME, 42, pages)
    chunks = store['chunks']
    assert [c['position'] for c in chunks] == [0, 1]
    assert chunks[0]['heading'] == 'Relics'
    assert chunks[1]['embedding'] == [1.0]
    assert chunks[0]['page_updated_at'] == '2025-08-07'
    assert store['embedded'][0].startswith('Far Cry 3 — Relics\nThere are 120 relics')
    assert store['index'] == ('game:1', 42, ['https://guides.example.com/ok'], 2)


async def test_index_without_readable_pages_remembers_the_attempt(
    monkeypatch: pytest.MonkeyPatch, store: dict[str, Any]
) -> None:
    async def find_pages(game: Game) -> list[deepguide.GuidePage]:
        return [deepguide.GuidePage(url='https://blocked.com/x', site='Blocked')]

    async def read_page(http: Any, url: str) -> tuple[str, str | None] | None:
        return None

    monkeypatch.setattr(deepguide, 'find_pages', find_pages)
    monkeypatch.setattr(deepguide, 'read_page', read_page)
    await deepguide.start(GAME)
    assert store['index'] == ('game:1', None, [], 0)
    assert 'chunks' not in store


async def test_find_pages_asks_with_the_playstation_platforms(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    async def fake(name: str, instructions: str, input: str, schema: dict[str, Any]) -> Any:
        seen.update(name=name, input=input, schema=schema)
        return {'pages': [{'url': 'https://a', 'site': 'Trophy Guides', 'kind': 'trophy-guide'}]}

    monkeypatch.setattr(llm, 'research_json', fake)
    pages = await deepguide.find_pages(GAME)
    assert pages == [deepguide.GuidePage(url='https://a', site='Trophy Guides')]
    assert seen == {
        'name': 'guide_pages',
        'input': 'Game: Far Cry 3 (PS3/PS4)',
        'schema': deepguide.SCHEMA,
    }


async def test_a_running_job_is_shared_and_reported_as_indexing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gate = asyncio.Event()
    runs: list[str] = []

    async def slow(game: Game, total: int | None, given: Any) -> None:
        runs.append(game.id)
        await gate.wait()

    async def fake_stats(game: str) -> Stats:
        return Stats(chunks=0, sources=[])

    async def no_index(game: str) -> None:
        return None

    monkeypatch.setattr(deepguide, '_index', slow)
    monkeypatch.setattr(guidestore, 'stats', fake_stats)
    monkeypatch.setattr(guidestore, 'get_index', no_index)
    first = deepguide.start(GAME)
    assert deepguide.start(GAME) is first
    assert (await deepguide.status(GAME)).indexing
    gate.set()
    await first
    await asyncio.sleep(0)
    assert runs == ['game:1']
    assert not (await deepguide.status(GAME)).indexing


# Retrieval


def passage(position: int) -> Passage:
    return Passage(
        source='Trophy Guides',
        url='https://a',
        heading=f'H{position}',
        content=f'C{position}',
        position=position,
    )


def scored(position: int, score: float) -> ScoredPassage:
    return ScoredPassage(**passage(position).model_dump(), score=score)


async def test_retrieve_puts_literal_matches_first_and_drops_weak_neighbours(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    async def fake_stats(game: str) -> Stats:
        return Stats(chunks=10, sources=[])

    async def embed(texts: list[str]) -> list[list[float]]:
        seen['embedded'] = texts
        return [[0.1]]

    async def mentioning(game: str, terms: list[str], limit: int = 4) -> list[Passage]:
        seen['literal'] = (terms, limit)
        return [passage(7), passage(2)]

    async def search(game: str, vector: list[float], limit: int = 6) -> list[ScoredPassage]:
        seen['limit'] = limit
        return [scored(2, 0.9), scored(4, 0.5), scored(5, 0.2)]

    monkeypatch.setattr(guidestore, 'stats', fake_stats)
    monkeypatch.setattr(llm, 'embed', embed)
    monkeypatch.setattr(guidestore, 'mentioning', mentioning)
    monkeypatch.setattr(guidestore, 'search', search)
    found = await deepguide.retrieve(GAME, 'onde fica o arco?', ['Toxophilite'], limit=3)
    assert [p.position for p in found] == [7, 2, 4]
    assert seen['embedded'] == ['Far Cry 3: onde fica o arco? Toxophilite']
    assert seen['literal'] == (['Toxophilite'], 3)
    assert seen['limit'] == 3


async def test_retrieve_skips_the_model_without_passages(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_stats(game: str) -> Stats:
        return Stats(chunks=0, sources=[])

    async def embed(texts: list[str]) -> list[list[float]]:
        raise AssertionError('no embedding for a game without passages')

    monkeypatch.setattr(guidestore, 'stats', fake_stats)
    monkeypatch.setattr(llm, 'embed', embed)
    assert await deepguide.retrieve(GAME, 'onde?', []) == []


# Routes


def test_stats_route_answers_in_camel_case(monkeypatch: pytest.MonkeyPatch) -> None:
    when = datetime(2026, 9, 28, 15, 1, 53, tzinfo=UTC)

    async def fake_stats(game: str) -> Stats:
        return Stats(chunks=2, sources=[Source(source='Trophy Guides', url='https://a')])

    async def fake_index(game: str) -> GuideIndex:
        return GuideIndex(indexed_at=when)

    monkeypatch.setattr(guidestore, 'stats', fake_stats)
    monkeypatch.setattr(guidestore, 'get_index', fake_index)
    body = {'game': {'id': 'game:1', 'name': 'Far Cry 3', 'release_year': 2012}}
    r = TestClient(app).post('/deep-guide/stats', json=body, headers=HEADERS)
    assert r.status_code == 200
    assert r.json() == {
        'chunks': 2,
        'sources': [{'source': 'Trophy Guides', 'url': 'https://a'}],
        'indexing': False,
        'indexedAt': '2026-09-28T15:01:53Z',
    }


def test_index_route_waits_and_reports_a_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    async def broken(game: Game, total: int | None, given: Any) -> None:
        raise RuntimeError('embeddings down')

    monkeypatch.setattr(deepguide, '_index', broken)
    body: dict[str, Any] = {
        'game': {'id': 'game:1', 'name': 'Far Cry 3'},
        'pages': [],
        'wait': True,
    }
    r = TestClient(app).post('/deep-guide/index', json=body, headers=HEADERS)
    assert r.status_code == 500
    # The cause goes to the log, never to the caller.
    assert r.json()['detail'] == 'deep guide failed'


def test_pages_given_by_hand_are_all_read(monkeypatch: pytest.MonkeyPatch) -> None:
    read: list[str] = []

    async def fake_read(_http: object, url: str) -> tuple[str, str | None] | None:
        read.append(url)
        return None

    async def fake_save(*_args: object) -> None:
        return None

    monkeypatch.setattr(deepguide, 'read_page', fake_read)
    monkeypatch.setattr(deepguide.guidestore, 'save_index', fake_save)
    pages = [deepguide.GuidePage(url=f'https://a/{i}', site='A') for i in range(15)]
    asyncio.run(deepguide._index(GAME, None, pages))  # pyright: ignore[reportPrivateUsage]
    assert len(read) == 15


# Writing a game's passages


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, Any]]:
    seen: list[tuple[str, Any]] = []

    async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
        seen.append((sql, vars))
        if sql.startswith('SELECT'):
            return ['guide_chunk:old']
        if 'boom' in str(vars):
            raise RuntimeError('write failed')
        batch: list[Any] = (vars or {})['chunks']
        return [f'guide_chunk:new{len(seen)}{i}' for i in range(len(batch))]

    async def query(sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
        seen.append((sql, vars))
        return []

    monkeypatch.setattr(guidestore.db, 'rows', rows)
    monkeypatch.setattr(guidestore.db, 'query', query)
    return seen


async def test_passages_are_written_in_batches_before_the_old_ones_go(
    calls: list[tuple[str, Any]],
) -> None:
    chunks = [{'content': str(i)} for i in range(guidestore.WRITE_BATCH * 2 + 1)]
    await guidestore.replace_chunks('game:1', chunks)
    inserts = [v for sql, v in calls if 'INSERT' in sql]
    assert [len(v['chunks']) for v in inserts] == [
        guidestore.WRITE_BATCH,
        guidestore.WRITE_BATCH,
        1,
    ]
    deletes = [v for sql, v in calls if sql.startswith('DELETE')]
    assert deletes == [{'ids': ['guide_chunk:old']}]
    assert calls[-1][0].startswith('DELETE')


async def test_a_failed_batch_removes_what_it_wrote_and_keeps_the_old(
    calls: list[tuple[str, Any]],
) -> None:
    chunks = [{'content': 'ok'}] * guidestore.WRITE_BATCH + [{'content': 'boom'}]
    with pytest.raises(RuntimeError):
        await guidestore.replace_chunks('game:1', chunks)
    deletes = [v['ids'] for sql, v in calls if sql.startswith('DELETE')]
    assert len(deletes) == 1
    assert 'guide_chunk:old' not in deletes[0]
    assert len(deletes[0]) == guidestore.WRITE_BATCH


ADDRESSES = {
    'guides.example': ['93.184.216.34'],
    'localhost': ['127.0.0.1'],
    'surrealdb': ['172.18.0.3'],
    'router.lan': ['192.168.0.1'],
    'metadata': ['169.254.169.254'],
    'v6.example': ['2606:4700::1111'],
    'loop6.example': ['::1'],
    'mixed.example': ['93.184.216.34', '10.0.0.5'],
    '127.0.0.1': ['127.0.0.1'],
}


@pytest.fixture
def resolver(monkeypatch: pytest.MonkeyPatch) -> None:
    async def addresses(host: str, port: int) -> list[str]:
        if host not in ADDRESSES:
            raise OSError('unknown host')
        return ADDRESSES[host]

    monkeypatch.setattr(deepguide, '_addresses', addresses)
    monkeypatch.setattr(deepguide, '_robots', {})


@pytest.mark.parametrize(
    ('url', 'ok'),
    [
        ('https://guides.example/far-cry-3', True),
        ('http://guides.example/far-cry-3', True),
        ('https://v6.example/guide', True),
        ('ftp://guides.example/file', False),
        ('file:///etc/passwd', False),
        ('https://user:pass@guides.example/guide', False),
        ('http://localhost:8000/', False),
        ('http://surrealdb:8000/version', False),
        ('http://router.lan/', False),
        ('http://metadata/latest/meta-data/', False),
        ('http://loop6.example/', False),
        ('http://mixed.example/', False),
        ('http://nowhere.example/', False),
        ('http://127.0.0.1:11434/api/tags', False),
    ],
)
async def test_the_reader_reaches_only_public_addresses(resolver: None, url: str, ok: bool) -> None:
    assert await deepguide.public_url(url) is ok


async def test_a_redirect_into_the_network_is_not_followed(resolver: None) -> None:
    asked: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        asked.append(str(request.url))
        if request.url.path == '/robots.txt':
            return httpx.Response(200, text='')
        if request.url.host == 'guides.example' and request.url.path == '/moved':
            return httpx.Response(302, headers={'location': '/guide'})
        if request.url.host == 'guides.example' and request.url.path == '/guide':
            return httpx.Response(200, text='<h2>Roadmap</h2><p>Step one.</p>')
        return httpx.Response(302, headers={'location': 'http://surrealdb:8000/version'})

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        assert await deepguide.read_page(http, 'https://guides.example/sneaky') is None
        page = await deepguide.read_page(http, 'https://guides.example/moved')
    assert page is not None and 'Step one.' in page[0]
    assert not any('surrealdb' in u for u in asked)


async def test_a_huge_page_is_cut_off(resolver: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(deepguide, 'MAX_PAGE_BYTES', 1000)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == '/robots.txt':
            return httpx.Response(404)
        return httpx.Response(200, text='<p>' + 'x' * 50_000 + '</p>')

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        page = await deepguide.read_page(http, 'https://guides.example/big')
    assert page is not None and len(page[0]) <= 1000


async def test_robots_rules_still_apply_after_a_redirect(resolver: None) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == '/robots.txt' and request.url.scheme == 'http':
            return httpx.Response(301, headers={'location': 'https://guides.example/robots.txt'})
        if request.url.path == '/robots.txt':
            return httpx.Response(200, text='User-agent: *\nDisallow: /private')
        return httpx.Response(200, text='<p>secret</p>')

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        assert await deepguide.read_page(http, 'http://guides.example/private/page') is None


async def test_a_failed_index_is_not_retried_for_a_while(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    async def broken(game: Game, total: int | None, given: Any) -> None:
        calls.append(game.id)
        raise RuntimeError('search down')

    async def no_index(game: str) -> None:
        return None

    async def idle(game: Game) -> Any:
        return deepguide.Status(indexing=False, chunks=0, sources=[])

    monkeypatch.setattr(deepguide, '_index', broken)
    monkeypatch.setattr(deepguide, '_failed', {})
    monkeypatch.setattr(guidestore, 'get_index', no_index)
    monkeypatch.setattr(deepguide, 'status', idle)
    game = Game(id='game:77', name='Broken Game')
    await deepguide.ensure(game)
    await asyncio.sleep(0.01)
    await deepguide.ensure(game)
    await deepguide.ensure(game)
    assert calls == ['game:77']


def test_requests_past_their_bounds_are_refused() -> None:
    client = TestClient(app)
    game = {'id': 'game:1', 'name': 'Far Cry 3'}
    long = client.post(
        '/deep-guide/retrieve',
        json={'game': game, 'question': 'x' * 5000},
        headers=HEADERS,
    )
    assert long.status_code == 422
    many = client.post(
        '/deep-guide/retrieve',
        json={'game': game, 'question': 'q', 'limit': 500},
        headers=HEADERS,
    )
    assert many.status_code == 422
    big = client.post(
        '/deep-guide/stats',
        content=b'{}',
        headers={**HEADERS, 'content-type': 'application/json', 'content-length': '5000000'},
    )
    assert big.status_code == 413


def test_a_token_with_other_characters_is_refused_not_an_error() -> None:
    token = b'\xe9' * 48  # sent as raw bytes, like a client that does not encode its headers
    headers: list[tuple[bytes, bytes]] = [(b'x-internal-token', token)]
    r = TestClient(app).post('/deep-guide/stats', json={}, headers=headers)
    assert r.status_code == 403


def tiny_pdf(text: str) -> bytes:
    """A one-page PDF with `text` on it, written by hand: enough for the reader's PDF path."""
    stream = f'BT /F1 12 Tf 72 720 Td ({text}) Tj ET'.encode()
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R '
        b'/Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length %d >>\nstream\n' % len(stream) + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    out = bytearray(b'%PDF-1.4\n')
    offsets: list[int] = []
    for n, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b'%d 0 obj\n' % n + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1)
    out += b''.join(b'%010d 00000 n \n' % o for o in offsets)
    out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (
        len(objects) + 1,
        xref,
    )
    return bytes(out)


async def test_a_pdf_guide_is_read_as_text_and_other_files_are_not(resolver: None) -> None:
    pdf = tiny_pdf('Collect all 12 relics before chapter 9')

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == '/robots.txt':
            return httpx.Response(404)
        if request.url.path == '/guide.pdf':
            return httpx.Response(200, content=pdf, headers={'content-type': 'application/pdf'})
        if request.url.path == '/map.png':
            return httpx.Response(200, content=b'\x89PNG\r\n\x1a\n' + bytes(500))
        return httpx.Response(
            200, content=b'%PDF-1.4 broken', headers={'content-type': 'application/pdf'}
        )

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        page = await deepguide.read_page(http, 'https://guides.example/guide.pdf')
        assert page is not None and 'Collect all 12 relics before chapter 9' in page[0]
        assert await deepguide.read_page(http, 'https://guides.example/broken.pdf') is None


async def test_files_that_are_not_pages_are_not_read(resolver: None) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == '/robots.txt':
            return httpx.Response(404)
        return httpx.Response(
            200, content=bytes(range(256)) * 10, headers={'content-type': 'image/png'}
        )

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        assert await deepguide.read_page(http, 'https://guides.example/map.png') is None


async def test_a_pdf_too_big_to_read_whole_is_left_out(
    resolver: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(deepguide, 'MAX_PDF_BYTES', 100)
    pdf = tiny_pdf('A long walkthrough')

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == '/robots.txt':
            return httpx.Response(404)
        return httpx.Response(200, content=pdf, headers={'content-type': 'application/pdf'})

    async with deepguide.reader_client(httpx.MockTransport(handler)) as http:
        assert await deepguide.read_page(http, 'https://guides.example/walkthrough.pdf') is None
