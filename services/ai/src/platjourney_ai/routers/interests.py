"""The next platinum among the saved interests: POST /interests/next."""

from typing import Any

from fastapi import APIRouter

from .. import next_pick
from ..next_pick import NextRequest

router = APIRouter(prefix='/interests')


@router.post('/next')
async def next_game(req: NextRequest) -> dict[str, Any] | None:
    """The chosen game, why it fits now and what to do first; null with nothing saved."""
    pick = await next_pick.next_pick(req)
    return pick.model_dump(by_alias=True) if pick else None
