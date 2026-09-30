"""The platinum guide: POST /guides/research with the catalog game and, when known, its PSN
trophy list and edition."""

from typing import Any

from fastapi import APIRouter

from .. import guide
from ..schemas import Game, Trophy, Wire

router = APIRouter(prefix='/guides')


class ResearchRequest(Wire):
    game: Game
    trophies: list[Trophy] | None = None
    edition: guide.Edition | None = None


@router.post('/research')
async def research(req: ResearchRequest) -> dict[str, Any]:
    """The guide as the model wrote it; the server stamps the version and stores it."""
    return await guide.research(req.game, req.trophies, req.edition)
