"""Online server status: which games' online trophies are still obtainable."""

from typing import Any

from . import llm

SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['games'],
    'properties': {
        'games': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['name', 'status', 'date', 'note'],
                'properties': {
                    'name': {'type': 'string', 'description': 'Exactly as given in the input'},
                    'status': {
                        'type': 'string',
                        'enum': ['active', 'announced', 'closed', 'unknown'],
                        'description': 'active = online works; announced = shutdown date '
                        'announced; closed = servers already offline; unknown = no online '
                        'trophies or no information',
                    },
                    'date': {
                        'type': ['string', 'null'],
                        'description': 'Shutdown date (YYYY-MM-DD) when known',
                    },
                    'note': {
                        'type': ['string', 'null'],
                        'description': 'One line in pt-BR: which trophies are affected, or why '
                        'it does not matter',
                    },
                },
            },
        },
    },
}

INSTRUCTIONS = (
    'You track PlayStation online server shutdowns. For each game, search the web '
    '(publisher and PlayStation announcements, news, trophy guides and their communities) and '
    'report whether trophies that require online play are still obtainable.'
)


def prompt(names: list[str]) -> str:
    return 'Games:\n' + '\n'.join(f'- {n}' for n in names)


async def check(names: list[str]) -> dict[str, Any]:
    return await llm.research_json('server_status', INSTRUCTIONS, prompt(names), SCHEMA)
