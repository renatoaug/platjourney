import './env.ts'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as aiClient from '../src/ai.ts'
import * as demo from '../src/demo.ts'
import * as lib from '../src/library.ts'
import { PLAYER_APP } from '../src/mcp-apps/player.ts'
import { READABLE } from '../src/mcp-apps/view.ts'
import * as shared from '../src/mcp-tools/shared.ts'
import { changedPrefs, emptyPrefs } from '../src/recommend.ts'
import * as interests from '../src/repository/interest.ts'
import * as similar from '../src/repository/similar.ts'
import * as users from '../src/repository/user.ts'
import { withTrophyCards } from '../src/routes/chat.ts'
import * as watcher from '../src/watcher.ts'
import { makeContext, makeGame, makeTitle, makeTrophy, makeUser } from './api-fixtures.ts'

const tool = (name: string) => {
  const found = PLAYER_APP.tools.find((t) => t.name === name)
  if (!found) throw new Error(`no tool ${name}`)
  return found
}

afterEach(() => mock.restore())

let save: ReturnType<typeof spyOn>
beforeEach(() => {
  save = spyOn(users, 'updateUser').mockResolvedValue(undefined as never)
})

test('a taste change keeps everything it does not name', () => {
  const current = {
    added: { genres: ['RPG'], traits: [], avoid: ['Online'] },
    removed: { genres: ['Tiro'], traits: ['Curto'], avoid: [] },
    filters: { noMissables: true, maxHours: 40 },
  }
  expect(
    changedPrefs(current, { add: { genres: ['Indie'] }, filters: { noOnline: true } }),
  ).toEqual({
    added: { genres: ['RPG', 'Indie'], traits: [], avoid: ['Online'] },
    removed: { genres: ['Tiro'], traits: ['Curto'], avoid: [] },
    filters: { noMissables: true, noOnline: true, maxHours: 40 },
  })
})

test('adding what was removed undoes it, and removing what was added too', () => {
  const current = {
    added: { genres: ['RPG'], traits: [], avoid: [] },
    removed: { genres: ['Tiro'], traits: [], avoid: [] },
    filters: {},
  }
  expect(
    changedPrefs(current, { add: { genres: ['tiro'] }, remove: { genres: ['rpg'] } }),
  ).toMatchObject({
    added: { genres: ['tiro'] },
    removed: { genres: ['rpg'] },
  })
})

test('a filter turns off, and a change of the wrong shape is refused', () => {
  const current = { ...emptyPrefs(), filters: { noOnline: true } }
  expect(changedPrefs(current, { filters: { noOnline: false } })?.filters).toEqual({})
  expect(changedPrefs(current, { add: { genres: 'RPG' } })).toBeNull()
})

test('saving from the view merges with what the player already had', async () => {
  const user = makeUser({
    taste_prefs: {
      added: { genres: ['RPG'], traits: [], avoid: [] },
      removed: { genres: ['Tiro'], traits: [], avoid: [] },
      filters: { maxHours: 40 },
    },
  } as never)
  await tool('change_taste_preferences').run(user, { add: { traits: ['Curto'] } })
  expect(save).toHaveBeenCalledWith(user.id, {
    taste_prefs: {
      added: { genres: ['RPG'], traits: ['Curto'], avoid: [] },
      removed: { genres: ['Tiro'], traits: [], avoid: [] },
      filters: { maxHours: 40 },
    },
  })
})

const game = makeGame({
  id: 'game:9',
  name: 'Stray',
  art_url: 'https://images.igdb.com/a.jpg',
  cover_url: 'https://evil.example/c.jpg',
})

test('the assistant chooses the game, and the view shows it with what the app knows', async () => {
  const ai = spyOn(aiClient, 'ai')
  spyOn(watcher, 'currentOrCheck').mockResolvedValue(undefined)
  spyOn(shared, 'gameFrom').mockResolvedValue(game)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(similar, 'guideFacts').mockResolvedValue([{ game: 'game:9', difficulty: 2, hours: 10 }])
  spyOn(interests, 'listInterests').mockResolvedValue([])
  const shown = await tool('show_platinum_pick').run(
    makeUser(),
    { game: 'game:9', reason: 'Curto.', firstStep: 'Comece.' },
    { assistant: 'chatgpt', base: 'https://app.test' },
  )
  expect(shown).toMatchObject({
    name: 'Stray',
    reason: 'Curto.',
    firstStep: 'Comece.',
    difficulty: 2,
    hours: 10,
    progress: null,
    artUrl: 'https://images.igdb.com/a.jpg',
    coverUrl: null,
    url: 'https://app.test/title/game/game%3A9',
  })
  expect(ai).not.toHaveBeenCalled()
  expect(tool('show_platinum_pick').changes).toBeUndefined()
  await expect(tool('show_platinum_pick').run(makeUser(), { game: 'game:9' })).rejects.toThrow(
    'why',
  )
})

test('the card says whether the game is already in the interests', async () => {
  spyOn(watcher, 'currentOrCheck').mockResolvedValue(undefined)
  spyOn(shared, 'gameFrom').mockResolvedValue(game)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(similar, 'guideFacts').mockResolvedValue([])
  const list = spyOn(interests, 'listInterests').mockResolvedValue([])
  const show = tool('show_platinum_pick')
  const args = { game: 'game:9', reason: 'Curto.' }
  expect(await show.run(makeUser(), args)).toMatchObject({ interested: false })
  list.mockResolvedValue([{ game: { id: 'game:9' } }] as never)
  expect(await show.run(makeUser(), args)).toMatchObject({ interested: true })
})

