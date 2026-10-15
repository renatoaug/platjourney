import {
  DEFAULT_LOCALE,
  defineMessages,
  Language,
  type Locale,
  translator,
  userLocale,
} from './i18n.ts'
import type { TitleProgress } from './psn.ts'
import { brazilianPage, type PlusTier, tierCovers } from './psstore.ts'
import { loadGroups } from './ranking.ts'
import { type Game, gameByName, gamesForTitles, getGame } from './repository/game.ts'
import {
  addInterest,
  INTEREST_SOURCES,
  type Interest,
  type InterestSource,
  listInterests,
  removeInterest,
  setInterestOrder,
} from './repository/interest.ts'
import { pricesFor, type StoredPrice } from './repository/store-price.ts'
import { getUser, type User, updateUser } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    withTarget: 'Meta {year}: {done}/{target} platinas ({percent}%)',
    withoutTarget: {
      one: '{year}: {count} platina até agora (sem meta definida — /goals set 12)',
      other: '{year}: {count} platinas até agora (sem meta definida — /goals set 12)',
    },
    interests: 'Interesses:',
    notStarted: 'não começou',
    platinumed: 'Platinadas no ano:',
    setUsage: 'Uso: /goals set <número de platinas>',
    addUsage: 'Uso: /goals add <nome do jogo>',
    notFound: 'Não achei "{query}".',
    removeUsage: 'Uso: /goals remove <número da lista>',
    moveUsage: 'Uso: /goals move <número> up|down',
    orderUsage: 'Uso: /goals order <ids separados por vírgula>',
  },
  [Language.En]: {
    withTarget: '{year} goal: {done}/{target} platinums ({percent}%)',
    withoutTarget: {
      one: '{year}: {count} platinum so far (no goal set — /goals set 12)',
      other: '{year}: {count} platinums so far (no goal set — /goals set 12)',
    },
    interests: 'Interests:',
    notStarted: 'not started',
    platinumed: 'Platinums this year:',
    setUsage: 'Usage: /goals set <number of platinums>',
    addUsage: 'Usage: /goals add <game name>',
    notFound: 'I couldn\'t find "{query}".',
    removeUsage: 'Usage: /goals remove <list number>',
    moveUsage: 'Usage: /goals move <number> up|down',
    orderUsage: 'Usage: /goals order <comma separated ids>',
  },
})

interface InterestView {
  id: string
  game: Game
  position: number
  progress: number | null
  done: boolean
  hours: number | null
  recommendedAt: string | null
  nextPickAt: string | null
  /** Where the player saved it from, and when. */
  source: InterestSource | null
  savedAt: string | null
  /** The game's PS Store price when it is on sale or in PS Plus; null otherwise. */
  deal: Deal | null
}

interface Deal {
  price: number
  base: number
  discount: number
  endsAt: string | null
  plus: boolean
  plusPrice: number | null
  /** The PS Plus tier whose catalog includes the game. */
  plusTier: PlusTier | null
  /** The player's own PS Plus tier includes it: they can play it without paying. */
  mine: boolean
  currency: string
  storeUrl: string | null
}

interface YearProgress {
  year: number
  target: number | null
  done: number
  platinumed: { game: Game; at: string; hours: number | null }[]
  interests: InterestView[]
}

// Progress of an interest comes from any PSN title of that game (PS4 or PS5 copy).
function titleForGame(library: TitleProgress[], game: Game): TitleProgress | undefined {
  const nps = new Set(game.np_communication_ids)
  const copies = library.filter((t) => nps.has(t.npCommunicationId))
  return copies.sort((a, b) => b.progress - a.progress)[0]
}

function dealOf(
  p: StoredPrice | undefined,
  url: string | null | undefined,
  tier: string | null | undefined,
): Deal | null {
  if (!p || (p.discount <= 0 && !p.plus)) return null
  const storeUrl = url ? brazilianPage(url) : null
  return {
    price: p.price,
    base: p.base,
    discount: p.discount,
    endsAt: p.endsAt,
    plus: p.plus,
    plusPrice: p.plusPrice,
    plusTier: p.plusTier,
    mine: tierCovers(tier, p.plusTier),
    currency: p.currency,
    storeUrl,
  }
}

/** A game's PlayStation Store page and, when its price is known (someone saved it), the sale or
 * the PS Plus tier that includes it, for the game page's "About" card. */
export async function storeFor(
  game: Pick<Game, 'id' | 'store_url'>,
  user: Pick<User, 'ps_plus'>,
): Promise<{ url: string | null; deal: Deal | null } | null> {
  const url = game.store_url ? brazilianPage(game.store_url) : null
  const deal = dealOf((await pricesFor([game.id])).get(game.id), game.store_url, user.ps_plus)
  return url || deal ? { url, deal } : null
}

