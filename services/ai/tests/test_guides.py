"""The guide research: its prompt, schema and route, with the model mocked."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from platjourney_ai import guide, llm
from platjourney_ai.config import settings
from platjourney_ai.main import app
from platjourney_ai.schemas import Game, Trophy

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


GAME = Game.model_validate({'id': 'game:2', 'name': 'Far Cry 3', 'platforms': ['PC', 'PS3', 'PS4']})


def test_trophy_list_formats_english_first() -> None:
    trophies = [Trophy.model_validate(trophy()), Trophy.model_validate(trophy(type='platinum'))]
    assert guide.trophy_list(trophies) == (
        '- [gold] Survivor (pt-BR: Sobrevivente): Finish the game\n'
        '- [platinum] Survivor (pt-BR: Sobrevivente): Finish the game'
    )


def test_guide_prompt_with_the_trophy_list() -> None:
    trophies = [Trophy.model_validate(trophy())]
    edition = guide.Edition(name='Far Cry 3 Classic Edition', platform='PS4')
    instructions, input = guide.prompt(GAME, trophies, edition)
    assert instructions == f'{guide.INSTRUCTIONS} Use only trophy names from the provided list.'
    assert input == (
        'Game: Far Cry 3 Classic Edition (PS4 trophy list)\n\nTrophy list:\n'
        '- [gold] Survivor (pt-BR: Sobrevivente): Finish the game'
    )


def test_guide_prompt_by_name_uses_the_catalog_platforms() -> None:
    instructions, input = guide.prompt(GAME, None, None)
    assert instructions.startswith(guide.INSTRUCTIONS)
    assert 'official trophy names' in instructions
    assert input == 'Game: Far Cry 3 (PS3/PS4)'


def test_guide_prompt_falls_back_to_playstation() -> None:
    game = Game.model_validate({'id': 'game:3', 'name': 'X', 'platforms': ['PC']})
    assert guide.prompt(game, None, None)[1] == 'Game: X (PlayStation)'


def test_guide_prompt_with_an_empty_list_still_counts_as_a_list() -> None:
    assert 'Trophy list:' in guide.prompt(GAME, [], None)[1]


def test_guide_schema_is_strict() -> None:
    assert_strict(guide.SCHEMA)
    assert len(guide.SCHEMA['required']) == 23
    assert guide.SCHEMA['properties']['easiest']['type'] == ['object', 'null']


async def test_research_calls_research_json(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str, str, dict[str, Any]]] = []

    async def research_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        calls.append((name, instructions, input, schema))
        return {'difficulty': 3}

    monkeypatch.setattr(llm, 'research_json', research_json)
    assert await guide.research(GAME) == {'difficulty': 3}
    assert calls == [('platinum_guide', *guide.prompt(GAME, None, None), guide.SCHEMA)]


def test_guide_route(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str, str]] = []

    async def research_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        calls.append((name, instructions, input))
        return {'difficulty': 3}

    monkeypatch.setattr(llm, 'research_json', research_json)
    res = TestClient(app).post(
        '/guides/research',
        json={
            'game': {**GAME.model_dump(by_alias=True), 'slug': 'far-cry-3'},
            'trophies': [trophy()],
            'edition': {'name': 'Far Cry 3', 'platform': 'PS3'},
        },
        headers=HEADERS,
    )
    assert res.status_code == 200
    assert res.json() == {'difficulty': 3}
    assert calls[0][2].startswith('Game: Far Cry 3 (PS3 trophy list)')


def test_guide_route_without_a_trophy_list(monkeypatch: pytest.MonkeyPatch) -> None:
    inputs: list[str] = []

    async def research_json(name: str, instructions: str, input: str, schema: Any) -> Any:
        inputs.append(input)
        return {}

    monkeypatch.setattr(llm, 'research_json', research_json)
    res = TestClient(app).post(
        '/guides/research',
        json={'game': GAME.model_dump(by_alias=True), 'trophies': None, 'edition': None},
        headers=HEADERS,
    )
    assert res.status_code == 200
    assert inputs == ['Game: Far Cry 3 (PS3/PS4)']
