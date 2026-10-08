"""The eval tooling without the model or a database: calls collected instead of stored, runs and
questions written to the evals store, the example questions, and the stored guide read as the
server sends it."""

import json
from pathlib import Path
from typing import Any

import pytest

from evals import answers, questions, runs, store
from platjourney_ai import costs, db, nexo
from platjourney_ai.costs import Usage


class FakeStore:
    """Records every statement sent to the evals database and answers like SurrealDB would."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []
        self.questions: list[dict[str, Any]] = []

    async def query(self, sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
        self.sent.append((sql, vars or {}))
        if sql.startswith('CREATE eval_run'):
            return [[{'id': 'eval_run:r1'}]]
        if sql.startswith('SELECT data FROM eval_question'):
            return [[{'data': q} for q in self.questions]]
        return [[]]

    async def rows(self, sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        results = await self.query(sql, vars)
        return results[-1] if results else []


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> FakeStore:
    f = FakeStore()
    monkeypatch.setattr(store, 'query', f.query)
    monkeypatch.setattr(store, 'rows', f.rows)
    return f


def ctx() -> Any:
    return nexo.GameContext.model_validate(
        {
            'game': {'id': 'game:1', 'name': 'Days Gone'},
            'title': {
                'name': 'Days Gone',
                'platform': 'PS4',
                'progress': 0,
                'earned': 0,
                'total': 1,
            },
            'trophies': [],
        }
    )


async def test_an_eval_collects_its_calls_and_writes_nothing_to_the_app(
    monkeypatch: pytest.MonkeyPatch, fake: FakeStore
) -> None:
    writes: list[Any] = []

    async def query(*args: Any) -> None:
        writes.append(args)

    monkeypatch.setattr(db, 'query', query)
    run = runs.Run('scope')

    async def work() -> str:
        await costs.record_call('gpt-5.6-terra', Usage(input=1_000_000), 10)
        await nexo.record_gap(ctx(), 'pergunta sem trecho')
        return 'resposta'

    result, calls = await run.measure(work())
    assert result == 'resposta'
    assert [c['model'] for c in calls] == ['gpt-5.6-terra']
    assert calls[0]['cost_usd'] == 2
    assert writes == []
    # Outside an eval, the same call is stored with the app's costs as before.
    await costs.record_call('gpt-5.6-terra', Usage(input=1), 10)
    assert len(writes) == 1


async def test_a_run_records_its_version_each_case_as_it_goes_and_its_end(
    monkeypatch: pytest.MonkeyPatch, fake: FakeStore
) -> None:
    monkeypatch.setattr(runs, 'git_commit', lambda: 'abc1234')
    monkeypatch.setattr(runs, 'version', lambda: '0.1.2')
    run = runs.Run('answers', prompt='p1')
    assert await run.start(2) == 'eval_run:r1'
    assert fake.sent[0][1]['data'] == {
        'suite': 'answers',
        'version': '0.1.2',
        'commit': 'abc1234',
        'prompt': 'p1',
        'planned': 2,
    }
    call = {'model': 'gpt-5.6-terra', 'cost_usd': 0.01}
    await run.case(
        question='eval_question:q1',
        input='q',
        passed=True,
        score=5,
        calls=[call, call | {'model': 'judge'}],
        game='Days Gone',
    )
    case = fake.sent[1][1]
    assert case['row']['models'] == ['gpt-5.6-terra', 'judge']
    assert case['row']['extra'] == {'game': 'Days Gone'}
    assert (case['passed'], case['total'], case['cost']) == (1, 1, 0.02)
    # A case without a score leaves the field out: SurrealDB refuses null in an optional field.
    await run.case(input='q2', passed=False)
    assert 'score' not in fake.sent[2][1]['row']
    del fake.sent[2]
    await run.finish({'mean score': '5.00/5'})
    assert "status = 'done'" in fake.sent[2][0]
    await run.fail('boom')
    assert fake.sent[3][1]['error'] == 'boom'


def test_the_version_comes_from_the_root_package_json() -> None:
    root = Path(__file__).resolve().parents[3]
    assert runs.version() == json.loads((root / 'package.json').read_text())['version']


def test_the_example_questions_have_the_fields_each_suite_reads() -> None:
    assert {'game', 'name', 'question', 'relevant'} <= set(questions.examples('retrieval')[0])
    assert {'message', 'forbidden', 'max_chars'} <= set(questions.examples('scope')[0])
    assert {'game', 'question', 'reference'} <= set(questions.examples('answers')[0])


async def test_seeding_adds_only_the_examples_a_suite_does_not_have(fake: FakeStore) -> None:
    examples = questions.examples('scope')
    assert await questions.seed('scope') == len(examples)
    assert fake.sent[-1][0].startswith('INSERT INTO eval_question')
    # A question already there (even edited elsewhere) is matched by its text and left alone.
    fake.questions = [examples[0] | {'forbidden': ['edited']}]
    assert await questions.seed('scope') == len(examples) - 1
    fake.questions = examples
    sent = len(fake.sent)
    assert await questions.seed('scope') == 0
    assert len(fake.sent) == sent + 1


def test_a_stored_guide_reads_in_camel_case_like_the_server_sends_it() -> None:
    stored = {'early_tips': ['x'], 'most_tedious': {'trophy': 'A'}, 'roadmap': [{'phase': 'F'}]}
    assert answers.camel(stored) == {
        'earlyTips': ['x'],
        'mostTedious': {'trophy': 'A'},
        'roadmap': [{'phase': 'F'}],
    }
