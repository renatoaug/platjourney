"""The deep guide: index a game's full guides in the background, report how far that got, and
find the passages that answer a question."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from pydantic import Field

from .. import deepguide
from ..deepguide import GuidePage, Passage, Status
from ..schemas import Game, Wire

log = logging.getLogger(__name__)
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
    pages: list[GuidePage] | None = Field(default=None, max_length=50)
    # Answer only when the job is over (scripts); otherwise at once, with `indexing` set.
    wait: bool = False


class RetrieveRequest(Wire):
    game: Game
    question: str = Field(max_length=4000)
    terms: list[str] = Field(default_factory=list[str], max_length=50)
    limit: int = Field(default=6, ge=1, le=20)


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
            # The detail stays in the log: it can carry database errors and addresses.
            log.exception('deep guide for %s failed', body.game.name)
            raise HTTPException(500, 'deep guide failed') from e
    return await deepguide.status(body.game)


@router.post('/stats')
async def stats(body: GameRequest) -> Status:
    return await deepguide.status(body.game)


@router.post('/retrieve')
async def retrieve(body: RetrieveRequest) -> Passages:
    return Passages(
        passages=await deepguide.retrieve(body.game, body.question, body.terms, body.limit)
    )
