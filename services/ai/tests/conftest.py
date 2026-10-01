import pytest

from platjourney_ai.config import settings
from platjourney_ai.costs import CostTag, current_tag


@pytest.fixture(autouse=True)
def default_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests describe the defaults (OpenAI with web search), whatever the local .env says."""
    monkeypatch.setattr(settings, 'ai_provider', 'openai')
    monkeypatch.setattr(settings, 'embedding_provider', 'openai')
    monkeypatch.setattr(settings, 'ai_web_search', True)
    for name in type(settings).model_fields:
        if name.startswith('ai_model_'):
            monkeypatch.setattr(settings, name, '')
    current_tag.set(CostTag())
