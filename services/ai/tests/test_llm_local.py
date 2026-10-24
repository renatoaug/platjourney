from types import SimpleNamespace
from typing import Any

import pytest

from platjourney_ai import llm
from platjourney_ai.config import settings
from platjourney_ai.costs import CostTag, Usage, cost_usd, current_tag


def test_instructions_and_turns_become_chat_messages() -> None:
    messages = llm.chat_messages(
        {
            'instructions': 'Você é o Nexo.',
            'input': [
                {'role': 'user', 'content': 'oi'},
                {'role': 'assistant', 'content': 'e aí'},
                {'role': 'user', 'content': 'qual o próximo troféu?'},
            ],
        }
    )
    assert messages == [
        {'role': 'system', 'content': 'Você é o Nexo.'},
        {'role': 'user', 'content': 'oi'},
        {'role': 'assistant', 'content': 'e aí'},
        {'role': 'user', 'content': 'qual o próximo troféu?'},
    ]


def test_a_plain_input_is_one_user_message() -> None:
    assert llm.chat_messages({'input': 'Games:\n- Destiny 2'}) == [
        {'role': 'user', 'content': 'Games:\n- Destiny 2'}
    ]


def test_json_schema_output_becomes_response_format() -> None:
    schema: dict[str, Any] = {
        'type': 'object',
        'properties': {},
        'required': [],
        'additionalProperties': False,
    }
    params: dict[str, Any] = {
        'text': {'format': {'type': 'json_schema', 'name': 'plan', 'schema': schema}}
    }
    assert llm.chat_format(params) == {
        'type': 'json_schema',
        'json_schema': {'name': 'plan', 'schema': schema, 'strict': True},
    }
    assert llm.chat_format({}) is None


def test_local_calls_cost_nothing() -> None:
    assert cost_usd('local/qwen3-8b', Usage(input=1_000_000, output=1_000_000)) == 0


async def test_local_provider_drops_web_search_and_uses_the_local_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    async def create(**kwargs: Any) -> Any:
        seen.update(kwargs)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='Oi!'))],
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=3),
        )

    recorded: list[str] = []

    async def record(model: str, u: Usage, ms: int) -> None:
        recorded.append(model)

    monkeypatch.setattr(settings, 'ai_provider', 'local')
    monkeypatch.setattr(settings, 'local_model', 'qwen3-8b')
    monkeypatch.setattr(llm.local.chat.completions, 'create', create)
    monkeypatch.setattr(llm, 'record_call', record)
    reply = await llm.respond(
        model='gpt-5.5',
        instructions='Você é o Nexo.',
        tools=[{'type': 'web_search'}],
        reasoning={'effort': 'low'},
        input='oi',
    )
    assert reply.output_text == 'Oi!'
    assert seen['model'] == 'qwen3-8b'
    assert 'tools' not in seen and 'reasoning' not in seen
    assert seen['extra_body'] == {'reasoning_effort': 'none'}
    assert seen['max_tokens'] == 2000
    assert recorded == ['local/qwen3-8b']


