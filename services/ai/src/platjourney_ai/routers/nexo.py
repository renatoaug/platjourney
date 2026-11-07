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
    # The trophies just unlocked; on "start", the first ones, which came with the game.
    unlocked: list[Trophy] = Field(default_factory=list[Trophy])
    # The guide's note on what comes next, to fold into the same message.
    route: str | None = None
    # The session's focus, the server's pick: the notice names it as the next trophy, never another.
    focus: nexo.Focus | None = None
    # The point of the journey this unlock reached, the server's pick ("unlock").
    mark: nexo.Mark | None = None
    # The game started was Nexo's recommendation ("start").
    recommended: nexo.Recommended | None = None
    # The trophies to keep at the whole game, listed by the server after Nexo's words ("start").
    ongoing: list[str] = Field(default_factory=list[str], max_length=10)


class FollowUpRequest(Wire):
    context: GameContext
    question: str = Field(max_length=4000)


class MaybeAnswer(Wire):
    text: str | None


class TrophyHelpRequest(Wire):
    context: GameContext
    trophy: Trophy


class ReplyRequest(Wire):
    text: str = Field(max_length=4000)
    context: GameContext | None = None
    history: list[nexo.Turn] = Field(default_factory=list[nexo.Turn], max_length=50)
    # The app's language, for a reply with no game context.
    locale: Literal['pt-BR', 'en'] = 'pt-BR'
    resume: nexo.Resume | None = None
    # The general conversation, with no game open.
    player: nexo.PlayerFacts | None = None
    # A fact from the player's game to close with, picked by the server at most once a day per game.
    hook: str | None = Field(default=None, max_length=300)


@router.post('/tip')
async def tip(body: TipRequest) -> Answer:
    text = await nexo.tip(
        body.kind,
        body.context,
        body.unlocked,
        body.route,
        body.focus,
        body.mark,
        body.recommended,
        body.ongoing,
    )
    return Answer(text=text)


@router.post('/trophy-help')
async def trophy_help(body: TrophyHelpRequest) -> Answer:
    return Answer(text=await nexo.trophy_help(body.context, body.trophy))


@router.post('/follow-up')
async def follow_up(body: FollowUpRequest) -> MaybeAnswer:
    """A question Nexo could not answer before, asked again now that the deep guide may have it."""
    return MaybeAnswer(text=await nexo.follow_up(body.context, body.question))


@router.post('/reply')
async def reply(body: ReplyRequest) -> Answer:
    try:
        return Answer(
            text=await nexo.reply(
                body.text,
                body.context,
                body.history,
                body.locale,
                body.resume,
                body.player,
                body.hook,
            )
        )
    except nexo.Moderated:
        # 422 tells the server the message itself was refused, not that the model failed.
        raise HTTPException(status_code=422, detail='moderated') from None
