"""SurrealDB over its HTTP RPC endpoint: one `query` method, no SDK.

Requests and answers are CBOR, as in the official SDKs. Over JSON, SurrealDB reads a string
that looks like a record id as one: a passage starting "Note: It ..." arrived as `Note:It` and
failed the write. Record ids travel as strings ("game:123"); queries turn them back into
records with `type::record($id)`, and answers carry them back as strings.
"""

from datetime import UTC, datetime
from typing import Any

import cbor2
import httpx

from .config import settings

_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            auth=(settings.surreal_user, settings.surreal_pass),
            headers={
                'Accept': 'application/cbor',
                'Content-Type': 'application/cbor',
                'Surreal-NS': settings.surreal_ns,
                'Surreal-DB': settings.surreal_db,
            },
            timeout=30,
        )
    return _client


class QueryError(Exception):
    pass


def _record(value: Any) -> str:
    table, key = value
    return f'{table}:{key}'


def _none(_value: Any) -> None:
    return None


def _datetime(value: Any) -> str:
    seconds, nanos = [*list(value), 0][:2]
    when = datetime.fromtimestamp(seconds, UTC).replace(microsecond=nanos // 1000)
    return when.isoformat().replace('+00:00', 'Z')


# SurrealDB's CBOR tags, turned into what the JSON protocol used to give: plain values and strings.
_TAGS: dict[int, Any] = {
    6: _none,  # NONE
    7: str,  # table name
    8: _record,  # record id
    9: str,  # uuid as text
    10: str,  # decimal as text
    12: _datetime,  # datetime [seconds, nanoseconds]
    13: str,  # duration as text
}


def _tag(tag: cbor2.CBORTag, _immutable: bool) -> Any:
    convert = _TAGS.get(tag.tag)
    return convert(tag.value) if convert else tag.value


async def _send(sql: str, vars: dict[str, Any] | None) -> dict[str, Any]:
    r = await client().post(
        settings.surreal_url,
        content=cbor2.dumps({'id': 1, 'method': 'query', 'params': [sql, vars or {}]}),
    )
    r.raise_for_status()
    return cbor2.loads(r.content, tag_hook=_tag)


def _lost_auth(body: dict[str, Any]) -> bool:
    return 'error' in body and 'anonymous access' in str(body['error']).lower()


async def query(sql: str, vars: dict[str, Any] | None = None) -> list[Any]:
    """Runs one or more statements and returns the result of each."""
    body = await _send(sql, vars)
    # After a long run of requests on one kept-alive connection SurrealDB can treat it as
    # anonymous. A fresh connection authenticates again; the request is sent once more.
    if _lost_auth(body):
        await close()
        body = await _send(sql, vars)
    if 'error' in body:
        raise QueryError(body['error'].get('message', str(body['error'])))
    out: list[Any] = []
    for statement in body['result']:
        if statement.get('status') != 'OK':
            raise QueryError(str(statement.get('result')))
        out.append(statement['result'])
    return out


async def rows(sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """The rows of the last statement."""
    results = await query(sql, vars)
    return results[-1] if results else []


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
