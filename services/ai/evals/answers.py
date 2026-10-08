"""Answers: is what Nexo says about a trophy right, on point and about what the player still lacks?

Each case is a question about one game, asked with that game's real guide, deep guide passages and
trophy list, as a player who has earned only the trophies the case names. A judge model scores the
answer from 1 to 5 against the guide's reference answer and checks it says nothing from `avoid`.
Calls the real chat model and the judge.
"""

import json
import re
from typing import Any, cast

from pydantic import BaseModel

from platjourney_ai import db, llm, nexo
from platjourney_ai.costs import CostTag, current_tag
from platjourney_ai.schemas import GameContext

from . import questions
from .runs import Run

# A case passes from this score up, with nothing from `avoid` in the answer.
PASS = 4


class Case(BaseModel):
    game: str
    question: str
    reference: str
    earned: list[str] = []
    avoid: list[str] = []


class Verdict(BaseModel):
    score: int
    correct: bool
    answered: bool
    avoided: bool
    reason: str


JUDGE = (
    'Você avalia respostas do Nexo, um assistente de troféus de PlayStation, para jogadores '
    'brasileiros. Recebe a pergunta, o que o jogador já conquistou, a resposta de referência do '
    'guia, o que a resposta não pode dizer e a resposta do Nexo. Dê uma nota de 1 a 5: 5 correta, '
    'completa e direta; 4 correta com detalhe faltando; 3 parcialmente correta ou vaga; 2 com erro '
    'que atrapalha; 1 errada ou fora do assunto. Fatos a mais que não contradizem a referência não '
    'tiram nota. "correct": nada contradiz a referência. "answered": responde o que foi '
    'perguntado. "avoided": não diz nada da lista do que evitar. "reason": uma frase em português '
    'com o porquê.'
)

VERDICT_SCHEMA: dict[str, Any] = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['score', 'correct', 'answered', 'avoided', 'reason'],
    'properties': {
        'score': {'type': 'integer', 'minimum': 1, 'maximum': 5},
        'correct': {'type': 'boolean'},
        'answered': {'type': 'boolean'},
        'avoided': {'type': 'boolean'},
        'reason': {'type': 'string'},
    },
}


def camel(value: Any) -> Any:
    """A stored guide (snake_case keys) as the server sends it to this service (camelCase)."""
    if isinstance(value, dict):
        items = cast(dict[str, Any], value).items()
        return {re.sub(r'_([a-z])', lambda m: m.group(1).upper(), k): camel(v) for k, v in items}
    if isinstance(value, list):
        return [camel(v) for v in cast(list[Any], value)]
    return value


async def load_context(case: Case) -> GameContext | None:
    """The game as a player who has earned only `case.earned` would have it, from the catalog,
    the stored guide and any stored copy of its trophy list. A game nobody here owns has no
    stored list: then Nexo answers from the guide and its passages alone."""
    games = await db.rows(
        'SELECT * OMIT embedding FROM game WHERE name = $name LIMIT 1', {'name': case.game}
    )
    if not games:
        return None
    game = games[0]
    guides = await db.rows('SELECT guide FROM guide WHERE game = $g LIMIT 1', {'g': game['id']})
    titles = await db.rows(
        'SELECT name, platform, trophies FROM title WHERE game = $g AND trophies != NONE LIMIT 1',
        {'g': game['id']},
    )
    title: dict[str, Any] = (
        titles[0] if titles else {'name': game['name'], 'platform': 'PS5', 'trophies': []}
    )
    earned = set(case.earned)
    stored = cast(list[dict[str, Any]], title['trophies'])
    trophies: list[dict[str, Any]] = [
        t | {'earned': bool(t['name'] in earned), 'earned_at': None} for t in stored
    ]
    base = [t for t in trophies if t.get('group_id', 'default') == 'default']
    dlc = [t for t in trophies if t.get('group_id', 'default') != 'default']
    count = sum(1 for t in trophies if t['earned'])

    def group(ts: list[dict[str, Any]]) -> dict[str, int]:
        return {'earned': sum(1 for t in ts if t['earned']), 'total': len(ts)}

    return GameContext.model_validate(
        {
            'game': {'id': str(game['id']), 'name': game['name']},
            'title': {
                'name': title['name'],
                'platform': title['platform'],
                'earned': count,
                'total': len(trophies),
                'progress': round(count / len(trophies) * 100) if trophies else 0,
            },
            'trophies': trophies,
            'guide': camel(guides[0]['guide']) if guides and guides[0].get('guide') else None,
            'groups': {'base': group(base), 'dlc': group(dlc) if dlc else None},
        }
    )


