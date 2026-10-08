"""An eval run as it is stored: one eval_run row with the platform version, commit, prompt
fingerprint, models and cost, and one eval_case row per question, written as each case finishes so
the viewer can follow a run live."""

import hashlib
import json
import subprocess
from collections.abc import Awaitable
from pathlib import Path
from typing import Any

from platjourney_ai import costs

from . import store

ROOT = Path(__file__).resolve().parents[3]


def version() -> str:
    """The platform's version, from the root package.json that each release sets."""
    try:
        return str(json.loads((ROOT / 'package.json').read_text())['version'])
    except OSError, ValueError, KeyError:
        return 'unknown'


def git_commit() -> str:
    """The commit the run measured, with `+` when the tree had uncommitted changes."""
    try:
        sha = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'],
            capture_output=True,
            text=True,
            check=True,
            cwd=ROOT,
        ).stdout.strip()
        dirty = subprocess.run(
            ['git', 'status', '--porcelain'], capture_output=True, text=True, check=True, cwd=ROOT
        ).stdout.strip()
        return f'{sha}+' if dirty else sha
    except OSError, subprocess.CalledProcessError:
        return 'unknown'


def digest(*parts: str) -> str:
    """A short fingerprint of a prompt: two runs with the same one used the same instructions."""
    return hashlib.sha256('\n'.join(parts).encode()).hexdigest()[:10]


class Run:
    """One run of a suite. `start` creates it, `case` records each question, `finish` closes it."""

    def __init__(self, suite: str, prompt: str = '') -> None:
        self.suite = suite
        self.prompt = prompt
        self.id = ''
        self.cases: list[dict[str, Any]] = []

    async def start(self, planned: int) -> str:
        [row] = await store.rows(
            'CREATE eval_run CONTENT $data RETURN id',
            {
                'data': {
                    'suite': self.suite,
                    'version': version(),
                    'commit': git_commit(),
                    'prompt': self.prompt,
                    'planned': planned,
                }
            },
        ) or [{}]
        self.id = str(row.get('id', ''))
        return self.id

    async def measure[T](self, work: Awaitable[T]) -> tuple[T, list[dict[str, Any]]]:
        """Awaits one case's model work with its calls collected (never stored with the app's
        costs): the result and the calls it made."""
        calls: list[dict[str, Any]] = []
        token = costs.collected.set(calls)
        try:
            return await work, calls
        finally:
            costs.collected.reset(token)

    async def case(
        self,
        *,
        input: str,
        passed: bool,
        question: str | None = None,
        output: str = '',
        expected: str = '',
        score: float | None = None,
        reason: str = '',
        calls: list[dict[str, Any]] | None = None,
        **extra: Any,
    ) -> None:
        calls = calls or []
        row = {
            'input': input,
            'expected': expected,
            'output': output,
            'passed': passed,
            'score': score,
            'reason': reason,
            'models': sorted({c['model'] for c in calls}),
            'cost_usd': round(sum(c['cost_usd'] for c in calls), 6),
            'extra': extra,
        }
        # SurrealDB wants NONE, not null, in an optional field: a case without a score omits it.
        if score is None:
            del row['score']
        self.cases.append(row | {'score': score})
        await store.query(
            'CREATE eval_case CONTENT object::extend($row, { run: type::record($run),'
            ' question: IF $question THEN type::record($question) ELSE NONE END });'
            'UPDATE type::record($run) SET passed = $passed, total = $total, cost_usd = $cost,'
            ' models = $models',
            {
                'row': row,
                'run': self.id,
                'question': question,
                'passed': sum(c['passed'] for c in self.cases),
                'total': len(self.cases),
                'cost': round(sum(c['cost_usd'] for c in self.cases), 6),
                'models': sorted({m for c in self.cases for m in c['models']}),
            },
        )

    async def finish(self, summary: dict[str, Any]) -> None:
        await store.query(
            "UPDATE type::record($run) SET status = 'done', summary = $summary,"
            ' finished_at = time::now()',
            {'run': self.id, 'summary': summary},
        )

    async def fail(self, error: str) -> None:
        await store.query(
            "UPDATE type::record($run) SET status = 'failed', error = $error,"
            ' finished_at = time::now()',
            {'run': self.id, 'error': error[:500]},
        )
