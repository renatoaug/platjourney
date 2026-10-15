"""Platinum recommendations: candidates by taste similarity, ranked and explained by the model."""

import logging
import re
from collections.abc import Sequence
from typing import Any, Literal

from pydantic import Field, field_validator

from . import db, llm
from .schemas import Wire
from .taste import Candidate, LibraryTitle, candidates, games_as_candidates

log = logging.getLogger(__name__)

# The most recent ones describe the taste well enough and keep the prompt small;
# collectors have thousands of platinums.
MAX_PLATINUMS_IN_PROMPT = 80
MAX_IN_PROGRESS_IN_PROMPT = 30
CANDIDATES = 24
# The most catalog games the server may send as graph candidates.
MAX_GRAPH_CANDIDATES = 100

INSTRUCTIONS = (
    'You recommend PlayStation platinums to a trophy hunter. First build a taste profile from '
    'the games they platinumed and are playing (genres, studios, tone, length and difficulty '
    'they accept, what they drop) and explain it citing their games. Then choose 6 games ONLY '
    "from the candidate list (they were pre-selected by similarity to the player's library), "
    'preferring variety across genres and mixing 2 quick platinums with 4 that match the '
    'profile. Every candidate has a PlatJourney guide: use the numbers on its line ("guia: ...") '
    'as they are, and null for a number the line does not carry; never invent or look up '
    'numbers, and never confuse difficulty-specific trophies with the platinum difficulty '
    'rating. Every "why" must reference the profile and the games it '
    'resembles. The player may have said why they turned games down: steer away from games '
    'like those for that reason (too long, too hard, a genre they do not enjoy, online play) '
    'and say it in "avoid" as a kind of game, never as a game\'s name; a game turned down '
    'without a reason only stays out of the picks. The player may also have said what they like '
    'and what to avoid, and set rules: they win over anything the library suggests, so the '
    'profile keeps what they said in its lists and no pick breaks a rule. '
    'Write everything in Brazilian Portuguese, '
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


class Filters(Wire):
    """Rules the player set for every pick, checked against the guides we have."""

    no_missables: bool = False
    one_playthrough: bool = False
    no_difficulty_trophy: bool = False
    no_online: bool = False
    max_hours: float | None = None
    max_difficulty: float | None = None


class Preferences(Wire):
    """What the player said about their taste, over what the library suggests."""

    likes: list[str] = Field(default_factory=list[str])
    avoid: list[str] = Field(default_factory=list[str])
    # What an earlier profile said about them and they took out: not their taste.
    wrong: list[str] = Field(default_factory=list[str])
    filters: Filters = Field(default_factory=Filters)


class RecommendRequest(Wire):
    library: list[LibraryTitle]
    # Owned, dismissed and already-saved interests: never candidates.
    exclude: list[str] = Field(default_factory=list[str])
    # The games the player dismissed, which the model must never suggest, with why when they said.
    dismissed: list[Dismissed] = Field(default_factory=list[Dismissed])
    # Shown before, the longest ago first: candidates only when the unseen ones run out.
    seen: list[str] = Field(default_factory=list[str])
    preferences: Preferences = Field(default_factory=Preferences)
    # Catalog games ("game:123") a similarity graph chose, best first: drawn before the vector
    # search, which only fills what they leave short.
    candidates: list[str] = Field(default_factory=list[str], max_length=MAX_GRAPH_CANDIDATES)

    @field_validator('candidates')
    @classmethod
    def _game_ids(cls, ids: list[str]) -> list[str]:
        if any(not i.startswith('game:') for i in ids):
            raise ValueError('candidates must be catalog game ids ("game:123")')
        return ids


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


async def guided_games() -> list[str]:
    """Every game PlatJourney has a guide for."""
    return [
        str(g) for g in await db.rows('SELECT VALUE <string> game FROM guide WHERE guide != NONE')
    ]


async def guide_rows(ids: Sequence[str]) -> dict[str, dict[str, Any]]:
    """What the guides we already have say about each game: the numbers and the traits a
    player's rules look at."""
    rows = await db.rows(
        'SELECT game, guide.difficulty AS difficulty, guide.hours AS hours, '
        'guide.playthroughs AS playthroughs, guide.has_missables AS has_missables, '
        'guide.has_online AS has_online, guide.difficulty_trophy AS difficulty_trophy FROM guide '
        'WHERE game IN $ids.map(|$i| type::record($i)) AND guide != NONE',
        {'ids': list(ids)},
    )
    return {str(r['game']): r for r in rows}


def facts_line(r: dict[str, Any]) -> str:
    """Difficulty, hours and playthroughs from the guide, the numbers the picks rest on."""
    if r.get('difficulty') is None or r.get('hours') is None:
        return ''
    return f'dificuldade {r["difficulty"]}/10, ~{r["hours"]}h, {r["playthroughs"]} jogada(s)'


def breaks(f: Filters, r: dict[str, Any] | None) -> bool:
    """Whether what we know of a game breaks one of the player's rules. A game we know
    nothing about passes: the model checks it."""
    if not r:
        return False

    def num(key: str) -> float | None:
        v = r.get(key)
        return float(v) if isinstance(v, int | float) else None

    return bool(
        (f.no_missables and r.get('has_missables') is True)
        or (f.no_online and r.get('has_online') is True)
        or (f.no_difficulty_trophy and r.get('difficulty_trophy'))
        or (f.one_playthrough and (num('playthroughs') or 1) > 1)
        or (f.max_hours is not None and (num('hours') or 0) > f.max_hours)
        or (f.max_difficulty is not None and (num('difficulty') or 0) > f.max_difficulty)
    )


def pick_breaks(f: Filters, item: dict[str, Any]) -> bool:
    """Whether the model's own numbers for a pick break a rule."""
    return breaks(
        f,
        {
            'has_missables': item.get('hasMissables'),
            'difficulty_trophy': item.get('hasDifficultyTrophy') is True,
            'playthroughs': item.get('playthroughs'),
            'hours': item.get('hours'),
            'difficulty': item.get('difficulty'),
        },
    )


def rules_text(p: Preferences) -> str:
    f = p.filters
    rules = [
        text
        for on, text in [
            (f.no_missables, 'no missable trophies'),
            (f.one_playthrough, 'a single playthrough'),
            (f.no_difficulty_trophy, 'no trophy tied to a difficulty'),
            (f.no_online, 'no online trophies'),
        ]
        if on
    ]
    if f.max_hours is not None:
        rules.append(f'at most {f.max_hours:g} hours to platinum')
    if f.max_difficulty is not None:
        rules.append(f'difficulty at most {f.max_difficulty:g}/10')
    said = [
        *([f'Likes: {", ".join(p.likes)}'] if p.likes else []),
        *([f'Avoid: {", ".join(p.avoid)}'] if p.avoid else []),
        *([f'Not about them (leave out of the profile): {", ".join(p.wrong)}'] if p.wrong else []),
        *([f'Rules for every pick: {"; ".join(rules)}'] if rules else []),
    ]
    return '\n\nThe player said:\n' + '\n'.join(said) if said else ''


def build_input(
    library: Sequence[LibraryTitle],
    found: Sequence[Candidate],
    dismissed: Sequence[Dismissed],
    facts: dict[str, str] | None = None,
    preferences: Preferences | None = None,
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
        f'{rules_text(preferences) if preferences else ""}'
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


def resolve(
    result: dict[str, Any], found: Sequence[Candidate], filters: Filters | None = None
) -> RecommendResponse:
    """Ties each pick back to the candidate it names, under the candidate's own name, and
    drops a pick whose numbers break one of the player's rules."""
    items: list[dict[str, Any]] = []
    for item in result['items']:
        if filters and pick_breaks(filters, item):
            continue
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


async def vector_draw(
    req: RecommendRequest, guided: list[str], drawn: Sequence[Candidate], wanted: int
) -> list[Candidate]:
    """Up to `wanted` more guided games nearest the player's taste, past those already drawn:
    unseen first, then the ones shown longest ago."""
    taken = [c.id for c in drawn]
    found = await candidates(req.library, [*req.exclude, *req.seen, *taken], wanted, only=guided)
    if len(found) < wanted and req.seen:
        # Not enough unseen games: the ones shown longest ago come back first.
        order = {g: i for i, g in enumerate(req.seen)}
        again = await candidates(
            req.library, [*req.exclude, *taken], wanted + len(req.seen), only=guided
        )
        back = sorted((c for c in again if c.id in order), key=lambda c: order[c.id])
        found = [*found, *back[: wanted - len(found)]]
    return found


async def graph_draw(req: RecommendRequest, guided: list[str]) -> list[Candidate]:
    """The graph's candidates the player can still be shown, in its order: guided games only,
    never an excluded or already seen one."""
    allowed = set(guided)
    skip = {*req.exclude, *req.seen}
    ids = [g for g in dict.fromkeys(req.candidates) if g in allowed and g not in skip]
    return await games_as_candidates(req.library, ids)


async def recommend(req: RecommendRequest) -> RecommendResponse:
    filters = req.preferences.filters
    # Only games PlatJourney has a guide for: their numbers are ours, so nothing is looked up.
    # More are drawn than shown, so the player's rules can still leave enough.
    guided = await guided_games()
    wanted = CANDIDATES * 2
    # The similarity graph's games come first; the vector search fills what they leave short.
    drawn = await graph_draw(req, guided) if req.candidates else []
    if len(drawn) < wanted:
        drawn = [*drawn, *await vector_draw(req, guided, drawn, wanted - len(drawn))]
    known = await guide_rows([c.id for c in drawn])
    found = [c for c in drawn if c.id in known and not breaks(filters, known[c.id])][:CANDIDATES]
    log.info('building recommendations from %d candidates (%d drawn)', len(found), len(drawn))
    facts = {i: line for i, r in known.items() if (line := facts_line(r))}
    result = await llm.answer_json(
        'recommendations',
        INSTRUCTIONS,
        build_input(req.library, found, req.dismissed, facts, req.preferences),
        SCHEMA,
    )
    return resolve(result, found, filters)
