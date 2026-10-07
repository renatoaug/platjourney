"""The HTTP service the Bun server calls.

The server gathers the facts (PSN, database); this service writes the prompts and talks to
the model.
"""

import logging
import secrets
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from . import db
from .config import settings
from .costs import CostTag, current_tag
from .routers import deep_guide, guides, nexo, plans, recommend, servers

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    yield
    await db.close()


app = FastAPI(title='PlatJourney AI', lifespan=lifespan, docs_url=None, redoc_url=None)


# The biggest request is a game with its trophy list and a chat history: well under this.
MAX_BODY = 2_000_000

for feature in (deep_guide, nexo, plans, guides, recommend, servers):
    app.include_router(feature.router)


@app.middleware('http')
async def internal_only(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Only the Bun server may call this, and it says who the work is for."""
    if request.url.path != '/health' and not secrets.compare_digest(
        request.headers.get('x-internal-token', '').encode(), settings.ai_token.encode()
    ):
        return JSONResponse({'error': 'forbidden'}, status_code=403)
    if int(request.headers.get('content-length') or 0) > MAX_BODY:
        return JSONResponse({'error': 'body too large'}, status_code=413)
    token = current_tag.set(
        CostTag(
            user=request.headers.get('x-cost-user') or None,
            action=request.headers.get('x-cost-action') or 'other',
        )
    )
    try:
        return await call_next(request)
    finally:
        current_tag.reset(token)


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


def run() -> None:
    import uvicorn

    uvicorn.run('platjourney_ai.main:app', host=settings.ai_host, port=settings.ai_port)
