from types import SimpleNamespace
from typing import Any, cast

from openai.types.responses import Response

from platjourney_ai.llm import cited_urls


def response(*output: object) -> Response:
    return cast(Response, SimpleNamespace(output=list(output)))


def message(*urls: str) -> object:
    notes = [SimpleNamespace(type='url_citation', url=u) for u in urls]
    return SimpleNamespace(type='message', content=[SimpleNamespace(annotations=notes)])


def search(*urls: str, opened: str | None = None) -> object:
    sources: list[Any] = [SimpleNamespace(type='url', url=u) for u in urls]
    return SimpleNamespace(
        type='web_search_call', action=SimpleNamespace(sources=sources, url=opened)
    )


def test_an_answer_that_cites_nothing_still_keeps_the_pages_its_search_opened() -> None:
    found = cited_urls(response(search('https://a.example/1', 'https://b.example/2'), message()))
    assert found == ('https://a.example/1', 'https://b.example/2')


def test_cited_pages_come_first_and_each_page_once() -> None:
    found = cited_urls(
        response(
            search('https://a.example/1', 'https://b.example/2'),
            search(opened='https://c.example/3'),
            message('https://b.example/2'),
        )
    )
    assert found == ('https://b.example/2', 'https://a.example/1', 'https://c.example/3')
