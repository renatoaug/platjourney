"""The deep guide: index a game's full guides in the background, report how far that got, and
find the passages that answer a question."""

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import Field

from .. import deepguide
from ..deepguide import GuidePage, Passage, Status
from ..schemas import Game, Wire

router = APIRouter(prefix='/deep-guide')


class GameRequest(Wire):
    game: Game


class EnsureRequest(Wire):
    game: Game
    # The PSN list size; a different size than at the last index means the list changed.
    trophy_total: int | None = None


class IndexRequest(Wire):
    game: Game
    trophy_total: int | None = None
    # Pages already found; without them the model searches for the guides.
    pages: list[GuidePage] | None = None
    # Answer only when the job is over (scripts); otherwise at once, with `indexing` set.
    wait: bool = False


class RetrieveRequest(Wire):
    game: Game
    question: str
    terms: list[str] = Field(default_factory=list[str])
    limit: int = 6


class Passages(Wire):
    passages: list[Passage]


@router.post('/ensure')
async def ensure(body: EnsureRequest) -> Status:
    """Starts indexing when the game has no index, an old one or one behind its trophy list."""
    return await deepguide.ensure(body.game, body.trophy_total)


@router.post('/index')
async def index(body: IndexRequest) -> Status:
    job = deepguide.start(body.game, body.trophy_total, body.pages)
    if body.wait:
        try:
            # Shielded so a caller that gives up does not cancel the indexing.
            await asyncio.shield(job)
        except Exception as e:
            raise HTTPException(500, f'deep guide for {body.game.name} failed: {e}') from e
    return await deepguide.status(body.game)


@router.post('/stats')
async def stats(body: GameRequest) -> Status:
    return await deepguide.status(body.game)


@router.post('/retrieve')
async def retrieve(body: RetrieveRequest) -> Passages:
    return Passages(
        passages=await deepguide.retrieve(body.game, body.question, body.terms, body.limit)
    )
