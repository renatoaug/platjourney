import type { GameContext } from './nexo.ts'
import type { TrophyStatus } from './psn.ts'

/**
 * A reason to come back, for the end of a chat answer: one fact from the player's own game that
 * something is ahead that changes what they do now (a missable not done yet, a progress mark a
 * trophy or two away). The rarest trophy still missing is not one: it closed answers about anything
 * else with an offer nobody asked for. Nexo closes with it at most once a day per game, so it stays
 * a nudge.
 * The fact is written for the model, in Portuguese like the rest of its context.
 */
export function pickHook(ctx: GameContext): string | null {
  if (ctx.owned === false) return null
  const base = ctx.trophies.filter((t) => (t.groupId ?? 'default') === 'default')
  const platinum = base.find((t) => t.type === 'platinum')
  if (!base.length || platinum?.earned) return null
  const missing = base.filter((t) => !t.earned && t.type !== 'platinum')
  const missable = nextMissable(ctx, missing)
  if (missable)
    return `ainda falta o perdível ${missable.trophy} (${missable.when.replace(/\*\*/g, '').replace(/\.$/, '')}): ofereça avisar o que fazer antes de chegar lá, se o jogador te chamar quando estiver perto`
  const counted = base.filter((t) => t.type !== 'platinum')
  const earned = counted.length - missing.length
  const mark = [25, 50, 75].find((m) => earned < (counted.length * m) / 100)
  if (mark) {
    const left = Math.ceil((counted.length * mark) / 100) - earned
    if (left <= 2)
      return `${left > 1 ? `faltam ${left} troféus` : 'falta 1 troféu'} pra ${mark}% da platina: ofereça ajudar a fechar esse marco`
  }
  return null
}

function nextMissable(ctx: GameContext, missing: TrophyStatus[]) {
  const open = new Set(missing.filter((t) => !t.hidden).map((t) => t.name.toLowerCase()))
  return ctx.guide?.missables?.find((m) => open.has(m.trophy.toLowerCase()))
}

// Per player and game, the day a hook was last offered. In memory: a restart only means one more
// hook that day.
const offered = new Map<string, string>()

/** The hook for this answer, or null when the game already had one today. */
export function hookFor(user: string, ctx: GameContext, now = new Date()): string | null {
  const key = `${user}:${ctx.game.id}`
  const today = now.toISOString().slice(0, 10)
  if (offered.get(key) === today) return null
  const hook = pickHook(ctx)
  if (hook) offered.set(key, today)
  return hook
}

export const forgetHooks = () => offered.clear()
