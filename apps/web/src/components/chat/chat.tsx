/** The Nexo chat card: suggestion chips, the conversation log and the message box. Presentational; the /nexo screen fetches and sends. */
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { defineMessages, getLocale, Language, type Translator, useMessages } from '../../i18n/i18n'
import type { Game, LibraryGame } from '../../lib/types'
import { canDictate, type Dictation, dictate } from '../../lib/voice'
import { Cover } from '../../ui/cover'
import { Icon } from '../../ui/icon'
import { Markdown, UserText } from '../../ui/markdown'
import { Sk } from '../../ui/skeleton'
import { SourceNote, splitSource } from '../../ui/source-note'
import { ErrorState } from '../../ui/states'
import { toast } from '../../ui/toast'
import { DemoConnectButton } from '../demo'
import { NexoHero } from '../nexo-hero'
import { titleHref } from '../tip'
import '../demo.css'
import { CommandMenu, type MenuItem } from './command-menu'
import './chat.css'

const messages = defineMessages({
  [Language.PtBR]: {
    suggestions: {
      remaining: {
        q: 'O que falta pra platina e qual a ordem mais eficiente?',
        label: 'O que falta pra platina?',
      },
      missable: {
        q: 'Tem algum missable perto de onde estou? O que eu não posso deixar passar agora?',
        label: 'Tem missable agora?',
      },
      easiest: {
        q: 'Qual o próximo troféu mais fácil pra eu pegar agora e como?',
        label: 'Próximo troféu fácil',
      },
      stuck: {
        q: 'Travei. Me explica o que fazer nessa parte sem spoiler.',
        label: 'Travei aqui',
      },
    },
    partner: 'PARCEIRO DE PLATINAS',
    typing: 'Nexo está preparando uma resposta',
    welcomeEyebrow: 'SEU PARCEIRO DE CONQUISTAS',
    welcomeTitle: 'Sou o Nexo. Vamos à platina?',
    welcomeBody:
      'Do primeiro troféu ao último desafio. Escolha uma sugestão acima ou me conte onde você está.',
    loadFailed: 'Não foi possível carregar a conversa. Atualize a página para tentar novamente.',
    eyebrow: 'SEU PARCEIRO DE PLATINAS',
    logLabel: 'Conversa com o Nexo',
    inputLabel: 'Mensagem para Nexo',
    count: '{count}/{max}',
    cut: 'Texto colado cortado em {max} caracteres · ',
    placeholder: 'Nexo, qual é o próximo passo?',
    placeholderShort: 'Pergunte ao Nexo…',
    trophy: {
      about: 'Sobre o troféu **{trophy}**: {text}',
      placeholder: 'Pergunte sobre o troféu…',
      label: 'Perguntando sobre o troféu',
      remove: 'Tirar o troféu {trophy} da pergunta',
      how: 'Como pegar?',
      missable: 'Dá pra perder?',
      when: 'Quando fazer?',
    },
    placeholderCommands: 'Nexo, qual é o próximo passo? Digite / para ver os comandos',
    send: 'Enviar',
    mic: 'Falar a pergunta',
    micStop: 'Parar de ouvir',
    micDenied:
      'Sem permissão para o microfone. Libere nas configurações do navegador ou do celular.',
    micFailed: 'Não deu para ouvir agora. Tente de novo.',
    menu: {
      label: 'Comandos e jogos',
      game: 'Trocar o jogo da conversa',
      noGame: 'Nenhum jogo com esse nome.',
      current: 'atual',
      notOwned: 'fora da biblioteca',
      switch: 'Trocar o jogo da conversa',
      switching: 'Trocando para {name}…',
    },
    demo: {
      subtitle: 'Exemplos de conversa sobre Red Dead Redemption 2.',
      eyebrow: 'COMO O NEXO RESPONDE',
      lead: 'Na demonstração o chat fica fechado. Estas são perguntas de exemplo sobre o jogo atual, com as respostas do Nexo a partir do guia:',
      connect: 'Conecte sua conta da PSN para conversar com o Nexo sobre os seus jogos.',
      missable: {
        q: 'Tem algum troféu perdível no capítulo em que estou?',
        a: 'Tem, e eles se concentram nos Capítulos 2 a 4:\n\n- **Doe aos Pobres**: a caixa de doações da gangue some depois do Capítulo 4. Doe os 250 dólares aos poucos.\n- **Garoto de Recados**: entregue 5 itens que os companheiros do acampamento pedem; os pedidos só existem entre os Capítulos 2 e 4.\n- **Amigo do Peito**: faça uma atividade com companheiros no acampamento em cada um desses capítulos.\n\nFonte: Trophy Guides, Game Wiki e Platinum Forum',
      },
      hard: {
        q: 'Como eu pego o Corrida do Ouro?',
        a: 'É o mais difícil da platina: os objetivos de ouro só aparecem quando você **repete a missão**, e vários pedem precisão de tiro, tempo ou furtividade com menos recursos. Termine a história primeiro e depois repita as missões pelo menu de pausa até somar **70 Medalhas de Ouro**, sem pressa e uma de cada vez.\n\nFonte: Trophy Guides, Game Wiki e Platinum Forum',
      },
      next: {
        q: 'Terminei o Capítulo 3. O que eu faço agora?',
        a: 'Siga a história com a **Honra alta**: a missão de Honra do Capítulo 6, de **Dando uma Mãozinha**, só abre com Honra no nível 4 de 8. Antes de fechar o Capítulo 4, confira a doação e os pedidos do acampamento, e faça um save manual ao fim de cada capítulo. Medalhas de Ouro, colecionáveis e animais ficam para depois do Epílogo, quando o mapa abre por completo.\n\nFonte: Trophy Guides, Game Wiki e Platinum Forum',
      },
      bug: {
        q: 'O Zoólogo travou em 99%. É bug?',
        a: 'É um problema conhecido: o progresso para em 99% mesmo quando parece que você estudou tudo. Confira as subespécies no **Compendium**: normalmente falta um animal específico de um estado, como a cascavel Black-tailed Rattlesnake em New Austin.\n\nFonte: Trophy Guides, Game Wiki e Platinum Forum',
      },
    },
  },
  [Language.En]: {
    suggestions: {
      remaining: {
        q: 'What is left for the platinum, and what is the most efficient order?',
        label: 'What is left for the platinum?',
      },
      missable: {
        q: 'Is there a missable near where I am? What must I not skip right now?',
        label: 'Any missables now?',
      },
      easiest: {
        q: 'What is the next easiest trophy I can get right now, and how?',
        label: 'Next easy trophy',
      },
      stuck: {
        q: 'I am stuck. Tell me what to do in this part without spoilers.',
        label: 'I am stuck',
      },
    },
    partner: 'PLATINUM PARTNER',
    typing: 'Nexo is preparing an answer',
    welcomeEyebrow: 'YOUR ACHIEVEMENT PARTNER',
    welcomeTitle: 'I am Nexo. Shall we go for the platinum?',
    welcomeBody:
      'From the first trophy to the last challenge. Pick a suggestion above or tell me where you are.',
    loadFailed: 'Could not load the conversation. Refresh the page to try again.',
    eyebrow: 'YOUR PLATINUM PARTNER',
    logLabel: 'Conversation with Nexo',
    inputLabel: 'Message to Nexo',
    count: '{count}/{max}',
    cut: 'Pasted text cut at {max} characters · ',
    placeholder: 'Nexo, what is the next step?',
    placeholderShort: 'Ask Nexo…',
    trophy: {
      about: 'About the trophy **{trophy}**: {text}',
      placeholder: 'Ask about this trophy…',
      label: 'Asking about the trophy',
      remove: 'Take the trophy {trophy} out of the question',
      how: 'How do I get it?',
      missable: 'Can I miss it?',
      when: 'When should I do it?',
    },
    placeholderCommands: 'Nexo, what is the next step? Type / for commands',
    send: 'Send',
    mic: 'Say your question',
    micStop: 'Stop listening',
    micDenied: 'No microphone permission. Allow it in the browser or phone settings.',
    micFailed: 'Could not listen now. Try again.',
    menu: {
      label: 'Commands and games',
      game: 'Switch the game we talk about',
      noGame: 'No game with that name.',
      current: 'current',
      notOwned: 'not in your library',
      switch: 'Switch the game we talk about',
      switching: 'Switching to {name}…',
    },
    demo: {
      subtitle: 'Sample conversations about Red Dead Redemption 2.',
      eyebrow: 'HOW NEXO ANSWERS',
      lead: 'The chat is closed in the demo. These are a player’s questions about the current game, with Nexo’s answers from the guide:',
      connect: 'Connect your PSN account to talk to Nexo about your own games.',
      missable: {
        q: 'Is there a missable trophy in the chapter I am in?',
        a: 'Yes, and they sit in Chapters 2 to 4:\n\n- **The camp donation box** disappears after Chapter 4. Donate the 250 dollars a little at a time.\n- **Camp requests**: hand in 5 items your camp companions ask for; the requests only exist between Chapters 2 and 4.\n- **Companion activities**: do one with your camp companions in each of those chapters.\n\nSource: Trophy Guides, Game Wiki and Platinum Forum',
      },
      hard: {
        q: 'How do I get Gold Rush?',
        a: 'It is the hardest trophy of the platinum: the gold objectives only show up when you **replay a mission**, and many ask for accurate shooting, a time limit or stealth with fewer resources. Finish the story first, then replay missions from the pause menu until you have **70 Gold Medals**, one at a time and without rushing.\n\nSource: Trophy Guides, Game Wiki and Platinum Forum',
      },
      next: {
        q: 'I finished Chapter 3. What should I do now?',
        a: 'Keep going with **high Honor**: the Chapter 6 Honor mission only opens with Honor at level 4 of 8. Before you close Chapter 4, check the donation box and the camp requests, and make a manual save at the end of every chapter. Gold Medals, collectibles and animals can wait until after the Epilogue, when the whole map opens up.\n\nSource: Trophy Guides, Game Wiki and Platinum Forum',
      },
      bug: {
        q: 'Zoologist is stuck at 99%. Is it bugged?',
        a: 'It is a known issue: progress stops at 99% even when it looks like you studied everything. Check the subspecies in the **Compendium**: usually one animal from a specific state is missing, like the Black-tailed Rattlesnake in New Austin.\n\nSource: Trophy Guides, Game Wiki and Platinum Forum',
      },
    },
  },
})

