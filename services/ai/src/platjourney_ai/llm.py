"""Every model call goes through here, so its tokens and web searches are recorded.

Three providers: OpenAI (the Responses API, with web search), a local server that speaks the
OpenAI API (chat completions and embeddings) and, for development only, the Codex CLI signed in
on this machine. Features call the same functions either way.
"""

import asyncio
import json
import re
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletion
from openai.types.responses import Response

from .config import settings
from .costs import LOCAL_PREFIX, Usage, current_tag, record_call

# Research calls stream web results and can run for minutes; a hung request must
# not sit for the SDK's default 10 min x 3 attempts.
openai = AsyncOpenAI(api_key=settings.openai_api_key or 'unset', timeout=5 * 60, max_retries=1)
# A local model on a laptop can take minutes on a long context too; nothing to retry.
local = AsyncOpenAI(
    base_url=settings.local_base_url, api_key='local', timeout=10 * 60, max_retries=0
)


@dataclass(frozen=True)
class Reply:
    output_text: str


@dataclass(frozen=True)
class Route:
    provider: Literal['openai', 'local', 'codex']
    model: str


# Steps that run inside another feature's request with a model of their own (the cost still goes
# to that request's tag), and the OpenAI model they use when AI_MODEL_<STEP> is unset.
SMALL_STEPS = frozenset({'search'})


def route(step: str | None = None) -> Route:
    """Where the current request's feature runs: its AI_MODEL_<FEATURE>, else AI_PROVIDER. A
    `step` (the question's translation for the search) picks AI_MODEL_<STEP> instead."""
    chosen = str(getattr(settings, f'ai_model_{step or current_tag.get().action}', '') or '')
    provider, _, model = chosen.partition(':')
    if (provider or settings.ai_provider) == 'local':
        return Route('local', model or settings.local_model)
    default = settings.openai_small_model if step in SMALL_STEPS else settings.openai_model
    if (provider or settings.ai_provider) == 'codex':
        return Route('codex', model or default)
    return Route('openai', model or default)


def web_search_on() -> bool:
    return settings.ai_web_search and route().provider in ('openai', 'codex')


async def respond(step: str | None = None, **params: Any) -> Reply:
    """A Responses API call (instructions, input, tools, reasoning, text); the model comes
    from the feature's route, or the step's."""
    chosen = route(step)
    if chosen.provider == 'local':
        return await _respond_locally(params, chosen.model)
    if chosen.provider == 'codex':
        return await _respond_with_codex(params, chosen.model)
    params = params | {'model': chosen.model}
    if not web_search_on() and params.get('tools'):
        tools = [t for t in params['tools'] if t.get('type') != 'web_search']
        params = {k: v for k, v in params.items() if k != 'tools'} | (
            {'tools': tools} if tools else {}
        )
    started = time.monotonic()
    # Never streamed here, so the overload is always a full Response.
    response = cast(Response, await openai.responses.create(**params))
    usage = response.usage
    await record_call(
        str(params.get('model') or response.model),
        Usage(
            input=usage.input_tokens if usage else 0,
            cached=usage.input_tokens_details.cached_tokens if usage else 0,
            output=usage.output_tokens if usage else 0,
            searches=sum(1 for item in response.output if item.type == 'web_search_call'),
        ),
        int((time.monotonic() - started) * 1000),
    )
    return Reply(response.output_text)


# What a message is refused for, and from which score. Violence and "illicit" are left out:
# games are full of weapons, killing and crafting ("how do I build my own weapon?" scores 0.8 for
# illicit violence). Questions off PlayStation are the system prompt's job, not moderation's.
# Self-harm needs a high score: "100 kills with headshots" and "how do I die less to this boss?"
# score 0.4 once framed as a game question, while "quero me matar" stays above 0.8.
BLOCKED = {
    'sexual': 0.5,
    'sexual/minors': 0.3,
    'hate': 0.5,
    'hate/threatening': 0.5,
    'harassment/threatening': 0.5,
    'self-harm': 0.7,
    'self-harm/intent': 0.7,
    'self-harm/instructions': 0.7,
}
# Moderation reads the message as what it is: a player asking about a game.
FRAME = 'Pergunta de um jogador sobre um videogame de PlayStation: '


