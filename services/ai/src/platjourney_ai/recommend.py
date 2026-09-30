"""Platinum recommendations: candidates by taste similarity, ranked and explained by the model."""

import logging
import re
from collections.abc import Sequence
from typing import Any, Literal

from pydantic import Field

from . import db, llm
from .schemas import Wire
from .taste import Candidate, LibraryTitle, candidates

log = logging.getLogger(__name__)

# The most recent ones describe the taste well enough and keep the prompt small;
# collectors have thousands of platinums.
MAX_PLATINUMS_IN_PROMPT = 80
MAX_IN_PROGRESS_IN_PROMPT = 30
CANDIDATES = 24

INSTRUCTIONS = (
    'You recommend PlayStation platinums to a trophy hunter. First build a taste profile from '
    'the games they platinumed and are playing (genres, studios, tone, length and difficulty '
    'they accept, what they drop) and explain it citing their games. Then choose 6 games ONLY '
    "from the candidate list (they were pre-selected by similarity to the player's library), "
    'preferring variety across genres and mixing 2 quick platinums with 4 that match the '
    'profile. When a candidate line carries guide numbers ("guia: ..."), use them as they are. '
    "Otherwise search the web for each pick's platinum difficulty, hours, and minimum full "
    'playthroughs on the recommended platform, from trophy guides. Also verify whether any '
    'base-game trophy requires a specific difficulty. Use null for playthroughs or '
    'hasDifficultyTrophy when unverified; never confuse difficulty-specific trophies with the '
    'platinum difficulty rating. Every "why" must reference the profile and the games it '
    'resembles. The player may have said why they turned games down: steer away from games '
    'like those for that reason (too long, too hard, a genre they do not enjoy, online play) '
    'and say it in "avoid" as a kind of game, never as a game\'s name; a game turned down '
    'without a reason only stays out of the picks. Write everything in Brazilian Portuguese, '
    'second person, without the '
    'player\'s grammatical gender (no "bem-vindo", "pronto", "campeão"; use neutral wording).'
)

SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['profile', 'items'],
    'properties': {
        'profile': {
            'type': 'object',
            'additionalProperties': False,
            'required': ['summary', 'genres', 'traits', 'avoid'],
            'description': 'What the library says about the player, written in pt-BR, '
            'second person',
            'properties': {
                'summary': {
                    'type': 'string',
                    'description': 'Two or three sentences describing the taste, citing games '
                    'from the library as evidence',
                },
                'genres': {
                    'type': 'array',
                    'items': {'type': 'string'},
                    'description': 'Up to 5 genres, ordered by preference',
                },
                'traits': {
                    'type': 'array',
                    'items': {'type': 'string'},
                    'description': 'Up to 5 short traits, e.g. "prefere platinas de 20-40h", '
                    '"gosta de mundo aberto Ubisoft", "evita multiplayer"',
                },
                'avoid': {
                    'type': 'array',
                    'items': {'type': 'string'},
                    'description': 'Up to 3 things the recommendations steered away from',
                },
            },
        },
        'items': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': [
                    'name',
                    'platform',
                    'difficulty',
                    'hours',
                    'playthroughs',
                    'hasDifficultyTrophy',
                    'why',
                    'hasMissables',
                ],
                'properties': {
                    'name': {
                        'type': 'string',
                        'description': 'Exactly one of the candidate names given in the input',
                    },
                    'platform': {'type': 'string', 'description': 'PS5 or PS4'},
                    'difficulty': {'type': 'number', 'description': 'Platinum difficulty 1-10'},
                    'hours': {'type': 'number', 'description': 'Hours to platinum'},
                    'playthroughs': {
                        'type': ['integer', 'null'],
                        'minimum': 1,
                        'description': 'Minimum full playthroughs required for the base-game '
                        'platinum on this platform, verified from a trophy guide. Null if '
                        'unknown; never assume one.',
                    },
                    'hasDifficultyTrophy': {
                        'type': ['boolean', 'null'],
                        'description': 'Whether the base-game platinum requires any trophy tied '
                        'to a specific difficulty on this platform. True if required, false only '
                        'if verified absent, null if unknown. This is not the platinum difficulty '
                        'rating.',
                    },
                    'why': {
                        'type': 'string',
                        'description': 'One line in pt-BR tying it to games the player liked',
                    },
                    'hasMissables': {'type': 'boolean'},
                },
            },
        },
    },
}


DismissReason = Literal['too_long', 'too_hard', 'genre', 'online', 'played']

# How each reason reads to the model.
REASONS: dict[str, str] = {
    'too_long': 'too long a platinum',
    'too_hard': 'too hard a platinum',
    'genre': 'a genre they do not enjoy',
    'online': 'needs online play',
    'played': 'already played it',
}


class Dismissed(Wire):
    name: str
    reason: DismissReason | None = None


class RecommendRequest(Wire):
    library: list[LibraryTitle]
    # Owned, dismissed and already-saved interests: never candidates.
    exclude: list[str] = Field(default_factory=list[str])
    # The games the player dismissed, which the model must never suggest, with why when they said.
    dismissed: list[Dismissed] = Field(default_factory=list[Dismissed])


