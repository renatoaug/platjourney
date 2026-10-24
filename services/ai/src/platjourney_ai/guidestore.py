"""Where the deep guide lives: passages in guide_chunk, and when each game was indexed in guide."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from . import db


class Passage(BaseModel):
    source: str
    url: str
    heading: str
    content: str
    position: int
    page_updated_at: str | None = None


class ScoredPassage(Passage):
    score: float


class Source(BaseModel):
    source: str
    url: str


class Stats(BaseModel):
    chunks: int
    sources: list[Source]


class GuideIndex(BaseModel):
    indexed_at: datetime
    trophy_total: int | None = None
    pages: list[str] = []
    passages: int = 0


_FIELDS = 'source, url, heading, content, position, page_updated_at'


async def get_index(game: str) -> GuideIndex | None:
    rows = await db.rows(
        'SELECT indexed_at, trophy_total, pages, passages FROM guide '
        'WHERE game = type::record($game) AND indexed_at != NONE LIMIT 1',
        {'game': game},
    )
    return GuideIndex.model_validate(rows[0]) if rows else None


async def save_index(game: str, trophy_total: int | None, pages: list[str], passages: int) -> None:
    # A missing $total is NONE, which option<int> accepts; null it would reject.
    vars: dict[str, Any] = {'game': game, 'pages': pages, 'passages': passages}
    if trophy_total is not None:
        vars['total'] = trophy_total
    await db.query(
        'LET $g = type::record($game); '
        'UPSERT guide SET game = $g, indexed_at = time::now(), trophy_total = $total, '
        'pages = $pages, passages = $passages WHERE game = $g',
        vars,
    )


# Passages are written this many at a time: a whole big game (a thousand passages with their
# vectors) in one statement is more than the database takes.
WRITE_BATCH = 200


async def replace_chunks(game: str, chunks: list[dict[str, Any]]) -> None:
    """Swaps a game's passages. The new ones go in first, in batches, and the old ones go only
    after all of them are in, so readers see old and new together for a moment, never none.
    If a batch fails, the new passages written so far are removed and the old ones stay."""
    old = await db.rows(
        'SELECT VALUE id FROM guide_chunk WHERE game = type::record($game)', {'game': game}
    )
    new: list[Any] = []
    try:
        for start in range(0, len(chunks), WRITE_BATCH):
            new += await db.rows(
                'LET $g = type::record($game); '
                'INSERT INTO guide_chunk $chunks.map(|$c| object::extend($c, { game: $g })) '
                'RETURN VALUE id;',
                {'game': game, 'chunks': chunks[start : start + WRITE_BATCH]},
            )
    except Exception:
        if new:
            await _delete(new)
        raise
    if old:
        await _delete(old)


async def _delete(ids: list[Any]) -> None:
    await db.query('DELETE $ids.map(|$i| type::record($i))', {'ids': ids})


async def search(game: str, vector: list[float], limit: int = 6) -> list[ScoredPassage]:
    """A game has a few hundred passages at most, so an exact scan beats an ANN index here."""
    rows = await db.rows(
        f'SELECT {_FIELDS}, vector::similarity::cosine(embedding, $v) AS score '
        # Vectors from another embedding model (before a re-embed) are skipped, not compared.
        'FROM guide_chunk WHERE game = type::record($game) '
        'AND array::len(embedding) = array::len($v) '
        f'ORDER BY score DESC LIMIT {int(limit)}',
        {'game': game, 'v': vector},
    )
    return [ScoredPassage.model_validate(r) for r in rows]


async def passages(game: str) -> list[Passage]:
    """Every passage of a game's deep guide, without the vectors: the keyword search scores them
    all."""
    rows = await db.rows(
        f'SELECT {_FIELDS} FROM guide_chunk WHERE game = type::record($game) ORDER BY position',
        {'game': game},
    )
    return [Passage.model_validate(r) for r in rows]


async def mentioning(game: str, terms: list[str], limit: int = 4) -> list[Passage]:
    """Passages that mention one of the given terms (trophy names in the guide's language)."""
    if not terms:
        return []
    rows = await db.rows(
        f'SELECT {_FIELDS} FROM guide_chunk WHERE game = type::record($game) AND '
        'array::any($terms, |$t| string::contains(string::lowercase(content), $t) '
        'OR string::contains(string::lowercase(heading), $t)) '
        f'ORDER BY position LIMIT {int(limit)}',
        {'game': game, 'terms': [t.lower() for t in terms]},
    )
    return [Passage.model_validate(r) for r in rows]


async def at_positions(game: str, positions: list[int]) -> list[Passage]:
    """The passages at the given positions, for the one that follows a passage cut short."""
    if not positions:
        return []
    rows = await db.rows(
        f'SELECT {_FIELDS} FROM guide_chunk WHERE game = type::record($game) '
        'AND position IN $positions',
        {'game': game, 'positions': positions},
    )
    return [Passage.model_validate(r) for r in rows]


async def stats(game: str) -> Stats:
    rows = await db.rows(
        'SELECT source, url, count() AS n FROM guide_chunk '
        'WHERE game = type::record($game) GROUP BY source, url',
        {'game': game},
    )
    return Stats(
        chunks=sum(int(r['n']) for r in rows),
        sources=[Source(source=r['source'], url=r['url']) for r in rows],
    )
