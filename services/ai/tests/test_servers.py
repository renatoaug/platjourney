from typing import Any

import pytest

from platjourney_ai import llm, servers


async def test_check_asks_for_each_game_with_the_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    async def fake(name: str, instructions: str, input: str, schema: dict[str, Any]) -> Any:
        seen.update(name=name, instructions=instructions, input=input, schema=schema)
        return {'games': []}

    monkeypatch.setattr(llm, 'research_json', fake)
    await servers.check(['Destiny 2', 'The Division'])
    assert seen['name'] == 'server_status'
    assert seen['input'] == 'Games:\n- Destiny 2\n- The Division'
    assert seen['schema'] is servers.SCHEMA
    assert 'PlayStation online server shutdowns' in seen['instructions']
