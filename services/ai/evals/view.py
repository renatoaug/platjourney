"""The eval viewer: `bun run ai:eval:view` serves http://127.0.0.1:8200 (or EVAL_VIEW_PORT).
It lists every run and compares two of the same suite case by case, lists and edits each suite's
questions, starts a run with its estimated cost, and shows the questions players really asked
Nexo, to search them again and turn them into suite questions. Local only: it reads the app's
database and writes only to the evals database."""

import asyncio
import contextlib
import os
import re
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from platjourney_ai import db, deepguide
from platjourney_ai.costs import collected

from . import questions, retrieval, store
from .suites import SUITES

HERE = Path(__file__).parent
PUBLIC = HERE.parents[2] / 'apps' / 'web' / 'public'
THEME = HERE.parents[2] / 'apps' / 'web' / 'src' / 'styles' / 'theme.css'
# The app's own toast, so a confirmation here looks like one in the app.
TOAST = HERE.parents[2] / 'apps' / 'web' / 'src' / 'ui' / 'toast.css'
# The app's own logo, mascot and favicon, so the viewer looks like the app.
ASSETS = {'logo.svg', 'favicon.svg', 'nexo-avatar.svg', 'icons.svg'}
# What a question costs when a suite has never run: the chat or judge calls it makes.
DEFAULT_COST = {'retrieval': 0.0002, 'scope': 0.003, 'answers': 0.02}

app = FastAPI(title='Nexo evals')
running: dict[str, asyncio.Task[str]] = {}


@app.get('/')
async def page() -> HTMLResponse:
    return HTMLResponse((HERE / 'view.html').read_text(), headers={'cache-control': 'no-store'})


@app.get('/view.css')
async def stylesheet() -> FileResponse:
    return FileResponse(HERE / 'view.css', media_type='text/css')


@app.get('/theme.css')
async def theme() -> FileResponse:
    return FileResponse(THEME, media_type='text/css')


@app.get('/toast.css')
async def toast_styles() -> FileResponse:
    return FileResponse(TOAST, media_type='text/css')


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
        'SELECT record::id(game) AS id, game.name AS name, game.cover_url AS cover_url,'
        ' game.platforms AS platforms, game.release_year AS release_year, passages FROM guide'
        ' WHERE guide != NONE AND string::lowercase(game.name) CONTAINS string::lowercase($q)'
        ' ORDER BY passages DESC LIMIT 10',
        {'q': q.strip()},
    )


@app.get('/api/game')
async def game(ref: str) -> dict[str, Any] | None:
    """One game as the picker shows it, by record id (game:…) or by its exact name."""
    source = 'type::record($ref)' if ref.startswith('game:') else 'game WHERE name = $ref'
    found = await db.rows(
        'SELECT record::id(id) AS id, name, cover_url, platforms, release_year'
        f' FROM {source} LIMIT 1',
        {'ref': ref},
    )
    return found[0] if found else None


