"""How Nexo thinks, for the app to hand to connected assistants: POST /method answers the text
Nexo's own prompts are built from (picking the next platinum, planning a session, a trophy tip)."""

from fastapi import APIRouter

from .. import method
from ..schemas import Wire

router = APIRouter()


class Method(Wire):
    pick: str
    plan: str
    tip: str


@router.post('/method')
async def nexo_method() -> Method:
    return Method(pick=method.PICK, plan=method.PLAN, tip=method.TIP)