class TasteProfile(Wire):
    summary: str
    genres: list[str]
    traits: list[str]
    avoid: list[str]


class Pick(Wire):
    name: str
    platform: str
    difficulty: float
    hours: float
    playthroughs: int | None
    has_difficulty_trophy: bool | None
    why: str
    has_missables: bool
    # The candidate the pick names ("game:123"), or None when the model strayed from the list.
    game: str | None = None
    similar_to: list[str] = Field(default_factory=list[str])


class RecommendResponse(Wire):
    profile: TasteProfile
    items: list[Pick]


def candidate_line(c: Candidate, facts: str = '') -> str:
    platforms = '/'.join(p for p in c.platforms if p.startswith('PS')) or 'PS'
    year = c.release_year if c.release_year is not None else '?'
    similar = ' e '.join(c.similar_to) or '—'
    known = f' — guia: {facts}' if facts else ''
    return (
        f'- {c.name} ({platforms}; {year}; {", ".join(c.genres[:3])}) — parecido com {similar}'
        f'{known}'
    )


async def guide_facts(ids: Sequence[str]) -> dict[str, str]:
    """Difficulty, hours and playthroughs from the guides we already have, so the picks rest
    on researched numbers instead of a web search."""
    rows = await db.rows(
        'SELECT game, guide.difficulty AS difficulty, guide.hours AS hours, '
        'guide.playthroughs AS playthroughs FROM guide '
        'WHERE game IN $ids.map(|$i| type::record($i)) AND guide != NONE',
        {'ids': list(ids)},
    )
    return {
        str(r['game']): f'dificuldade {r["difficulty"]}/10, ~{r["hours"]}h, '
        f'{r["playthroughs"]} jogada(s)'
        for r in rows
        if r.get('difficulty') is not None and r.get('hours') is not None
    }


def build_input(
    library: Sequence[LibraryTitle],
    found: Sequence[Candidate],
    dismissed: Sequence[Dismissed],
    facts: dict[str, str] | None = None,
) -> str:
    recent = sorted(library, key=lambda t: t.last_updated, reverse=True)
    platinum_total = sum(1 for t in library if t.earned_by_type.platinum == 1)
    platinumed = [t.name for t in recent if t.earned_by_type.platinum == 1][
        :MAX_PLATINUMS_IN_PROMPT
    ]
    in_progress = [
        f'{t.name} ({t.progress}%)'
        for t in recent
        if t.earned_by_type.platinum == 0 and t.progress >= 20
    ][:MAX_IN_PROGRESS_IN_PROMPT]
    candidate_list = '\n'.join(candidate_line(c, (facts or {}).get(c.id, '')) for c in found)
    turned_down = '\n'.join(
        f'{d.name} ({REASONS[d.reason]})' if d.reason else d.name for d in dismissed
    )
    never = f'\n\nDismissed before — never suggest:\n{turned_down}' if dismissed else ''
    return (
        f'Platinumed ({platinum_total} in all; the {len(platinumed)} most recent):\n'
        f'{"\n".join(platinumed)}\n\nIn progress:\n{"\n".join(in_progress)}\n\n'
        f'Candidates (pick only from these, use the exact name):\n{candidate_list}{never}'
    )


def named(name: str, found: Sequence[Candidate]) -> Candidate | None:
    """The candidate a pick names, case-insensitively. Smaller models copy the whole candidate
    line ("Ashen (PS4; 2018; RPG)"), so a name followed by its details counts too."""
    said = name.strip().lower()
    matches = [c for c in found if said == c.name.lower() or said.startswith(f'{c.name.lower()} (')]
    return max(matches, key=lambda c: len(c.name), default=None)


# The list shows plain text: markdown emphasis a model adds would show as asterisks.
def unmarked(text: str) -> str:
    return re.sub(r'\*{1,2}([^*\n]+)\*{1,2}', r'\1', text)


def resolve(result: dict[str, Any], found: Sequence[Candidate]) -> RecommendResponse:
    """Ties each pick back to the candidate it names, under the candidate's own name."""
    items: list[dict[str, Any]] = []
    for item in result['items']:
        c = named(str(item['name']), found)
        items.append(
            item
            | {
                'name': c.name if c else item['name'],
                'why': unmarked(str(item['why'])),
                'game': c.id if c else None,
                'similarTo': c.similar_to if c else [],
            }
        )
    return RecommendResponse.model_validate({'profile': result['profile'], 'items': items})


async def recommend(req: RecommendRequest) -> RecommendResponse:
    found = await candidates(req.library, req.exclude, CANDIDATES)
    log.info('building recommendations from %d candidates', len(found))
    facts = await guide_facts([c.id for c in found])
    result = await llm.research_json(
        'recommendations',
        INSTRUCTIONS,
        build_input(req.library, found, req.dismissed, facts),
        SCHEMA,
    )
    return resolve(result, found)
