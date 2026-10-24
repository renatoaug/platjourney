// bun run build-seed [path] [--psn] — writes the demo seed (db/demo-seed.json by default):
// PlatJourneyDemo, a fictional player with no password, Telegram or PSN account, read-only for
// whoever opens it from the sign-in screen.
//
// Everything about the games is real and comes from the database: the catalog rows, the guides
// (every game below must have one) and the trophy lists' facts (name, platform, icon, size, how
// many trophies of each type, the platinum's name and rarity), read from any title or platinum
// row that holds that list. Those facts are the same for every player; nothing else of whoever
// owns those rows is read. With --psn, each list's full trophy definitions are also read from PSN
// (PSN_NPSSO), so the demo shows its trophies and names its unlocks.
//
// The player's progress is made up: which games, how far, and when, from the plan below and a
// fixed day (ANCHOR). The same database gives the same file; `bun run seed` moves the dates to the
// day it is loaded. Route notices come from the guides' milestones, when a guide has them.
import { isAbsolute, resolve } from 'node:path'
import { camelKeys, closeDb, gameId, plain, q, snakeKeys } from '../src/db.ts'
import type { Guide } from '../src/guide.ts'
import { startNotice, together, unlockNotice } from '../src/notices.ts'
import type { SessionPlan } from '../src/planner.ts'
import { catalogTrophies, type TitleGroups, type TrophyStatus } from '../src/psn.ts'
import type { Game } from '../src/repository/game.ts'
import type { User } from '../src/repository/user.ts'
import { reachedMilestone, routeNotice } from '../src/route.ts'

const ANCHOR = '2026-10-01T00:00:00.000Z'
const YEAR = new Date(ANCHOR).getUTCFullYear()

// Platinums, oldest first: one about every two months over the last two years.
const PLATINUMS = [
  '19560', // God of War
  '11156', // Horizon Zero Dawn
  '529', // Far Cry 3
  '14362', // Detroit: Become Human
  '74701', // Star Wars Jedi: Fallen Order
  '134581', // Marvel's Spider-Man: Miles Morales
  '204350', // The Last of Us Part I
  '75235', // Ghost of Tsushima
  '112875', // God of War Ragnarök
  '136625', // Hogwarts Legacy
  '127044', // Marvel's Spider-Man 2
  '112874', // Horizon Forbidden West
  '217594', // Rise of the Ronin
]
// Games in progress, the current one first: share of the base game earned, days since last played.
const PLAYING = [
  { game: '25076', share: 0.42, daysAgo: 1 }, // Red Dead Redemption 2
  { game: '19562', share: 0.58, daysAgo: 5 }, // Resident Evil 7: Biohazard
  { game: '7331', share: 0.31, daysAgo: 16 }, // Uncharted 4: A Thief's End
  { game: '19561', share: 0.14, daysAgo: 44 }, // Days Gone
]
// This year's interests in the player's order, and the stored recommendations.
const WANTED = ['25076', '303811', '19562', '7323'] // + Astro Bot, Rise of the Tomb Raider
const SUGGESTED = ['110248', '7603', '7609', '6801'] // Stray, Hellblade, Until Dawn, Far Cry 4
// Where each interest was saved from, in WANTED's order.
const SOURCES = ['recommendations', 'releases', 'title', 'search']
// The demo's PS Plus tier, and a made-up sale on a saved game it does not own (cents, days from the
// anchor to its end), so the deals band and the interest's tag show.
const PS_PLUS = 'extra'
const DEALS: Record<string, { base: number; price: number; discount: number; days: number }> = {
  '303811': { base: 33990, price: 23793, discount: 30, days: 8 }, // Astro Bot
}
const GOALS = { [YEAR]: 12, [YEAR - 1]: 8 }
const PLAN_MINUTES = 120

const ROOT = new URL('../../../', import.meta.url).pathname
const args = process.argv.slice(2)
const withPsn = args.includes('--psn')
const target = args.find((a) => !a.startsWith('--')) ?? 'db/demo-seed.json'
const out = isAbsolute(target) ? target : resolve(ROOT, target)

