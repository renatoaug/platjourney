"""Where the evals keep their questions and runs: a database of their own (`evals` by default) on
the same SurrealDB as the app, so the history is backed up with everything else while the app's
own database (`main`) is only read. Settings: EVAL_SURREAL_URL, EVAL_SURREAL_USER,
EVAL_SURREAL_PASS, EVAL_SURREAL_NS and EVAL_SURREAL_DB, each falling back to the app's SURREAL_*
(and `evals` for the database)."""

import os
from pathlib import Path
from typing import Any

import cbor2
import httpx

from platjourney_ai import db
from platjourney_ai.config import settings

SCHEMA = Path(__file__).parent / 'schema.surql'


def _env(name: str, fallback: str) -> str:
    return os.environ.get(f'EVAL_{name}') or fallback


_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            auth=(
                _env('SURREAL_USER', settings.surreal_user),
                _env('SURREAL_PASS', settings.surreal_pass),
            ),
            headers={
                'Accept': 'application/cbor',
                'Content-Type': 'application/cbor',
                'Surreal-NS': _env('SURREAL_NS', settings.surreal_ns),
                'Surreal-DB': _env('SURREAL_DB', 'evals'),
            },
            timeout=30,
        )
    return _client


async def query(sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
    """Runs statements on the evals database and returns the result of each."""
    r = await client().post(
        _env('SURREAL_URL', settings.surreal_url),
        content=cbor2.dumps({'id': 1, 'method': 'query', 'params': [sql, vars or {}]}),
    )
    r.raise_for_status()
    body = cbor2.loads(r.content, tag_hook=db._tag)  # pyright: ignore[reportPrivateUsage]
    if 'error' in body:
        raise db.QueryError(body['error'].get('message', str(body['error'])))
    out: list[Any] = []
    for statement in body['result']:
        if statement.get('status') != 'OK':
            raise db.QueryError(str(statement.get('result')))
        out.append(statement['result'])
    return out


async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """The rows of the last statement."""
    results = await query(sql, vars)
    return results[-1] if results else []


async def migrate() -> None:
    """Creates the evals database when the user may (locally, as root), then its tables."""
    name = _env('SURREAL_DB', 'evals')
    async with httpx.AsyncClient(
        auth=(
            _env('SURREAL_USER', settings.surreal_user),
            _env('SURREAL_PASS', settings.surreal_pass),
        ),
        headers={
            'Accept': 'application/cbor',
            'Content-Type': 'application/cbor',
            'Surreal-NS': _env('SURREAL_NS', settings.surreal_ns),
        },
        timeout=30,
    ) as ns:
        await ns.post(
            _env('SURREAL_URL', settings.surreal_url),
            content=cbor2.dumps(
                {
                    'id': 1,
                    'method': 'query',
                    'params': [f'DEFINE DATABASE IF NOT EXISTS {name}', dict[str, Any]()],
                }
            ),
        )
    # One statement at a time: in one batch, a new table's FLEXIBLE fields are refused.
    for statement in SCHEMA.read_text().split(';\n'):
        lines = [line for line in statement.splitlines() if not line.startswith('--')]
        if '\n'.join(lines).strip():
            await query('\n'.join(lines))


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
