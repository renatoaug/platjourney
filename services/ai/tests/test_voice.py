"""The chat's mic: the transcription route, with the model mocked."""

import base64
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from platjourney_ai import llm
from platjourney_ai.config import settings
from platjourney_ai.costs import Usage, cost_usd
from platjourney_ai.main import app

HEADERS = {'x-internal-token': settings.ai_token}


def test_the_question_is_transcribed_with_the_game_names(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, Any]] = []
    recorded: list[tuple[str, Usage]] = []

    async def create(**params: Any) -> Any:
        calls.append(params)
        usage = SimpleNamespace(type='tokens', input_tokens=120, output_tokens=30)
        return SimpleNamespace(text=' Quais os colecionáveis do capítulo 11? ', usage=usage)

    async def record(model: str, u: Usage, ms: int) -> None:
        recorded.append((model, u))

    monkeypatch.setattr(llm.openai.audio.transcriptions, 'create', create)
    monkeypatch.setattr(llm, 'record_call', record)
    body = {
        'audio': base64.b64encode(b'webm-bytes').decode(),
        'mime': 'audio/webm;codecs=opus',
        'locale': 'pt-BR',
        'words': ['Nexo', 'A Plague Tale: Requiem', 'Nexo', ' '],
    }
    res = TestClient(app).post('/voice/transcribe', json=body, headers=HEADERS)
    assert res.status_code == 200
    assert res.json() == {'text': 'Quais os colecionáveis do capítulo 11?'}
    assert calls[0]['model'] == 'gpt-4o-mini-transcribe'
    assert calls[0]['file'] == ('question.webm', b'webm-bytes')
    assert calls[0]['language'] == 'pt'
    assert calls[0]['prompt'].endswith('Nomes: Nexo, A Plague Tale: Requiem.')
    assert recorded == [('gpt-4o-mini-transcribe', Usage(input=120, output=30))]


def test_audio_that_is_not_base64_is_refused() -> None:
    body = {'audio': 'not base64!', 'mime': 'audio/webm'}
    res = TestClient(app).post('/voice/transcribe', json=body, headers=HEADERS)
    assert res.status_code == 400


def test_a_minute_of_speech_costs_a_fraction_of_a_cent() -> None:
    # About 600 audio tokens a minute of speech, and a short text out.
    assert cost_usd('gpt-4o-mini-transcribe', Usage(input=650, output=60)) < 0.003