export async function yearProgress(
  user: User,
  library: TitleProgress[],
  year = new Date().getFullYear(),
  played: Map<string, { seconds: number }> = new Map(),
): Promise<YearProgress> {
  const hoursOf = (id: string) => {
    const p = played.get(id)
    return p ? Math.round((p.seconds / 3600) * 10) / 10 : null
  }
  const targets = (await getUser(user.id))?.goal_targets ?? {}
  const target = targets[String(year)] ?? null
  const rows = await listInterests(user.id, year)
  const prices = await pricesFor(rows.map((i) => i.game.id))
  const withDlc = user.include_dlc_progress === true
  const interests = await Promise.all(
    rows.map(async (i: Interest) => {
      const t = titleForGame(library, i.game)
      return {
        id: i.id,
        game: i.game,
        position: i.position,
        progress: await progressOf(t, user, withDlc),
        hours: hoursOf(i.game.id),
        recommendedAt: i.recommended_at ? String(i.recommended_at) : null,
        nextPickAt: i.next_pick_at ? String(i.next_pick_at) : null,
        source: i.source ?? null,
        savedAt: i.created_at ? String(i.created_at) : null,
        // A game the player already owns is no deal for them.
        deal: t ? null : dealOf(prices.get(i.game.id), i.game.store_url, user.ps_plus),
        done: t?.earnedByType.platinum === 1 && t.lastUpdated.startsWith(String(year)),
      }
    }),
  )
  const thisYear = library.filter(
    (t) => t.earnedByType.platinum === 1 && t.lastUpdated.startsWith(String(year)),
  )
  const games = await gamesForTitles(thisYear)
  const platinumed = thisYear.map((t) => {
    const game = games.get(t.npCommunicationId) as Game
    return { game, at: t.lastUpdated.slice(0, 10), hours: hoursOf(game.id) }
  })
  platinumed.sort((a, b) => a.at.localeCompare(b.at))
  return { year, target, done: platinumed.length, platinumed, interests }
}

// PSN's own progress mixes DLC in; the base game alone is what the platinum needs.
async function progressOf(
  t: TitleProgress | undefined,
  user: User,
  withDlc: boolean,
): Promise<number | null> {
  if (!t) return null
  const base = !withDlc && t.earned > 0 ? (await loadGroups(t, user))?.base : null
  return base ? Math.round((base.earned / base.total) * 100) : (t.progress ?? null)
}

export function yearReport(p: YearProgress, locale: Locale = DEFAULT_LOCALE): string {
  const t = translator(messages, locale)
  const head = p.target
    ? t('withTarget', {
        year: p.year,
        done: p.done,
        target: p.target,
        percent: Math.round((p.done / p.target) * 100),
      })
    : t('withoutTarget', { year: p.year, count: p.done })
  const lines = [head]
  if (p.interests.length) {
    lines.push('', t('interests'))
    for (const [i, g] of p.interests.entries()) {
      const state = g.done ? '✅' : g.progress != null ? `${g.progress}%` : t('notStarted')
      lines.push(`${i + 1}. ${g.game.name} — ${state}`)
    }
  }
  if (p.platinumed.length) {
    lines.push('', t('platinumed'))
    for (const g of p.platinumed) lines.push(`• ${g.at} ${g.game.name}`)
  }
  return lines.join('\n')
}

// What each interest action gets; an action answers its usage text when the value is wrong.
interface InterestAction {
  user: User
  year: number
  value: string
  t: ReturnType<typeof translator<typeof messages>>
  list: () => ReturnType<typeof listInterests>
  resolveId: (v: string) => Promise<string | undefined>
}

const INTEREST_ACTIONS: Record<string, (a: InterestAction) => Promise<string | undefined>> = {
  set: async ({ user, year, value, t }) => {
    const target = Number(value)
    if (!Number.isInteger(target) || target <= 0) return t('setUsage')
    const targets = (await getUser(user.id))?.goal_targets ?? {}
    await updateUser(user.id, { goal_targets: { ...targets, [String(year)]: target } })
  },
  add: async ({ user, year, value, t }) => {
    // The web says where the game was saved from at the end: "add game:12 from:releases".
    const from = value.match(/\s+from:(\S+)$/)
    const source = INTEREST_SOURCES.find((s) => s === from?.[1])
    const query = from ? value.slice(0, from.index).trim() : value
    if (!query) return t('addUsage')
    const game = query.startsWith('game:') ? await getGame(query) : await gameByName(query)
    if (!game) return t('notFound', { query })
    await addInterest(user.id, game.id, year, source)
  },
  remove: async ({ user, value, t, resolveId }) => {
    const id = await resolveId(value)
    if (!id) return t('removeUsage')
    await removeInterest(user.id, id)
  },
  move: async ({ user, year, value, t, list, resolveId }) => {
    const [rawId, direction] = value.split(' ')
    const id = await resolveId(rawId)
    if (!id || (direction !== 'up' && direction !== 'down')) return t('moveUsage')
    const ids = (await list()).map((i) => i.id)
    const at = ids.indexOf(id)
    const to = direction === 'up' ? at - 1 : at + 1
    if (at >= 0 && to >= 0 && to < ids.length) {
      ;[ids[at], ids[to]] = [ids[to], ids[at]]
      await setInterestOrder(user.id, year, ids)
    }
  },
  order: async ({ user, year, value, t }) => {
    const ids = value.split(',').map((v) => v.trim())
    if (!ids.length || ids.some((v) => !v.startsWith('interest:'))) return t('orderUsage')
    await setInterestOrder(user.id, year, ids)
  },
}

// Handles "set 12", "add <name|game:id> [from:<source>]", "remove <interest:id|n>", "move <id> up|down", "order <ids>".
export async function handleInterestCommand(
  user: User,
  arg: string,
  library: TitleProgress[],
): Promise<string> {
  const year = new Date().getFullYear()
  const t = translator(messages, user)
  const [action, ...rest] = arg.split(' ')
  const value = rest.join(' ').trim()
  const list = () => listInterests(user.id, year)
  const resolveId = async (v: string) => {
    if (v.startsWith('interest:')) return v
    const n = Number(v)
    return Number.isInteger(n) ? (await list())[n - 1]?.id : undefined
  }
  const run = Object.hasOwn(INTEREST_ACTIONS, action) ? INTEREST_ACTIONS[action] : undefined
  const usage = await run?.({ user, year, value, t, list, resolveId })
  if (usage) return usage
  return yearReport(await yearProgress(user, library, year), userLocale(user))
}
