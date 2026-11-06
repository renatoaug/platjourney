import { ai } from './ai.ts'
import { aiContext } from './ai-context.ts'
import { tagged } from './costs.ts'
import { contextForGame } from './game-context.ts'
import { deliver } from './notify.ts'
import { aroundModel } from './plugins.ts'
import { appendMessage, logTip } from './repository/activity.ts'
import { getGame } from './repository/game.ts'
import { markQuestion, type WaitingQuestion, waitingQuestions } from './repository/guide-request.ts'
import { getUser } from './repository/user.ts'

const EVERY = 30 * 60_000

/**
 * Keeps Nexo's "I'll let you know": a question it could not answer is asked again once the game's
 * deep guide gets new passages, and the answer goes to the player as a notice and into that game's
 * conversation. With nothing to say yet, the question waits for the next passages.
 */
export async function followUp(w: WaitingQuestion): Promise<boolean> {
  const [user, game] = await Promise.all([getUser(w.user), getGame(w.game)])
  if (!user || !game) return false
  const ctx = await contextForGame(user, game)
  if (!ctx) return false
  const { text } = await aroundModel({ user, action: 'chat' }, () =>
    tagged({ user: user.id, action: 'chat' }, () =>
      ai<{ text: string | null }>('/nexo/follow-up', {
        context: aiContext(ctx, user),
        question: w.question,
      }),
    ),
  )
  if (!text) {
    await markQuestion(w, 'checked_at')
    return false
  }
  await logTip(user.id, 'answer', text, game.id)
  await appendMessage(user.id, 'assistant', text, game.id)
  await deliver(user, text)
  await markQuestion(w, 'notified_at')
  return true
}

/** One pass over the waiting questions, one at a time; a failure leaves its question for later. */
export async function followUps(): Promise<number> {
  let sent = 0
  for (const w of await waitingQuestions()) {
    try {
      if (await followUp(w)) sent++
    } catch (e) {
      console.error(`follow-up ${w.game} failed:`, (e as Error).message)
    }
  }
  return sent
}

export function startFollowUps(): void {
  const run = () =>
    followUps()
      .then((n) => n && console.log(`follow-ups: ${n} answers sent`))
      .catch((e) => console.error('follow-ups failed:', e.message))
  setTimeout(run, 5 * 60_000).unref()
  setInterval(run, EVERY).unref()
}
