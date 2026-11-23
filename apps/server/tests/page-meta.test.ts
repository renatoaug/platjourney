import './env.ts'
import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'
import type { IncomingMessage } from 'node:http'
import { pageMeta, siteBase, withPageMeta } from '../src/page-meta.ts'
import * as games from '../src/repository/game.ts'
import * as guides from '../src/repository/guide.ts'
import * as users from '../src/repository/user.ts'
import { makeGame, makeUser } from './api-fixtures.ts'

const req = (language = 'pt-BR') =>
  ({ headers: { 'accept-language': language } }) as unknown as IncomingMessage

const SHELL = `<title>PlatJourney</title>
<meta name="description" content="general">
<meta property="og:title" content="PlatJourney">
<meta property="og:description" content="general">
<meta property="og:image" content="/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="app">
`

beforeEach(() => {
  spyOn(games, 'getGame').mockResolvedValue(
    makeGame({ id: 'game:7', name: 'Astro Bot', art_url: 'https://img/art.jpg' }),
  )
  spyOn(guides, 'getGuide').mockResolvedValue({
    difficulty: 3,
    hours: 25,
    playthroughs: 1,
    missables: [{ trophy: 'a', when: '', how: '' }],
  })
  spyOn(users, 'userByOnlineId').mockResolvedValue(makeUser({ psn_online_id: 'Kratos_BR' }))
})

afterEach(() => mock.restore())

test("a game's page is previewed with its guide's facts and its art", async () => {
  expect(await pageMeta(req(), '/title/game/7')).toEqual({
    title: 'Guia de platina de Astro Bot · PlatJourney',
    description: 'Dificuldade 3/10, cerca de 25h, 1 jogatina. 1 troféu perdível.',
    image: 'https://img/art.jpg',
    canonical: '/title/game/7',
  })
  expect(games.getGame).toHaveBeenCalledWith('game:7')
  // The address the app's links once wrote, the id encoded, is the same page.
  expect((await pageMeta(req(), '/title/game/game%3A7'))?.canonical).toBe('/title/game/7')
  expect((await pageMeta(req('en'), '/title/game/game:7'))?.title).toBe(
    'Astro Bot platinum guide · PlatJourney',
  )
})

test('a game without a guide still names it, and an unknown one keeps the general preview', async () => {
  spyOn(guides, 'getGuide').mockResolvedValue(undefined)
  expect((await pageMeta(req(), '/title/game/7'))?.description).toBe(
    'Os troféus de Astro Bot e o caminho até a platina no PlatJourney.',
  )
  spyOn(games, 'getGame').mockResolvedValue(undefined)
  expect(await pageMeta(req(), '/title/game/7')).toBeNull()
})

test('a profile is previewed only for someone who shows up in the community', async () => {
  expect((await pageMeta(req(), '/profiles/kratos_br'))?.title).toBe('Kratos_BR · PlatJourney')
  spyOn(users, 'userByOnlineId').mockResolvedValue(makeUser({ community_visible: false }))
  expect(await pageMeta(req(), '/profiles/kratos_br')).toBeNull()
})

test('the guides have their own preview, and other addresses none', async () => {
  expect((await pageMeta(req(), '/guides'))?.title).toBe('Guias de platina · PlatJourney')
  expect(await pageMeta(req(), '/games')).toBeNull()
  expect(await pageMeta(req(), '/title/name/Astro')).toBeNull()
})

test("the shell takes the page's preview, escaped, and drops the app picture's size", () => {
  const html = withPageMeta(SHELL, {
    title: 'A <b> & "c"',
    description: 'd',
    image: 'https://img/x.jpg',
  })
  expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>')
  expect(html).toContain('<meta property="og:image" content="https://img/x.jpg">')
  expect(html).toContain('<meta name="description" content="d">')
  expect(html).not.toContain('og:image:width')
  expect(withPageMeta(SHELL, null)).toBe(SHELL)
  // Without its own picture, the app's stays with its size.
  expect(withPageMeta(SHELL, { title: 't', description: 'd' })).toContain('og:image:width')
})

test('a public page names its one address for search engines when the app address is known', () => {
  const html = `${SHELL}</head>`
  const meta = { title: 't', description: 'd', canonical: '/title/game/7' }
  const out = withPageMeta(html, meta, 'https://app.example')
  expect(out).toContain('<link rel="canonical" href="https://app.example/title/game/7">')
  expect(out).toContain('<meta property="og:url" content="https://app.example/title/game/7">')
  expect(withPageMeta(html, meta)).not.toContain('canonical')
})

test('the app address comes from the request when none is set, and only from a plain host', () => {
  const r = (headers: Record<string, string>) => ({ headers }) as unknown as IncomingMessage
  expect(siteBase(r({ host: 'app.example', 'x-forwarded-proto': 'https' }))).toBe(
    'https://app.example',
  )
  expect(siteBase(r({ host: 'evil"<x>' }))).toBeNull()
})
