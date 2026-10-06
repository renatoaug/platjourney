"""The platinum guide: one web research per catalog game, returned as structured JSON."""

from typing import Any

from pydantic import BaseModel

from . import llm
from .schemas import Game, Trophy


def _key_trophy() -> dict[str, Any]:
    return {
        'type': ['object', 'null'],
        'additionalProperties': False,
        'required': ['trophy', 'why'],
        'properties': {
            'trophy': {'type': 'string', 'description': 'Exact pt-BR trophy name from the list'},
            'why': {'type': 'string', 'description': 'One line in pt-BR'},
        },
    }


SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': [
        'difficulty',
        'hours',
        'playthroughs',
        'hasMissables',
        'hasOnline',
        'overview',
        'glossary',
        'missables',
        'roadmap',
        'earlyTips',
        'onlineTrophies',
        'easiest',
        'hardest',
        'mostTedious',
        'tricks',
        'buggy',
        'collectibles',
        'difficultyTrophy',
        'postgame',
        'pointOfNoReturn',
        'autopop',
        'sources',
        'unobtainable',
    ],
    'properties': {
        'difficulty': {
            'type': 'number',
            'description': 'Platinum difficulty from 1 to 10, as guides rate it',
        },
        'hours': {'type': 'number', 'description': 'Estimated hours to platinum'},
        'playthroughs': {'type': 'number'},
        'hasMissables': {'type': 'boolean'},
        'hasOnline': {'type': 'boolean', 'description': 'Any trophy requires online play'},
        'overview': {
            'type': 'string',
            'description': 'Two sentences in pt-BR about what the platinum is like',
        },
        'glossary': {
            'type': 'array',
            'description': (
                'Game terms a beginner does not know (acronyms, systems, activities, places), '
                'each with a one-line pt-BR explanation'
            ),
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['term', 'meaning'],
                'properties': {'term': {'type': 'string'}, 'meaning': {'type': 'string'}},
            },
        },
        'missables': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['trophy', 'when', 'how'],
                'properties': {
                    'trophy': {
                        'type': 'string',
                        'description': 'Exact pt-BR trophy name from the list',
                    },
                    'when': {
                        'type': 'string',
                        'description': 'Chapter/mission/point where it can be missed',
                    },
                    'how': {'type': 'string'},
                },
            },
        },
        'roadmap': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['phase', 'goal', 'trophies'],
                'properties': {
                    'phase': {'type': 'string'},
                    'goal': {'type': 'string'},
                    'trophies': {'type': 'array', 'items': {'type': 'string'}},
                },
            },
        },
        'earlyTips': {
            'type': 'array',
            'items': {'type': 'string'},
            'description': 'Up to 5 tips for the first hours that save time later, in pt-BR',
        },
        'onlineTrophies': {
            'type': 'array',
            'description': (
                'Trophies that need online/multiplayer, with what exactly and whether boosting '
                'with a partner works'
            ),
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['trophy', 'what', 'boostable'],
                'properties': {
                    'trophy': {'type': 'string'},
                    'what': {'type': 'string'},
                    'boostable': {'type': 'boolean'},
                },
            },
        },
        'easiest': _key_trophy(),
        'hardest': _key_trophy(),
        'mostTedious': _key_trophy(),
        'tricks': {
            'type': 'array',
            'description': (
                'Shortcuts, exploits and community tricks that make a trophy much easier (e.g. a '
                'mission with infinite fuel to grind drifting). Only real, sourced tricks.'
            ),
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['trophy', 'trick', 'source'],
                'properties': {
                    'trophy': {'type': 'string'},
                    'trick': {'type': 'string', 'description': 'Concrete steps in pt-BR'},
                    'source': {
                        'type': 'string',
                        'description': 'Site or community name, no URL',
                    },
                },
            },
        },
        'buggy': {
            'type': 'array',
            'description': (
                'Trophies known to glitch or not unlock on this edition and platform, one entry '
                'per trophy (a glitch that hits two trophies becomes two entries)'
            ),
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['trophy', 'issue', 'workaround', 'reported', 'status'],
                'properties': {
                    'trophy': {
                        'type': 'string',
                        'description': 'Exact pt-BR name of a single trophy',
                    },
                    'issue': {'type': 'string'},
                    'workaround': {'type': 'string'},
                    'reported': {
                        'type': 'string',
                        'description': (
                            'When and on which version the reports are from, pt-BR (e.g. '
                            '"relatos de 2013, versão de PS3" or "relatos de 2024 na versão de '
                            'PS5")'
                        ),
                    },
                    'status': {
                        'type': 'string',
                        'enum': ['recent', 'old', 'fixed', 'unconfirmed'],
                        'description': (
                            'recent: reported in the last 2 years on this version; old: only '
                            'older reports, may be fixed by patches; fixed: a patch fixed it; '
                            'unconfirmed: a single report'
                        ),
                    },
                },
            },
        },
        'collectibles': {
            'type': ['string', 'null'],
            'description': (
                'How many collectibles the platinum needs and whether an in-game tracker '
                'exists, pt-BR'
            ),
        },
        'difficultyTrophy': {
            'type': ['string', 'null'],
            'description': (
                'Whether a trophy needs a specific difficulty: which trophy and difficulty, '
                'whether difficulty trophies stack, and whether you can lower the difficulty '
                'mid-game without losing it, pt-BR. Null when no trophy depends on difficulty.'
            ),
        },
        'postgame': {
            'type': ['string', 'null'],
            'description': (
                'What is left after the ending: free roam, chapter or mission select, NG+, and '
                'whether missed trophies can be cleaned up there, pt-BR'
            ),
        },
        'pointOfNoReturn': {
            'type': ['string', 'null'],
            'description': (
                'Whether the game locks content after a point and what to finish before it, pt-BR'
            ),
        },
        'autopop': {
            'type': ['string', 'null'],
            'description': (
                'Whether PS4/PS5 versions share saves and auto-pop trophies (stackable lists), '
                'pt-BR'
            ),
        },
        'sources': {
            'type': 'array',
            'items': {'type': 'string'},
            'description': 'Site names used, no URLs',
        },
        'unobtainable': {
            'type': ['string', 'null'],
            'description': (
                'Only when the platinum can no longer be earned today (servers shut down, '
                'content delisted): one line in pt-BR saying why and since when. Otherwise null.'
            ),
        },
    },
}

