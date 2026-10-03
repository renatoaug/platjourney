"""Deep guide retrieval: does `retrieve` bring a passage that answers the player's question?

Each golden case is a pt-BR question and what a correct passage must contain. Reports recall@k
(a relevant passage among the k returned) and MRR (1 / rank of the first relevant one) per game
and overall. Cases whose game no longer has any relevant passage are listed apart: that is a
stale golden set or a re-index, not a retrieval miss.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from platjourney_ai import db, deepguide
from platjourney_ai.guidestore import Passage
from platjourney_ai.schemas import Game

DATA = Path(__file__).parent / 'data' / 'retrieval.json'
K = 6


class Case(BaseModel):
    question: str
    terms: list[str] = []
    relevant: list[list[str]]


class GameCases(BaseModel):
    game: str
    name: str
    cases: list[Case]


class Golden(BaseModel):
    games: list[GameCases]


def relevant(case: Case, p: Passage) -> bool:
    text = f'{p.heading}\n{p.content}'.lower()
    return any(all(k.lower() in text for k in group) for group in case.relevant)


def first_hit(case: Case, found: list[Passage]) -> int | None:
    """1-based rank of the first relevant passage."""
    return next((i for i, p in enumerate(found, 1) if relevant(case, p)), None)


@dataclass
class Score:
    ranks: list[int | None] = field(default_factory=list[int | None])

    @property
    def recall(self) -> float:
        return sum(r is not None for r in self.ranks) / len(self.ranks) if self.ranks else 0

    @property
    def mrr(self) -> float:
        return sum(1 / r for r in self.ranks if r) / len(self.ranks) if self.ranks else 0

    def line(self, label: str) -> str:
        return (
            f'{label:<34} n={len(self.ranks):<3} recall@{K}={self.recall:.2f}  MRR={self.mrr:.2f}'
        )


async def load_game(id: str) -> Game:
    rows = await db.rows('SELECT * OMIT embedding FROM type::record($id)', {'id': id})
    if not rows:
        raise SystemExit(f'retrieval eval: no {id} in the database')
    return Game.model_validate(rows[0])


async def all_passages(game: str) -> list[Passage]:
    rows: list[dict[str, Any]] = await db.rows(
        'SELECT source, url, heading, content, position FROM guide_chunk '
        'WHERE game = type::record($game)',
        {'game': game},
    )
    return [Passage.model_validate(r) for r in rows]


async def check(golden: Golden) -> dict[str, list[Case]]:
    """The cases that can be answered from what is indexed now, per game; no model calls."""
    usable: dict[str, list[Case]] = {}
    for g in golden.games:
        passages = await all_passages(g.game)
        usable[g.game] = []
        for case in g.cases:
            if any(relevant(case, p) for p in passages):
                usable[g.game].append(case)
            else:
                print(f'  stale: {g.name}: "{case.question}" has no relevant passage indexed')
        print(f'  {g.name}: {len(passages)} passages, {len(usable[g.game])} cases')
    return usable


async def run() -> None:
    golden = Golden.model_validate(json.loads(DATA.read_text()))
    print(f'retrieval ({DATA.name})')
    usable = await check(golden)
    overall = Score()
    lines: list[str] = []
    for g in golden.games:
        game = await load_game(g.game)
        score = Score()
        for case in usable[g.game]:
            found = await deepguide.retrieve(game, case.question, case.terms, K)
            rank = first_hit(case, found)
            score.ranks.append(rank)
            if rank is None:
                print(f'  miss: {g.name}: "{case.question}"')
        overall.ranks.extend(score.ranks)
        lines.append(score.line(g.name))
    print('\n'.join(lines))
    print(overall.line('overall'))
