"""Recommendations: taste vector, candidate retrieval, prompt and the catalog embedding job."""

from datetime import UTC, datetime
from typing import Any

import pytest

from platjourney_ai import db, llm, recommend, taste
from platjourney_ai.jobs import embed_catalog
from platjourney_ai.recommend import (
    Dismissed,
    Filters,
    Preferences,
    RecommendRequest,
    breaks,
    build_input,
    candidate_line,
    facts_line,
    rules_text,
)
from platjourney_ai.taste import Candidate, LibraryTitle, cosine, mean, signals

NOW = datetime(2026, 9, 30, tzinfo=UTC)


def title(name: str, progress: int, platinum: int, updated: str, game: str | None) -> LibraryTitle:
    return LibraryTitle.model_validate(
        {
            'name': name,
            'platform': 'PS5',
            'progress': progress,
            'lastUpdated': updated,
            'earnedByType': {'bronze': 3, 'silver': 1, 'gold': 0, 'platinum': platinum},
            'game': game,
        }
    )


LIBRARY = [
    title('Old Plat', 100, 1, '2020-01-01T00:00:00Z', 'game:1'),
    title('New Plat', 100, 1, '2026-09-30T00:00:00Z', 'game:2'),
    title('Halfway', 60, 0, '2026-05-01T00:00:00Z', 'game:3'),
    title('Started', 25, 0, '2026-06-01T00:00:00Z', 'game:4'),
    title('Dropped', 5, 0, '2026-07-01T00:00:00Z', 'game:5'),
    title('Not in catalog', 100, 1, '2026-08-01T00:00:00Z', None),
]


def test_signals_weigh_platinums_by_recency_and_skip_unknown_games() -> None:
    by_game = {s.game: s.weight for s in signals(LIBRARY, NOW)}
    assert by_game == {'game:1': 1, 'game:2': 1.5, 'game:3': 0.6, 'game:4': 0.3, 'game:5': -0.15}


def test_weighted_mean_and_cosine() -> None:
    assert mean([[1, 0], [0, 1]], [3, 1]) == [0.75, 0.25]
    assert mean([[2, 4], [4, 8]]) == [3, 6]
    assert mean([[1, 1]], [0]) == [0, 0]
    assert mean([]) == []
    assert cosine([1, 0], [1, 0]) == 1
    assert cosine([1, 0], [0, 1]) == 0
    assert cosine([], [1, 0]) == 0


VECTORS = {
    'game:1': ('Old Plat', [1.0, 0.0]),
    'game:2': ('New Plat', [0.0, 1.0]),
    'game:3': ('Halfway', [1.0, 1.0]),
}


async def test_candidates_use_the_taste_vector_and_exclusions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        assert vars is not None
        if 'vector::similarity::cosine' in sql:
            seen['sql'], seen['vars'] = sql, vars
            return [
                {
                    'id': 'game:9',
                    'name': 'Close',
                    'platforms': ['PS5', 'PC'],
                    'release_year': None,
                    'genres': ['RPG'],
                    'embedding': [0.1, 1.0],
                    'score': 0.9,
                }
            ]
        return [
            {'id': i, 'name': VECTORS[i][0], 'embedding': VECTORS[i][1]}
            for i in vars['ids']
            if i in VECTORS
        ]

    monkeypatch.setattr(db, 'rows', rows)
    found = await taste.candidates(LIBRARY, ['game:7', 'game:6', 'game:7'], 24, NOW)
    # Plats 1 and 1.5, halfway 0.6: (1*1 + 0 + 0.6, 0 + 1.5 + 0.6) / 3.1.
    assert seen['vars']['v'] == pytest.approx([1.6 / 3.1, 2.1 / 3.1])
    assert seen['vars']['exclude'] == ['game:6', 'game:7']
    assert 'LIMIT 24' in seen['sql']
    assert found == [
        Candidate(
            id='game:9',
            name='Close',
            platforms=['PS5', 'PC'],
            genres=['RPG'],
            score=0.9,
            similar_to=['New Plat', 'Halfway'],
        )
    ]


