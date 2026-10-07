"""Settings from the environment. The repository's root .env is shared with the Bun server."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[4] / '.env'


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV, extra='ignore')

    # Where the text and the vectors come from. `local` is any server that speaks the OpenAI
    # API on your machine (LM Studio, mlx-lm, llama.cpp, Ollama): free, no web search, and
    # the answers are only as good as the model you run.
    ai_provider: Literal['openai', 'local'] = 'openai'
    embedding_provider: Literal['openai', 'local'] = 'openai'
    local_base_url: str = 'http://localhost:1234/v1'
    local_model: str = ''
    local_embedding_model: str = ''
    # Thinking models (Qwen 3.5 and similar) think for minutes on a laptop before answering;
    # `none` turns that off. Any value the local server accepts as reasoning_effort works.
    local_reasoning_effort: str = 'none'
    # A small model can loop on a JSON answer until the timeout; this caps each reply.
    local_max_tokens: int = 2000
    # The longest chat answer, reasoning included, so a request for a long text cannot spend more
    # than a chat is worth. Nexo's answers are ~12 lines.
    chat_max_output_tokens: int = 1500

    # A provider and model per feature, as `provider` or `provider:model` (`openai:gpt-5.5`,
    # `local:qwen3.6:35b-a3b`). Unset, a feature uses AI_PROVIDER with OPENAI_MODEL or
    # LOCAL_MODEL. The feature is the action the server tags each request with.
    ai_model_chat: str = ''
    ai_model_tip: str = ''
    ai_model_plan: str = ''
    ai_model_recommend: str = ''
    ai_model_guide: str = ''
    ai_model_guide_index: str = ''
    ai_model_server_check: str = ''

    # Hosted web search (OpenAI only). Off, every answer comes from the stored guides, the deep
    # guide passages and the catalog, which is cheaper and faster; a local model never searches.
    ai_web_search: bool = True

    openai_api_key: str = ''
    openai_model: str = 'gpt-5.5'
    embedding_model: str = 'text-embedding-3-small'

    surreal_url: str = 'http://localhost:8000/rpc'
    surreal_user: str = 'root'
    surreal_pass: str
    surreal_ns: str = 'platjourney'
    surreal_db: str = 'main'

    # Only the Bun server calls this service; it sends this token on every request.
    # At least 32 characters: an empty or short token would leave the service open.
    ai_token: str = Field(min_length=32)
    ai_host: str = '127.0.0.1'
    ai_port: int = 8100


settings = Settings()  # pyright: ignore[reportCallIssue]
