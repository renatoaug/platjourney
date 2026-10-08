"""Runs the evals against the real model and database: `bun run ai:eval`, or only some of them by
name (`bun run ai:eval scope`). `bun run ai:eval seed` copies the example questions into the evals
database first. Each run is stored there; `bun run ai:eval:view` shows them, and runs them too."""

import asyncio
import sys

import openai

from platjourney_ai import db

from . import questions, store
from .suites import SUITES


async def main() -> int:
    try:
        await store.migrate()
        if sys.argv[1:] == ['seed']:
            for suite in SUITES:
                print(f'{suite}: {await questions.seed(suite)} example questions added')
            return 0
        chosen = sys.argv[1:] or list(SUITES)
        for name in chosen:
            await SUITES[name]()
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
        await store.close()
    return 0


sys.exit(asyncio.run(main()))