async def test_local_embeddings_use_the_local_model(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    async def create(**kwargs: Any) -> Any:
        seen.update(kwargs)
        return SimpleNamespace(
            data=[SimpleNamespace(index=0, embedding=[0.1, 0.2])],
            usage=SimpleNamespace(prompt_tokens=4),
        )

    async def record(model: str, u: Usage, ms: int) -> None:
        seen['recorded'] = model

    monkeypatch.setattr(settings, 'embedding_provider', 'local')
    monkeypatch.setattr(settings, 'local_embedding_model', 'nomic-embed-text')
    monkeypatch.setattr(llm.local.embeddings, 'create', create)
    monkeypatch.setattr(llm, 'record_call', record)
    assert await llm.embed(['Bloodborne']) == [[0.1, 0.2]]
    assert seen['model'] == 'nomic-embed-text'
    assert seen['recorded'] == 'local/nomic-embed-text'


async def test_web_search_off_drops_the_tool_on_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict[str, Any] = {}

    async def create(**kwargs: Any) -> Any:
        seen.update(kwargs)
        return SimpleNamespace(output_text='{}', usage=None, output=[], model='gpt-5.5')

    async def record(model: str, u: Usage, ms: int) -> None:
        pass

    monkeypatch.setattr(settings, 'ai_provider', 'openai')
    monkeypatch.setattr(settings, 'ai_web_search', False)
    monkeypatch.setattr(llm.openai.responses, 'create', create)
    monkeypatch.setattr(llm, 'record_call', record)
    await llm.respond(model='gpt-5.5', tools=[{'type': 'web_search'}], input='oi')
    assert 'tools' not in seen
    await llm.research_json('x', 'Find it.', 'input', {'type': 'object'})
    assert 'Web search is not available' in seen['instructions']
    assert 'tools' not in seen


def tag(action: str) -> None:
    current_tag.set(CostTag(user='user:1', action=action))


def test_each_feature_can_have_its_own_provider_and_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'local')
    monkeypatch.setattr(settings, 'local_model', 'qwen3-8b')
    monkeypatch.setattr(settings, 'openai_model', 'gpt-5.5')
    monkeypatch.setattr(settings, 'ai_model_chat', 'openai:gpt-5-mini')
    monkeypatch.setattr(settings, 'ai_model_plan', 'openai')
    monkeypatch.setattr(settings, 'ai_model_recommend', 'local:qwen3.6:35b-a3b')
    tag('chat')
    assert llm.route() == llm.Route('openai', 'gpt-5-mini')
    tag('plan')
    assert llm.route() == llm.Route('openai', 'gpt-5.5')
    tag('recommend')
    assert llm.route() == llm.Route('local', 'qwen3.6:35b-a3b')
    tag('tip')
    assert llm.route() == llm.Route('local', 'qwen3-8b')
    tag('other')
    assert llm.route() == llm.Route('local', 'qwen3-8b')


def test_the_search_step_has_its_own_model_and_a_small_one_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'openai')
    monkeypatch.setattr(settings, 'openai_model', 'gpt-5.5')
    monkeypatch.setattr(settings, 'ai_model_chat', '')
    monkeypatch.setattr(settings, 'ai_model_search', '')
    tag('chat')
    # The translation runs inside the chat request, on its own model.
    assert llm.route('search') == llm.Route('openai', 'gpt-5.4-nano')
    assert llm.route() == llm.Route('openai', 'gpt-5.5')
    monkeypatch.setattr(settings, 'ai_model_search', 'local:qwen3-8b')
    assert llm.route('search') == llm.Route('local', 'qwen3-8b')
    monkeypatch.setattr(settings, 'ai_model_search', '')
    monkeypatch.setattr(settings, 'ai_provider', 'local')
    monkeypatch.setattr(settings, 'local_model', 'qwen3-8b')
    assert llm.route('search') == llm.Route('local', 'qwen3-8b')


async def test_the_feature_route_picks_the_client_and_the_web_search(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, Any] = {}

    async def create(**kwargs: Any) -> Any:
        seen.update(kwargs)
        return SimpleNamespace(output_text='Oi!', usage=None, output=[], model='gpt-5-mini')

    async def local_create(**kwargs: Any) -> Any:
        raise AssertionError('the chat must not go to the local server')

    async def record(model: str, u: Usage, ms: int) -> None:
        seen['recorded'] = model

    monkeypatch.setattr(settings, 'ai_provider', 'local')
    monkeypatch.setattr(settings, 'ai_model_chat', 'openai:gpt-5-mini')
    monkeypatch.setattr(llm.openai.responses, 'create', create)
    monkeypatch.setattr(llm.local.chat.completions, 'create', local_create)
    monkeypatch.setattr(llm, 'record_call', record)
    tag('chat')
    assert llm.web_search_on()
    await llm.respond(instructions='Você é o Nexo.', tools=[{'type': 'web_search'}], input='oi')
    assert seen['model'] == 'gpt-5-mini'
    assert seen['tools'] == [{'type': 'web_search'}]
    assert seen['recorded'] == 'gpt-5-mini'
    tag('tip')
    assert not llm.web_search_on()