INSTRUCTIONS = ' '.join(
    [
        'You research platinum trophy guides. Search the web for complete written trophy guides '
        'and trophy hunting communities, and return a structured summary written in Brazilian '
        'Portuguese.',
        'Research the exact edition and platform given: remasters and ports often have their '
        'own trophy list, fixes and glitches. Leave out bugs and tips that only apply to another '
        'version unless someone confirms them on this one.',
        'Be surgical: name the exact mission, chapter, region, character, ally, item, build or '
        'setting. Never give generic advice such as "pick a mission where allies distract the '
        'boss"; say which mission and which allies.',
        'Write the facts, never the research: no "the sources say", "according to the guide" or '
        '"sources disagree" in any field. When something is unconfirmed, say it plainly '
        '("the total is not confirmed yet"). Sources are credited only in the sources and source '
        'fields.',
    ]
)


class Edition(BaseModel):
    """The PSN trophy list's own name and platform ("Far Cry 3 Classic Edition", PS4)."""

    name: str
    platform: str


def trophy_list(trophies: list[Trophy]) -> str:
    return '\n'.join(f'- [{t.type}] {t.name_en} (pt-BR: {t.name}): {t.detail_en}' for t in trophies)


def prompt(game: Game, trophies: list[Trophy] | None, edition: Edition | None) -> tuple[str, str]:
    """Instructions and input. With the PSN trophy list the guide uses exact trophy names;
    without it (a game the player does not own) it is web-only. The catalog groups every
    release of a game under one entry, so the edition names the one to research."""
    platform = (
        edition.platform
        if edition
        else '/'.join(p for p in game.platforms if p.startswith('PS')) or 'PlayStation'
    )
    name = edition.name if edition else game.name
    if trophies is not None:
        return (
            f'{INSTRUCTIONS} Use only trophy names from the provided list.',
            f'Game: {name} ({platform} trophy list)\n\nTrophy list:\n{trophy_list(trophies)}',
        )
    return (
        f'{INSTRUCTIONS} Use the official trophy names as the guides list them (pt-BR names '
        'when a Brazilian guide has them, otherwise English).',
        f'Game: {name} ({platform})',
    )


async def research(
    game: Game, trophies: list[Trophy] | None = None, edition: Edition | None = None
) -> dict[str, Any]:
    instructions, input = prompt(game, trophies, edition)
    return await llm.research_json('platinum_guide', instructions, input, SCHEMA)
