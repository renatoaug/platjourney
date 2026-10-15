"""The player's taste as a vector, and the catalog games closest to it."""

import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

from . import db
from .schemas import Wire


class TrophyCounts(Wire):
    platinum: int = 0


class LibraryTitle(Wire):
    """A PSN title as the server sends it, with the catalog game it maps to (if any)."""

    name: str
    progress: int
    last_updated: str
    earned_by_type: TrophyCounts
    game: str | None = None


@dataclass(frozen=True)
class Signal:
    game: str
    weight: float


class Candidate(BaseModel):
    id: str
    name: str
    platforms: list[str] = []
    release_year: int | None = None
    genres: list[str] = []
    score: float = 0
    # The player's own games this candidate is closest to, for "parecido com X e Y".
    similar_to: list[str] = []


def _age_years(last_updated: str, now: datetime) -> float:
    seen = datetime.fromisoformat(last_updated)
    if seen.tzinfo is None:
        seen = seen.replace(tzinfo=UTC)
    return (now - seen).total_seconds() / (365 * 86_400)


def weight(t: LibraryTitle, now: datetime) -> float:
    if t.earned_by_type.platinum == 1:
        return 1 + max(0, 1 - _age_years(t.last_updated, now) / 4) * 0.5
    if t.progress >= 50:
        return 0.6
    if t.progress >= 20:
        return 0.3
    return -0.15


def signals(library: Sequence[LibraryTitle], now: datetime) -> list[Signal]:
    """What the player enjoys, as a weighted mix of the games they finished and are
    playing. Platinums count most; recent ones a bit more; dropped games (touched, below
    20%) pull the vector slightly away. Games outside the catalog cannot shape the taste."""
    return [Signal(t.game, weight(t, now)) for t in library if t.game]


def mean(vectors: Sequence[Sequence[float]], weights: Sequence[float] | None = None) -> list[float]:
    dim = len(vectors[0]) if vectors else 0
    acc = [0.0] * dim
    total = 0.0
    for i, v in enumerate(vectors):
        w = weights[i] if weights is not None and i < len(weights) else 1
        total += w
        for d in range(dim):
            acc[d] += v[d] * w
    return [x / total if total else 0 for x in acc]


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = na = nb = 0.0
    for i in range(len(a)):
        bi = b[i] if i < len(b) else 0
        dot += a[i] * bi
        na += a[i] * a[i]
        nb += bi * bi
    return dot / math.sqrt(na * nb) if na and nb else 0


async def embeddings_for(ids: list[str]) -> dict[str, tuple[str, list[float]]]:
    """Name and vector of each catalog game that has one."""
    rows = await db.rows(
        'SELECT id, name, embedding FROM game WHERE id IN $ids.map(|$i| type::record($i))',
        {'ids': list(set(ids))},
    )
    return {r['id']: (r['name'], r['embedding']) for r in rows if r.get('embedding')}


async def similar_games(
    vector: list[float], k: int, exclude: list[str], only: list[str] | None = None
) -> list[dict[str, Any]]:
    """Nearest catalog games to a vector, excluding the given ids and, with `only`, among those
    ids alone. An exact scan: the catalog is a few thousand games, and it works with vectors of
    any size (any embedding model)."""
    among = 'AND id IN $only.map(|$i| type::record($i))' if only is not None else ''
    return await db.rows(
        f"""SELECT id, name, platforms, release_year, genres, embedding,
              vector::similarity::cosine(embedding, $v) AS score FROM game
           WHERE embedding != NONE AND array::len(embedding) = array::len($v)
             AND id NOT IN $exclude.map(|$i| type::record($i)) {among}
           ORDER BY score DESC LIMIT {k}""",
        {'v': vector, 'exclude': exclude, 'only': only or []},
    )


def annotate(
    nearest: list[dict[str, Any]],
    liked: list[Signal],
    vectors: dict[str, tuple[str, list[float]]],
) -> list[Candidate]:
    """Each candidate with the two liked games it resembles most."""
    out: list[Candidate] = []
    for g in nearest:
        v: list[float] = g.get('embedding') or []
        scored = sorted(
            ((vectors[s.game][0], cosine(v, vectors[s.game][1])) for s in liked),
            key=lambda x: x[1],
            reverse=True,
        )
        out.append(
            Candidate.model_validate(
                {k: val for k, val in g.items() if k != 'embedding' and val is not None}
                | {'similar_to': [name for name, _ in scored[:2]]}
            )
        )
    return out


async def candidates(
    library: Sequence[LibraryTitle],
    exclude: list[str],
    k: int,
    now: datetime | None = None,
    only: list[str] | None = None,
) -> list[Candidate]:
    """Nearest catalog games to the player's taste that are not excluded (owned, dismissed,
    already an interest), each annotated with the owned games it resembles."""
    sig = signals(library, now or datetime.now(UTC))
    vectors = await embeddings_for([s.game for s in sig])
    usable = [s for s in sig if s.game in vectors]
    if not usable:
        return []
    taste = mean([vectors[s.game][1] for s in usable], [s.weight for s in usable])
    liked = [s for s in usable if s.weight > 0.5]
    nearest = await similar_games(taste, k, sorted(set(exclude)), only)
    return annotate(nearest, liked, vectors)


async def games_as_candidates(
    library: Sequence[LibraryTitle], ids: list[str], now: datetime | None = None
) -> list[Candidate]:
    """The given catalog games as candidates, in the given order, each annotated with the owned
    games it resembles. A game missing from the catalog is left out."""
    if not ids:
        return []
    sig = signals(library, now or datetime.now(UTC))
    vectors = await embeddings_for([s.game for s in sig])
    liked = [s for s in sig if s.game in vectors and s.weight > 0.5]
    rows = await db.rows(
        'SELECT id, name, platforms, release_year, genres, embedding FROM game '
        'WHERE id IN $ids.map(|$i| type::record($i))',
        {'ids': list(dict.fromkeys(ids))},
    )
    by_id = {str(r['id']): r for r in rows}
    return annotate([by_id[i] for i in dict.fromkeys(ids) if i in by_id], liked, vectors)
