"""Nexo picks the next platinum among the games the player saved in their interests, with why it
fits now and what to do first."""

import json
import re
from typing import Any, Literal

from pydantic import Field

from . import llm
from .schemas import Wire


class Choice(Wire):
    """A saved game, with what the guide says about it and where the player is in it."""

    game: str
    name: str
    owned: bool = False
    progress: int | None = None
    hours_played: float | None = None
    difficulty: float | None = None
    hours: float | None = None
    playthroughs: int | None = None
    has_missables: bool | None = None
    has_online: bool | None = None


class RecentPlatinum(Wire):
    name: str
    hours: float | None = None
    difficulty: float | None = None


class Playing(Wire):
    name: str
    progress: int | None = None


class NextRequest(Wire):
    choices: list[Choice]
    # Saved games the player is in the middle of right now: not options, what the pick comes after.
    playing: list[Playing] = Field(default_factory=list[Playing])
    # The most recent platinums first: the player's pace and what they just went through.
    recent: list[RecentPlatinum] = Field(default_factory=list[RecentPlatinum])
    profile: str | None = None
    locale: Literal['pt-BR', 'en'] = 'pt-BR'


class NextPick(Wire):
    game: str
    why: str
    first_step: str


SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['game', 'name', 'why', 'firstStep'],
    'properties': {
        'game': {
            'type': 'string',
            'description': 'Only the chosen game id, exactly as listed (game:…), without its name',
        },
        'name': {'type': 'string', 'description': 'The chosen game name, exactly as listed'},
        'why': {
            'type': 'string',
            'description': 'Why this one now, at most two short sentences, citing the numbers '
            'that decided it (progress, hours, difficulty, what came before)',
        },
        'firstStep': {
            'type': 'string',
            'description': 'What to do first in it, one sentence: the first concrete thing',
        },
    },
}

INSTRUCTIONS = (
    'You are Nexo, from PlatJourney. The player saved these games to platinum and asks which one '
    'to go for next. Choose exactly one from the list. Weigh: a game they already started (high '
    'progress is a quick win), the length and difficulty after their last platinums (after two '
    'long or hard ones, something shorter; after short ones, they can take a big one), missables '
    'and online trophies (online first while servers are up), and their taste. Games under '
    '"Playing now" are not options: the player is on them, so the pick is what comes after; '
    'you may mention them. Use only the numbers given; never invent hours or difficulty. Talk '
    'to the player directly, warm and short, without their grammatical gender. No markdown.'
)


def line(c: Choice) -> str:
    parts = [
        f'{c.game} — {c.name}',
        f'{c.progress}% feito, {c.hours_played:g}h jogadas'
        if c.owned and c.progress is not None and c.hours_played is not None
        else f'{c.progress}% feito'
        if c.owned and c.progress is not None
        else 'ainda não começou',
        f'dificuldade {c.difficulty:g}/10' if c.difficulty is not None else '',
        f'~{c.hours:g}h até a platina' if c.hours is not None else '',
        f'{c.playthroughs} jogada(s)' if c.playthroughs else '',
        'tem perdíveis' if c.has_missables else '',
        'tem troféus online' if c.has_online else '',
    ]
    return '- ' + '; '.join(p for p in parts if p)


def build_input(req: NextRequest) -> str:
    recent = '\n'.join(
        '- '
        + '; '.join(
            p
            for p in [
                r.name,
                f'~{r.hours:g}h' if r.hours is not None else '',
                f'dificuldade {r.difficulty:g}/10' if r.difficulty is not None else '',
            ]
            if p
        )
        for r in req.recent
    )
    playing = '\n'.join(
        f'- {p.name}' + (f'; {p.progress}% feito' if p.progress is not None else '')
        for p in req.playing
    )
    language = 'English' if req.locale == 'en' else 'Brazilian Portuguese'
    return (
        f'Saved games:\n{"\n".join(line(c) for c in req.choices)}\n\n'
        f'{f"Playing now:\n{playing}\n\n" if playing else ""}'
        f'Last platinums (most recent first):\n{recent or "- none yet"}\n\n'
        f'{f"Taste: {req.profile}\n\n" if req.profile else ""}'
        f'Write in {language}.'
    )


def chosen(out: dict[str, Any], choices: list[Choice]) -> Choice | None:
    """The listed game the answer names: its id as given, an id inside what it wrote (a model
    may copy the whole line), or its name. None when it names none of them."""
    by_id = {c.game: c for c in choices}
    said = str(out.get('game', '')).strip()
    if said in by_id:
        return by_id[said]
    for found in re.findall(r'game:[\w-]+', said):
        if found in by_id:
            return by_id[found]
    name = str(out.get('name', '')).strip().casefold()
    return next((c for c in choices if c.name.casefold() == name), None)


async def next_pick(req: NextRequest) -> NextPick | None:
    """None with nothing saved, or when the answer names no listed game: the why is written
    for the game it chose, so another game would get the wrong text."""
    if not req.choices:
        return None
    response = await llm.respond(
        instructions=INSTRUCTIONS,
        reasoning={'effort': 'low'},
        text={
            'format': {'type': 'json_schema', 'name': 'next_pick', 'schema': SCHEMA, 'strict': True}
        },
        input=build_input(req),
    )
    out = json.loads(response.output_text)
    pick = chosen(out, req.choices)
    if pick is None:
        return None
    return NextPick(game=pick.game, why=str(out['why']), first_step=str(out['firstStep']))
