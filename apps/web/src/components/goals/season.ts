/** Numbers of the yearly challenge, shared by the Home card and the Interests season overview. */
import { defineMessages, getLocale, Language, translator } from '../../i18n/i18n'
import type { Interest, YearGoals } from '../../lib/types'

const messages = defineMessages({
  [Language.PtBR]: {
    season: {
      pace: 'Faltam {remaining} em {months} · {perMonth} platinas por mês.',
      months: {
        one: '{count} mês',
        other: '{count} meses',
      },
      reached: 'Meta conquistada. Que venha o próximo desafio.',
      pick: 'Escolha um objetivo que combine com o seu ritmo.',
    },
  },
  [Language.En]: {
    season: {
      pace: '{remaining} to go in {months} · {perMonth} platinums a month.',
      months: {
        one: '{count} month',
        other: '{count} months',
      },
      reached: 'Goal reached. Bring on the next challenge.',
      pick: 'Pick a goal that fits your pace.',
    },
  },
})
const t = translator(messages)

export function season(p: YearGoals, now = new Date()) {
  const progress = p.target ? Math.min(100, Math.round((p.done / p.target) * 100)) : 0
  const remaining = p.target ? Math.max(0, p.target - p.done) : null
  const monthsLeft = 12 - now.getMonth()
  const pace =
    remaining != null && remaining > 0
      ? t('season.pace', {
          remaining,
          months: t('season.months', { count: monthsLeft }),
          perMonth: Number((remaining / monthsLeft).toFixed(1)).toLocaleString(getLocale()),
        })
      : remaining === 0
        ? t('season.reached')
        : t('season.pick')
  return { progress, pace }
}

export type GoalFilter = 'all' | 'playing' | 'pending' | 'done'

// The server sends null progress for a game never started, although the shared type says number.
export const started = (g: Interest) => (g.progress as number | null | undefined) != null

export const goalState = (g: Interest): Exclude<GoalFilter, 'all'> =>
  g.done ? 'done' : started(g) ? 'playing' : 'pending'
