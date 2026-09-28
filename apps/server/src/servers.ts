import { ai } from './ai.ts'
import { tagged } from './costs.ts'
import { defineMessages, Language, translator } from './i18n.ts'
import type { TitleProgress } from './psn.ts'
import { rankNextPlatinum } from './ranking.ts'
import { logTip, serverWarnedGames } from './repository/activity.ts'
import {
  listServerStatuses,
  type ServerState,
  type ServerStatus,
  saveServerStatus,
} from './repository/server-status.ts'
import type { User } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    closed: '⚠️ **{name}**: servidores já fechados. {note}',
    closing:
      '⚠️ **{name}**: servidor fecha{when}. {note} Se quiser a platina, prioriza o online agora.',
    closingOn: ' em {date}',
    none: 'Nenhum alerta de servidor nos seus jogos próximos da platina.',
    active: 'online ok',
    announced: 'fecha em {date}',
    shut: 'fechado',
  },
  [Language.En]: {
    closed: '⚠️ **{name}**: servers already shut down. {note}',
    closing:
      '⚠️ **{name}**: servers shut down{when}. {note} If you want the platinum, do the online trophies now.',
    closingOn: ' on {date}',
    none: 'No server alerts for your games closest to the platinum.',
    active: 'online ok',
    announced: 'shuts down on {date}',
    shut: 'shut down',
  },
})

const RECHECK_DAYS = 7

function isStale(s: ServerStatus | undefined): boolean {
  if (!s) return true
  return Date.now() - new Date(s.checked_at).getTime() > RECHECK_DAYS * 86_400_000
}

// Checks online-server status for the games this user is most likely to platinum
// next. The status itself is shared (looked up once a week per game); what is per
// user is who has already been warned. Returns the warnings to deliver.
export async function checkServers(user: User, library: TitleProgress[]): Promise<string[]> {
  const ranked = await rankNextPlatinum(library, user, 15)
  const known = new Map((await listServerStatuses()).map((s) => [s.game.id, s]))
  const toCheck = ranked.filter((r) => isStale(known.get(r.game.id)))
  if (toCheck.length > 0) {
    console.log(`checking servers for ${toCheck.length} games`)
    const result = await tagged({ user: user.id, action: 'server_check' }, () =>
      ai<{
        games: { name: string; status: ServerState; date: string | null; note: string | null }[]
      }>('/servers/check', { names: toCheck.map((r) => r.game.name) }),
    )
    const byName = new Map(toCheck.map((r) => [r.game.name, r.game]))
    for (const g of result.games) {
      const game = byName.get(g.name)
      if (game)
        await saveServerStatus({ game: game.id, status: g.status, date: g.date, note: g.note })
    }
  }

  const alerted = await serverWarnedGames(user.id)
  const mine = await listServerStatuses(ranked.map((r) => r.game.id))
  const warnings: string[] = []
  const t = translator(messages, user)
  for (const s of mine) {
    if ((s.status !== 'announced' && s.status !== 'closed') || alerted.has(s.game.id)) continue
    const name = s.game.name
    const note = s.note ?? ''
    const text =
      s.status === 'closed'
        ? t('closed', { name, note })
        : t('closing', {
            name,
            note,
            when: s.date ? t('closingOn', { date: s.date }) : '',
          })
    warnings.push(text)
    await logTip(user.id, 'server', text, s.game.id)
  }
  return warnings
}

// Status of the servers for the games the user has in progress.
export async function serverReport(user: User, library: TitleProgress[]): Promise<string> {
  const ranked = await rankNextPlatinum(library, user, 15)
  const relevant = (await listServerStatuses(ranked.map((r) => r.game.id))).filter(
    (s) => s.status !== 'unknown',
  )
  const t = translator(messages, user)
  if (relevant.length === 0) return t('none')
  return relevant
    .map((s) => {
      const label = {
        active: t('active'),
        announced: t('announced', { date: s.date ?? '?' }),
        closed: t('shut'),
      }[s.status as 'active' | 'announced' | 'closed']
      return `• ${s.game.name} — ${label}${s.note ? `: ${s.note}` : ''}`
    })
    .join('\n')
}
