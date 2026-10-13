"""The next platinum among the saved interests: the prompt, the pick and its fallback."""

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


async def test_a_pick_outside_the_list_falls_back_to_the_first(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    answers = iter(
        [
            {'game': 'game:2', 'why': 'Curto', 'firstStep': 'Comece'},
            {'game': 'game:99', 'why': 'x', 'firstStep': 'y'},
        ]
    )

    async def respond(**_: Any) -> Any:
        return SimpleNamespace(output_text=json.dumps(next(answers)))

    monkeypatch.setattr(llm, 'respond', respond)
    req = NextRequest(choices=[STARTED, NEW])
    first = await next_pick.next_pick(req)
    assert first and (first.game, first.why, first.first_step) == ('game:2', 'Curto', 'Comece')
    second = await next_pick.next_pick(req)
    assert second and second.game == 'game:1'
    assert await next_pick.next_pick(NextRequest(choices=[])) is None


def test_the_route_answers_with_the_pick(monkeypatch: pytest.MonkeyPatch) -> None:
    async def respond(**_: Any) -> Any:
        return SimpleNamespace(
            output_text=json.dumps({'game': 'game:1', 'why': 'w', 'firstStep': 'f'})
        )

    monkeypatch.setattr(llm, 'respond', respond)
    res = TestClient(app).post(
        '/interests/next',
        json={'choices': [STARTED.model_dump(by_alias=True)]},
        headers=HEADERS,
    )
    assert res.json() == {'game': 'game:1', 'why': 'w', 'firstStep': 'f'}
