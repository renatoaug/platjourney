"""Deep guide retrieval: does `retrieve` bring a passage that answers the player's question?

Each golden case is a pt-BR question and what a correct passage must contain. Reports recall@k
(a relevant passage among the k returned) and MRR (1 / rank of the first relevant one) per game
and overall. Cases whose game no longer has any relevant passage are listed apart: that is a
stale golden set or a re-index, not a retrieval miss.
"""

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from platjourney_ai import db, deepguide
from platjourney_ai.guidestore import Passage
from platjourney_ai.schemas import Game

from . import questions
from .runs import Run

K = 6


class Case(BaseModel):
    question: str
    terms: list[str] = []
    relevant: list[list[str]]


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


async def run() -> str:
    asked = await questions.active('retrieval')
    print(f'retrieval ({len(asked)} questions)')
    record = Run('retrieval', prompt=f'k={K}')
    await record.start(len(asked))
    by_game: dict[str, list[tuple[str, Case, str]]] = {}
    for q in asked:
        data = q['data']
        by_game.setdefault(data['game'], []).append(
            (q['id'], Case.model_validate(data), data['name'])
        )
    overall = Score()
    summary: dict[str, str] = {}
    try:
        for game_id, cases in by_game.items():
            game = await load_game(game_id)
            indexed = await all_passages(game_id)
            score = Score()
            for qid, case, name in cases:
                # A question no indexed passage can answer is a stale golden set, not a miss.
                if not any(relevant(case, p) for p in indexed):
                    await record.case(
                        question=qid,
                        input=case.question,
                        passed=False,
                        reason='no relevant passage indexed for this game',
                        game=name,
                        stale=True,
                    )
                    continue
                found, calls = await record.measure(
                    deepguide.retrieve(game, case.question, case.terms, K)
                )
                rank = first_hit(case, found)
                score.ranks.append(rank)
                if rank is None:
                    print(f'  miss: {name}: "{case.question}"')
                await record.case(
                    question=qid,
                    input=case.question,
                    expected=' or '.join(' + '.join(group) for group in case.relevant),
                    output='\n\n'.join(
                        f'[{p.source} — {p.heading}]\n{p.content[:400]}' for p in found
                    ),
                    passed=rank is not None,
                    score=1 / rank if rank else 0,
                    reason=f'first relevant passage at #{rank}' if rank else f'none in the top {K}',
                    calls=calls,
                    game=name,
                )
            overall.ranks.extend(score.ranks)
            print(score.line(cases[0][2]))
            summary[cases[0][2]] = f'recall@{K} {score.recall:.2f} · MRR {score.mrr:.2f}'
        print(overall.line('overall'))
        await record.finish(
            {'overall': f'recall@{K} {overall.recall:.2f} · MRR {overall.mrr:.2f}', **summary}
        )
    except Exception as e:
        await record.fail(f'{type(e).__name__}: {e}')
        raise
    return record.id