async def flagged(text: str) -> bool:
    """Whether OpenAI's moderation scores the message, framed as a game question, at or above a
    BLOCKED threshold. The moderation endpoint is free and needs no route; without an OpenAI key,
    or when it is unreachable, nothing is flagged."""
    if not settings.openai_api_key:
        return False
    try:
        result = await openai.moderations.create(model='omni-moderation-latest', input=FRAME + text)
    except Exception:
        return False
    return any(
        r.category_scores.model_dump(by_alias=True).get(name, 0) >= threshold
        for r in result.results
        for name, threshold in BLOCKED.items()
    )


def chat_messages(params: dict[str, Any]) -> list[dict[str, str]]:
    """The Responses API's instructions + input as chat messages."""
    messages: list[dict[str, str]] = []
    if params.get('instructions'):
        messages.append({'role': 'system', 'content': params['instructions']})
    given = params.get('input', '')
    if isinstance(given, str):
        messages.append({'role': 'user', 'content': given})
    else:
        turns = cast(list[dict[str, Any]], given)
        messages.extend({'role': t['role'], 'content': str(t['content'])} for t in turns)
    return messages


def chat_format(params: dict[str, Any]) -> dict[str, Any] | None:
    """The Responses API's JSON schema output as a chat completions response_format."""
    text = cast(dict[str, Any], params.get('text') or {})
    fmt = cast(dict[str, Any], text.get('format') or {})
    if fmt.get('type') != 'json_schema':
        return None
    return {
        'type': 'json_schema',
        'json_schema': {'name': fmt['name'], 'schema': fmt['schema'], 'strict': True},
    }


async def _respond_locally(params: dict[str, Any], model: str) -> Reply:
    # Local servers have no hosted web search and no reasoning effort: both are dropped, and
    # the answer comes from the context the feature sent.
    started = time.monotonic()
    extra: dict[str, Any] = {'extra_body': {'reasoning_effort': settings.local_reasoning_effort}}
    response_format = chat_format(params)
    if response_format:
        extra['response_format'] = response_format
    completion = cast(
        ChatCompletion,
        await local.chat.completions.create(
            model=model,
            messages=cast(Any, chat_messages(params)),
            max_tokens=min(
                settings.local_max_tokens,
                params.get('max_output_tokens') or settings.local_max_tokens,
            ),
            **extra,
        ),
    )
    usage = completion.usage
    await record_call(
        f'{LOCAL_PREFIX}{model}',
        Usage(
            input=usage.prompt_tokens if usage else 0,
            output=usage.completion_tokens if usage else 0,
        ),
        int((time.monotonic() - started) * 1000),
    )
    return Reply(completion.choices[0].message.content or '')


def codex_prompt(params: dict[str, Any]) -> str:
    """The Responses API's instructions + input as one prompt for `codex exec`."""
    parts = [f'{m["role"]}:\n{m["content"]}' for m in chat_messages(params)]
    return (
        'Answer as the assistant described below. Reply with the answer only: no files, no '
        'commands, no notes about the task.\n\n' + '\n\n'.join(parts)
    )