/** A message as /api/chat sends it. `optimistic` marks what the player just sent, before the server answers. */
export interface ChatMessage {
  id?: string
  role: string
  content: string
  created_at?: string
  game?: Pick<Game, 'id' | 'name' | 'cover_url'> | null
  optimistic?: boolean
}

export type ChatLoad = ChatMessage[] | 'loading' | 'error'

const SUGGESTIONS = ['remaining', 'missable', 'easiest', 'stuck'] as const

// The demo's examples are about its current game.
const DEMO_GAME = {
  id: 'game:25076',
  name: 'Red Dead Redemption 2',
  cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1q1f.jpg',
}
// The longest message Nexo takes; the server cuts at the same length (config.chat.maxChars).
export const CHAT_MAX = 1000
const DEMO_EXCHANGES = ['missable', 'hard', 'next', 'bug'] as const
// The examples read as the last few evenings: one exchange a day, the oldest first, the answer a
// minute after the question.
function demoTime(exchange: number, minute: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (DEMO_EXCHANGES.length - 1 - exchange))
  d.setHours(21, 12 + minute, 0, 0)
  return d.toISOString()
}

function MessageMeta({ message: m }: { message: ChatMessage }) {
  const date = m.created_at ? new Date(m.created_at) : null
  const valid = date && !Number.isNaN(date.getTime())
  return (
    <div className="message-meta">
      {m.game?.id && m.game.name && (
        <Link className="message-game" to={titleHref(m.game.id)}>
          <Cover url={m.game.cover_url} name={m.game.name} className="message-game-cover" />
          <span>{m.game.name}</span>
        </Link>
      )}
      {valid && (
        <time dateTime={m.created_at}>
          {date.toLocaleString(getLocale(), {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      )}
    </div>
  )
}

function AssistantMessage({
  message,
  pending = false,
}: {
  message?: ChatMessage
  pending?: boolean
}) {
  const t = useMessages(messages)
  const [body, source] = splitSource(message?.content ?? '')
  return (
    <div
      className={`msg assistant${pending ? ' pending' : ''}`}
      id={pending ? 'pending' : undefined}
    >
      <div className="message-author">
        <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
        <span>
          Nexo<small>{t('partner')}</small>
        </span>
        {!pending && message && <MessageMeta message={message} />}
      </div>
      {pending ? (
        <div className="message-content">
          <span className="typing" role="img" aria-label={t('typing')}>
            <i />
            <i />
            <i />
          </span>
        </div>
      ) : source ? (
        <div className="message-content">
          <Markdown text={body} />
          <SourceNote text={source} />
        </div>
      ) : (
        <Markdown className="message-content" text={body} />
      )}
    </div>
  )
}

function UserMessage({ message: m }: { message: ChatMessage }) {
  // Just sent: no date or game yet, the server's copy replaces it with the answer.
  if (m.optimistic)
    return (
      <div className="msg user">
        <UserText text={m.content} />
      </div>
    )
  return (
    <div className="msg user">
      <MessageMeta message={m} />
      <div>
        <UserText text={m.content} />
      </div>
    </div>
  )
}

function ChatWelcome() {
  const t = useMessages(messages)
  return (
    <div className="empty chat-welcome">
      <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
      <span className="eyebrow">{t('welcomeEyebrow')}</span>
      <h2>{t('welcomeTitle')}</h2>
      <p>{t('welcomeBody')}</p>
    </div>
  )
}

/** Loading layout of the log: two Nexo bubbles around one of the player's. */
export function ChatSkeleton() {
  return (
    <>
      <div className="msg assistant" style={{ width: '70%' }}>
        <Sk w="40%" h={12} />
        <Sk w="100%" h={11} style={{ marginTop: 10 }} />
        <Sk w="90%" h={11} style={{ marginTop: 6 }} />
      </div>
      <div className="msg user" style={{ width: '45%' }}>
        <Sk w="100%" h={11} />
      </div>
      <div className="msg assistant" style={{ width: '78%' }}>
        <Sk w="40%" h={12} />
        <Sk w="100%" h={11} style={{ marginTop: 10 }} />
        <Sk w="95%" h={11} style={{ marginTop: 6 }} />
        <Sk w="60%" h={11} style={{ marginTop: 6 }} />
      </div>
    </>
  )
}

/** The demo's chat: a player's questions and Nexo's answers, written out, instead of a conversation. */
function DemoExamples() {
  const t = useMessages(messages)
  return (
    <>
      <div className="demo-lead">
        <span className="eyebrow">{t('demo.eyebrow')}</span>
        <p>{t('demo.lead')}</p>
      </div>
      {DEMO_EXCHANGES.map((key, i) => (
        <div key={key} className="demo-exchange" data-example={key}>
          <UserMessage
            message={{
              role: 'user',
              content: t(`demo.${key}.q`),
              game: DEMO_GAME,
              created_at: demoTime(i, 0),
            }}
          />
          <AssistantMessage
            message={{
              role: 'assistant',
              content: t(`demo.${key}.a`),
              game: DEMO_GAME,
              created_at: demoTime(i, 1),
            }}
          />
        </div>
      ))}
    </>
  )
}

function ChatLog({ chat, sending }: { chat: ChatLoad; sending: boolean }) {
  const t = useMessages(messages)
  if (chat === 'loading') return <ChatSkeleton />
  if (chat === 'error') return <ErrorState>{t('loadFailed')}</ErrorState>
  if (!chat.length && !sending) return <ChatWelcome />
  return (
    <>
      {chat.map((m, i) =>
        m.role === 'assistant' ? (
          <AssistantMessage key={m.id ?? i} message={m} />
        ) : (
          <UserMessage key={m.id ?? i} message={m} />
        ),
      )}
      {sending && <AssistantMessage pending />}
    </>
  )
}

type CommandMode = 'game' | 'command' | null

function commandMode(text: string): CommandMode {
  if (text.startsWith('/game ')) return 'game'
  return /^\/\S*$/.test(text) ? 'command' : null
}

function gameBadge(g: LibraryGame, t: Translator<typeof messages>) {
  if (g.current) return t('menu.current')
  return g.owned === false ? t('menu.notOwned') : undefined
}

/** The command list's options: "/game" while typing a command, the player's games after it. */
function menuItems(
  mode: CommandMode,
  text: string,
  games: LibraryGame[] | null,
  t: Translator<typeof messages>,
): MenuItem[] {
  if (mode === 'command')
    return '/game'.startsWith(text) ? [{ key: 'game', title: '/game', detail: t('menu.game') }] : []
  if (mode !== 'game') return []
  return (games ?? []).map((g) => ({
    key: g.np ?? g.game ?? g.name,
    title: g.name,
    detail: g.progress === null ? g.platform : `${g.platform} · ${g.progress}%`,
    icon: g.icon,
    badge: gameBadge(g, t),
  }))
}

/** The subtitle as a button that starts "/game"; while a picked game loads, it says so. */
function SubtitleSwitch({
  subtitle,
  switching,
  onClick,
}: {
  subtitle: string
  switching: string | null
  onClick: () => void
}) {
  const t = useMessages(messages)
  return (
    <button
      type="button"
      id="nexo-sub"
      className="nexo-sub-switch"
      aria-label={
        switching ? t('menu.switching', { name: switching }) : `${subtitle} ${t('menu.switch')}`
      }
      aria-busy={Boolean(switching)}
      data-tip={t('menu.switch')}
      disabled={Boolean(switching)}
      onClick={onClick}
    >
      {switching ? (
        <>
          <span className="chat-switching" aria-hidden="true" />
          {t('menu.switching', { name: switching })}
        </>
      ) : (
        <>
          <span className="nexo-sub-text">{subtitle}</span>
          <Icon name="chevron-down" />
        </>
      )}
    </button>
  )
}

/** The line under the title: the game switch when the box takes commands, plain text otherwise. */
function ChatSubtitle({
  subtitle,
  demo,
  canSwitch,
  switching,
  onSwitch,
}: {
  subtitle: string
  demo: boolean
  canSwitch: boolean
  switching: string | null
  onSwitch: () => void
}) {
  const t = useMessages(messages)
  if (canSwitch && !demo)
    return <SubtitleSwitch subtitle={subtitle} switching={switching} onClick={onSwitch} />
  return <p id="nexo-sub">{demo ? t('demo.subtitle') : subtitle}</p>
}

/** Under the log: the demo's invitation to connect, the read-only note, or the message box. */
function ChatBottom({
  demo,
  onConnect,
  readOnly,
  children,
}: {
  demo: boolean
  onConnect?: () => void
  readOnly?: ReactNode
  children: ReactNode
}) {
  const t = useMessages(messages)
  if (demo)
    return (
      <div className="demo-connect" id="chat-demo-connect">
        <p>{t('demo.connect')}</p>
        <DemoConnectButton onConnect={onConnect} />
      </div>
    )
  if (readOnly)
    return (
      <div className="nexo-readonly" role="note">
        {readOnly}
      </div>
    )
  return children
}

/** Ready questions above the log: about the trophy when there is one, general ones otherwise. */
function ChatChips({
  trophy,
  sending,
  onSend,
}: {
  trophy: string | null
  sending: boolean
  onSend: (text: string) => void
}) {
  const t = useMessages(messages)
  return (
    <div className="chips" id="chat-chips">
      {trophy
        ? (['how', 'missable', 'when'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="chip"
              disabled={sending}
              onClick={() => onSend(t(`trophy.${k}`))}
            >
              {t(`trophy.${k}`)}
            </button>
          ))
        : SUGGESTIONS.map((s) => {
            const q = t(`suggestions.${s}.q`)
            return (
              <button
                key={s}
                type="button"
                className="chip"
                data-q={q}
                disabled={sending}
                onClick={() => onSend(q)}
              >
                {t(`suggestions.${s}.label`)}
              </button>
            )
          })}
    </div>
  )
}

/** The trophy the question is about, on the message box, with a button to drop it. */
function ChatTrophy({ trophy, onClear }: { trophy: string; onClear: () => void }) {
  const t = useMessages(messages)
  return (
    <span className="chat-trophy">
      <Icon name="trophy" />
      <b title={t('trophy.label')}>{trophy}</b>
      <button type="button" aria-label={t('trophy.remove', { trophy })} onClick={onClear}>
        <Icon name="close" />
      </button>
    </span>
  )
}

// The field grows with its content, up to 160px.
function useAutoGrow(input: RefObject<HTMLTextAreaElement | null>, text: string) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit whenever the text changes
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])
}

