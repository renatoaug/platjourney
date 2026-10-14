/** Chat with Nexo, one conversation per game. Each conversation is fetched once and kept in the app cache, so navigating away and back keeps it (and an answer still in flight). */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { type ChatLoad, type ChatMessage, NexoChat } from '../components/chat/chat'
import {
  type ChatThread,
  ChatThreads,
  ChatThreadsToggle,
  threadKey,
} from '../components/chat/threads'
import { connectAccount, useDemo } from '../components/demo'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import type { LibraryGame } from '../lib/types'
import { modelWorkDone } from '../plugins'
import { toast } from '../ui/toast'

const messages = defineMessages({
  [Language.PtBR]: {
    sendFailed: 'Não conseguimos falar com o Nexo. Tenta de novo.',
    subtitleLoading: 'Um passo mais perto da platina.',
    subtitleGame: 'Falando sobre {name} ({progress}%).',
    subtitleNoGame: 'Escolha um jogo para começar a conversa.',
    subtitleNotOwned: 'Falando sobre {name}, antes de você comprar.',
    switchFailed: 'Não consegui trocar o jogo. Tenta de novo.',
    playing: 'Seu jogo atual continua {name}.',
    backTo: 'Falar dele',
    readOnlyGeneral: 'Conversas de antes de o Nexo separar por jogo.',
    backToCurrent: 'Voltar para {name}',
    backToChat: 'Voltar para a conversa',
  },
  [Language.En]: {
    sendFailed: 'Could not reach Nexo. Try again.',
    subtitleLoading: 'One step closer to the platinum.',
    subtitleGame: 'Talking about {name} ({progress}%).',
    subtitleNoGame: 'Pick a game to start the conversation.',
    subtitleNotOwned: 'Talking about {name}, before you buy it.',
    switchFailed: 'Could not switch the game. Try again.',
    playing: 'Your current game is still {name}.',
    backTo: 'Talk about it',
    readOnlyGeneral: 'Conversations from before Nexo kept one per game.',
    backToCurrent: 'Back to {name}',
    backToChat: 'Back to the conversation',
  },
})

type ChatReply = { text?: string; error?: string; messages?: ChatMessage[] }

export function Nexo() {
  // The demo's chat is closed: it shows sample exchanges and asks nothing of the server.
  if (useDemo()) return <DemoNexo />
  return <LiveNexo />
}

function DemoNexo() {
  return (
    <Page path="/nexo">
      <NexoChat
        chat={[]}
        sending={false}
        subtitle=""
        onSend={() => {}}
        demo
        onConnect={connectAccount}
      />
    </Page>
  )
}

