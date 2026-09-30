"""Embeds every catalog game that has no vector yet. Safe to re-run; run it after
`bun run seed` or `bun run catalog:expand`.

    uv run python -m platjourney_ai.jobs.embed_catalog          # games without a vector
    uv run python -m platjourney_ai.jobs.embed_catalog --all    # every game and guide passage

`--all` is for after switching the embedding model (EMBEDDING_PROVIDER, the model name):
vectors from different models do not compare, so everything is embedded again.
"""

import asyncio
import sys
from typing import Any

from .. import db, llm
from ..costs import CostTag, current_tag
from ..deepguide import embed_text

BATCH = 100


def game_text(g: dict[str, Any]) -> str:
    """What a game "is", for similarity: name, taxonomy and the IGDB summary."""
    genres: list[str] = g.get('genres') or []
    themes: list[str] = g.get('themes') or []
    modes: list[str] = g.get('modes') or []
    return '\n'.join(
        part
        for part in [
            g['name'],
            f'Genres: {", ".join(genres)}' if genres else '',
            f'Themes: {", ".join(themes)}' if themes else '',
            f'Modes: {", ".join(modes)}' if modes else '',
            f'Released: {g["release_year"]}' if g.get('release_year') else '',
            g.get('summary') or '',
        ]
        if part
    )


async def embed_catalog(everything: bool = False) -> int:
    games = await db.rows(
        'SELECT id, name, genres, themes, modes, release_year, summary FROM game'
        + ('' if everything else ' WHERE embedding = NONE')
    )
    print(f'embedding {len(games)} games')
    for i in range(0, len(games), BATCH):
        batch = games[i : i + BATCH]
        vectors = await llm.embed([game_text(g) for g in batch])
        for g, v in zip(batch, vectors, strict=True):
            await db.query(
                'UPDATE type::record($id) SET embedding = $embedding',
                {'id': g['id'], 'embedding': v},
            )
        print(f'  {min(i + BATCH, len(games))}/{len(games)}')
    return len(games)


async def embed_passages() -> int:
    """Every deep guide passage, with the same text the indexer embeds."""
    passages = await db.rows('SELECT id, heading, content, game.name AS game_name FROM guide_chunk')
    print(f'embedding {len(passages)} guide passages')
    for i in range(0, len(passages), BATCH):
        batch = passages[i : i + BATCH]
        vectors = await llm.embed(
            [embed_text(p['game_name'], p['heading'], p['content']) for p in batch]
        )
        for p, v in zip(batch, vectors, strict=True):
            await db.query(
                'UPDATE type::record($id) SET embedding = $embedding',
                {'id': p['id'], 'embedding': v},
            )
        print(f'  {min(i + BATCH, len(passages))}/{len(passages)}')
    return len(passages)


async def main() -> None:
    everything = '--all' in sys.argv[1:]
    current_tag.set(CostTag(action='catalog'))
    try:
        print(f'model: {llm.embedding_model()}')
        await embed_catalog(everything)
        if everything:
            await embed_passages()
    finally:
        await db.close()


if __name__ == '__main__':
    asyncio.run(main())
