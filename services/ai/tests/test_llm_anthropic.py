from typing import Any

import pytest
from anthropic.types.beta import BetaMessage

from platjourney_ai import llm
from platjourney_ai.config import settings
from platjourney_ai.costs import CostTag, Usage, cost_usd, current_tag


def message(content: list[dict[str, Any]], stop: str = 'end_turn', **usage: Any) -> BetaMessage:
    return BetaMessage.model_validate(
        {
            'id': 'msg_1',
            'type': 'message',
            'role': 'assistant',
            'model': 'claude-opus-5-5',
            'content': content,
            'stop_reason': stop,
            'usage': {'input_tokens': 10, 'output_tokens': 5, **usage},
        }
    )


def text(value: str, **extra: Any) -> dict[str, Any]:
    return {'type': 'text', 'text': value, **extra}


class Fake:
    """The requests sent to Anthropic; each answers with the next queued message."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.replies: list[BetaMessage] = []

    async def create(self, **kwargs: Any) -> BetaMessage:
        self.sent.append(kwargs)
        return self.replies.pop(0)


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> Fake:
    fake = Fake()
    monkeypatch.setattr(llm.anthropic.beta.messages, 'create', fake.create)
    return fake


@pytest.fixture
def recorded(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, Usage]]:
    out: list[tuple[str, Usage]] = []

    async def record(model: str, u: Usage, ms: int) -> None:
        out.append((model, u))

    monkeypatch.setattr(llm, 'record_call', record)
    return out


def test_a_feature_routed_to_anthropic_runs_its_model_or_the_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, 'ai_model_tip', 'anthropic:claude-haiku-5-5')
    current_tag.set(CostTag(action='tip'))
    assert llm.route() == llm.Route('anthropic', 'claude-haiku-5-5')
    monkeypatch.setattr(settings, 'ai_model_tip', 'anthropic')
    assert llm.route() == llm.Route('anthropic', 'claude-opus-5-5')
    monkeypatch.setattr(settings, 'ai_provider', 'anthropic')
    assert llm.route('search') == llm.Route('anthropic', 'claude-haiku-5-5')
    assert llm.web_search_on()


def test_a_responses_request_becomes_a_messages_request() -> None:
    schema: dict[str, Any] = {'type': 'object', 'properties': {}, 'additionalProperties': False}
    request = llm.anthropic_request(
        {
            'instructions': 'Você é o Nexo.',
            'input': [
                {'role': 'user', 'content': 'oi'},
                {'role': 'assistant', 'content': 'e aí'},
                {'role': 'user', 'content': 'qual o próximo troféu?'},
            ],
            'tools': [{'type': 'web_search'}],
            'tool_choice': {'type': 'web_search'},
            'reasoning': {'effort': 'low'},
            'max_output_tokens': 1500,
            'text': {'format': {'type': 'json_schema', 'name': 'plan', 'schema': schema}},
        },
        'claude-opus-5-5',
    )
    assert request == {
        'model': 'claude-opus-5-5',
        'max_tokens': 1500,
        'system': 'Você é o Nexo.' + llm.MUST_SEARCH,
        'messages': [
            {'role': 'user', 'content': 'oi'},
            {'role': 'assistant', 'content': 'e aí'},
            {'role': 'user', 'content': 'qual o próximo troféu?'},
        ],
        'tools': [llm.WEB_SEARCH_TOOL],
        'output_config': {'effort': 'low', 'format': {'type': 'json_schema', 'schema': schema}},
        'betas': [llm.FALLBACK_BETA],
        'fallbacks': 'default',
    }


def test_haiku_gets_the_basic_search_and_no_fallback() -> None:
    request = llm.anthropic_request(
        {'input': 'oi', 'tools': [{'type': 'web_search'}], 'reasoning': {'effort': 'minimal'}},
        'claude-haiku-5-5',
    )
    assert request['tools'] == [llm.BASIC_WEB_SEARCH_TOOL]
    assert request['output_config'] == {'effort': 'low'}
    assert request['max_tokens'] == 16000
    assert 'fallbacks' not in request and 'betas' not in request and 'system' not in request


async def test_web_search_off_sends_no_search_tool(
    monkeypatch: pytest.MonkeyPatch,
    calls: Fake,
    recorded: list[tuple[str, Usage]],
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'anthropic')
    monkeypatch.setattr(settings, 'ai_web_search', False)
    calls.replies.extend([message([text('Oi!')])])
    reply = await llm.respond(
        instructions='Você é o Nexo.', tools=[{'type': 'web_search'}], input='oi'
    )
    assert reply == llm.Reply('Oi!')
    assert 'tools' not in calls.sent[0]


async def test_the_answer_its_sources_and_its_cost_are_read_from_the_message(
    monkeypatch: pytest.MonkeyPatch,
    calls: Fake,
    recorded: list[tuple[str, Usage]],
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'anthropic')
    cite = {
        'type': 'web_search_result_location',
        'url': 'https://a.example/guide',
        'title': 'Guide',
        'cited_text': 'x',
        'encrypted_index': 'e',
    }
    found = {
        'type': 'web_search_result',
        'url': 'https://b.example/map',
        'title': 'Map',
        'encrypted_content': 'e',
    }
    calls.replies.append(
        message(
            [
                {'type': 'server_tool_use', 'id': 's1', 'name': 'web_search', 'input': {}},
                {'type': 'web_search_tool_result', 'tool_use_id': 's1', 'content': [found]},
                text('São 9 gangues.', citations=[cite]),
            ],
            cache_read_input_tokens=100,
            cache_creation_input_tokens=20,
            server_tool_use={'web_search_requests': 1, 'web_fetch_requests': 0},
        )
    )
    reply = await llm.respond(tools=[{'type': 'web_search'}], input='quantas gangues?')
    assert reply == llm.Reply(
        'São 9 gangues.', searches=1, urls=('https://a.example/guide', 'https://b.example/map')
    )
    assert recorded == [('claude-opus-5-5', Usage(input=130, cached=100, output=5, searches=1))]


async def test_a_paused_search_is_resumed_and_counted_once(
    monkeypatch: pytest.MonkeyPatch,
    calls: Fake,
    recorded: list[tuple[str, Usage]],
) -> None:
    monkeypatch.setattr(settings, 'ai_provider', 'anthropic')
    calls.replies.extend(
        [message([text('Procurando. ')], stop='pause_turn'), message([text('Achei.')])]
    )
    reply = await llm.respond(input='onde fica?')
    assert reply.output_text == 'Procurando. Achei.'
    assert len(calls.sent) == 2
    assert calls.sent[1]['messages'][-1]['role'] == 'assistant'
    assert recorded[0][1] == Usage(input=20, output=10)


def test_claude_calls_have_a_price() -> None:
    cost = cost_usd('claude-haiku-5-5', Usage(input=1_000_000, output=1_000_000))
    assert cost == pytest.approx(0.6)
