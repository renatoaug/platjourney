"""The questions each suite asks, kept in the evals database so they can be listed, added and
edited from the viewer. `bun run ai:eval seed` copies in the examples from evals/data/."""

import json
from pathlib import Path
from typing import Any

from . import store

DATA = Path(__file__).parent / 'data'
SUITES = ('retrieval', 'scope', 'answers')


def examples(suite: str) -> list[dict[str, Any]]:
    """The example questions shipped with the repository, one `data` object per question."""
    raw = json.loads((DATA / f'{suite}.json').read_text())
    if suite == 'retrieval':
        return [
            {'game': g['game'], 'name': g['name'], **case}
            for g in raw['games']
            for case in g['cases']
        ]
    if suite == 'scope':
        return [case | {'max_chars': raw['max_chars']} for case in raw['cases']]
    return list(raw['cases'])


def _key(data: dict[str, Any]) -> str:
    """What makes two questions the same: their text (the scope suite calls it a message)."""
    return str(data.get('question') or data.get('message') or '')


async def seed(suite: str) -> int:
    """Adds the example questions the suite does not have yet (`bun run ai:eval seed`); returns
    how many it added. Questions edited or archived in the viewer are left as they are."""
    have = await store.rows('SELECT data FROM eval_question WHERE suite = $suite', {'suite': suite})
    known = {_key(row['data']) for row in have}
    items = [{'suite': suite, 'data': d} for d in examples(suite) if _key(d) not in known]
    if items:
        await store.query('INSERT INTO eval_question $items', {'items': items})
    return len(items)


async def active(suite: str) -> list[dict[str, Any]]:
    """The suite's active questions, oldest first: [{id, data}]."""
    return await store.rows(
        'SELECT id, data, created_at FROM eval_question WHERE suite = $suite AND active'
        ' ORDER BY created_at',
        {'suite': suite},
    )
