import { AiError, ai } from './ai.ts'
import { aiContext } from './ai-context.ts'
import { tagged } from './costs.ts'
import type { Guide } from './guide.ts'
import { defineMessages, Language, translator } from './i18n.ts'
import { aroundModel } from './plugins.ts'
import type { TitleGroups, TitleProgress, TrophyStatus } from './psn.ts'
import {
  appendMessage,
  logTip,
  recentMessages,
  recentNotifications,
} from './repository/activity.ts'
import type { Game } from './repository/game.ts'
import type { User } from './repository/user.ts'

const messages = defineMessages({
  [Language.PtBR]: {
    trophyTip: 'Dica para o troféu **{trophy}**',
    moderated:
      'Essa mensagem eu não posso responder. Bora voltar pro jogo? Me pergunta de troféu, guia ou do que fazer agora.',
  },
  [Language.En]: {
    trophyTip: 'Tip for the trophy **{trophy}**',
    moderated:
      'I cannot answer that message. Back to the game? Ask me about a trophy, the guide or what to do next.',
  },
})

export interface GameContext {
  game: Game
  title: TitleProgress
  trophies: TrophyStatus[]
  guide?: Guide
  groups?: TitleGroups | null
  // Hours played so far, from PSN (may lag a session behind).
  hoursPlayed?: number | null
}

type Turn = { role: 'user' | 'assistant'; content: string }

// The chat so far plus the latest automatic notices, in order, so a reply like
// "e o próximo?" to a trophy notice has what it refers to. Notices are not chat
// turns: they are shown to the model as what Nexo said on its own.
async function conversation(user: User): Promise<Turn[]> {
  const [messages, notices] = await Promise.all([
    recentMessages(user.id, 12),
    recentNotifications(user.id, 3),
  ])
  return [
    ...messages.map((m) => ({ at: m.created_at, role: m.role, content: m.content })),
    ...notices.map((n) => ({
      at: n.created_at,
      role: 'assistant' as const,
      content: `(Aviso automático${n.game ? ` sobre ${n.game.name}` : ''}) ${n.content}`,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ role, content }) => ({ role, content }))
}

// Every call here is model work the plugins may refuse (see plugins.ts). With `remember`, the
// conversation goes along and the exchange is stored in it.
function ask(
  user: User,
  action: 'chat' | 'tip',
  path: string,
  body: Record<string, unknown>,
  remember?: { text: string; game?: string },
): Promise<string> {
  return aroundModel({ user, action }, () =>
    tagged({ user: user.id, action }, async () => {
      const history = remember ? { history: await conversation(user) } : {}
      const { text } = await ai<{ text: string }>(path, { ...body, ...history })
      if (remember) {
        await appendMessage(user.id, 'user', remember.text, remember.game)
        await appendMessage(user.id, 'assistant', text, remember.game)
      }
      return text
    }),
  )
}

// `route` is the guide's note on what comes next, written into the same message.
export async function proactiveTip(user: User, ctx: GameContext, route?: string): Promise<string> {
  const text = await ask(user, 'tip', '/nexo/tip', {
    kind: 'start',
    context: aiContext(ctx, user),
    ...(route ? { route } : {}),
  })
  await logTip(user.id, 'start', text, ctx.game.id)
  return text
}

export async function unlockReaction(
  user: User,
  ctx: GameContext,
  unlocked: TrophyStatus[],
  route?: string,
): Promise<string> {
  const text = await ask(user, 'tip', '/nexo/tip', {
    kind: 'unlock',
    context: aiContext(ctx, user),
    unlocked,
    ...(route ? { route } : {}),
  })
  // The trophy as the message's title, then Nexo's words: the same first line as a plain notice.
  const titled = `${unlocked.map((t) => `🏆 ${t.name}`).join('\n')}\n\n${text}`
  await logTip(user.id, 'unlock', titled, ctx.game.id)
  return titled
}

// Help for one trophy the player has not earned yet, asked from the trophy list.
export function trophyHelp(user: User, ctx: GameContext, trophy: TrophyStatus): Promise<string> {
  return tagged({ user: user.id, action: 'chat' }, async () => {
    const text = await ask(user, 'chat', '/nexo/trophy-help', {
      context: aiContext(ctx, user),
      trophy,
    })
    // Kept in the conversation so the player can follow up in the chat.
    await appendMessage(
      user.id,
      'user',
      translator(messages, user)('trophyTip', { trophy: trophy.name }),
      ctx.game.id,
    )
    await appendMessage(user.id, 'assistant', text, ctx.game.id)
    await logTip(user.id, 'chat', text, ctx.game.id)
    return text
  })
}

export function reply(user: User, userText: string, ctx?: GameContext): Promise<string> {
  // The guide lookup is part of the answer's cost.
  return tagged({ user: user.id, action: 'chat' }, async () => {
    let text: string
    try {
      text = await ask(
        user,
        'chat',
        '/nexo/reply',
        { text: userText, context: ctx ? aiContext(ctx, user) : null },
        { text: userText, game: ctx?.game.id },
      )
    } catch (e) {
      // A message moderation refused: no answer was made, so nothing is stored.
      if (e instanceof AiError && e.status === 422) return translator(messages, user)('moderated')
      throw e
    }
    await logTip(user.id, 'chat', text, ctx?.game.id)
    return text
  })
}
