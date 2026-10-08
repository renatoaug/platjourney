"""The eval viewer: `bun run ai:eval:view` serves http://127.0.0.1:8200 (or EVAL_VIEW_PORT).
It lists every run and compares two of the same suite case by case, lists and edits each suite's
questions, and starts a run with its estimated cost. Local only: it reads the app's database and
writes only to the evals database."""

import asyncio
import contextlib
import os
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from platjourney_ai import db

from . import questions, store
from .suites import SUITES

HERE = Path(__file__).parent
PUBLIC = HERE.parents[2] / 'apps' / 'web' / 'public'
THEME = HERE.parents[2] / 'apps' / 'web' / 'src' / 'styles' / 'theme.css'
# The app's own logo, mascot and favicon, so the viewer looks like the app.
ASSETS = {'logo.svg', 'favicon.svg', 'nexo-avatar.svg', 'icons.svg'}
# What a question costs when a suite has never run: the chat or judge calls it makes.
DEFAULT_COST = {'retrieval': 0.0002, 'scope': 0.003, 'answers': 0.02}

app = FastAPI(title='Nexo evals')
running: dict[str, asyncio.Task[str]] = {}


@app.get('/')
async def page() -> HTMLResponse:
    return HTMLResponse((HERE / 'view.html').read_text(), headers={'cache-control': 'no-store'})


@app.get('/theme.css')
async def theme() -> FileResponse:
    return FileResponse(THEME, media_type='text/css')


@app.get('/assets/{name}')
async def asset(name: str) -> FileResponse:
    if name not in ASSETS:
        raise HTTPException(404)
    return FileResponse(PUBLIC / name, media_type='image/svg+xml')


@app.get('/api/suites')
async def suites() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for suite in SUITES:
        asked = await questions.active(suite)
        last = await store.rows(
            'SELECT cost_usd, total, started_at FROM eval_run'
            " WHERE suite = $suite AND status = 'done' ORDER BY started_at DESC LIMIT 1",
            {'suite': suite},
        )
        per = (
            last[0]['cost_usd'] / last[0]['total']
            if last and last[0]['total']
            else DEFAULT_COST[suite]
        )
        task = running.get(suite)
        out.append(
            {
                'suite': suite,
                'questions': len(asked),
                'estimate_usd': round(per * len(asked), 4),
                'running': bool(task and not task.done()),
            }
        )
    return out


@app.get('/api/runs')
async def runs() -> list[dict[str, Any]]:
    return await store.rows('SELECT * FROM eval_run ORDER BY started_at DESC LIMIT 200')


@app.get('/api/runs/{run_id}')
async def run(run_id: str) -> dict[str, Any]:
    found = await store.rows('SELECT * FROM type::record($id)', {'id': f'eval_run:{run_id}'})
    if not found:
        raise HTTPException(404)
    cases = await store.rows(
        'SELECT * OMIT run FROM eval_case WHERE run = type::record($id) ORDER BY created_at',
        {'id': f'eval_run:{run_id}'},
    )
    return found[0] | {'cases': cases}


class Start(BaseModel):
    suite: str


@app.post('/api/runs')
async def start(body: Start) -> dict[str, bool]:
    if body.suite not in SUITES:
        raise HTTPException(404)
    task = running.get(body.suite)
    if task and not task.done():
        raise HTTPException(409, 'this suite is already running')
    running[body.suite] = asyncio.create_task(SUITES[body.suite]())
    return {'started': True}


@app.post('/api/runs/{run_id}/stop')
async def stop(run_id: str) -> dict[str, bool]:
    """Stops a run: cancels it when this viewer started it, and marks it stopped either way, so a
    run left "running" by a viewer that went down can be closed too. The cases done so far stay."""
    found = await store.rows(
        'SELECT suite, status FROM type::record($id)', {'id': f'eval_run:{run_id}'}
    )
    if not found:
        raise HTTPException(404)
    task = running.get(found[0]['suite'])
    if task and not task.done():
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task
    await store.query(
        "UPDATE type::record($id) SET status = 'stopped', finished_at = time::now()"
        " WHERE status = 'running'",
        {'id': f'eval_run:{run_id}'},
    )
    return {'stopped': True}


@app.get('/api/games')
async def games(q: str = '') -> list[dict[str, Any]]:
    """Catalog games Nexo can answer about (they have a stored guide), by name, the ones with
    the most deep guide passages first."""
    if len(q.strip()) < 2:
        return []
    return await db.rows(
        'SELECT record::id(game) AS id, game.name AS name, passages FROM guide'
        ' WHERE guide != NONE AND string::lowercase(game.name) CONTAINS string::lowercase($q)'
        ' ORDER BY passages DESC LIMIT 10',
        {'q': q.strip()},
    )


@app.get('/api/questions/{suite}')
async def list_questions(suite: str) -> list[dict[str, Any]]:
    if suite not in SUITES:
        raise HTTPException(404)
    return await store.rows(
        'SELECT id, data, active, created_at, updated_at FROM eval_question WHERE suite = $suite'
        ' ORDER BY active DESC, created_at',
        {'suite': suite},
    )


class Question(BaseModel):
    data: dict[str, Any]
    active: bool = True


@app.post('/api/questions/{suite}')
async def add_question(suite: str, body: Question) -> dict[str, Any]:
    if suite not in SUITES:
        raise HTTPException(404)
    [row] = await store.rows(
        'CREATE eval_question CONTENT $q', {'q': {'suite': suite, **body.model_dump()}}
    ) or [{}]
    return row


@app.put('/api/questions/{suite}/{question_id}')
async def edit_question(suite: str, question_id: str, body: Question) -> dict[str, Any]:
    found = await store.rows(
        'UPDATE type::record($id) SET data = $data, active = $active WHERE suite = $suite',
        {'id': f'eval_question:{question_id}', 'suite': suite, **body.model_dump()},
    )
    if not found:
        raise HTTPException(404)
    return found[0]


async def prepare() -> None:
    await store.migrate()
    # The server runs on its own event loop: this one's connection cannot be reused there.
    await store.close()


def main() -> None:
    asyncio.run(prepare())
    port = int(os.environ.get('EVAL_VIEW_PORT', '8200'))
    print(f'eval viewer on http://127.0.0.1:{port} (Ctrl+C to stop)')
    with contextlib.suppress(KeyboardInterrupt):
        uvicorn.run(app, host='127.0.0.1', port=port, log_level='warning')


if __name__ == '__main__':
    main()
