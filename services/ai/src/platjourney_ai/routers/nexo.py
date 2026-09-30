"""Nexo's answers: automatic notices, help for one trophy and chat replies. The server stores the
conversation; it sends the chat history it wants remembered."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field

from .. import nexo
from ..schemas import GameContext, Trophy, Wire

router = APIRouter(prefix='/nexo')


class Answer(Wire):
    text: str


class TipRequest(Wire):
    kind: Literal['start', 'unlock', 'session']
    context: GameContext
    # The trophies just unlocked ("unlock") or earned this session ("session").
    unlocked: list[Trophy] = Field(default_factory=list[Trophy])
    # Minutes since the last activity, for "session".
    minutes: float = 0
    # The guide's note on what comes next, to fold into the same message.
    route: str | None = None


class TrophyHelpRequest(Wire):
    context: GameContext
    trophy: Trophy


class ReplyRequest(Wire):
    text: str
    context: GameContext | None = None
    history: list[nexo.Turn] = Field(default_factory=list[nexo.Turn])


@router.post('/tip')
async def tip(body: TipRequest) -> Answer:
    return Answer(
        text=await nexo.tip(body.kind, body.context, body.unlocked, body.minutes, body.route)
    )


@router.post('/trophy-help')
async def trophy_help(body: TrophyHelpRequest) -> Answer:
    return Answer(text=await nexo.trophy_help(body.context, body.trophy))


@router.post('/reply')
async def reply(body: ReplyRequest) -> Answer:
    try:
        return Answer(text=await nexo.reply(body.text, body.context, body.history))
    except nexo.Moderated:
        # 422 tells the server the message itself was refused, not that the model failed.
        raise HTTPException(status_code=422, detail='moderated') from None
