"""Nexo's pick: the prompt, the mood, the games drawn for any scope, the pick and its fallback."""

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from platjourney_ai import llm, next_pick
from platjourney_ai.config import settings
from platjourney_ai.main import app
from platjourney_ai.next_pick import Choice, NextRequest, build_input, line

HEADERS = {'x-internal-token': settings.ai_token}

STARTED = Choice(
    game='game:1',
    name='Days Gone',
    owned=True,
    progress=40,
    hours_played=30,
    difficulty=3,
    hours=70,
    playthroughs=1,
    has_missables=False,
    has_online=False,
)
NEW = Choice(game='game:2', name='Inside', difficulty=2, hours=5, has_missables=True)


def test_each_saved_game_reads_with_its_numbers() -> None:
    assert line(STARTED) == (
        '- game:1 — Days Gone; 40% feito, 30h jogadas; dificuldade 3/10; ~70h até a platina; '
        '1 jogada(s)'
    )
    assert (
        line(NEW) == '- game:2 — Inside; ainda não começou; dificuldade 2/10; ~5h até a platina; '
        'tem perdíveis'
    )


def test_the_prompt_has_the_games_the_last_platinums_the_taste_and_the_language() -> None:
    req = NextRequest.model_validate(
        {
            'choices': [STARTED.model_dump(by_alias=True)],
            'recent': [{'name': 'Elden Ring', 'hours': 100, 'difficulty': 6}],
            'profile': 'Gosta de mundo aberto',
            'locale': 'en',
        }
    )
    text = build_input(req)
    assert '- Elden Ring; ~100h; dificuldade 6/10' in text
    assert 'Taste: Gosta de mundo aberto' in text
    assert text.endswith('Write in English.')
    assert '- none yet' in build_input(NextRequest(choices=[NEW]))


def test_the_game_being_played_goes_as_context_not_as_an_option() -> None:
    req = NextRequest.model_validate(
        {
            'choices': [NEW.model_dump(by_alias=True)],
            'playing': [{'name': 'Days Gone', 'progress': 74}],
        }
    )
    assert 'Playing now:\n- Days Gone; 74% feito\n\n' in build_input(req)
    assert 'Playing now' not in build_input(NextRequest(choices=[NEW]))


async def test_the_pick_is_the_game_the_answer_names(monkeypatch: pytest.MonkeyPatch) -> None:
    answers = iter(
        [
            {'game': 'game:2', 'name': 'Inside', 'why': 'Curto', 'firstStep': 'Comece'},
            # A model that copies the whole line still names its game.
            {'game': 'game:2 — Inside', 'name': 'Inside', 'why': 'x', 'firstStep': 'y'},
            {'game': '', 'name': 'days gone', 'why': 'x', 'firstStep': 'y'},
            # Naming no listed game: no pick, rather than another game under this text.
            {'game': 'game:99', 'name': 'Hellblade II', 'why': 'x', 'firstStep': 'y'},
        ]
    )

    async def respond(**_: Any) -> Any:
        return SimpleNamespace(output_text=json.dumps(next(answers)))

    monkeypatch.setattr(llm, 'respond', respond)
    req = NextRequest(choices=[STARTED, NEW])
    first = await next_pick.next_pick(req)
    assert first and (first.game, first.why, first.first_step) == ('game:2', 'Curto', 'Comece')
    copied = await next_pick.next_pick(req)
    assert copied and copied.game == 'game:2'
    by_name = await next_pick.next_pick(req)
    assert by_name and by_name.game == 'game:1'
    assert await next_pick.next_pick(req) is None
    assert await next_pick.next_pick(NextRequest(choices=[])) is None


def test_the_route_answers_with_the_pick(monkeypatch: pytest.MonkeyPatch) -> None:
    async def respond(**_: Any) -> Any:
        return SimpleNamespace(
            output_text=json.dumps({'game': 'game:1', 'why': 'w', 'firstStep': 'f'})
        )

    monkeypatch.setattr(llm, 'respond', respond)
    res = TestClient(app).post(
        '/pick',
        json={'choices': [STARTED.model_dump(by_alias=True)]},
        headers=HEADERS,
    )
    assert res.json() == {'game': 'game:1', 'why': 'w', 'firstStep': 'f', 'fits': True}


def test_the_mood_leads_the_prompt_and_the_list_says_where_it_comes_from() -> None:
    text = build_input(NextRequest(choices=[NEW], mood='algo curto pra relaxar'))
    assert text.startswith('Right now the player feels like: algo curto pra relaxar\n\n')
    assert 'Games the player saved to platinum:' in text
    owned = build_input(NextRequest(choices=[NEW], scope='any'))
    assert 'Games the player already has' in owned and 'feels like' not in owned


async def test_any_game_is_drawn_by_taste_with_its_guide_numbers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from platjourney_ai.taste import Candidate

    seen: dict[str, Any] = {}

    async def guided() -> list[str]:
        return ['game:7', 'game:8']

    async def graph(req: Any, ids: list[str]) -> list[Candidate]:
        seen['exclude'] = req.exclude
        return [Candidate(id='game:7', name='Journey', genres=['Adventure'], similar_to=['Abzu'])]

    async def vector(req: Any, ids: list[str], drawn: Any, wanted: int) -> list[Candidate]:
        seen['wanted'] = wanted
        return [Candidate(id='game:8', name='Unguided')]

    async def rows(ids: list[str]) -> dict[str, dict[str, Any]]:
        return {'game:7': {'difficulty': 1, 'hours': 3, 'playthroughs': 2, 'has_online': True}}

    async def respond(**params: Any) -> Any:
        seen['input'] = params['input']
        return SimpleNamespace(
            output_text=json.dumps(
                {'game': 'game:7', 'name': 'Journey', 'why': 'w', 'firstStep': 'f', 'fits': False}
            )
        )

    monkeypatch.setattr(next_pick, 'guided_games', guided)
    monkeypatch.setattr(next_pick, 'graph_draw', graph)
    monkeypatch.setattr(next_pick, 'vector_draw', vector)
    monkeypatch.setattr(next_pick, 'guide_rows', rows)
    monkeypatch.setattr(llm, 'respond', respond)
    req = NextRequest.model_validate(
        {
            'scope': 'any',
            'mood': 'fácil',
            'draw': {'library': [], 'exclude': ['game:1'], 'candidates': ['game:7']},
        }
    )
    pick = await next_pick.next_pick(req)
    assert pick and (pick.game, pick.fits) == ('game:7', False)
    assert seen['exclude'] == ['game:1'] and seen['wanted'] == next_pick.CANDIDATES - 1
    # Only guided games go to the model, with their numbers and what they resemble.
    assert "Games picked for the player's taste" in seen['input']
    assert (
        '- game:7 — Journey; ainda não começou; dificuldade 1/10; ~3h até a platina; '
        '2 jogada(s); tem troféus online; Adventure; parecido com Abzu'
    ) in seen['input']
    assert 'Unguided' not in seen['input']