async def _respond_with_codex(params: dict[str, Any], model: str) -> Reply:
    # Development only (the evals without API spend): `codex exec` answers with the same model,
    # signed in with the developer's own account. It reports no token usage, so the call is
    # recorded as free. Web search is Codex's own, when the request asks for it.
    started = time.monotonic()
    effort = cast(dict[str, Any], params.get('reasoning') or {}).get('effort', 'medium')
    tools = cast(list[dict[str, Any]], params.get('tools') or [])
    search = web_search_on() and any(t.get('type') == 'web_search' for t in tools)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / 'answer.txt'
        args = [
            'codex',
            *(['--search'] if search else []),
            'exec',
            '--skip-git-repo-check',
            '--ephemeral',
            '-s',
            'read-only',
            '-C',
            tmp,
            '-c',
            'mcp_servers={}',
            '-c',
            f'model_reasoning_effort={effort}',
            '-m',
            model,
            '-o',
            str(out),
        ]
        fmt = chat_format(params)
        if fmt:
            schema = Path(tmp) / 'schema.json'
            schema.write_text(json.dumps(fmt['json_schema']['schema']))
            args += ['--output-schema', str(schema)]
        proc = await asyncio.create_subprocess_exec(
            *args,
            '-',
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate(codex_prompt(params).encode())
        if proc.returncode != 0 or not out.exists():
            raise RuntimeError(f'codex exec failed ({proc.returncode}): {err.decode()[-300:]}')
        text = out.read_text().strip()
    await record_call(
        f'{LOCAL_PREFIX}codex:{model}', Usage(), int((time.monotonic() - started) * 1000)
    )
    return Reply(text)


def strip_links(text: str) -> str:
    """Web search answers still sneak in markdown links; keep only the label."""
    return re.sub(r'\[([^\]]+)\]\(https?://[^)]+\)', r'\1', text).strip()


_URL = re.compile(r'\(?\b(?:https?://|www\.)\S+')


def strip_urls(text: str) -> str:
    """No address at all in what Nexo says: guide pages are untrusted text, and one could try
    to send the player to a site that asks for their PSN login. Answers state facts, not
    sources."""
    return re.sub(r'[ \t]{2,}', ' ', _URL.sub('', strip_links(text))).strip()


async def research_json(name: str, instructions: str, input: str, schema: dict[str, Any]) -> Any:
    """One web-searching call that must come back as JSON matching `schema`. A local model
    answers from what it knows, without searching."""
    offline = (
        ''
        if web_search_on()
        else '\nWeb search is not available: work only from the data given here and what you '
        'know with certainty; where the schema allows null, use it rather than guess.'
    )
    response = await respond(
        instructions=f'{instructions}\nNever put URLs or markdown links inside any field; '
        f'cite sources by site name only.{offline}',
        tools=[{'type': 'web_search'}],
        reasoning={'effort': 'medium'},
        text={'format': {'type': 'json_schema', 'name': name, 'schema': schema, 'strict': True}},
        input=input,
    )
    return json.loads(strip_links(response.output_text))


async def answer_json(name: str, instructions: str, input: str, schema: dict[str, Any]) -> Any:
    """One call that answers only from the data given, as JSON matching `schema`: no web search."""
    response = await respond(
        instructions=instructions,
        reasoning={'effort': 'medium'},
        text={'format': {'type': 'json_schema', 'name': name, 'schema': schema, 'strict': True}},
        input=input,
    )
    return json.loads(strip_links(response.output_text))


def embedding_model() -> str:
    """The model behind every stored vector. Vectors from different models do not compare:
    after switching, run `bun run embed --all`."""
    if settings.embedding_provider == 'local':
        return f'{LOCAL_PREFIX}{settings.local_embedding_model}'
    return settings.embedding_model


async def embed(texts: list[str]) -> list[list[float]]:
    is_local = settings.embedding_provider == 'local'
    client = local if is_local else openai
    model = settings.local_embedding_model if is_local else settings.embedding_model
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):
        started = time.monotonic()
        res = await client.embeddings.create(model=model, input=texts[i : i + 100])
        await record_call(
            embedding_model(),
            Usage(input=res.usage.prompt_tokens if res.usage else 0),
            int((time.monotonic() - started) * 1000),
        )
        out.extend(d.embedding for d in sorted(res.data, key=lambda d: d.index))
    return out
