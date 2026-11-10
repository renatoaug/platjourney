from typing import Any

import pytest

from platjourney_ai import db, llm, steps
from platjourney_ai.config import settings
from platjourney_ai.costs import Usage, cost_usd
from platjourney_ai.schemas import Trophy


def trophy(id: int, name: str, **extra: Any) -> Trophy:
    return Trophy.model_validate(
        {
            'id': id,
            'name': name,
            'name_en': extra.pop('name_en', ''),
            'detail': f'Faça {name}',
            'type': 'bronze',
            'earned': False,
            **extra,
        }
    )


TROPHIES = [
    trophy(0, 'Platina', type='platinum'),
    trophy(1, 'Prólogo', name_en='Prologue'),
    trophy(2, 'Episódio 3'),
    trophy(3, 'Coleção', earned_rate=12.5),
    trophy(4, 'Sem lugar'),
    trophy(5, 'DLC', group_id='001'),
]
GUIDE = {
    'storyline': {'unit': 'episode', 'total': 4},
    'trophy_places': [
        {'trophy': 'Prologue', 'from': 0},
        {'trophy': 'Episódio 3', 'from': 3},
        {'trophy': 'Coleção', 'from': 1, 'to': 5},
    ],
}


def test_asks_only_about_trophies_without_a_single_moment() -> None:
    planned = steps.plan(GUIDE, TROPHIES)
    assert planned is not None
    state, questions, asked = planned
    # The story trophies are the marks, in their order; platinum and DLC are left out.
    assert 'episode 0: "Prologue"' in state
    assert state.index('Prologue') < state.index('Episódio 3')
    assert sorted(asked) == ['t3', 't4']
    collection = questions['t3']
    assert collection['type'] == 'choice'
    # One option per step, one before the first and one after the story.
    assert list(collection['criteria']) == ['0', '1', '2', '3', '4', '5']
    assert 'from episode 1 to after the story' in collection['instructions']
    assert '12.5% of all players' in collection['instructions']
    assert 'A guide says' not in questions['t4']['instructions']


def test_a_guide_without_a_storyline_or_story_trophies_asks_nothing() -> None:
    assert steps.plan({**GUIDE, 'storyline': None}, TROPHIES) is None
    assert steps.plan({**GUIDE, 'storyline': {'unit': 'room', 'total': 4}}, TROPHIES) is None
    only_counts = {**GUIDE, 'trophy_places': [{'trophy': 'Coleção', 'from': 1, 'to': 5}]}
    assert steps.plan(only_counts, TROPHIES) is None


async def test_stores_the_expected_step_of_each_answer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, 'typesafe_api_key', 'key')
    stored: list[dict[str, Any]] = []

    async def rows(_sql: str, _vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return [{'guide': GUIDE}]

    async def query(_sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
        stored.append(vars or {})
        return []

    async def decide(_state: str, questions: dict[str, Any]) -> dict[str, Any]:
        assert set(questions) == {'t3', 't4'}
        return {
            't3': {'choice': '2', 'probabilities': {'1': 0.25, '2': 0.5, '3': 0.25}},
            't4': {'choice': '5', 'probabilities': {'5': 1.0}},
        }

    monkeypatch.setattr(db, 'rows', rows)
    monkeypatch.setattr(db, 'query', query)
    monkeypatch.setattr(llm, 'decide', decide)
    found = await steps.predict('game:1', 'Jogo', TROPHIES)
    assert found == [{'trophy': 'Coleção', 'step': 2}, {'trophy': 'Sem lugar', 'step': 5}]
    assert stored == [{'game': 'game:1', 'steps': found}]


async def test_without_a_key_or_with_an_answer_already_it_calls_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail(*_args: Any) -> Any:
        raise AssertionError('no call expected')

    monkeypatch.setattr(llm, 'decide', fail)
    monkeypatch.setattr(db, 'query', fail)
    monkeypatch.setattr(settings, 'typesafe_api_key', '')
    assert await steps.predict('game:1', 'Jogo', TROPHIES) == []

    monkeypatch.setattr(settings, 'typesafe_api_key', 'key')
    kept = [{'trophy': 'Coleção', 'step': 3}]

    async def rows(_sql: str, _vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return [{'guide': {**GUIDE, 'predicted_steps': kept}}]

    monkeypatch.setattr(db, 'rows', rows)
    assert await steps.predict('game:1', 'Jogo', TROPHIES) == kept


def test_the_decision_model_costs_its_input_only() -> None:
    usage = Usage(input=1_000_000, output=1_000_000)
    assert cost_usd('jev-1.14.0', usage) == 0.042
    assert cost_usd('jev-latest', usage) == 0.042


async def test_decide_sends_the_questions_and_records_the_input(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import httpx

    from platjourney_ai.costs import collected

    sent: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(
            200,
            json={
                'model': 'jev-1.14.0',
                'answers': {'t3': {'choice': '2', 'probabilities': {'2': 1.0}}},
                'usage': {'input_tokens': 500, 'output_tokens': 10},
            },
        )

    real = httpx.AsyncClient

    def client(timeout: float) -> httpx.AsyncClient:
        return real(transport=httpx.MockTransport(handler), timeout=timeout)

    monkeypatch.setattr(llm.httpx, 'AsyncClient', client)
    monkeypatch.setattr(settings, 'typesafe_api_key', 'key')
    calls: list[dict[str, Any]] = []
    collected.set(calls)
    answers = await llm.decide('state', {'t3': {'type': 'choice'}})
    assert answers['t3']['choice'] == '2'
    assert sent[0].headers['authorization'] == 'Bearer key'
    assert calls[0]['model'] == 'jev-1.14.0' and calls[0]['input_tokens'] == 500
