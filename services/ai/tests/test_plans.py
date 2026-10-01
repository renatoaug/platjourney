"""The session plan: its prompt, schema and route, with the model mocked."""

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from platjourney_ai import llm, planner
from platjourney_ai.config import settings
from platjourney_ai.main import app
from platjourney_ai.schemas import GameContext

HEADERS = {'x-internal-token': settings.ai_token}


def trophy(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        'id': 1,
        'name': 'Sobrevivente',
        'detail': 'Termine o jogo',
        'nameEn': 'Survivor',
        'detailEn': 'Finish the game',
        'type': 'gold',
        'earnedRate': 12.5,
        'earned': False,
        'groupId': 'default',
    }
    return base | over


def ctx_payload(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        'game': {'id': 'game:1', 'name': 'Days Gone', 'platforms': ['PS4', 'PC']},
        'title': {'name': 'Days Gone', 'platform': 'PS4', 'progress': 20, 'earned': 2, 'total': 4},
        'trophies': [
            trophy(id=1, name='Antigo', earned=True, earnedAt='2026-01-01T00:00:00Z'),
            trophy(id=2, name='Recente', earned=True, earnedAt='2026-02-01T00:00:00Z'),
            trophy(id=3, name='Coletor', earnedRate=40, progressValue=3, progressTarget=10),
            trophy(id=4, name='Extra', groupId='001'),
        ],
        'guide': {'overview': 'Ação e horda', 'difficulty': 4},
        'hoursPlayed': 7.5,
    }
    return base | over


def ctx(**over: Any) -> GameContext:
    return GameContext.model_validate(ctx_payload(**over))


def test_plan_context_matches_the_server_format() -> None:
    assert planner.context(ctx()) == '\n'.join(
        [
            'Jogo: Days Gone (PS4) — 20% (2/4 troféus)',
            'Tempo jogado: 7.5h',
            'Últimos conquistados: Recente, Antigo',
            'Faltando (2):',
            '- [gold] Coletor (Survivor): Termine o jogo — 40% de quem joga — progresso 3/10',
            '- [gold] Extra (Survivor): Termine o jogo — 12.5% de quem joga — DLC',
            '',
            'Guia (JSON): {"overview":"Ação e horda","difficulty":4}',
        ]
    )


def test_plan_context_leaves_out_what_is_unknown() -> None:
    text = planner.context(ctx(guide=None, hoursPlayed=None))
    assert 'Tempo jogado' not in text
    assert 'Guia' not in text
    assert text.splitlines()[1].startswith('Últimos conquistados')


def test_plan_context_uses_the_progress_the_player_chose() -> None:
    groups = {'base': {'earned': 2, 'total': 3}, 'dlc': {'earned': 0, 'total': 1}}
    assert planner.context(ctx(groups=groups)).startswith(
        'Jogo: Days Gone (PS4) — 67% (2/3 troféus do jogo base)'
    )


def test_plan_input_ends_with_the_time_available() -> None:
    assert planner.plan_input(ctx(), 90).endswith(
        '\n\n---\nTempo disponível nesta sessão: 90 minutos.'
    )
    assert planner.plan_input(ctx(), 90.0).endswith('90 minutos.')


def test_js_number_prints_like_javascript() -> None:
    assert [planner.js_number(n) for n in (12, 12.0, 12.5, 0.1)] == ['12', '12', '12.5', '0.1']


def assert_strict(schema: dict[str, Any]) -> None:
    """What OpenAI's strict structured outputs demand of every object."""
    types = schema.get('type')
    if types == 'object' or (isinstance(types, list) and 'object' in types):
        assert schema['additionalProperties'] is False
        assert set(schema['required']) == set(schema['properties'])
    for sub in schema.get('properties', {}).values():
        assert_strict(sub)
    if 'items' in schema:
        assert_strict(schema['items'])


def test_plan_schema_is_strict() -> None:
    assert_strict(planner.SCHEMA)
    assert planner.SCHEMA['required'] == [
        'summary',
        'steps',
        'totalMinutes',
        'warnings',
        'ifTimeLeft',
    ]


PLAN = {
    'summary': 'Coletáveis do começo',
    'steps': [
        {
            'trophy': 'Coletor',
            'minutes': 30,
            'how': 'Pegue os 7 restantes',
            'why': 'Rende cedo',
            'trick': None,
            'flexible': True,
        }
    ],
    'totalMinutes': 30,
    'warnings': [],
    'ifTimeLeft': None,
}


async def test_plan_session_calls_the_model_as_before(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []

    async def respond(**params: Any) -> Any:
        calls.append(params)
        return SimpleNamespace(output_text=json.dumps(PLAN))

    monkeypatch.setattr(llm, 'respond', respond)
    assert await planner.plan_session(ctx(), 60) == PLAN
    (params,) = calls
    assert params['reasoning'] == {'effort': 'low'}
    assert params['instructions'] == planner.INSTRUCTIONS
    assert params['text']['format'] == {
        'type': 'json_schema',
        'name': 'session_plan',
        'schema': planner.SCHEMA,
        'strict': True,
    }
    assert params['input'] == planner.plan_input(ctx(), 60)


def test_plan_route(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[tuple[GameContext, float]] = []

    async def plan_session(context: GameContext, minutes: float) -> dict[str, Any]:
        seen.append((context, minutes))
        return PLAN

    monkeypatch.setattr(planner, 'plan_session', plan_session)
    res = TestClient(app).post(
        '/plans/session', json={'context': ctx_payload(), 'minutes': 45}, headers=HEADERS
    )
    assert res.status_code == 200
    assert res.json() == PLAN
    assert seen[0][0].game.name == 'Days Gone'
    assert seen[0][1] == 45
