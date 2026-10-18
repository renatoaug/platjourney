import { AiError, ai } from './ai.ts'
import { aiContext } from './ai-context.ts'
import { tagged } from './costs.ts'
import { focusAfter, tidy } from './focus.ts'
import type { Guide } from './guide.ts'
import { defineMessages, Language, translator } from './i18n.ts'
import { markCheer, progressMark } from './marks.ts'
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
  // False for a game outside the player's library, chosen to talk about before buying it.
  owned?: boolean
}

type Turn = { role: 'user' | 'assistant'; content: string }

// The chat so far plus the latest automatic notices, in order, so a reply like
// "e o próximo?" to a trophy notice has what it refers to. Notices are not chat
// turns: they are shown to the model as what Nexo said on its own.
async function conversation(user: User, game?: string): Promise<Turn[]> {
  const [messages, notices] = await Promise.all([
    // Each game is its own conversation: the model sees this game's turns only.
    recentMessages(user.id, 12, game ?? null),
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
      const history = remember ? { history: await conversation(user, remember.game) } : {}
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
/** The notice for a game just started. `recommended`: it was Nexo's recommendation, so the notice
 * opens glad the player followed it. */
export async function proactiveTip(
  user: User,
  ctx: GameContext,
  route?: string,
  recommended?: { daysAgo: number; why: string },
): Promise<string> {
  const text = await ask(user, 'tip', '/nexo/tip', {
    kind: 'start',
    context: aiContext(ctx, user),
    ...(route ? { route } : {}),
    ...(recommended ? { recommended } : {}),
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
  // The target is the server's, the same the session notice named: Nexo does not pick another.
  const focus = focusAfter(ctx, unlocked)
  // The first trophy, halfway, the final stretch or the platinum: the notice marks it.
  const mark = progressMark(ctx.trophies, unlocked)
  const text = await ask(user, 'tip', '/nexo/tip', {
    kind: 'unlock',
    context: aiContext(ctx, user),
    unlocked,
    ...(mark ? { mark } : {}),
    // Without a guide there is no focus to keep: Nexo then reads the context as before. No phase
    // goes as where the player is (focus.ts): only whether the focus was left behind, and a phase
    // these unlocks just closed.
    ...(focus.trophy || focus.missable || focus.completed
      ? {
          focus: {
            behind: focus.behind ?? false,
            completed: focus.completed,
            trophy: focus.trophy?.name,
            detail: focus.trophy?.detail,
            trick: focus.trick,
            changed: focus.changed,
            missable: focus.missable,
          },
        }
      : {}),
    ...(route ? { route } : {}),
  })
  // The trophy as the message's title, then Nexo's words: the same first line as a plain notice.
  const body = withoutTitle(
    text,
    unlocked.map((t) => t.name),
  )
  // At a mark, our own line opens the message under the trophy (a paragraph of its own, so it does not
  // read as part of the title), and Nexo's words follow it.
  const cheer = mark ? `\n\n${markCheer(user, mark.kind)}` : ''
  const titled = `${unlocked.map((t) => `🏆 **${tidy(t.name)}**`).join('\n')}${cheer}\n\n${body}`
  await logTip(user.id, 'unlock', titled, ctx.game.id)
  return titled
}

// Nexo sometimes opens with the trophy's name again (a heading or a bold line) though the message
// already has it as its title: drop those leading lines.
export function withoutTitle(text: string, names: string[]): string {
  const plain = (line: string) =>
    line
      .replace(/[#*_🏆]/gu, '')
      .trim()
      .toLowerCase()
  const titles = new Set(names.map(plain))
  const lines = text.split('\n')
  while (lines.length && (titles.has(plain(lines[0])) || !lines[0].trim())) lines.shift()
  return lines.join('\n')
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
