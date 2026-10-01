"""The database client: CBOR both ways, so text that looks like a record id stays text."""

from typing import Any

import cbor2
import httpx
import pytest

from platjourney_ai import db


def answer(result: list[Any]) -> httpx.Response:
    return httpx.Response(200, content=cbor2.dumps({'id': 1, 'result': result}))


@pytest.fixture
def server(monkeypatch: pytest.MonkeyPatch) -> list[Any]:
    sent: list[Any] = []

    def handle(request: httpx.Request) -> httpx.Response:
        sent.append(cbor2.loads(request.content))
        tags = [
            cbor2.CBORTag(8, ['game', 123]),
            cbor2.CBORTag(12, [1_767_225_600, 5_000]),
            cbor2.CBORTag(6, None),
            cbor2.CBORTag(10, '1.5'),
            cbor2.CBORTag(99, 'kept'),
        ]
        return answer([{'status': 'OK', 'result': [{'text': 'Note: It is kept', 'tags': tags}]}])

    monkeypatch.setattr(db, '_client', httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    return sent


async def test_text_goes_out_as_text_and_tags_come_back_as_plain_values(server: list[Any]) -> None:
    rows = await db.rows('SELECT * FROM x WHERE content = $t', {'t': 'Note: It is kept'})
    assert server == [
        {
            'id': 1,
            'method': 'query',
            'params': ['SELECT * FROM x WHERE content = $t', {'t': 'Note: It is kept'}],
        }
    ]
    assert rows == [
        {
            'text': 'Note: It is kept',
            'tags': ['game:123', '2026-01-01T00:00:00.000005Z', None, '1.5', 'kept'],
        }
    ]


async def test_a_failed_statement_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def handle(_: httpx.Request) -> httpx.Response:
        return answer([{'status': 'ERR', 'result': 'bad query'}])

    monkeypatch.setattr(db, '_client', httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    with pytest.raises(db.QueryError, match='bad query'):
        await db.query('SELEC')


async def test_an_rpc_error_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def handle(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=cbor2.dumps({'id': 1, 'error': {'message': 'denied'}}))

    monkeypatch.setattr(db, '_client', httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    with pytest.raises(db.QueryError, match='denied'):
        await db.query('RETURN 1')


async def test_the_client_speaks_cbor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db, '_client', None)
    client = db.client()
    assert client.headers['content-type'] == 'application/cbor'
    assert client.headers['accept'] == 'application/cbor'
    await db.close()
    assert db._client is None  # pyright: ignore[reportPrivateUsage]


async def test_a_connection_that_lost_its_auth_is_replaced_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clients: list[httpx.AsyncClient] = []
    answers = [
        httpx.Response(
            200,
            content=cbor2.dumps({'id': 1, 'error': {'message': 'Anonymous access not allowed'}}),
        ),
        answer([{'status': 'OK', 'result': [{'ok': True}]}]),
    ]

    def fresh() -> httpx.AsyncClient:
        made = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: answers.pop(0)))
        clients.append(made)
        monkeypatch.setattr(db, '_client', made)
        return made

    monkeypatch.setattr(db, 'client', fresh)
    assert await db.rows('SELECT 1') == [{'ok': True}]
    assert len(clients) == 2