test('the game being played now is not a next platinum, unless the player asked about it', async () => {
  spyOn(shared, 'gameFrom').mockResolvedValue(game)
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(similar, 'guideFacts').mockResolvedValue([])
  spyOn(interests, 'listInterests').mockResolvedValue([])
  spyOn(watcher, 'currentOrCheck').mockResolvedValue(makeContext({ game }))
  const show = tool('show_platinum_pick')
  await expect(show.run(makeUser(), { game: 'game:9', reason: 'Curto.' })).rejects.toThrow('on now')
  expect(
    await show.run(makeUser(), { game: 'game:9', reason: 'Curto.', allowCurrent: true }),
  ).toMatchObject({ name: 'Stray' })
})

test('a hidden trophy the player asks about gets its card, marked as hidden, with the assistant tip', async () => {
  spyOn(shared, 'gameFrom').mockResolvedValue(game)
  spyOn(shared, 'ownCopy').mockReturnValue(makeTitle())
  spyOn(lib, 'library').mockResolvedValue([])
  spyOn(demo, 'trophiesFor').mockResolvedValue([
    makeTrophy({ id: 1, name: 'Aberto', iconUrl: 'https://image.api.playstation.com/x.png' }),
    makeTrophy({ id: 2, name: 'Segredo', hidden: true, earned: false }),
  ])
  const show = tool('show_trophy_card')
  expect(
    await show.run(makeUser(), { game: 'game:9', trophy: 'aberto', tip: 'Faça assim.' }),
  ).toMatchObject({
    name: 'Aberto',
    tip: 'Faça assim.',
    iconUrl: 'https://image.api.playstation.com/x.png',
  })
  expect(await show.run(makeUser(), { game: 'game:9', trophy: 'Segredo' })).toMatchObject({
    name: 'Segredo',
    hidden: true,
  })
  await expect(show.run(makeUser(), { game: 'game:9', trophy: 'Nada' })).rejects.toThrow(
    'No trophy',
  )
  const reveals = makeUser({ revealed_trophy_games: ['game:9'] } as never)
  expect(await show.run(reveals, { game: 'game:9', trophy: 'Segredo' })).toMatchObject({
    name: 'Segredo',
    hidden: false,
  })
})

test('every view blocks connections and only allows images from the PSN', () => {
  for (const resource of PLAYER_APP.resources) {
    expect(resource.mimeType).toBe('text/html;profile=mcp-app')
    expect(resource.text).toContain("connect-src 'none'")
    expect(resource.text).not.toContain('</script</')
    expect(resource._meta?.ui?.csp?.connectDomains).toEqual([])
  }
})

describe('the trophy card on a chat answer', () => {
  const ctx = makeContext({
    game: makeGame({ id: 'game:1' }),
    trophies: [
      makeTrophy({ id: 1, name: 'Mira Certeira', earned: false }),
      makeTrophy({ id: 2, name: 'Piedade', earned: true }),
      makeTrophy({ id: 3, name: 'Segredo', earned: false, hidden: true }),
    ],
  })
  const game = { id: 'game:1', name: 'Jogo' } as never
  const answerTo = (content: string, user = makeUser()) =>
    withTrophyCards(
      [
        { id: 'm1', role: 'user', content, created_at: '', game },
        { id: 'm2', role: 'assistant', content: 'resposta', created_at: '', game },
      ],
      user,
      ctx,
    )[1] as { trophy?: { name: string; earned: boolean } }

  test('comes from the trophy the question names', () => {
    expect(answerTo('Sobre o troféu **Mira Certeira**: como?').trophy?.name).toBe('Mira Certeira')
    expect(answerTo('como pego mira certeira?').trophy?.name).toBe('Mira Certeira')
  })

  test('a one-word name needs the bold, since it may be an ordinary word', () => {
    expect(answerTo('tenha piedade de mim').trophy).toBeUndefined()
    expect(answerTo('Sobre o troféu **Piedade**: como?').trophy?.earned).toBe(true)
  })

  test('a question naming two trophies has no card', () => {
    expect(answerTo('**Piedade** ou **Mira Certeira**?').trophy).toBeUndefined()
  })

  test('a hidden trophy has no card until the player reveals it', () => {
    expect(answerTo('Sobre **Segredo**').trophy).toBeUndefined()
    const reveals = makeUser({ revealed_trophy_games: ['game:1'] } as never)
    expect(answerTo('Sobre **Segredo**', reveals).trophy?.name).toBe('Segredo')
  })

  test('an answer about another game has no card', () => {
    const other = { id: 'game:2', name: 'Outro' } as never
    const [, answer] = withTrophyCards(
      [
        { id: 'm1', role: 'user', content: '**Piedade**', created_at: '', game: other },
        { id: 'm2', role: 'assistant', content: 'x', created_at: '', game: other },
      ],
      makeUser(),
      ctx,
    ) as { trophy?: unknown }[]
    expect(answer.trophy).toBeUndefined()
  })
})

test('a refusal wrapped by the host shows only the tool message', () => {
  const readable = new Function(`${READABLE} return readable`)() as (raw: unknown) => string
  const wrapped = JSON.stringify({
    detail: `Error code: INVALID_ARGUMENT; Error: RuntimeException: Error calling MCP tool: [TextContent(type='text', text='Troféu que o guia não conhece: \\"Inventado\\"', annotations=None, meta=None)]`,
  })
  expect(readable(wrapped)).toBe('Troféu que o guia não conhece: "Inventado"')
  expect(readable(`[TextContent(type='text', text="It's refused", annotations=None)]`)).toBe(
    "It's refused",
  )
  expect(readable('Sem créditos')).toBe('Sem créditos')
  expect(readable(undefined)).toBe('')
})
