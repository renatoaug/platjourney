"""The chat's mic: POST /voice/transcribe turns a recorded question into text."""

import base64
import binascii
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import Field

from .. import llm
from ..schemas import Wire

router = APIRouter(prefix='/voice')

# A few minutes of compressed speech, base64, inside the service's body limit.
MAX_AUDIO_B64 = 1_800_000
EXTENSIONS = {'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3'}


class TranscribeRequest(Wire):
    audio: str = Field(max_length=MAX_AUDIO_B64)
    mime: str
    locale: Literal['pt-BR', 'en'] = 'pt-BR'
    # Names the speech is likely to have: Nexo, the game, its trophies.
    words: list[str] = Field(default_factory=list[str], max_length=200)


class Transcript(Wire):
    text: str


def vocabulary(locale: str, words: list[str]) -> str:
    """The prompt the model reads before the audio: a player asking Nexo about a game, and how
    the names are written."""
    names = ', '.join(dict.fromkeys(w.strip() for w in words if w.strip()))
    if locale == 'en':
        return f'A player asks Nexo, a PlayStation trophy assistant, about a game. Names: {names}.'
    return (
        'Um jogador pergunta ao Nexo, assistente de troféus de PlayStation, sobre um jogo. '
        f'Nomes: {names}.'
    )


@router.post('/transcribe')
async def transcribe(req: TranscribeRequest) -> Transcript:
    try:
        audio = base64.b64decode(req.audio, validate=True)
    except binascii.Error as e:
        raise HTTPException(400, 'audio is not base64') from e
    if not audio:
        raise HTTPException(400, 'empty audio')
    kind = req.mime.split(';')[0].strip()
    filename = f'question.{EXTENSIONS.get(kind, "webm")}'
    text = await llm.transcribe(
        audio, filename, 'en' if req.locale == 'en' else 'pt', vocabulary(req.locale, req.words)
    )
    return Transcript(text=text)