// New messages and the pending bubble always land at the bottom. The demo's examples read
// from the top.
function useChatScroll(
  log: RefObject<HTMLDivElement | null>,
  demo: boolean,
  chat: ChatLoad,
  sending: boolean,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the log changes
  useLayoutEffect(() => {
    if (log.current && !demo) log.current.scrollTop = log.current.scrollHeight
    // Late layout (fonts, covers, a phone where the page scrolls rather than the log) can leave the
    // view short of the last message: put it in view once things settle.
    const raf = requestAnimationFrame(() => {
      if (!log.current || demo) return
      log.current.scrollTop = log.current.scrollHeight
      log.current.lastElementChild?.scrollIntoView?.({ block: 'end' })
    })
    return () => cancelAnimationFrame(raf)
  }, [chat, sending])
}

/** The player's games matching "/game <query>", a moment after typing stops; null while it is not
 * asked for (no `searchGames`) or still loading. */
function useGameSearch(
  searchGames: ((query: string) => Promise<LibraryGame[]>) | undefined,
  query: string,
) {
  const [games, setGames] = useState<LibraryGame[] | null>(null)
  useEffect(() => {
    if (!searchGames) {
      setGames(null)
      return
    }
    let live = true
    const timer = setTimeout(() => {
      searchGames(query)
        .then((found) => live && setGames(found))
        .catch(() => live && setGames([]))
    }, 150)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, searchGames])
  return games
}

