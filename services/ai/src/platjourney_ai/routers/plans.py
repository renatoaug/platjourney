"""The session plan: POST /plans/session with the game context and the minutes available."""

from typing import Any

from fastapi import APIRouter
from pydantic import Field

from .. import planner
from ..schemas import GameContext, Wire

router = APIRouter(prefix='/plans')


class SessionRequest(Wire):
    context: GameContext
    minutes: float
    # The trophies of the route the player asked to replace, for a different one.
    avoid: list[str] = Field(default_factory=list[str])


@router.post('/session')
async def session(req: SessionRequest) -> dict[str, Any]:
    """The plan as the model wrote it (summary, steps, totalMinutes, warnings, ifTimeLeft)."""
    return await planner.plan_session(req.context, req.minutes, req.avoid)