// A fixed sequence of numbers, so the made-up parts come out the same every time.
let state = 20_261_001
const random = () => {
  state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
  return state / 2_147_483_648
}
const DAY = 86_400_000
const at = (daysAgo: number, hour: number) =>
  new Date(new Date(ANCHOR).getTime() - daysAgo * DAY + hour * 3_600_000).toISOString()
const key = (id: string) => id.replace(/^game:/, '')
const fail = (message: string): never => {
  throw new Error(`build-seed: ${message}`)
}

type Counts = TitleGroups['base']['definedByType']
interface ListFacts {
  np: string
  name: string
  platform: string
  icon: string
  total: number
  groups: TitleGroups
  trophies: TrophyStatus[] | null
}

async function gameOf(id: string): Promise<Game> {
  const row = plain(await q<Game[]>('SELECT * OMIT embedding FROM $id', { id: gameId(id) }))[0]
  return row ?? fail(`game ${id} is not in the catalog`)
}

async function guideOf(game: Game): Promise<{ guide: Guide; fetched_at: string }> {
  const [row] = plain(
    await q<{ guide: Guide | null; fetched_at: string }[]>(
      'SELECT guide, fetched_at FROM guide WHERE game = $game',
      { game: gameId(key(game.id)) },
    ),
  )
  if (!row?.guide) fail(`${game.name} has no guide`)
  return { ...row, guide: camelKeys(row.guide) } as { guide: Guide; fetched_at: string }
}

const zero = (): Counts => ({ bronze: 0, silver: 0, gold: 0, platinum: 0 })
const sum = (c: Counts) => c.bronze + c.silver + c.gold + c.platinum

// The base/DLC split of a full trophy list, with nothing earned.
function groupsOf(list: TrophyStatus[]): TitleGroups {
  const count = (inBase: boolean) => {
    const defined = zero()
    for (const t of list)
      if ((t.groupId === 'default') === inBase && t.type in defined)
        defined[t.type as keyof Counts]++
    return {
      earned: 0,
      total: sum(defined),
      remaining: defined.bronze + defined.silver + defined.gold,
      earnedByType: zero(),
      definedByType: defined,
    }
  }
  const dlc = count(false)
  const names = [...new Set(list.filter((t) => t.groupId !== 'default').map((t) => t.groupId))]
  return { base: count(true), dlc: dlc.total ? dlc : null, dlcNames: names }
}

// The trophy list's facts: from any title row of the game that has its split, and with --psn the
// full list from PSN.
async function listOf(game: Game): Promise<ListFacts> {
  const [row] = plain(
    await q<
      {
        np_communication_id: string
        name: string
        platform: string
        icon_url: string
        total: number
        groups: TitleGroups | null
      }[]
    >(
      'SELECT np_communication_id, name, platform, icon_url, total, groups FROM title WHERE game = $game AND groups != NONE ORDER BY np_communication_id LIMIT 1',
      { game: gameId(key(game.id)) },
    ),
  )
  if (!row?.groups) fail(`no trophy list with its split is stored for ${game.name}`)
  if (!game.np_communication_ids.includes(row.np_communication_id))
    fail(`${game.name} does not list ${row.np_communication_id}`)
  const trophies = withPsn
    ? ((await catalogTrophies([row.np_communication_id]))?.trophies ??
      fail(`PSN has no trophy list for ${game.name}`))
    : null
  return {
    np: row.np_communication_id,
    name: row.name,
    platform: row.platform,
    icon: row.icon_url,
    total: trophies?.length ?? row.total,
    groups: trophies ? groupsOf(trophies) : camelKeys(row.groups as TitleGroups),
    trophies,
  }
}

async function platinumOf(list: ListFacts): Promise<{ name: string; rate: number }> {
  const fromList = list.trophies?.find((t) => t.type === 'platinum')
  const [row] = plain(
    await q<{ trophy_name: string; rarity_rate: number }[]>(
      'SELECT trophy_name, rarity_rate FROM platinum WHERE np_communication_id = $np LIMIT 1',
      { np: list.np },
    ),
  )
  const name = fromList?.name ?? row?.trophy_name ?? fail(`no platinum name for ${list.name}`)
  return { name, rate: row?.rarity_rate ?? 0 }
}

