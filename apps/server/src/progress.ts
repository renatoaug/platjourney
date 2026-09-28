import { defineMessages, Language, translator } from './i18n.ts'
import type { TitleGroups, TitleProgress } from './psn.ts'
import type { User } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    baseOnly: ' do jogo base',
    withDlc: ' com DLC',
  },
  [Language.En]: {
    baseOnly: ' in the base game',
    withDlc: ' with DLC',
  },
})

// Progress as the player chose to see it (account preference): the base game only by
// default, which is what the platinum needs, or with DLC counted in. PSN's own
// percentage weighs trophies by grade and always mixes DLC in, so it is not used.
export function shownProgress(
  user: User,
  title: TitleProgress,
  groups?: TitleGroups | null,
): { earned: number; total: number; progress: number; label: string } {
  if (!groups)
    return { earned: title.earned, total: title.total, progress: title.progress, label: '' }
  const withDlc = user.include_dlc_progress === true && !!groups.dlc
  const earned = groups.base.earned + (withDlc ? (groups.dlc?.earned ?? 0) : 0)
  const total = groups.base.total + (withDlc ? (groups.dlc?.total ?? 0) : 0)
  const t = translator(messages, user)
  const label = groups.dlc ? t(withDlc ? 'withDlc' : 'baseOnly') : ''
  return { earned, total, progress: total ? Math.round((earned / total) * 100) : 0, label }
}