@app.get('/api/questions/{suite}')
async def list_questions(suite: str) -> list[dict[str, Any]]:
    if suite not in SUITES:
        raise HTTPException(404)
    # `used`: how many run cases ask it. A question no run asked can be deleted; one with history
    # is only archived, so earlier runs keep comparing against it.
    return await store.rows(
        'SELECT id, data, active, created_at, updated_at,'
        ' count((SELECT id FROM eval_case WHERE question = $parent.id)) AS used'
        ' FROM eval_question WHERE suite = $suite ORDER BY created_at DESC',
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


@app.delete('/api/questions/{suite}/{question_id}')
async def delete_question(suite: str, question_id: str) -> dict[str, bool]:
    """Deletes a question no run has asked yet (one added by mistake, a typo). A question with
    run history can only be archived: its cases would lose what they compare against."""
    ref = {'id': f'eval_question:{question_id}', 'suite': suite}
    used = await store.rows(
        'SELECT VALUE id FROM eval_case WHERE question = type::record($id) LIMIT 1', ref
    )
    if used:
        raise HTTPException(409, 'asked in a run: archive it instead')
    gone = await store.rows('DELETE type::record($id) WHERE suite = $suite RETURN BEFORE', ref)
    if not gone:
        raise HTTPException(404)
    return {'deleted': True}


# The real questions: what players asked Nexo in the chat, newest first.
REAL_MAX = 200


@app.get('/api/real')
async def real(limit: int = 100) -> list[dict[str, Any]]:
    """The questions players asked Nexo in the chat, newest first, each with Nexo's answer, the
    game and how many deep guide passages it has, where the answer's links lead (`source`) and
    whether the question is already a retrieval question. Who asked is never sent."""
    asked = await db.rows(
        'SELECT record::id(id) AS id, user, content, created_at, record::id(game) AS game,'
        ' game.name AS name FROM message'
        " WHERE role = 'user' AND game != NONE ORDER BY created_at DESC LIMIT $limit",
        {'limit': max(1, min(limit, REAL_MAX))},
    )

    async def answer(q: dict[str, Any]) -> str:
        rows = await db.rows(
            'SELECT content, created_at FROM message WHERE user = type::record($user)'
            " AND role = 'assistant' AND created_at >= type::datetime($at)"
            ' ORDER BY created_at LIMIT 1',
            {'user': str(q['user']), 'at': q['created_at']},
        )
        return str(rows[0]['content']) if rows else ''

    answers = await asyncio.gather(*(answer(q) for q in asked))
    games = {str(q['game']) for q in asked}

    # One query per game, on the game index: a single query over all of them scans every passage.
    async def guide_pages(game: str) -> tuple[str, dict[str, int]]:
        rows = await db.rows(
            'SELECT url, count() AS n FROM guide_chunk WHERE game = type::record($game)'
            ' GROUP BY url',
            {'game': f'game:{game}'},
        )
        return game, {str(r['url']): int(r['n']) for r in rows}

    pages = dict(await asyncio.gather(*(guide_pages(g) for g in games)))
    passages = {g: sum(by_url.values()) for g, by_url in pages.items()}
    in_eval = {
        str(q['data'].get('question', ''))
        for q in await store.rows("SELECT data FROM eval_question WHERE suite = 'retrieval'", {})
    }
    return [
        {
            'id': q['id'],
            'question': q['content'],
            'asked_at': q['created_at'],
            'game': f'game:{q["game"]}',
            'name': q['name'],
            'answer': a,
            'passages': passages.get(str(q['game']), 0),
            'source': source(a, set(pages.get(str(q['game']), {}))),
            'in_eval': q['content'] in in_eval,
        }
        for q, a in zip(asked, answers, strict=True)
    ]


# A link in markdown: [text](url).
_LINK = re.compile(r'\]\((https?://[^)\s]+)\)')


def source(answer: str, pages: set[str]) -> str:
    """Where the answer's links lead: `guide` when one is a page of the game's deep guide (Nexo
    links the page next to what it says from it), `web` when they come from a web search, `none`
    without links."""
    links = [url.split('?')[0] for url in _LINK.findall(answer)]
    if not links:
        return 'none'
    guide = {url.split('?')[0] for url in pages}
    return 'guide' if any(url in guide for url in links) else 'web'


class Search(BaseModel):
    game: str
    question: str


@app.post('/api/real/search')
async def search_again(body: Search) -> dict[str, Any]:
    """The question searched again with the current retrieval: its English translation and the
    passages Nexo would read now. Model calls are collected, not stored, as in the evals."""
    collected.set([])
    game = await retrieval.load_game(body.game)
    english = await deepguide.in_english(body.question)
    found = await deepguide.retrieve(game, body.question, [], retrieval.K)
    return {
        'english': english,
        'passages': [
            {'source': p.source, 'url': p.url, 'heading': p.heading, 'content': p.content[:600]}
            for p in found
        ],
    }


def main() -> None:
    asyncio.run(prepare())
    port = int(os.environ.get('EVAL_VIEW_PORT', '8200'))
    print(f'eval viewer on http://127.0.0.1:{port} (Ctrl+C to stop)')
    with contextlib.suppress(KeyboardInterrupt):
        uvicorn.run(app, host='127.0.0.1', port=port, log_level='warning')


if __name__ == '__main__':
    main()
