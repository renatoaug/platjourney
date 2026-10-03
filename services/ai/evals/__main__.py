"""Runs the evals against the real model and database: `bun run ai:eval`, or only some of them by
name (`bun run ai:eval scope`)."""

import asyncio
import sys
from collections.abc import Awaitable, Callable

import openai

from platjourney_ai import db

from . import retrieval, scope

EVALS: dict[str, Callable[[], Awaitable[None]]] = {'retrieval': retrieval.run, 'scope': scope.run}


async def main() -> int:
    try:
        chosen = sys.argv[1:] or list(EVALS)
        for name in chosen:
            await EVALS[name]()
    except openai.RateLimitError as e:
        # Stop at the first refusal: every later call would be refused the same way.
        if 'insufficient_quota' in (e.type, e.code) or e.code == 'credit_balance_exhausted':
            print(
                f'\nOpenAI refused the call: the account has no credits (429 {e.code or e.type}).'
            )
            print('Add credits at platform.openai.com/settings/organization/billing and run again.')
            return 2
        raise
    finally:
        await db.close()
    return 0


sys.exit(asyncio.run(main()))
