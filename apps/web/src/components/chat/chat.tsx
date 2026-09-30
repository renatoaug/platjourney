/** The Nexo chat card: suggestion chips, the conversation log and the message box. Presentational; the /nexo screen fetches and sends. */
import {
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { defineMessages, getLocale, Language, useMessages } from '../../i18n/i18n'
import type { Game } from '../../lib/types'
import { Cover } from '../../ui/cover'
import { Markdown, UserText } from '../../ui/markdown'
import { Sk } from '../../ui/skeleton'
import { SourceNote, splitSource } from '../../ui/source-note'
import { ErrorState } from '../../ui/states'
import { DemoConnectButton } from '../demo'
import { titleHref } from '../tip'

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
    send: 'Enviar',
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
    send: 'Send',
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

export function NexoChat({
  chat,
  sending,
  subtitle,
  onSend,
  demo = false,
  onConnect,
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
}) {
  const t = useMessages(messages)
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const form = useRef<HTMLFormElement>(null)

  // The field grows with its content, up to 160px.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit whenever the text changes
  useLayoutEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  // New messages and the pending bubble always land at the bottom. The demo's examples read
  // from the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the log changes
  useLayoutEffect(() => {
    if (log.current && !demo) log.current.scrollTop = log.current.scrollHeight
  }, [chat, sending])

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
    onSend(value)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(text.trim())
  }

  // Enter sends; Shift+Enter breaks the line.
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    form.current?.requestSubmit()
  }

  return (
    <div className="card chat-page">
      <div className="nexo-chat-top">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div className="nexo-chat-heading">
            <img className="nexo-avatar" src="/nexo-avatar.svg" alt="" />
            <div>
              <span className="eyebrow">{t('eyebrow')}</span>
              <h1>Nexo</h1>
              <p id="nexo-sub">{demo ? t('demo.subtitle') : subtitle}</p>
            </div>
          </div>
        </div>
        {!demo && (
          <div className="chips" id="chat-chips">
            {SUGGESTIONS.map((s) => {
              const q = t(`suggestions.${s}.q`)
              return (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  data-q={q}
                  disabled={sending}
                  onClick={() => send(q)}
                >
                  {t(`suggestions.${s}.label`)}
                </button>
              )
            })}
          </div>
        )}
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
      {demo ? (
        <div className="demo-connect" id="chat-demo-connect">
          <p>{t('demo.connect')}</p>
          <DemoConnectButton onConnect={onConnect} />
        </div>
      ) : (
        <ChatForm
          formRef={form}
          inputRef={input}
          text={text}
          sending={sending}
          onText={setText}
          onSubmit={submit}
          onKeyDown={keyDown}
        />
      )}
    </div>
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
}: {
  formRef: RefObject<HTMLFormElement | null>
  inputRef: RefObject<HTMLTextAreaElement | null>
  text: string
  sending: boolean
  onText: (text: string) => void
  onSubmit: (e: FormEvent) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  const t = useMessages(messages)
  // The field grows with what is typed and only scrolls past its tallest size.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again whenever the text changes
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const tallest = Number.parseFloat(getComputedStyle(el).maxHeight) || Number.POSITIVE_INFINITY
    el.style.height = `${Math.min(el.scrollHeight + 2, tallest)}px`
    el.style.overflowY = el.scrollHeight + 2 > tallest ? 'auto' : 'hidden'
  }, [text, inputRef])
  // A paste longer than what is left is cut by the field; say so instead of losing it quietly.
  const [cut, setCut] = useState(false)
  useEffect(() => {
    if (text.length < CHAT_MAX) setCut(false)
  }, [text])
  const near = text.length >= CHAT_MAX * 0.8
  return (
    <form ref={formRef} className="chatform" id="chat-form" onSubmit={onSubmit}>
      <div className="chat-field">
        {/* The counter sits on the text box itself, not on the field with the note below it. */}
        <div className="chat-box">
          <textarea
            ref={inputRef}
            id="chat-input"
            rows={1}
            maxLength={CHAT_MAX}
            aria-label={t('inputLabel')}
            placeholder={t('placeholder')}
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
          {text.length > 0 && (
            <span
              className={`chat-count${near ? ' near' : ''}${text.length >= CHAT_MAX ? ' full' : ''}`}
              aria-live="polite"
            >
              {t('count', { count: text.length, max: CHAT_MAX })}
            </span>
          )}
        </div>
        {cut && (
          <span className="chat-cut" role="status">
            {t('cut', { max: CHAT_MAX }).replace(/ · $/, '.')}
          </span>
        )}
      </div>
      <button type="submit" disabled={sending}>
        {t('send')}
      </button>
    </form>
  )
}
