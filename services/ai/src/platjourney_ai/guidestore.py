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


async def replace_chunks(game: str, chunks: list[dict[str, Any]]) -> None:
    """Swaps a game's passages in one transaction, so readers never see it half empty."""
    await db.query(
        'BEGIN TRANSACTION; '
        'LET $g = type::record($game); '
        'DELETE guide_chunk WHERE game = $g; '
        'FOR $c IN $chunks { CREATE guide_chunk CONTENT object::extend($c, { game: $g }) }; '
        'COMMIT TRANSACTION;',
        {'game': game, 'chunks': chunks},
    )


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