function LiveNexo() {
  const t = useMessages(messages)
  const { data, cache, loadState } = useApp()
  // Each game is its own conversation, kept by its key (the game's id, or "none" without a game).
  if (!cache.chats) cache.chats = {}
  const chats = cache.chats as Record<string, ChatMessage[]>
  // The chat's game: its own pick when there is one, else the game being played.
  const chatGame = data?.chat ?? data?.current
  const currentKey = chatGame?.game.id ?? 'none'
  // Another conversation being read, from the list; null is the chat's own game.
  const [viewing, setViewing] = useState<string | null>(null)
  // A game page's link names the game to open on (?game=…): until the switch lands, the old game's
  // conversation must not flash on screen.
  const [params, setParams] = useSearchParams()
  const incoming = params.get('game')
  const arriving = incoming !== null && incoming !== chatGame?.np && incoming !== chatGame?.game.id
  const key = viewing ?? currentKey
  const shown = useRef(key)
  shown.current = key
  const [chat, setChat] = useState<ChatLoad>(() =>
    arriving ? 'loading' : (chats[key] ?? 'loading'),
  )
  // The conversation being left while a switch loads: it is not shown again meanwhile.
  const leaving = useRef<string | null>(arriving ? key : null)
  const [sending, setSending] = useState(() => cache.chatSending === true)
  const [threads, setThreads] = useState<ChatThread[] | null>(
    () => (cache.chatThreads as ChatThread[] | undefined) ?? null,
  )
  const [sheet, setSheet] = useState(false)

  // Writes go to the cache first: a reply that lands after the player left is still there on return.
  const write = useCallback(
    (k: string, list: ChatMessage[]) => {
      chats[k] = list
      if (shown.current === k) setChat(list)
    },
    [chats],
  )

  const loadThreads = useCallback(() => {
    api<ChatThread[]>('/api/chat/threads')
      .then((list) => {
        cache.chatThreads = list
        setThreads(list)
      })
      .catch(() => setThreads((old) => old ?? []))
  }, [cache])

  useEffect(() => {
    if (!cache.chatThreads) loadThreads()
  }, [cache, loadThreads])

  useEffect(() => {
    if (!data || leaving.current === key) return
    const known = chats[key]
    setChat(known ?? 'loading')
    if (known) return
    api<ChatMessage[]>(`/api/chat?game=${encodeURIComponent(key)}`)
      .then((list) => write(key, list))
      .catch(() => shown.current === key && setChat('error'))
  }, [data, key, chats, write])

  const send = async (text: string) => {
    if (cache.chatSending === true) return
    const k = currentKey
    cache.chatSending = true
    setSending(true)
    write(k, [...(chats[k] ?? []), { role: 'user', content: text, optimistic: true }])
    try {
      const r = await api<ChatReply>('/api/chat', { text })
      const messages = r.messages
      if (messages) write(k, messages)
      else write(k, [...(chats[k] ?? []), { role: 'assistant', content: r.text ?? r.error ?? '' }])
      modelWorkDone()
      loadThreads()
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('sendFailed'))
    }
    cache.chatSending = false
    setSending(false)
  }

  const current = chatGame
  const subtitle = !data
    ? t('subtitleLoading')
    : current
      ? current.owned === false
        ? t('subtitleNotOwned', { name: current.name })
        : t('subtitleGame', { name: current.name, progress: current.progress })
      : t('subtitleNoGame')

  // The chat's game, as /game in Telegram: the server loads that game's context, then the screen
  // reloads its state so the subtitle and the next answers follow it.
  const searchGames = useCallback(
    (q: string) => api<LibraryGame[]>(`/api/library?q=${encodeURIComponent(q)}`),
    [],
  )
  // Loading a game's context takes a few seconds (PSN, guide): the chat says so meanwhile.
  // The game a switch is heading to: the list marks it (and shows it as the draft) before the
  // server answers, so the previous game's draft does not linger.
  const [target, setTarget] = useState<LibraryGame | null>(() => {
    if (!arriving || !incoming) return null
    const name = params.get('name') ?? ''
    return incoming.startsWith('game:')
      ? ({ game: incoming, name } as LibraryGame)
      : ({ np: incoming, name } as LibraryGame)
  })
  const [switching, setSwitching] = useState<string | null>(() =>
    arriving ? params.get('name') || '…' : null,
  )
  // The trophy the player came to ask about.
  const [trophy, setTrophy] = useState<string | null>(null)
  // The game being played, when the chat talks about another one: a line away, to go back to.
  const playing = data?.chat && data.current ? data.current : null
  const pickGame = async (game: LibraryGame) => {
    setSwitching(game.name)
    setTarget(game)
    // The old game's messages leave at once; the skeleton holds until the new game's arrive.
    leaving.current = shown.current
    setChat('loading')
    try {
      await api('/api/current', game.np ? { np: game.np } : { game: game.game })
      await loadState()
      // The subtitle and the conversation change in place: that is the confirmation.
      setViewing(null)
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('switchFailed'))
      setChat(chats[shown.current] ?? 'error')
    } finally {
      leaving.current = null
      setSwitching(null)
      setTarget(null)
    }
  }

  // A game page's "talk to Nexo" link names the game (?game=<np>&name=…): the chat opens on it.
  // A trophy tip link names the trophy too (&trophy=…): it is attached to the box.
  const asked = useRef(false)
  useEffect(() => {
    const wanted = params.get('game')
    if (!wanted || asked.current || !data) return
    asked.current = true
    setTrophy(params.get('trophy'))
    setParams({}, { replace: true })
    // A PSN list id for a game in the library, a game id for one outside it.
    const byGame = wanted.startsWith('game:')
    if (byGame ? chatGame?.game.id === wanted : chatGame?.np === wanted) return
    void pickGame({
      ...(byGame ? { game: wanted } : { np: wanted }),
      name: params.get('name') ?? '',
    } as LibraryGame)
  })

  // A conversation from the list: the chat's game is just shown; another game of the library becomes
  // the chat's game; one outside the library, or the old messages without a game, is read only.
  // A game the player chose here (a command or the list): the trophy and the way back no longer apply.
  const chooseGame = (game: LibraryGame) => {
    setTrophy(null)
    void pickGame(game)
  }
  const pickThread = (thread: ChatThread) => {
    setSheet(false)
    setTrophy(null)
    const k = threadKey(thread)
    if (k === currentKey) setViewing(null)
    else if (thread.np) void pickGame({ np: thread.np, name: thread.name ?? '' } as LibraryGame)
    // A game outside the library is still a conversation: Nexo talks about it before buying.
    else if (thread.game)
      void pickGame({ game: thread.game, name: thread.name ?? '' } as LibraryGame)
    else setViewing(k)
  }
  // The chat's game with no conversation yet sits on top as a draft; it goes away by itself when
  // the player leaves without writing, since nothing is stored until a message is sent.
  const heading = target
    ? (threads?.find((x) => (target.np ? x.np === target.np : x.game === target.game)) ?? null)
    : undefined
  const draft: ChatThread | null = target
    ? heading
      ? null
      : {
          game: target.game ?? `np:${target.np}`,
          np: target.np ?? null,
          name: target.name,
          cover_url: target.icon ?? null,
          messages: 0,
          last_at: new Date().toISOString(),
          last_question: null,
          draft: true,
        }
    : current && threads && !threads.some((x) => x.game === current.game.id)
      ? {
          game: current.game.id,
          np: current.np,
          name: current.name,
          cover_url: current.game.cover_url ?? null,
          messages: 0,
          last_at: new Date().toISOString(),
          last_question: null,
          draft: true,
        }
      : null
  const listed = threads && (draft ? [draft, ...threads] : threads)
  // While switching, the conversation heading for the new game is the one marked.
  const marked = target ? (heading ? threadKey(heading) : draft ? threadKey(draft) : key) : key
  const reading = viewing !== null && viewing !== currentKey
  const readOnly = reading ? (
    <>
      <span>{t('readOnlyGeneral')}</span>
      <button type="button" className="button ghost sm" onClick={() => setViewing(null)}>
        {current ? t('backToCurrent', { name: current.name }) : t('backToChat')}
      </button>
    </>
  ) : undefined

  return (
    <Page path="/nexo">
      <div className="nexo-layout">
        {/* The list shows once there is a conversation, or the chat's game waits for its first. */}
        {listed?.length ? (
          <>
            <ChatThreadsToggle onOpen={() => setSheet(true)} />
            <ChatThreads
              threads={listed}
              active={marked}
              onPick={pickThread}
              open={sheet}
              onClose={() => setSheet(false)}
            />
          </>
        ) : null}
        <NexoChat
          readOnly={readOnly}
          chat={chat}
          sending={sending}
          subtitle={subtitle}
          onSend={send}
          searchGames={searchGames}
          onPickGame={chooseGame}
          switching={switching}
          trophy={trophy}
          onClearTrophy={() => setTrophy(null)}
          note={
            playing && !switching ? (
              <>
                {t('playing', { name: playing.name })}{' '}
                <button
                  type="button"
                  onClick={() =>
                    chooseGame({
                      ...(playing.np ? { np: playing.np } : { game: playing.game.id }),
                      name: playing.name,
                    } as LibraryGame)
                  }
                >
                  {t('backTo')}
                </button>
              </>
            ) : undefined
          }
        />
      </div>
    </Page>
  )
}
