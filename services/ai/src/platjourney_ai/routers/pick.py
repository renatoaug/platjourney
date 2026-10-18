"""Nexo picks one game to platinum now: POST /pick."""

from typing import Any

from fastapi import APIRouter

from .. import next_pick
from ..next_pick import NextRequest

router = APIRouter(prefix='/pick')


@router.post('')
async def pick(req: NextRequest) -> dict[str, Any] | None:
    """The chosen game, why it fits now, what to do first and whether it matches the mood; null
    with nothing to choose from."""
    chosen = await next_pick.next_pick(req)
    return chosen.model_dump(by_alias=True) if chosen else None