// Earns a share of each trophy type of the base game (all of it for a platinum) and, with a full
// list, marks which trophies those are: the first ones of each type, in the list's order.
function progress(list: ListFacts, share: number, finishedAt: string, startedAt: string) {
  const base = list.groups.base
  const earnedByType: Counts = {
    bronze: Math.floor(base.definedByType.bronze * share),
    silver: Math.floor(base.definedByType.silver * share),
    gold: Math.floor(base.definedByType.gold * share),
    platinum: share >= 1 ? base.definedByType.platinum : 0,
  }
  const groups: TitleGroups = {
    ...list.groups,
    base: {
      ...base,
      earned: sum(earnedByType),
      remaining:
        base.definedByType.bronze -
        earnedByType.bronze +
        (base.definedByType.silver - earnedByType.silver) +
        (base.definedByType.gold - earnedByType.gold),
      earnedByType,
    },
  }
  const left = { ...earnedByType }
  const span = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  const trophies = list.trophies?.map((t, i) => {
    const type = t.type as keyof Counts
    const earned = t.groupId === 'default' && type in left && left[type] > 0
    if (earned) left[type]--
    const earnedAt = earned
      ? new Date(
          new Date(startedAt).getTime() + (span * (i + 1)) / (list.trophies?.length ?? 1),
        ).toISOString()
      : undefined
    return {
      ...t,
      earned,
      rarity: '',
      ...(earned ? { earnedAt: t.type === 'platinum' ? finishedAt : earnedAt } : {}),
    }
  })
  const earned = sum(earnedByType)
  return {
    groups,
    trophies,
    earned,
    progress: Math.round((earned / list.total) * 100),
    earnedIds: (trophies ?? []).filter((t) => t.earned).map((t) => t.id),
  }
}

const user = {
  key: 'demo',
  psn_online_id: 'PlatJourneyDemo',
  psn_account_id: 'demo',
  demo: true,
  avatar_url: '/logo.svg',
  include_dlc_progress: false,
  ps_plus: PS_PLUS,
  goal_targets: Object.fromEntries(Object.entries(GOALS).map(([y, n]) => [y, n])),
  last_seen_at: at(1, 22),
} as Record<string, unknown>
const asUser = { ...user, id: 'user:demo', locale: null } as unknown as User

type Row = Record<string, unknown>
const games = new Map<string, Game>()
const guides = new Map<string, Row>()
const titles: Row[] = []
const platinums: Row[] = []
const playtimes: Row[] = []
const notices: { kind: string; content: string; game: string; created_at: string }[] = []

async function remember(id: string): Promise<{ game: Game; guide: Guide }> {
  const game = games.get(id) ?? (await gameOf(id))
  games.set(id, game)
  if (!guides.has(id)) {
    const { guide, fetched_at } = await guideOf(game)
    guides.set(id, { game: id, guide, fetched_at })
  }
  return { game, guide: (guides.get(id) as { guide: Guide }).guide }
}

const hoursFor = (guide: Guide, share: number) =>
  Math.max(2, Math.round(guide.hours * share * (0.85 + random() * 0.35) * 10) / 10)

for (const [i, id] of PLATINUMS.entries()) {
  const { game, guide } = await remember(id)
  const list = await listOf(game)
  const platinum = await platinumOf(list)
  const hours = hoursFor(guide, 1)
  const finishedAt = at(690 - i * 55 + Math.floor(random() * 9), 20 + Math.floor(random() * 3))
  const playDays = Math.min(60, Math.max(7, Math.round(hours / 2)))
  const startedAt = new Date(new Date(finishedAt).getTime() - playDays * DAY).toISOString()
  const p = progress(list, 1, finishedAt, startedAt)
  titles.push({
    user: 'demo',
    game: id,
    np_communication_id: list.np,
    name: list.name,
    platform: list.platform,
    icon_url: list.icon,
    progress: p.progress,
    earned: p.earned,
    total: list.total,
    earned_ids: p.earnedIds,
    groups: p.groups,
    ...(p.trophies ? { trophies: p.trophies } : {}),
    created_at: startedAt,
    last_updated_at: finishedAt,
    last_tip_at: startedAt,
  })
  platinums.push({
    user: 'demo',
    game: id,
    np_communication_id: list.np,
    trophy_name: platinum.name,
    earned_at: finishedAt,
    rarity_rate: platinum.rate,
  })
  playtimes.push({
    user: 'demo',
    game: id,
    seconds: Math.round(hours * 3600),
    play_count: Math.max(3, Math.round(hours / 2.5)),
    first_played_at: startedAt,
    last_played_at: finishedAt,
  })
  const title = { title: { name: list.name }, game } as Parameters<typeof startNotice>[1]
  notices.push({
    kind: 'start',
    content: startNotice(asUser, title),
    game: id,
    created_at: startedAt,
  })
  notices.push({
    kind: 'unlock',
    content: unlockNotice(asUser, title, [
      { name: platinum.name, type: 'platinum', earnedRate: platinum.rate } as TrophyStatus,
    ]),
    game: id,
    created_at: finishedAt,
  })
}

