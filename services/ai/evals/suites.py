"""The suites by name, shared by the command line and the viewer."""

from collections.abc import Callable, Coroutine
from typing import Any

from . import answers, retrieval, scope

SUITES: dict[str, Callable[[], Coroutine[Any, Any, str]]] = {
    'retrieval': retrieval.run,
    'scope': scope.run,
    'answers': answers.run,
}