export function NexoChat({
  chat,
  sending,
  subtitle,
  onSend,
  demo = false,
  onConnect,
  searchGames,
  onPickGame,
  switching = null,
  readOnly,
  trophy = null,
  onClearTrophy,
  note,
}: {
  chat: ChatLoad
  /** A question is out: the pending bubble shows and the send controls are disabled. */
  sending: boolean
  subtitle: string
  onSend: (text: string) => void
  /** The read-only demo: sample exchanges instead of the conversation, and no message box. */
  demo?: boolean
  /** Leaves the demo to connect an account. */
  onConnect?: () => void
  /** The player's games by name, for "/game" and the subtitle; without it, no game switch. */
  searchGames?: (query: string) => Promise<LibraryGame[]>
  onPickGame?: (game: LibraryGame) => void
  /** The game being loaded after a pick: the subtitle says so and the box waits. */
  switching?: string | null
  /** Reading a conversation that is not the chat's game: this note stands in for the box. */
  readOnly?: ReactNode
  /** A trophy the player came to ask about: it sits on the box and every question names it. */
  trophy?: string | null
  onClearTrophy?: () => void
  /** A discreet line under the subtitle (the game the player was on before a link switched it). */
  note?: ReactNode
}) {
  const t = useMessages(messages)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const form = useRef<HTMLFormElement>(null)

  useAutoGrow(input, text)
  useChatScroll(log, demo, chat, sending)

  // Opening the screen: jump to the latest message; on desktop, ready to type.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the screen opens
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (log.current && !demo) log.current.scrollTop = log.current.scrollHeight
      if (window.matchMedia('(min-width: 761px)').matches) input.current?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const send = (value: string) => {
    if (!value || sending) return
    setText('')
    // The trophy goes in the message itself, so Nexo focuses on it and the log says what was asked.
    onSend(trophy ? t('trophy.about', { trophy, text: value }) : value)
  }

  // Commands, as in Telegram: "/" lists them, "/game <name>" lists the player's games. A command
  // is never sent to Nexo.
  const mode = searchGames ? commandMode(text) : null
  const query = mode === 'game' ? text.slice(6).trim() : ''
  const games = useGameSearch(mode === 'game' ? searchGames : undefined, query)
  const items = menuItems(mode, text, games, t)
  const pick = (index: number) => {
    if (mode === 'command') setText('/game ')
    if (mode === 'game' && games?.[index]) {
      setText('')
      onPickGame?.(games[index])
    }
    setActive(0)
    input.current?.focus()
  }
  // Before paint: a key pressed right as the list arrives must not be undone by this reset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: back to the first option when the list changes
  useLayoutEffect(() => setActive(0), [mode, games])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode) {
      if (items.length) pick(active)
      return
    }
    send(text.trim())
  }

  // Enter sends; Shift+Enter breaks the line. With the list open, the arrows move through it, Enter
  // or Tab picks and Esc clears the command.
  // Whether the key was one of the open list's own.
  const menuKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (items.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((active + step + items.length) % items.length)
      return true
    }
    if (e.key === 'Tab' && items.length) {
      e.preventDefault()
      pick(active)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setText('')
      return true
    }
    return false
  }
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mode && menuKey(e)) return
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    form.current?.requestSubmit()
  }

  const listed = Boolean(mode && items.length)
  const menu = mode ? (
    <CommandMenu
      id="chat-menu"
      label={t('menu.label')}
      items={items}
      active={active}
      empty={mode === 'game' && games !== null ? t('menu.noGame') : undefined}
      onPick={pick}
    />
  ) : null

  return (
    <div className="card chat-page">
      <div className="nexo-chat-top">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div className="nexo-chat-heading">
            <NexoHero />
            <div>
              <span className="eyebrow">{t('eyebrow')}</span>
              <h1>Nexo</h1>
              <ChatSubtitle
                subtitle={subtitle}
                demo={demo}
                canSwitch={Boolean(searchGames)}
                switching={switching}
                onSwitch={() => {
                  setText('/game ')
                  input.current?.focus()
                }}
              />
              {note && <p className="nexo-note">{note}</p>}
            </div>
          </div>
        </div>
        {!demo && <ChatChips trophy={trophy} sending={sending} onSend={send} />}
      </div>
      <div
        ref={log}
        className="chat"
        id="chat"
        role="log"
        aria-label={t('logLabel')}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable log must be reachable by keyboard (WCAG 2.1.1)
        tabIndex={0}
      >
        {demo ? <DemoExamples /> : <ChatLog chat={chat} sending={sending} />}
      </div>
      <ChatBottom demo={demo} onConnect={onConnect} readOnly={readOnly}>
        <ChatForm
          formRef={form}
          inputRef={input}
          text={text}
          sending={sending || Boolean(switching)}
          onText={setText}
          onSubmit={submit}
          onKeyDown={keyDown}
          menu={menu}
          commands={Boolean(searchGames)}
          menuOpen={listed}
          activeId={listed ? `chat-menu-${active}` : undefined}
          attachment={
            trophy ? (
              <ChatTrophy
                trophy={trophy}
                onClear={() => {
                  onClearTrophy?.()
                  input.current?.focus()
                }}
              />
            ) : undefined
          }
        />
      </ChatBottom>
    </div>
  )
}

