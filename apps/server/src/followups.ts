import { ai } from './ai.ts'
import { aiContext } from './ai-context.ts'
import { tagged } from './costs.ts'
import { contextForGame } from './game-context.ts'
import { deliver } from './notify.ts'
import { aroundModel } from './plugins.ts'
import { appendMessage, logTip } from './repository/activity.ts'
import { getGame } from './repository/game.ts'
import { markAnswered, type WaitingQuestion } from './repository/guide-request.ts'
import { getUser } from './repository/user.ts'

/**
 * Keeps Nexo's "I'll let you know", run by whoever fills the guide (`scripts/answer-question.ts`):
 * once the game's deep guide has the answer, Nexo writes it from the guide. Null while the guide
 * still has nothing to say, or the player, the game or its list is gone.
 */
export async function followUpAnswer(w: WaitingQuestion): Promise<string | null> {
  const [user, game] = await Promise.all([getUser(w.user), getGame(w.game)])
  if (!user || !game) return null
  const ctx = await contextForGame(user, game)
  if (!ctx) return null
  const { text } = await aroundModel({ user, action: 'chat', game: game.id }, () =>
    tagged({ user: user.id, action: 'chat' }, () =>
      ai<{ text: string | null }>('/nexo/follow-up', {
        context: aiContext(ctx, user),
        question: w.question,
      }),
    ),
  )
  return text
}

/** Sends the answer as an `answer` notice on every channel and into that game's conversation, and
 * closes the question. */
export async function sendFollowUp(w: WaitingQuestion, text: string): Promise<void> {
  const user = await getUser(w.user)
  if (!user) throw new Error(`no player ${w.user}`)
  await logTip(user.id, 'answer', text, w.game)
  await appendMessage(user.id, 'assistant', text, w.game)
  await deliver(user, text)
  await markAnswered(w)
}
