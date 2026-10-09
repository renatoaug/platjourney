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
import { modelWorkDone } from '../ui/plugin-slot'
import { toast } from '../ui/toast'

const messages = defineMessages({
  [Language.PtBR]: {
    sendFailed: 'Não conseguimos falar com o Nexo. Tenta de novo.',
    subtitleLoading: 'Um passo mais perto da platina.',
    subtitleGame: 'Falando sobre {name} ({progress}%).',
    subtitleNoGame: 'Escolha um jogo para começar a conversa.',
    subtitleNotOwned: 'Falando sobre {name}, antes de você comprar.',
    switchFailed: 'Não consegui trocar o jogo. Tenta de novo.',
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
  const currentKey = data?.current?.game.id ?? 'none'
  // Another conversation being read, from the list; null is the chat's own game.
  const [viewing, setViewing] = useState<string | null>(null)
  const key = viewing ?? currentKey
  const shown = useRef(key)
  shown.current = key
  const [chat, setChat] = useState<ChatLoad>(() => chats[key] ?? 'loading')
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
    if (!data) return
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

  const current = data?.current
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
  const [switching, setSwitching] = useState<string | null>(null)
  const pickGame = async (game: LibraryGame) => {
    setSwitching(game.name)
    try {
      await api('/api/current', game.np ? { np: game.np } : { game: game.game })
      await loadState()
      // The subtitle and the conversation change in place: that is the confirmation.
      setViewing(null)
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('switchFailed'))
    } finally {
      setSwitching(null)
    }
  }

  // A game page's "talk to Nexo" link names the game (?game=<np>&name=…): the chat opens on it.
  const [params, setParams] = useSearchParams()
  const asked = useRef(false)
  useEffect(() => {
    const wanted = params.get('game')
    if (!wanted || asked.current || !data) return
    asked.current = true
    setParams({}, { replace: true })
    // A PSN list id for a game in the library, a game id for one outside it.
    const byGame = wanted.startsWith('game:')
    if (byGame ? data.current?.game.id === wanted : data.current?.np === wanted) return
    void pickGame({
      ...(byGame ? { game: wanted } : { np: wanted }),
      name: params.get('name') ?? '',
    } as LibraryGame)
  })

  // A conversation from the list: the chat's game is just shown; another game of the library becomes
  // the chat's game; one outside the library, or the old messages without a game, is read only.
  const pickThread = (thread: ChatThread) => {
    setSheet(false)
    const k = threadKey(thread)
    if (k === currentKey) setViewing(null)
    else if (thread.np) void pickGame({ np: thread.np, name: thread.name ?? '' } as LibraryGame)
    // A game outside the library is still a conversation: Nexo talks about it before buying.
    else if (thread.game)
      void pickGame({ game: thread.game, name: thread.name ?? '' } as LibraryGame)
    else setViewing(k)
  }
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
        {/* The list shows once there is a conversation to go back to. */}
        {threads?.length ? (
          <>
            <ChatThreadsToggle onOpen={() => setSheet(true)} />
            <ChatThreads
              threads={threads}
              active={key}
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
          onPickGame={pickGame}
          switching={switching}
        />
      </div>
    </Page>
  )
}