async def test_no_candidates_without_embedded_games(monkeypatch: pytest.MonkeyPatch) -> None:
    async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        assert 'embedding <|' not in sql
        return []

    monkeypatch.setattr(db, 'rows', rows)
    assert await taste.candidates(LIBRARY, [], 24, NOW) == []


CANDIDATE = Candidate(
    id='game:9',
    name='Close',
    platforms=['PC', 'PS4', 'PS5'],
    release_year=2021,
    genres=['RPG', 'Adventure', 'Shooter', 'Puzzle'],
    similar_to=['New Plat', 'Halfway'],
)


def test_candidate_line() -> None:
    assert candidate_line(CANDIDATE) == (
        '- Close (PS4/PS5; 2021; RPG, Adventure, Shooter) — parecido com New Plat e Halfway'
    )
    bare = Candidate(id='game:8', name='Bare', platforms=['PC'])
    assert candidate_line(bare) == '- Bare (PS; ?; ) — parecido com —'


def test_prompt_lists_recent_platinums_progress_candidates_and_dismissed() -> None:
    text = build_input(
        LIBRARY,
        [CANDIDATE],
        [Dismissed(name='Skipped'), Dismissed(name='Endless', reason='too_long')],
    )
    assert text == (
        'Platinumed (3 in all; the 3 most recent):\nNew Plat\nNot in catalog\nOld Plat\n\n'
        'In progress:\nStarted (25%)\nHalfway (60%)\n\n'
        'Candidates (pick only from these, use the exact name):\n'
        '- Close (PS4/PS5; 2021; RPG, Adventure, Shooter) — parecido com New Plat e Halfway'
        '\n\nDismissed before — never suggest:\nSkipped\nEndless (too long a platinum)'
    )
    assert 'Dismissed' not in build_input(LIBRARY, [CANDIDATE], [])


def test_prompt_keeps_only_the_most_recent_platinums() -> None:
    many = [title(f'P{i:03}', 100, 1, f'2026-01-01T00:00:{i % 60:02}Z', None) for i in range(90)]
    text = build_input(many, [], [])
    assert text.startswith('Platinumed (90 in all; the 80 most recent):\n')


@pytest.fixture(autouse=True)
def guided(monkeypatch: pytest.MonkeyPatch) -> None:
    async def every() -> list[str]:
        return []

    monkeypatch.setattr(recommend, 'guided_games', every)


async def test_recommend_resolves_picks_to_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_candidates(*_: Any, **__: Any) -> list[Candidate]:
        return [CANDIDATE]

    calls: list[tuple[str, str, str]] = []

    async def answer_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        calls.append((name, instructions, input))
        pick = {
            'platform': 'PS5',
            'difficulty': 4,
            'hours': 30,
            'playthroughs': None,
            'hasDifficultyTrophy': False,
            'why': 'Porque sim',
            'hasMissables': True,
        }
        return {
            'profile': {'summary': 'Você...', 'genres': ['RPG'], 'traits': [], 'avoid': []},
            'items': [
                pick | {'name': 'close'},
                pick | {'name': 'Elsewhere'},
                # A smaller model copies the candidate line and adds markdown.
                pick | {'name': 'Close (PS4/PS5; 2021; RPG)', 'why': 'Como **New Plat**, *curto*'},
            ],
        }

    async def no_guides(ids: Any) -> dict[str, Any]:
        return {i: {} for i in ids}

    monkeypatch.setattr(recommend, 'candidates', fake_candidates)
    monkeypatch.setattr(recommend, 'guide_rows', no_guides)
    monkeypatch.setattr(llm, 'answer_json', answer_json)
    req = RecommendRequest.model_validate({'library': [], 'dismissed': []})
    out = (await recommend.recommend(req)).model_dump(by_alias=True)
    assert calls[0][0] == 'recommendations'
    assert calls[0][1].startswith('You recommend PlayStation platinums')
    first, second, copied = out['items']
    assert (first['game'], first['similarTo'], first['hasDifficultyTrophy']) == (
        'game:9',
        ['New Plat', 'Halfway'],
        False,
    )
    assert (second['game'], second['similarTo']) == (None, [])
    assert (copied['name'], copied['game'], copied['why']) == (
        'Close',
        'game:9',
        'Como New Plat, curto',
    )


