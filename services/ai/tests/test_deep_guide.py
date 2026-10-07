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
    assert 'embeddings down' in r.json()['detail']


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