// Whether the end of a text field's last line runs into a counter of the given width at its bottom
// right. The text is laid out again in a hidden copy with the field's own font, padding and width,
// and the point where it ends is read from a marker placed after it.
function lastLineReaches(el: HTMLTextAreaElement, counterWidth: number): boolean {
  if (!el.value) return false
  const style = getComputedStyle(el)
  const copy = document.createElement('div')
  for (const p of [
    'font',
    'letterSpacing',
    'wordSpacing',
    'lineHeight',
    'textTransform',
    'tabSize',
    'paddingLeft',
    'paddingRight',
    'wordBreak',
  ] as const)
    copy.style[p] = style[p]
  copy.style.boxSizing = 'border-box'
  copy.style.width = `${el.clientWidth}px`
  copy.style.position = 'absolute'
  copy.style.visibility = 'hidden'
  copy.style.whiteSpace = 'pre-wrap'
  copy.style.overflowWrap = 'break-word'
  copy.textContent = el.value
  const end = document.createElement('span')
  end.textContent = '\u200b'
  copy.append(end)
  document.body.append(copy)
  const reach = end.offsetLeft
  copy.remove()
  return reach > el.clientWidth - counterWidth - 8
}

/** The mic next to Send: what the player says goes into the box, after what is already there, to
 * read and fix before sending. Shown only where the phone or the browser can dictate. */
