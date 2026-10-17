import json
from pathlib import Path
from typing import Any

import pytest

from platjourney_ai import llm
from platjourney_ai.config import settings
from platjourney_ai.costs import CostTag, Usage, cost_usd, current_tag


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def read_json(path: str) -> Any:
    return json.loads(Path(path).read_text())


class FakeProcess:
    """`codex exec` as the test wants it: it writes the answer file, or fails."""

    def __init__(self, args: tuple[str, ...], answer: str | None, code: int = 0) -> None:
        self.args = args
        self.answer = answer
        self.returncode = code
        self.prompt = ''

    async def communicate(self, data: bytes) -> tuple[bytes, bytes]:
        self.prompt = data.decode()
        if self.answer is not None:
            write(self.args[self.args.index('-o') + 1], self.answer)
        return b'', b'' if self.returncode == 0 else b'not signed in'


def fake_codex(
    monkeypatch: pytest.MonkeyPatch, answer: str | None, code: int = 0
) -> tuple[list[FakeProcess], list[Any]]:
    runs: list[FakeProcess] = []
    recorded: list[Any] = []

    async def spawn(*args: str, **_: Any) -> FakeProcess:
        proc = FakeProcess(args, answer, code)
        # The schema file is gone once the call returns: read it while it exists.
        if '--output-schema' in args:
            proc.schema = read_json(args[args.index('--output-schema') + 1])  # type: ignore[attr-defined]
        runs.append(proc)
        return proc

    async def record(model: str, usage: Usage, ms: int) -> None:
        recorded.append((model, usage))

    monkeypatch.setattr(llm.asyncio, 'create_subprocess_exec', spawn)
    monkeypatch.setattr(llm, 'record_call', record)
    return runs, recorded


def test_a_feature_can_run_on_codex(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'openai')
    monkeypatch.setattr(settings, 'openai_model', 'gpt-5.5')
    monkeypatch.setattr(settings, 'ai_model_judge', 'codex:gpt-5.4')
    current_tag.set(CostTag(action='judge'))
    try:
        assert llm.route() == llm.Route('codex', 'gpt-5.4')
        monkeypatch.setattr(settings, 'ai_model_judge', '')
        monkeypatch.setattr(settings, 'ai_provider', 'codex')
        assert llm.route() == llm.Route('codex', 'gpt-5.5')
    finally:
        current_tag.set(CostTag())


async def test_codex_answers_with_the_schema_and_costs_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'codex')
    monkeypatch.setattr(settings, 'openai_model', 'gpt-5.6-terra')
    monkeypatch.setattr(settings, 'ai_web_search', False)
    runs, recorded = fake_codex(monkeypatch, ' {"score": 5} \n')
    schema = {'type': 'object', 'properties': {'score': {'type': 'integer'}}, 'required': ['score']}

    reply = await llm.respond(
        instructions='Você é o juiz.',
        input='Pergunta: como pego o troféu?',
        reasoning={'effort': 'low'},
        tools=[{'type': 'web_search'}],
        text={'format': {'type': 'json_schema', 'name': 'verdict', 'schema': schema}},
    )

    assert reply.output_text == '{"score": 5}'
    (run,) = runs
    args = list(run.args)
    assert args[:2] == ['codex', 'exec']  # web search off: no --search
    assert args[args.index('-m') + 1] == 'gpt-5.6-terra'
    assert 'model_reasoning_effort=low' in args
    assert args[args.index('-s') + 1] == 'read-only'
    assert run.schema == schema  # type: ignore[attr-defined]
    assert 'Você é o juiz.' in run.prompt and 'como pego o troféu?' in run.prompt
    assert recorded == [('local/codex:gpt-5.6-terra', Usage())]
    assert cost_usd('local/codex:gpt-5.6-terra', Usage(input=10_000)) == 0


async def test_codex_searches_the_web_only_when_asked_and_allowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'codex')
    monkeypatch.setattr(settings, 'ai_web_search', True)
    runs, _ = fake_codex(monkeypatch, 'Resposta.')

    assert llm.web_search_on()
    await llm.respond(instructions='Nexo.', input='oi', tools=[{'type': 'web_search'}])
    await llm.respond(instructions='Nexo.', input='oi')

    assert runs[0].args[:3] == ('codex', '--search', 'exec')
    assert '--search' not in runs[1].args
    assert '--output-schema' not in runs[1].args


async def test_a_failed_codex_run_raises_with_its_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'codex')
    fake_codex(monkeypatch, None, code=1)

    with pytest.raises(RuntimeError, match='not signed in'):
        await llm.respond(instructions='Nexo.', input='oi')
