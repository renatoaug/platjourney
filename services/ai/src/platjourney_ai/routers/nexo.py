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
    kind: Literal['start', 'unlock']
    context: GameContext
    # The trophies just unlocked ("unlock").
    unlocked: list[Trophy] = Field(default_factory=list[Trophy])
    # The guide's note on what comes next, to fold into the same message.
    route: str | None = None
    # The session's focus, the server's pick ("unlock"): the notice names it, never another.
    focus: nexo.Focus | None = None


class TrophyHelpRequest(Wire):
    context: GameContext
    trophy: Trophy


class ReplyRequest(Wire):
    text: str = Field(max_length=4000)
    context: GameContext | None = None
    history: list[nexo.Turn] = Field(default_factory=list[nexo.Turn], max_length=50)


@router.post('/tip')
async def tip(body: TipRequest) -> Answer:
    text = await nexo.tip(body.kind, body.context, body.unlocked, body.route, body.focus)
    return Answer(text=text)


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