const SESSION = (game: string, count: number, minutes: number) =>
  `Sessão de ${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')} em ${game}: ${count} troféus novos.`

let current: { game: Game; guide: Guide; list: ListFacts } | null = null
for (const { game: id, share, daysAgo } of PLAYING) {
  const { game, guide } = await remember(id)
  const list = await listOf(game)
  const hours = hoursFor(guide, share)
  const lastAt = at(daysAgo, 21 + Math.floor(random() * 2))
  const playDays = Math.min(90, Math.max(5, Math.round(hours / 1.5)))
  const startedAt = new Date(new Date(lastAt).getTime() - playDays * DAY).toISOString()
  const p = progress(list, share, lastAt, startedAt)
  current ??= { game, guide, list }
  titles.push({
    user: 'demo',
    game: id,
    np_communication_id: list.np,
    name: list.name,
    platform: list.platform,
    icon_url: list.icon,
    progress: p.progress,
    earned: p.earned,
    total: list.total,
    earned_ids: p.earnedIds,
    groups: p.groups,
    ...(p.trophies ? { trophies: p.trophies } : {}),
    created_at: startedAt,
    last_updated_at: lastAt,
    last_tip_at: startedAt,
  })
  playtimes.push({
    user: 'demo',
    game: id,
    seconds: Math.round(hours * 3600),
    play_count: Math.max(2, Math.round(hours / 2)),
    first_played_at: startedAt,
    last_played_at: lastAt,
  })
  const title = { title: { name: list.name }, game } as Parameters<typeof startNotice>[1]
  // Like the watcher: one notice for the start, with the guide's opening note when it has one.
  const opening = reachedMilestone(guide, [], true)
  notices.push({
    kind: 'start',
    content: together(startNotice(asUser, title), opening && routeNotice(opening)),
    game: id,
    created_at: startedAt,
  })
  // The last session's unlocks, named when the full list is known.
  const recent = (p.trophies ?? [])
    .filter((t) => t.earned && t.type !== 'platinum')
    .slice(-2) as TrophyStatus[]
  const reached = reachedMilestone(
    guide,
    recent.map((t) => t.name),
    false,
  )
  if (recent.length)
    notices.push({
      kind: 'unlock',
      content: together(unlockNotice(asUser, title, recent), reached && routeNotice(reached)),
      game: id,
      created_at: new Date(new Date(lastAt).getTime() - 40 * 60_000).toISOString(),
    })
  const minutes = 60 + Math.floor(random() * 6) * 15
  notices.push({
    kind: 'session',
    content: SESSION(game.name, 2 + Math.floor(random() * 4), minutes),
    game: id,
    created_at: new Date(new Date(lastAt).getTime() + 30 * 60_000).toISOString(),
  })
}
if (!current) fail('no game in progress')
const playing = current as { game: Game; guide: Guide; list: ListFacts }

// The stored session plan for the current game: the guide's own tricks, in its order.
const tricks = playing.guide.tricks.slice(0, 4)
const share = Math.floor(PLAN_MINUTES / Math.max(1, tricks.length) / 5) * 5
const plan: SessionPlan = {
  game: playing.game.id,
  gameName: playing.game.name,
  minutes: PLAN_MINUTES,
  createdAt: at(1, 20),
  summary: `Rota de ${PLAN_MINUTES} min com ${tricks.length} troféus do guia de ${playing.game.name}, com o macete de cada um.`,
  steps: tricks.map((t) => ({
    trophy: t.trophy,
    minutes: share,
    how: t.trick,
    why: `Macete do guia (${t.source}).`,
    trick: null,
    flexible: true,
  })),
  totalMinutes: share * tricks.length,
  warnings: playing.guide.missables.slice(0, 1).map((m) => `${m.trophy} — ${m.when}: ${m.how}`),
  ifTimeLeft: playing.guide.earlyTips[0] ?? null,
}
user.session_plan = plan

