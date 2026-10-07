"""Server status: POST /servers/check with the game names to look up."""

from typing import Any

from fastapi import APIRouter
from pydantic import Field

from .. import servers
from ..schemas import Wire

router = APIRouter(prefix='/servers')


class CheckRequest(Wire):
    names: list[str] = Field(max_length=1000)


@router.post('/check')
async def check(req: CheckRequest) -> dict[str, Any]:
    return await servers.check(req.names)
