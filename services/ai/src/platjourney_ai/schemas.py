"""What the Bun server sends: the facts about a player and a game, in its camelCase JSON.

Models accept unknown fields so the server can send more than a feature reads.
"""

import math
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='allow')


class Game(Wire):
    id: str
    name: str
    platforms: list[str] = []
    genres: list[str] = []
    themes: list[str] = []
    modes: list[str] = []
    release_year: int | None = None
    summary: str | None = None


class TitleProgress(Wire):
    name: str
    platform: str
    progress: int
    earned: int
    total: int


class Trophy(Wire):
    id: int
    name: str
    detail: str
    name_en: str
    detail_en: str = ''
    type: str
    rarity: str = ''
    earned_rate: float = 0
    earned: bool
    earned_at: str | None = None
    hidden: bool = False
    # "default" is the base game; "001", "002"... are DLC groups.
    group_id: str = 'default'
    # PS5 titles expose per-trophy progress (3/10 collectibles) when the game tracks it.
    progress_value: int | None = None
    progress_target: int | None = None
    progress_rate: int | None = None


class GroupCounts(Wire):
    earned: int
    total: int
    remaining: int | None = None


class TitleGroups(Wire):
    base: GroupCounts
    dlc: GroupCounts | None = None


class GameContext(Wire):
    """The game a player is on: PSN progress, the trophy list and the researched guide."""

    game: Game
    title: TitleProgress
    trophies: list[Trophy] = Field(max_length=3000)
    guide: dict[str, Any] | None = None
    groups: TitleGroups | None = None
    # Hours played so far, from PSN (may lag a session behind).
    hours_played: float | None = None
    # Account preference: count DLC trophies in the progress shown.
    include_dlc_progress: bool = False
    # False when the player does not own the game: Nexo talks about it before they buy it.
    owned: bool = True


class Shown(BaseModel):
    earned: int
    total: int
    progress: int
    label: str


def shown_progress(ctx: GameContext) -> Shown:
    """Progress as the player chose to see it: the base game only by default, which is what
    the platinum needs, or with DLC counted in."""
    g = ctx.groups
    if g is None:
        return Shown(
            earned=ctx.title.earned, total=ctx.title.total, progress=ctx.title.progress, label=''
        )
    with_dlc = ctx.include_dlc_progress and g.dlc is not None
    earned = g.base.earned + (g.dlc.earned if with_dlc and g.dlc else 0)
    total = g.base.total + (g.dlc.total if with_dlc and g.dlc else 0)
    label = (' com DLC' if with_dlc else ' do jogo base') if g.dlc else ''
    return Shown(
        earned=earned,
        total=total,
        progress=_round_half_up(earned / total * 100) if total else 0,
        label=label,
    )


def _round_half_up(x: float) -> int:
    """Like JavaScript's Math.round: 12.5 is 13 (Python's round() gives 12)."""
    return math.floor(x + 0.5)
