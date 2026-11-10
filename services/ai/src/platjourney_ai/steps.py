"""Where each trophy without a single moment probably falls, before players say (ADR-017).

The guide places story trophies at a step (`trophy_places`) and gives long trophies a range;
players' unlock times then say where the rest are usually earned (ADR-015, ADR-016). A game with
few players has no such data, so a decision model (`llm.decide`) picks, for each of those
trophies, the step players usually earn it at, from the guide's story trophies and the trophy's
own text. The expected step (the probability-weighted mean) is stored in the guide as
`predicted_steps`; saving the guide again drops it, and the server asks for it once more.
"""

import logging
from typing import Any, cast

from . import db, llm
from .schemas import Trophy

log = logging.getLogger(__name__)

UNITS = {'mission', 'chapter', 'episode', 'act', 'level'}
# A choice takes up to 255 options: the steps, one before the first and one after the story.
MAX_TOTAL = 253
# Questions sent together; the model answers each one alone against the same state.
BATCH = 60


def _items(guide: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = guide.get(key)
    return (
        [cast(dict[str, Any], x) for x in cast(list[Any], value) if isinstance(x, dict)]
        if isinstance(value, list)
        else []
    )


def _name(t: Trophy) -> str:
    return t.name_en or t.name


def _detail(t: Trophy) -> str:
    return t.detail_en or t.detail


def _matches(t: Trophy, name: str) -> bool:
    key = name.strip().casefold()
    return bool(key) and key in {t.name.strip().casefold(), t.name_en.strip().casefold()}


def plan(
    guide: dict[str, Any], trophies: list[Trophy]
) -> tuple[str, dict[str, Any], dict[str, Trophy]] | None:
    """The state and the questions for one guide, or None when it places nothing to ask about."""
    line = cast(dict[str, Any] | None, guide.get('storyline'))
    if not line or line.get('unit') not in UNITS:
        return None
    total = line.get('total')
    if not isinstance(total, int) or not 0 < total <= MAX_TOTAL:
        return None
    unit = str(line['unit'])
    places = _items(guide, 'trophy_places')
    if not places:
        return None
    kinds = {str(k.get('trophy')): k.get('kind') for k in _items(guide, 'trophy_kinds')}
    base = [t for t in trophies if t.group_id == 'default' and t.type != 'platinum']

    def place_of(t: Trophy) -> dict[str, Any] | None:
        found = [p for p in places if _matches(t, str(p.get('trophy', '')))]
        return found[0] if len(found) == 1 else None

    def single(t: Trophy, p: dict[str, Any] | None) -> bool:
        # A trophy of a single moment sits where the guide puts it; nothing to estimate.
        if p is None or (isinstance(p.get('to'), int) and p['to'] > p['from']):
            return False
        kind = next((v for k, v in kinds.items() if _matches(t, k)), None)
        return kind != 'grind' and (t.progress_target or 0) <= 1

    story: list[tuple[int, Trophy]] = []
    asked: dict[str, Trophy] = {}
    questions: dict[str, Any] = {}
    criteria = {'0': f'Before {unit} 1, at the very start of the game'}
    criteria |= {str(s): f'During {unit} {s} of {total}' for s in range(1, total + 1)}
    criteria[str(total + 1)] = 'After the main story is finished (postgame)'
    for t in base:
        p = place_of(t)
        if single(t, p) and p is not None:
            story.append((int(p['from']), t))
            continue
        where = ''
        if p is not None:
            to = p.get('to')
            end = (
                ''
                if not isinstance(to, int)
                else ' to after the story'
                if to > total
                else f' to {unit} {to}'
            )
            where = f' A guide says it can be worked on from {unit} {p["from"]}{end}.'
        rate = f' {t.earned_rate:.1f}% of all players have it.' if t.earned_rate > 0 else ''
        key = f't{t.id}'
        asked[key] = t
        questions[key] = {
            'type': 'choice',
            'criteria': criteria,
            'instructions': (
                f'Trophy "{_name(t)}" ({t.type}): {_detail(t)}.{where}{rate} '
                f'In which {unit} do players who earn this trophy usually earn it?'
            ),
        }
    if not story or not questions:
        return None
    marks = '\n'.join(
        f'- {unit} {s}: "{_name(t)}": {_detail(t)}' for s, t in sorted(story, key=lambda x: x[0])
    )
    state = (
        f'The main story has {total} {unit}s. Story trophies and the {unit} where each unlocks:\n'
        f'{marks}'
    )
    return state, questions, asked


async def predict(game: str, name: str, trophies: list[Trophy]) -> list[dict[str, Any]]:
    """The expected step of each trophy without a single moment, stored with the guide."""
    if not llm.decide_on():
        return []
    rows = await db.rows(
        'SELECT guide FROM guide WHERE game = type::record($game) LIMIT 1', {'game': game}
    )
    guide = cast(dict[str, Any] | None, rows[0].get('guide') if rows else None)
    if not guide:
        return []
    if isinstance(guide.get('predicted_steps'), list):
        return cast(list[dict[str, Any]], guide['predicted_steps'])
    planned = plan(guide, trophies)
    found: list[dict[str, Any]] = []
    if planned:
        state, questions, asked = planned
        state = f'Game: {name}. {state}'
        keys = list(questions)
        for i in range(0, len(keys), BATCH):
            part = {k: questions[k] for k in keys[i : i + BATCH]}
            answers = await llm.decide(state, part)
            for k in part:
                answer = cast(dict[str, Any], answers.get(k) or {})
                probs = cast(dict[str, float], answer.get('probabilities') or {})
                if probs:
                    step = sum(int(s) * p for s, p in probs.items()) / (sum(probs.values()) or 1)
                    # The English name matches the trophy in either language.
                    found.append({'trophy': _name(asked[k]), 'step': round(step)})
    # Stored even when empty, so the same guide is not asked about again.
    await db.query(
        'UPDATE guide SET guide.predicted_steps = $steps WHERE game = type::record($game)',
        {'game': game, 'steps': found},
    )
    log.info('predicted steps for %s: %d trophies', game, len(found))
    return found