// Interests: the order the player chose for this year.
const interests: Row[] = []
for (const [i, id] of WANTED.entries()) {
  await remember(id)
  interests.push({
    user: 'demo',
    game: id,
    year: YEAR,
    position: i + 1,
    source: SOURCES[i],
    created_at: at(250 - i, 12),
  })
}

// Store prices: the made-up sales above, on games that have a store page.
const storePrices: Row[] = Object.entries(DEALS)
  .filter(([id]) => games.get(id)?.store_url)
  .map(([id, d]) => ({
    game: id,
    region: 'BR',
    base: d.base,
    price: d.price,
    discount: d.discount,
    ends_at: at(-d.days, 23),
    plus: false,
    currency: 'BRL',
  }))

// Recommendations: each guide's own numbers and first sentence, next to the platinums that share
// the most genres with it.
const genreCount = new Map<string, number>()
for (const id of PLATINUMS)
  for (const g of (games.get(id) as Game).genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1)
const topGenres = [...genreCount]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 3)
  .map(([g]) => g)
user.taste_profile = {
  summary: `Mais platinas em ${topGenres.join(', ')}.`,
  genres: topGenres,
  traits: [],
  avoid: [],
}
const recommendations: Row[] = []
for (const id of SUGGESTED) {
  const { game, guide } = await remember(id)
  const shared = (g: Game) => g.genres.filter((x) => game.genres.includes(x)).length
  const similar = PLATINUMS.map((p) => games.get(p) as Game)
    .filter((g) => shared(g) > 0)
    .sort((a, b) => shared(b) - shared(a))
    .slice(0, 2)
    .map((g) => g.name)
  recommendations.push({
    user: 'demo',
    game: id,
    platform: game.platforms.includes('PS5') ? 'PS5' : (game.platforms.at(-1) ?? 'PS4'),
    difficulty: guide.difficulty,
    hours: guide.hours,
    playthroughs: guide.playthroughs,
    ...(guide.difficultyTrophy !== undefined
      ? { has_difficulty_trophy: Boolean(guide.difficultyTrophy) }
      : {}),
    has_missables: guide.hasMissables,
    why: guide.overview.split(/(?<=\.)\s/)[0],
    similar_to: similar,
    created_at: at(3, 9),
  })
}

notices.sort((a, b) => a.created_at.localeCompare(b.created_at))
// The seed holds rows as the database stores them: objects with snake_case keys.
const seed = {
  anchor: ANCHOR,
  user: [{ ...user, session_plan: snakeKeys(user.session_plan) }],
  game: [...games.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, igdb_id, ...rest }) => {
      const { created_at: _c, updated_at: _u, ...game } = rest as typeof rest & Row
      return { key: key(id), id: igdb_id ?? 0, ...game }
    }),
  title: titles.map((t) => ({
    ...t,
    groups: snakeKeys(t.groups),
    trophies: snakeKeys(t.trophies),
  })),
  guide: [...guides.values()].map((g) => ({ ...g, guide: snakeKeys(g.guide) })),
  interest: interests,
  platinum: platinums,
  dismissal: [],
  server_status: [],
  tip: notices.map(({ kind, content, game, created_at }) => ({
    user: 'demo',
    kind,
    content,
    game,
    created_at,
  })),
  message: [],
  // The last three notices are still unread under the bell.
  notification: notices.map((n, i) => ({
    user: 'demo',
    ...n,
    ...(i < notices.length - 3 ? { read_at: n.created_at } : {}),
  })),
  recommendation: recommendations,
  playtime: playtimes,
  store_price: storePrices,
}
await Bun.write(out, `${JSON.stringify(seed, null, 2)}\n`)
console.log(
  `${out}: ${platinums.length} platinums, ${PLAYING.length} games in progress, ${seed.game.length} games with guides, ${notices.length} notices${withPsn ? ', trophy lists from PSN' : ', no trophy lists (run with --psn for them)'}`,
)
await closeDb()
