"""The session plan: which trophies fit in one sitting, in which order, with the trick for each."""

import json
from datetime import date
from typing import Any

from . import llm, method
from .schemas import GameContext, Trophy, shown_progress

SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['summary', 'steps', 'totalMinutes', 'warnings', 'ifTimeLeft'],
    'properties': {
        'summary': {
            'type': 'string',
            'description': 'What this session achieves, pt-BR, at most 12 words',
        },
        'steps': {
            'type': 'array',
            'description': (
                'Trophies earned this session, in the order to play them; '
                'each trophy in one step only'
            ),
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['trophy', 'minutes', 'how', 'why', 'trick', 'flexible'],
                'properties': {
                    'trophy': {
                        'type': 'string',
                        'description': 'Exact pt-BR trophy name from the missing list',
                    },
                    'minutes': {
                        'type': 'number',
                        'description': 'Realistic minutes for this player, from where they are',
                    },
                    'how': {
                        'type': 'string',
                        'description': (
                            'What to do, pt-BR, at most 2 sentences and 40 words, with the '
                            'collectibles of this stretch that count toward other trophies'
                        ),
                    },
                    'why': {'type': 'string', 'description': 'Why now, pt-BR, at most 8 words'},
                    'trick': {
                        'type': ['string', 'null'],
                        'description': (
                            'A known trick from the guide that applies, at most 25 words, or '
                            'null. Never a rewording of how: null when the guide has nothing more'
                        ),
                    },
                    'flexible': {
                        'type': 'boolean',
                        'description': (
                            'true if it can be done at any moment of the session regardless of '
                            'order (grinds, purchases, counters); false if it depends on the '
                            'previous steps (story progress)'
                        ),
                    },
                },
            },
        },
        'totalMinutes': {'type': 'number'},
        'warnings': {
            'type': 'array',
            'items': {'type': 'string'},
            'description': (
                'At most 2 warnings, only real risks the player can hit in THIS session from '
                'where they are (a missable, a point of no return); a risk from a later act or '
                'chapter stays out. Each up to 14 words, pt-BR. Empty when there is none'
            ),
        },
        'ifTimeLeft': {
            'type': ['string', 'null'],
            'description': 'What to do with spare time, pt-BR, or null',
        },
    },
}

INSTRUCTIONS = (
    f'Você é o Nexo, do PlatJourney, montando o plano de UMA sessão de jogo. {method.PLAN} Marque '
    'flexible=true só nos passos que podem ser feitos em qualquer '
    'momento da sessão (grinds, compras, contadores) e coloque-os onde atrapalham menos. Se um '
    'troféu de grind não cabe inteiro, inclua o avanço parcial e diga a meta da sessão. Explique '
    'termos do jogo quando o progresso for menor que 20%. Seja telegráfico: o jogador lê isso '
    'com o controle na mão. Nada de conselhos genéricos nos avisos. Português do Brasil, sem '
    'marcar o gênero de quem joga (nada de "pronto", "preparado", "campeão").'
)


def js_number(n: float) -> str:
    """Numbers as JavaScript prints them (12, not 12.0), so the prompt reads as before."""
    return str(int(n)) if isinstance(n, float) and n.is_integer() else str(n)


def _missing_line(t: Trophy) -> str:
    progress = (
        f' — progresso {t.progress_value or 0}/{t.progress_target}' if t.progress_target else ''
    )
    dlc = ' — DLC' if t.group_id != 'default' else ''
    return (
        f'- [{t.type}] {t.name} ({t.name_en}): {t.detail} — '
        f'{js_number(t.earned_rate)}% de quem joga{progress}{dlc}'
    )


# The latest trophies earned, with their day: where the player is in the game now.
RECENT = 6


def _recent(t: Trophy) -> str:
    return f'{t.name} ({t.earned_at[:10]})' if t.earned_at else t.name


def context(ctx: GameContext) -> str:
    shown = shown_progress(ctx)
    missing = [t for t in ctx.trophies if not t.earned]
    recent = sorted(
        (t for t in ctx.trophies if t.earned), key=lambda t: t.earned_at or '', reverse=True
    )[:RECENT]
    lines = [
        f'Jogo: {ctx.title.name} ({ctx.title.platform}) — {shown.progress}% '
        f'({shown.earned}/{shown.total} troféus{shown.label})',
        f'Tempo jogado: {js_number(ctx.hours_played)}h' if ctx.hours_played is not None else '',
        f'Últimos conquistados, do mais recente: {", ".join(_recent(t) for t in recent)}',
        f'Faltando ({len(missing)}):',
        *(_missing_line(t) for t in missing),
        # Same text as JSON.stringify on the server: compact, accents kept.
        f'\nGuia (JSON): {json.dumps(ctx.guide, ensure_ascii=False, separators=(",", ":"))}'
        if ctx.guide is not None
        else '',
    ]
    return '\n'.join(line for line in lines if line)


def plan_input(
    ctx: GameContext, minutes: float, avoid: list[str] | None = None, today: str | None = None
) -> str:
    """`avoid` is the route the player asked to replace: its trophies are asked to change."""
    day = today or date.today().isoformat()
    redo = (
        f'\nO jogador pediu outro roteiro. O atual tem: {", ".join(avoid)}. Monte um caminho '
        'diferente, com outros troféus que também cabem agora.'
        if avoid
        else ''
    )
    return (
        f'{context(ctx)}\n\n---\nHoje: {day}.{redo}\n'
        f'Tempo disponível nesta sessão: {js_number(minutes)} minutos.'
    )


async def plan_session(
    ctx: GameContext, minutes: float, avoid: list[str] | None = None
) -> dict[str, Any]:
    """Base-game trophies come first; the platinum itself is never a step."""
    response = await llm.respond(
        instructions=INSTRUCTIONS,
        reasoning={'effort': 'low'},
        text={
            'format': {
                'type': 'json_schema',
                'name': 'session_plan',
                'schema': SCHEMA,
                'strict': True,
            }
        },
        input=plan_input(ctx, minutes, avoid),
    )
    return json.loads(response.output_text)