async def judge(case: Case, answer: str) -> Verdict:
    current_tag.set(CostTag(action='judge'))
    try:
        response = await llm.respond(
            instructions=JUDGE,
            input=(
                f'Pergunta: {case.question}\n'
                f'Já conquistados: {", ".join(case.earned) or "nenhum"}\n'
                f'Referência do guia: {case.reference}\n'
                f'Evitar: {"; ".join(case.avoid) or "nada além de contradizer a referência"}\n\n'
                f'Resposta do Nexo:\n{answer}'
            ),
            reasoning={'effort': 'low'},
            text={
                'format': {
                    'type': 'json_schema',
                    'name': 'verdict',
                    'schema': VERDICT_SCHEMA,
                    'strict': True,
                }
            },
        )
        return Verdict.model_validate(json.loads(response.output_text))
    finally:
        current_tag.set(CostTag(action='chat'))


async def run() -> str:
    asked = await questions.active('answers')
    print(f'answers ({len(asked)} questions)')
    current_tag.set(CostTag(action='chat'))
    record = Run('answers', {'Nexo': nexo.system_prompt(), 'Judge': JUDGE})
    await record.start(len(asked))
    try:
        for q in asked:
            case = Case.model_validate(q['data'])
            ctx = await load_context(case)
            if not ctx:
                print(f'  skipped: {case.game} is not in the catalog here')
                await record.case(
                    question=q['id'],
                    input=case.question,
                    passed=False,
                    reason='game not in the catalog',
                    game=case.game,
                    skipped=True,
                )
                continue

            async def ask_and_grade(
                case: Case = case, ctx: GameContext = ctx
            ) -> tuple[str, Verdict]:
                answer = await nexo.reply(case.question, ctx, [])
                return answer, await judge(case, answer)

            try:
                (answer, verdict), calls = await record.measure(ask_and_grade())
            except nexo.Moderated:
                await record.case(
                    question=q['id'],
                    input=case.question,
                    passed=False,
                    reason='moderated',
                    game=case.game,
                )
                continue
            passed = verdict.score >= PASS and verdict.avoided
            print(
                f'  {"ok  " if passed else "fail"} {verdict.score}/5 {case.game}: "{case.question}"'
            )
            await record.case(
                question=q['id'],
                input=case.question,
                expected=case.reference
                + (f'\nEvitar: {"; ".join(case.avoid)}' if case.avoid else ''),
                output=answer,
                passed=passed,
                score=verdict.score,
                reason=verdict.reason,
                calls=calls,
                game=case.game,
                trophy_list=bool(ctx.trophies),
                correct=verdict.correct,
                answered=verdict.answered,
                avoided=verdict.avoided,
            )
        scored = [c['score'] for c in record.cases if c['score'] is not None]
        passed = sum(c['passed'] for c in record.cases)
        mean = sum(scored) / len(scored) if scored else 0
        print(f'  {passed}/{len(record.cases)} passed · mean score {mean:.2f}/5')
        await record.finish(
            {'passed': f'{passed}/{len(record.cases)}', 'mean score': f'{mean:.2f}/5'}
        )
    except Exception as e:
        await record.fail(f'{type(e).__name__}: {e}')
        raise
    return record.id
