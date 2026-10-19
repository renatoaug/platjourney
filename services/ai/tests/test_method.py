from fastapi.testclient import TestClient

from platjourney_ai import method, nexo, next_pick, planner
from platjourney_ai.config import settings
from platjourney_ai.main import app

HEADERS = {'x-internal-token': settings.ai_token}


def test_nexo_prompts_are_built_from_the_method() -> None:
    assert method.PICK in next_pick.INSTRUCTIONS
    assert method.PLAN in planner.INSTRUCTIONS
    assert method.TIP in nexo.SYSTEM
    assert '{tip}' not in nexo.SYSTEM


def test_the_method_route_answers_the_same_text() -> None:
    r = TestClient(app).post('/method', headers=HEADERS)
    assert r.status_code == 200
    assert r.json() == {'pick': method.PICK, 'plan': method.PLAN, 'tip': method.TIP}


def test_the_method_route_is_internal() -> None:
    assert TestClient(app).post('/method').status_code == 403