function MicButton({
  text,
  onText,
  disabled,
}: {
  text: string
  onText: (text: string) => void
  disabled: boolean
}) {
  const t = useMessages(messages)
  const [listening, setListening] = useState(false)
  const session = useRef<Dictation | null>(null)
  const [supported] = useState(canDictate)
  useEffect(() => () => session.current?.stop(), [])
  if (!supported) return null
  const toggle = async () => {
    if (listening) return session.current?.stop()
    const base = text.trim()
    setListening(true)
    session.current = await dictate(getLocale() === Language.En ? 'en-US' : 'pt-BR', {
      onText: (heard) => onText(base && heard ? `${base} ${heard}` : base || heard),
      onEnd: (error) => {
        setListening(false)
        session.current = null
        if (error === 'denied') toast(t('micDenied'))
        else if (error === 'failed') toast(t('micFailed'))
      },
    })
  }
  return (
    <button
      type="button"
      className={`chat-mic${listening ? ' listening' : ''}`}
      aria-label={t(listening ? 'micStop' : 'mic')}
      aria-pressed={listening}
      title={t(listening ? 'micStop' : 'mic')}
      disabled={disabled}
      onClick={toggle}
    >
      <Icon name="mic" />
    </button>
  )
}

/** The message box under the conversation. */
function ChatForm({
  formRef,
  inputRef,
  text,
  sending,
  onText,
  onSubmit,
  onKeyDown,
  menu,
  commands = false,
  menuOpen = false,
  activeId,
  attachment,
}: {
  menu?: ReactNode
  /** What the question is about (a trophy), shown on the box above the text. */
  attachment?: ReactNode
  /** The box takes commands ("/game"): its placeholder says so. */
  commands?: boolean
  menuOpen?: boolean
  activeId?: string
  formRef: RefObject<HTMLFormElement | null>
  inputRef: RefObject<HTMLTextAreaElement | null>
  text: string
  sending: boolean
  onText: (text: string) => void
  onSubmit: (e: FormEvent) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const t = useMessages(messages)
  // The field grows with what is typed and only scrolls past its tallest size; a trophy coming or
  // going changes its width, so it is measured again then too.
  const attached = Boolean(attachment)
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again whenever the text or the trophy changes
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    const fit = () => {
      // The counter sits at the end of the last line, inside the box. Only when the text reaches it
      // does it move to a line of its own under the text.
      const box = el.closest('.chat-box')
      const counter = box?.querySelector<HTMLElement>('.chat-count')
      box?.classList.toggle('crowded', !!counter && lastLineReaches(el, counter.offsetWidth))
      el.style.height = 'auto'
      const tallest = Number.parseFloat(getComputedStyle(el).maxHeight) || Number.POSITIVE_INFINITY
      el.style.height = `${Math.min(el.scrollHeight + 2, tallest)}px`
      el.style.overflowY = el.scrollHeight + 2 > tallest ? 'auto' : 'hidden'
    }
    fit()
    // A narrower or wider box wraps the text differently: measure again then.
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    watch?.observe(el)
    return () => watch?.disconnect()
  }, [text, inputRef, attached])
  // A paste longer than what is left is cut by the field; say so instead of losing it quietly.
  const [cut, setCut] = useState(false)
  useEffect(() => {
    if (text.length < CHAT_MAX) setCut(false)
  }, [text])
  const near = text.length >= CHAT_MAX * 0.8
  // A phone has no keyboard shortcut to discover and its text is 16px: a short placeholder, on one line.
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches
  return (
    <form ref={formRef} className="chatform" id="chat-form" onSubmit={onSubmit}>
      <div className="chat-field">
        {/* The counter sits on the text box itself, not on the field with the note below it. */}
        <div className="chat-box">
          {menu}
          <div className="chat-line">
            {attachment}
            <textarea
              // The box takes commands too: "/game" opens a list of games under it.
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={menuOpen}
              aria-controls="chat-menu"
              aria-activedescendant={activeId}
              ref={inputRef}
              id="chat-input"
              rows={1}
              maxLength={CHAT_MAX}
              aria-label={t('inputLabel')}
              placeholder={
                attachment
                  ? t('trophy.placeholder')
                  : t(
                      narrow
                        ? 'placeholderShort'
                        : commands
                          ? 'placeholderCommands'
                          : 'placeholder',
                    )
              }
              autoComplete="off"
              value={text}
              onChange={(e) => onText(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={(e) => {
                const el = e.currentTarget
                const kept = el.value.length - (el.selectionEnd - el.selectionStart)
                if (kept + e.clipboardData.getData('text').length > CHAT_MAX) setCut(true)
              }}
            />
          </div>
          {/* The count has its own line inside the box, under the text, so it never covers it. */}
          <span
            className={`chat-count${near ? ' near' : ''}${text.length >= CHAT_MAX ? ' full' : ''}`}
            aria-live="polite"
          >
            {t('count', { count: text.length, max: CHAT_MAX })}
          </span>
        </div>
        {cut && (
          <span className="chat-cut" role="status">
            {t('cut', { max: CHAT_MAX }).replace(/ · $/, '.')}
          </span>
        )}
      </div>
      <MicButton text={text} onText={onText} disabled={sending} />
      <button type="submit" disabled={sending}>
        {t('send')}
      </button>
    </form>
  )
}