def test_game_text() -> None:
    game = {
        'id': 'game:1',
        'name': 'Bloodborne',
        'genres': ['RPG', 'Adventure'],
        'themes': [],
        'modes': ['Single player'],
        'release_year': 2015,
        'summary': 'Hunt.',
    }
    assert embed_catalog.game_text(game) == (
        'Bloodborne\nGenres: RPG, Adventure\nModes: Single player\nReleased: 2015\nHunt.'
    )
    assert embed_catalog.game_text({'name': 'Bare', 'summary': None}) == 'Bare'


async def test_embed_catalog_saves_one_vector_per_game(monkeypatch: pytest.MonkeyPatch) -> None:
    games = [{'id': f'game:{i}', 'name': f'G{i}'} for i in range(3)]
    saved: list[dict[str, Any]] = []

    async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        assert 'embedding = NONE' in sql
        return games

    async def query(sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
        assert vars is not None
        saved.append(vars)
        return [[]]

    async def embed(texts: list[str]) -> list[list[float]]:
        return [[float(len(t))] for t in texts]

    monkeypatch.setattr(db, 'rows', rows)
    monkeypatch.setattr(db, 'query', query)
    monkeypatch.setattr(llm, 'embed', embed)
    assert await embed_catalog.embed_catalog() == 3
    assert saved == [{'id': f'game:{i}', 'embedding': [2.0]} for i in range(3)]


def test_candidates_carry_the_guide_numbers_when_we_have_a_guide() -> None:
    from platjourney_ai.recommend import candidate_line
    from platjourney_ai.taste import Candidate

    c = Candidate(id='game:1', name='Days Gone', platforms=['PS4'], genres=['Action'])
    assert candidate_line(c, 'dificuldade 3/10, ~70h, 1 jogada(s)').endswith(
        ' — guia: dificuldade 3/10, ~70h, 1 jogada(s)'
    )
    assert ' — guia' not in candidate_line(c)


def test_rules_drop_what_a_guide_says_breaks_them_and_keep_the_unknown() -> None:
    f = Filters(no_missables=True, one_playthrough=True, max_hours=40)
    assert breaks(f, {'has_missables': True})
    assert breaks(f, {'playthroughs': 2})
    assert breaks(f, {'hours': 60})
    assert not breaks(f, {'has_missables': False, 'playthroughs': 1, 'hours': 30})
    assert not breaks(f, None)
    assert breaks(Filters(no_online=True), {'has_online': True})
    assert breaks(Filters(no_difficulty_trophy=True), {'difficulty_trophy': 'Brutal'})
    assert breaks(Filters(max_difficulty=5), {'difficulty': 7})
    assert not breaks(Filters(), {'has_missables': True, 'hours': 300})


def test_the_prompt_carries_what_the_player_said() -> None:
    p = Preferences(
        likes=['jogos curtos'], avoid=['terror'], wrong=['longas'], filters=Filters(no_online=True)
    )
    text = rules_text(p)
    assert 'Not about them (leave out of the profile): longas' in text
    assert 'Likes: jogos curtos' in text and 'Avoid: terror' in text
    assert 'no online trophies' in text
    assert rules_text(Preferences()) == ''
    assert 'The player said' in build_input([], [], [], None, p)


def test_facts_line_needs_difficulty_and_hours() -> None:
    assert facts_line({'difficulty': 3, 'hours': 20, 'playthroughs': 1}) == (
        'dificuldade 3/10, ~20h, 1 jogada(s)'
    )
    assert facts_line({'difficulty': None, 'hours': 20}) == ''


async def test_rules_thin_the_candidates_and_the_picks(monkeypatch: pytest.MonkeyPatch) -> None:
    long_one = Candidate(id='game:8', name='Long', platforms=['PS5'])
    drawn: list[int] = []

    async def fake_candidates(_lib: Any, _ex: Any, n: int, **_: Any) -> list[Candidate]:
        drawn.append(n)
        return [long_one, CANDIDATE]

    async def guides(ids: Any) -> dict[str, Any]:
        return {'game:8': {'difficulty': 5, 'hours': 120, 'playthroughs': 1}, 'game:9': {}}

    seen: list[str] = []

    async def answer_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        seen.append(input)
        pick = {
            'platform': 'PS5',
            'difficulty': 4,
            'playthroughs': 1,
            'hasDifficultyTrophy': False,
            'why': 'x',
            'hasMissables': False,
        }
        return {
            'profile': {'summary': 'x', 'genres': [], 'traits': [], 'avoid': []},
            'items': [pick | {'name': 'Close', 'hours': 20}, pick | {'name': 'Other', 'hours': 90}],
        }

    monkeypatch.setattr(recommend, 'candidates', fake_candidates)
    monkeypatch.setattr(recommend, 'guide_rows', guides)
    monkeypatch.setattr(llm, 'answer_json', answer_json)
    req = RecommendRequest.model_validate(
        {'library': [], 'preferences': {'filters': {'maxHours': 40}}}
    )
    out = await recommend.recommend(req)
    assert drawn == [recommend.CANDIDATES * 2]
    assert '- Long' not in seen[0] and '- Close' in seen[0]
    assert [i.name for i in out.items] == ['Close']


async def test_seen_games_come_back_only_when_the_unseen_run_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    old = Candidate(id='game:20', name='Old')
    older = Candidate(id='game:21', name='Older')
    calls: list[list[str]] = []

    async def fake_candidates(_lib: Any, exclude: list[str], n: int, **_: Any) -> list[Candidate]:
        calls.append(list(exclude))
        return [CANDIDATE] if 'game:20' in exclude else [CANDIDATE, old, older]

    async def no_guides(ids: Any) -> dict[str, Any]:
        return {i: {} for i in ids}

    seen: list[str] = []

    async def answer_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        seen.append(input)
        return {'profile': {'summary': 'x', 'genres': [], 'traits': [], 'avoid': []}, 'items': []}

    monkeypatch.setattr(recommend, 'candidates', fake_candidates)
    monkeypatch.setattr(recommend, 'guide_rows', no_guides)
    monkeypatch.setattr(llm, 'answer_json', answer_json)
    req = RecommendRequest.model_validate(
        {'library': [], 'exclude': ['game:1'], 'seen': ['game:21', 'game:20']}
    )
    await recommend.recommend(req)
    assert calls[0] == ['game:1', 'game:21', 'game:20']
    assert calls[1] == ['game:1']
    text = seen[0]
    assert text.index('- Older') < text.index('- Old (')


async def test_only_games_with_a_guide_are_candidates(monkeypatch: pytest.MonkeyPatch) -> None:
    bare = Candidate(id='game:30', name='Bare')
    guided = Candidate(id='game:31', name='Guided')

    async def fake_candidates(_lib: Any, _ex: list[str], n: int, **_: Any) -> list[Candidate]:
        return [bare, guided]

    async def guides(ids: Any) -> dict[str, Any]:
        return {'game:31': {'difficulty': 3, 'hours': 20, 'playthroughs': 1}}

    seen: list[str] = []

    async def answer_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        seen.append(input)
        return {'profile': {'summary': 'x', 'genres': [], 'traits': [], 'avoid': []}, 'items': []}

    monkeypatch.setattr(recommend, 'candidates', fake_candidates)
    monkeypatch.setattr(recommend, 'guide_rows', guides)
    monkeypatch.setattr(llm, 'answer_json', answer_json)
    await recommend.recommend(RecommendRequest.model_validate({'library': []}))
    assert '- Guided' in seen[0] and '- Bare' not in seen[0]


async def test_candidates_can_be_kept_to_some_games(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        seen['sql'], seen['vars'] = sql, vars
        return []

    monkeypatch.setattr(db, 'rows', rows)
    await taste.similar_games([1.0], 5, [], ['game:1'])
    assert 'id IN $only' in seen['sql'] and seen['vars']['only'] == ['game:1']
    await taste.similar_games([1.0], 5, [])
    assert 'id IN $only' not in seen['sql']


def graph_game(i: int) -> dict[str, Any]:
    return {'id': f'game:{i}', 'name': f'Graph {i}', 'platforms': ['PS5'], 'genres': ['RPG']}


async def run_with_graph(
    monkeypatch: pytest.MonkeyPatch,
    body: dict[str, Any],
    guided: list[str],
    vector: list[Candidate] | None = None,
) -> tuple[str, list[tuple[list[str], int]]]:
    """Runs a recommendation with graph candidates; returns the prompt and each vector search
    (its exclusions and size)."""
    searches: list[tuple[list[str], int]] = []

    async def every() -> list[str]:
        return guided

    async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        assert vars is not None
        if 'release_year' in sql:
            # The catalog answers in its own order, not the graph's.
            return [graph_game(int(i.split(':')[1])) for i in sorted(vars['ids'])]
        return []

    async def fake_candidates(_lib: Any, exclude: list[str], n: int, **_: Any) -> list[Candidate]:
        searches.append((list(exclude), n))
        return [c for c in vector or [] if c.id not in exclude][:n]

    async def no_guides(ids: Any) -> dict[str, Any]:
        return {i: {} for i in ids}

    prompts: list[str] = []

    async def answer_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        prompts.append(input)
        return {'profile': {'summary': 'x', 'genres': [], 'traits': [], 'avoid': []}, 'items': []}

    monkeypatch.setattr(recommend, 'guided_games', every)
    monkeypatch.setattr(db, 'rows', rows)
    monkeypatch.setattr(recommend, 'candidates', fake_candidates)
    monkeypatch.setattr(recommend, 'guide_rows', no_guides)
    monkeypatch.setattr(llm, 'answer_json', answer_json)
    await recommend.recommend(RecommendRequest.model_validate({'library': []} | body))
    return prompts[0], searches


def listed(prompt: str) -> list[str]:
    return [line[2:].split(' (')[0] for line in prompt.splitlines() if line.startswith('- ')]


async def test_graph_candidates_are_drawn_in_their_order(monkeypatch: pytest.MonkeyPatch) -> None:
    ids = [f'game:{i}' for i in range(100, 100 + recommend.CANDIDATES * 2)][::-1]
    prompt, searches = await run_with_graph(monkeypatch, {'candidates': ids}, ids)
    assert listed(prompt) == [f'Graph {i.split(":")[1]}' for i in ids[: recommend.CANDIDATES]]
    assert searches == []


async def test_graph_candidates_drop_excluded_seen_and_unguided(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ids = ['game:5', 'game:1', 'game:2', 'game:3', 'game:4', 'game:1']
    body = {'candidates': ids, 'exclude': ['game:2'], 'seen': ['game:3']}
    prompt, _ = await run_with_graph(monkeypatch, body, ['game:1', 'game:2', 'game:3', 'game:5'])
    assert listed(prompt)[:2] == ['Graph 5', 'Graph 1']
    assert len(listed(prompt)) == 2


async def test_vector_search_fills_what_the_graph_leaves_short(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vector = [Candidate(id='game:5', name='Graph 5 again'), Candidate(id='game:9', name='Near')]
    body = {'candidates': ['game:5', 'game:6'], 'exclude': ['game:1'], 'seen': ['game:2']}
    prompt, searches = await run_with_graph(
        monkeypatch, body, ['game:5', 'game:6', 'game:9'], vector
    )
    assert listed(prompt) == ['Graph 5', 'Graph 6', 'Near']
    assert searches[0] == (['game:1', 'game:2', 'game:5', 'game:6'], recommend.CANDIDATES * 2 - 2)


async def test_no_graph_candidates_keep_the_vector_search(monkeypatch: pytest.MonkeyPatch) -> None:
    vector = [Candidate(id='game:9', name='Near')]
    prompt, searches = await run_with_graph(
        monkeypatch, {'exclude': ['game:1'], 'seen': ['game:2']}, ['game:9'], vector
    )
    assert listed(prompt) == ['Near']
    wanted = recommend.CANDIDATES * 2
    assert searches == [(['game:1', 'game:2'], wanted), (['game:1'], wanted + 1)]


def test_graph_candidates_must_be_game_ids() -> None:
    assert RecommendRequest.model_validate({'library': []}).candidates == []
    with pytest.raises(ValueError):
        RecommendRequest.model_validate({'library': [], 'candidates': ['user:1']})
    with pytest.raises(ValueError):
        RecommendRequest.model_validate(
            {'library': [], 'candidates': [f'game:{i}' for i in range(101)]}
        )
