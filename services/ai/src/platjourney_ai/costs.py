"""What each model call cost, recorded per user and action.

The Bun server says who and what caused a request (headers X-Cost-User and
X-Cost-Action); the tag rides a context variable down to where the call is made.
"""

import logging
import re
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from . import db

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class CostTag:
    user: str | None = None
    action: str = 'other'


_NO_TAG = CostTag()
current_tag: ContextVar[CostTag] = ContextVar('cost_tag', default=_NO_TAG)

# Set by the evals: calls are collected here instead of stored, so an eval writes nothing to the
# database it reads (it may be production, with a read-only user).
collected: ContextVar[list[dict[str, Any]] | None] = ContextVar('collected_calls', default=None)

# USD per 1M tokens (input, cached input, output), from
# https://developers.openai.com/api/docs/pricing (2026-10-03).
# Reasoning tokens are billed as output and are already counted in output_tokens.
PRICES: dict[str, tuple[float, float, float]] = {
    'gpt-5.5': (5, 0.5, 30),
    'gpt-5.6-sol': (4, 0.4, 20),
    'gpt-5.6-terra': (2, 0.2, 12),
    'gpt-5.6-luna': (0.2, 0.02, 1.2),
    'gpt-5.4': (2.5, 0.25, 15),
    'gpt-5.4-mini': (0.75, 0.075, 4.5),
    'gpt-5.4-nano': (0.2, 0.02, 1.25),
    'text-embedding-3-small': (0.02, 0.02, 0),
}
# Each web search call, on top of the tokens its results add to the input.
WEB_SEARCH_USD = 10 / 1000

# Models run on the player's own machine are recorded with this prefix and cost nothing.
LOCAL_PREFIX = 'local/'

_warned: set[str] = set()


@dataclass(frozen=True)
class Usage:
    input: int = 0
    cached: int = 0
    output: int = 0
    searches: int = 0


def cost_usd(model: str, u: Usage) -> float:
    if model.startswith(LOCAL_PREFIX):
        return 0.0
    # Snapshots carry a date suffix (gpt-5.5-2026-08-01) and cost the same as the alias.
    price = PRICES.get(model) or PRICES.get(re.sub(r'-\d{4}-\d{2}-\d{2}$', '', model))
    if price is None:
        if model not in _warned:
            _warned.add(model)
            log.error('no price for model %s; its calls are recorded at $0', model)
        price = (0, 0, 0)
    inp, cached, out = price
    fresh = max(0, u.input - u.cached)
    return (
        fresh * inp + u.cached * cached + u.output * out
    ) / 1_000_000 + u.searches * WEB_SEARCH_USD


async def record_call(model: str, u: Usage, ms: int) -> None:
    """Never lets bookkeeping break the request that paid for the call."""
    tag = current_tag.get()
    data = {
        'action': tag.action,
        'model': model,
        'input_tokens': u.input,
        'cached_tokens': u.cached,
        'output_tokens': u.output,
        'web_searches': u.searches,
        'cost_usd': cost_usd(model, u),
        'ms': ms,
    }
    calls = collected.get()
    if calls is not None:
        calls.append(data)
        return
    try:
        if tag.user:
            await db.query(
                'CREATE llm_call CONTENT object::extend($data, { user: type::record($user) })',
                {'data': data, 'user': tag.user},
            )
        else:
            await db.query('CREATE llm_call CONTENT $data', {'data': data})
    except Exception as e:
        log.error('cost record failed: %s', e)
