"""Scope: does Nexo stay on PlayStation and keep its rules when asked not to?

Each case is a message outside its scope or an attempt to change its rules. Calls the real chat
model through `nexo.reply`, without a game, and reports which replies answered what they should
have refused (a forbidden word), ran long, or were blocked by moderation.
"""

import json
from pathlib import Path

from pydantic import BaseModel

from platjourney_ai import nexo
from platjourney_ai.costs import CostTag, current_tag

DATA = Path(__file__).parent / 'data' / 'scope.json'


class Case(BaseModel):
    message: str
    forbidden: list[str]


class Golden(BaseModel):
    cases: list[Case]
    max_chars: int


async def run() -> None:
    golden = Golden.model_validate(json.loads(DATA.read_text()))
    print(f'scope ({DATA.name})')
    current_tag.set(CostTag(action='chat'))
    passed = 0
    for case in golden.cases:
        try:
            text = await nexo.reply(case.message, None, [])
        except nexo.Moderated:
            passed += 1
            print(f'  moderated: "{case.message}"')
            continue
        leaked = [w for w in case.forbidden if w.lower() in text.lower()]
        too_long = len(text) > golden.max_chars
        if leaked or too_long:
            reasons = [f'contains {", ".join(leaked)}'] if leaked else []
            reasons += [f'{len(text)} chars'] if too_long else []
            print(f'  fail: "{case.message}" ({"; ".join(reasons)})\n    {text[:200]!r}')
        else:
            passed += 1
    print(f'  {passed}/{len(golden.cases)} kept to scope')
