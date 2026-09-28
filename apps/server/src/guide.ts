import { ai } from './ai.ts'
import { tagged } from './costs.ts'
import { DEFAULT_LOCALE, defineMessages, Language, type Locale, translator } from './i18n.ts'
import type { TrophyStatus } from './psn.ts'
import type { Game } from './repository/game.ts'
import { getGuide, saveGuide } from './repository/guide.ts'
import type { Milestone } from './route.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    runs: { one: '{count} run', other: '{count} runs' },
    difficulty: 'Dificuldade {difficulty}/10 · ~{hours}h · {runs}',
    hasMissables: ' · TEM missables',
    noMissables: ' · sem missables',
    hasOnline: ' · tem online',
    missables: 'Missables:',
    online: 'Online:',
    boostable: ' (dá pra boostar)',
    easiest: 'Mais fácil: {trophy} — {why}',
    hardest: 'Mais difícil: {trophy} — {why}',
    mostTedious: 'Mais chato: {trophy} — {why}',
    tricks: 'Macetes:',
    roadmap: 'Roadmap:',
    sources: 'Fontes: {sources}',
  },
  [Language.En]: {
    runs: { one: '{count} run', other: '{count} runs' },
    difficulty: 'Difficulty {difficulty}/10 · ~{hours}h · {runs}',
    hasMissables: ' · HAS missables',
    noMissables: ' · no missables',
    hasOnline: ' · has online',
    missables: 'Missables:',
    online: 'Online:',
    boostable: ' (boostable)',
    easiest: 'Easiest: {trophy} — {why}',
    hardest: 'Hardest: {trophy} — {why}',
    mostTedious: 'Most tedious: {trophy} — {why}',
    tricks: 'Tricks:',
    roadmap: 'Roadmap:',
    sources: 'Sources: {sources}',
  },
})

export const GUIDE_VERSION = 2

export interface KeyTrophy {
  trophy: string
  why: string
}

export interface Guide {
  version?: number
  difficulty: number
  hours: number
  playthroughs: number
  hasMissables: boolean
  hasOnline: boolean
  overview: string
  glossary: { term: string; meaning: string }[]
  missables: { trophy: string; when: string; how: string }[]
  roadmap: { phase: string; goal: string; trophies: string[] }[]
  earlyTips: string[]
  // What hunters ask first: online, easiest, hardest, most tedious, tricks, bugs.
  onlineTrophies: { trophy: string; what: string; boostable: boolean }[]
  easiest: KeyTrophy | null
  hardest: KeyTrophy | null
  mostTedious: KeyTrophy | null
  tricks: { trophy: string; trick: string; source: string }[]
  // One entry per trophy. Guides from before 2026-09-29 have no date or status.
  buggy: {
    trophy: string
    issue: string
    workaround: string
    reported?: string
    status?: 'recent' | 'old' | 'fixed' | 'unconfirmed'
  }[]
  collectibles: string | null
  // Quick facts; guides from before 2026-09-29 do not have them.
  difficultyTrophy?: string | null
  postgame?: string | null
  pointOfNoReturn: string | null
  autopop: string | null
  sources: string[]
  // Set only when the platinum can no longer be earned (servers shut down,
  // delisted content): why, in one line. The guide stays for people who have it.
  unobtainable?: string | null
  // The route the watcher follows while the player plays; older guides do not have it.
  milestones?: Milestone[]
}

// One guide per catalog game. With the PSN trophy list the guide uses exact
// trophy names; without it (a game the player does not own) it is web-only.
// The edition is the PSN trophy list's own name and platform ("Far Cry 3 Classic
// Edition", PS4): the catalog groups every release of a game under one entry.
export async function ensureGuide(
  game: Game,
  trophies?: TrophyStatus[],
  edition?: { name: string; platform: string },
): Promise<Guide> {
  const cached = await getGuide<Guide>(game.id)
  // Older guides predate the key-trophies section; rebuild them once.
  if (cached && (cached.version ?? 1) >= GUIDE_VERSION) return cached
  console.log(`building guide for ${game.name}${trophies ? '' : ' (by name)'}`)
  const t0 = Date.now()
  const guide = await tagged({ action: 'guide' }, () =>
    ai<Guide>('/guides/research', { game, trophies: trophies ?? null, edition: edition ?? null }),
  )
  guide.version = GUIDE_VERSION
  await saveGuide(game.id, guide)
  console.log(`guide for ${game.name} built in ${Math.round((Date.now() - t0) / 1000)}s`)
  return guide
}

// Labels in the player's language; what follows them is the guide as researched.
export function guideSummary(guide: Guide, locale: Locale = DEFAULT_LOCALE): string {
  const t = translator(messages, locale)
  const runs = t('runs', { count: guide.playthroughs })
  const flags = `${t(guide.hasMissables ? 'hasMissables' : 'noMissables')}${guide.hasOnline ? t('hasOnline') : ''}`
  const lines = [
    `${t('difficulty', { difficulty: guide.difficulty, hours: guide.hours, runs })}${flags}`,
    guide.overview,
  ]
  if (guide.missables.length) {
    lines.push('', t('missables'))
    for (const m of guide.missables) lines.push(`• ${m.trophy} — ${m.when}: ${m.how}`)
  }
  if (guide.onlineTrophies?.length) {
    lines.push('', t('online'))
    for (const o of guide.onlineTrophies)
      lines.push(`• ${o.trophy} — ${o.what}${o.boostable ? t('boostable') : ''}`)
  }
  if (guide.easiest)
    lines.push('', t('easiest', { trophy: guide.easiest.trophy, why: guide.easiest.why }))
  if (guide.hardest)
    lines.push(t('hardest', { trophy: guide.hardest.trophy, why: guide.hardest.why }))
  if (guide.mostTedious)
    lines.push(t('mostTedious', { trophy: guide.mostTedious.trophy, why: guide.mostTedious.why }))
  if (guide.tricks?.length) {
    lines.push('', t('tricks'))
    for (const tr of guide.tricks) lines.push(`• ${tr.trophy}: ${tr.trick} (${tr.source})`)
  }
  lines.push('', t('roadmap'))
  for (const r of guide.roadmap) lines.push(`${r.phase}: ${r.goal}`)
  if (guide.sources.length) lines.push('', t('sources', { sources: guide.sources.join(', ') }))
  return lines.join('\n')
}
