/** Chat with Nexo: a general conversation and one per game. Each conversation is fetched once and kept in the app cache, so navigating away and back keeps it (and an answer still in flight). */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
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
import { defineMessages, Language, type Translator, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import { shownProgress } from '../lib/progress'
import type { CurrentGame, LibraryGame } from '../lib/types'
import { modelWorkDone } from '../plugins'
import { toast } from '../ui/toast'
import './nexo.css'

const messages = defineMessages({
  [Language.PtBR]: {
    sendFailed: 'Não conseguimos falar com o Nexo. Tenta de novo.',
    subtitleLoading: 'Um passo mais perto da platina.',
    subtitleGame: '{name} · {progress}%',
    subtitleGeneral: 'Suas platinas, metas e próximos jogos.',
    subtitleNotOwned: 'Falando sobre {name}, antes de você comprar.',
    switchFailed: 'Não consegui trocar o jogo. Tenta de novo.',
  },
  [Language.En]: {
    sendFailed: 'Could not reach Nexo. Try again.',
    subtitleLoading: 'One step closer to the platinum.',
    subtitleGame: '{name} · {progress}%',
    subtitleGeneral: 'Your platinums, goals and next games.',
    subtitleNotOwned: 'Talking about {name}, before you buy it.',
    switchFailed: 'Could not switch the game. Try again.',
  },
})

type ChatReply = { text?: string; error?: string; messages?: ChatMessage[]; general?: boolean }

function hasReply({ error, text, messages }: ChatReply) {
  if (error) return false
  const last = messages?.at(-1)
  return Boolean(text?.trim() || (last?.role === 'assistant' && last.content.trim()))
}

export function Nexo() {
  // The demo's chat is closed: it shows sample exchanges and asks nothing of the server.
  const demo = useDemo()
  const [params] = useSearchParams()
  if (demo) return <DemoNexo />
  return params.get('resume') === 'latest' && !params.has('game') ? <LatestNexo /> : <LiveNexo />
}

/** General entries resume the server's most recent conversation; explicit game entries keep theirs. */
function LatestNexo() {
  const { cache } = useApp()
  const location = useLocation()
  const [, setParams] = useSearchParams()
  const [chat, setChat] = useState<ChatLoad>('loading')
  useEffect(() => {
    let active = true
    api<ChatThread[]>('/api/chat/threads')
      .then((list) => {
        if (!active) return
        cache.chatThreads = list
        // The authenticated endpoint already orders by last_at descending.
        const latest = list[0]
        const next = new URLSearchParams()
        if (latest?.game) {
          next.set('game', latest.np ?? latest.game)
          next.set('name', latest.name ?? '')
        } else if (latest) next.set('history', 'none')
        setParams(next, { replace: true, state: location.state })
      })
      .catch(() => active && setChat('error'))
    return () => {
      active = false
    }
  }, [cache, location.state, setParams])
  return (
    <Page path="/nexo">
      <NexoChat chat={chat} sending={false} subtitle="" onSend={() => {}} readOnly={<span />} />
    </Page>
  )
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

type Translate = Translator<typeof messages>

function subtitleOf(
  t: Translate,
  loaded: boolean,
  current: CurrentGame | null | undefined,
  includeDlc: boolean,
  general: boolean,
) {
  if (!loaded) return t('subtitleLoading')
  if (general || !current) return t('subtitleGeneral')
  if (current.owned === false) return t('subtitleNotOwned', { name: current.name })
  return t('subtitleGame', {
    name: current.name,
    progress: current.groups
      ? shownProgress(current.groups.base, current.groups.dlc, includeDlc).progress
      : current.progress,
  })
}

/** The list's conversation for the game a switch is heading to, when it already has one. */
function threadFor(target: LibraryGame, threads: ChatThread[] | null) {
  return threads?.find((x) => (target.np ? x.np === target.np : x.game === target.game)) ?? null
}

/**
 * The draft on top of the list: the game a switch is heading to while it has no conversation, or
 * the chat's game before its first message.
 */
function draftThread(
  target: LibraryGame | null,
  heading: ChatThread | null | undefined,
  current: CurrentGame | null | undefined,
  threads: ChatThread[] | null,
): ChatThread | null {
  if (target) {
    if (heading) return null
    return {
      game: target.game ?? `np:${target.np}`,
      np: target.np ?? null,
      name: target.name,
      cover_url: target.icon ?? null,
      messages: 0,
      last_at: new Date().toISOString(),
      last_question: null,
      draft: true,
    }
  }
  if (current && threads && !threads.some((x) => x.game === current.game.id))
    return {
      game: current.game.id,
      np: current.np,
      name: current.name,
      cover_url: current.game.cover_url ?? null,
      messages: 0,
      last_at: new Date().toISOString(),
      last_question: null,
      draft: true,
    }
  return null
}

function markedKey(
  target: LibraryGame | null,
  heading: ChatThread | null | undefined,
  draft: ChatThread | null,
  key: string,
) {
  if (!target) return key
  if (heading) return threadKey(heading)
  return draft ? threadKey(draft) : key
}

/** The general conversation, always on top of the list, even before its first message. */
function generalThread(threads: ChatThread[]): ChatThread {
  return (
    threads.find((x) => !x.game) ?? {
      game: null,
      np: null,
      name: null,
      cover_url: null,
      messages: 0,
      last_at: new Date().toISOString(),
      last_question: null,
      draft: true,
    }
  )
}

function LiveNexo() {
  const t = useMessages(messages)
  const location = useLocation()
  const { data, cache, loadState, me } = useApp()
  // Each game is its own conversation, kept by its key (the game's id, or "none" without a game).
  if (!cache.chats) cache.chats = {}
  const chats = cache.chats as Record<string, ChatMessage[]>
  // The chat's game: its own pick when there is one, else the game being played.
  const chatGame = data?.chat ?? data?.current
  const currentKey = chatGame?.game.id ?? 'none'
  // Another conversation being read, from the list; null is the chat's own game.
  const [params, setParams] = useSearchParams()
  const [viewing, setViewing] = useState<string | null>(() =>
    params.get('history') === 'none' ? 'none' : null,
  )
  const [replyVersion, setReplyVersion] = useState(0)
  // A game page's link names the game to open on (?game=…): until the switch lands, the old game's
  // conversation must not flash on screen.
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
  const closeThreads = useCallback(() => setSheet(false), [])

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

  // What to platinum next is not about this game: its answer lives in the general conversation.
  const landReply = (r: ChatReply, k: string) => {
    if (r.general && r.messages && k !== 'none') {
      write(
        k,
        (chats[k] ?? []).filter((m) => !m.optimistic),
      )
      write('none', r.messages)
      if (shown.current === k) setViewing('none')
      return
    }
    write(
      k,
      r.messages ?? [...(chats[k] ?? []), { role: 'assistant', content: r.text ?? r.error ?? '' }],
    )
  }

  const send = async (text: string) => {
    if (cache.chatSending === true) return
    const k = key
    cache.chatSending = true
    setSending(true)
    write(k, [...(chats[k] ?? []), { role: 'user', content: text, optimistic: true }])
    try {
      const r = await api<ChatReply>('/api/chat', k === 'none' ? { text, general: true } : { text })
      landReply(r, k)
      if (hasReply(r) && shown.current === k && leaving.current !== k) {
        setReplyVersion((version) => version + 1)
      }
      modelWorkDone()
      loadThreads()
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('sendFailed'))
    }
    cache.chatSending = false
    setSending(false)
  }

  const current = chatGame
  const general = key === 'none'
  const subtitle = subtitleOf(t, !!data, current, me.includeDlcProgress, general)

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
    setParams({}, { replace: true, state: location.state })
    // A PSN list id for a game in the library, a game id for one outside it.
    const byGame = wanted.startsWith('game:')
    if (byGame ? chatGame?.game.id === wanted : chatGame?.np === wanted) return
    void pickGame({
      ...(byGame ? { game: wanted } : { np: wanted }),
      name: params.get('name') ?? '',
    } as LibraryGame)
  })

  // A conversation from the list: the chat's game is just shown; another game becomes the chat's
  // game; the general one is opened in place, keeping the chat's game for when the player returns.
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
  const heading = target ? threadFor(target, threads) : undefined
  const draft = draftThread(target, heading, current, threads)
  const listed = threads && [
    generalThread(threads),
    ...(draft ? [draft] : []),
    ...threads.filter((x) => x.game),
  ]
  // While switching, the conversation heading for the new game is the one marked.
  const marked = markedKey(target, heading, draft, key)

  return (
    <Page path="/nexo">
      <div className="nexo-layout nexo-conversation">
        {/* The general conversation is always there, so the list shows as soon as it loads. */}
        {listed?.length ? (
          <>
            <ChatThreads
              threads={listed}
              active={marked}
              onPick={pickThread}
              open={sheet}
              onClose={closeThreads}
            />
          </>
        ) : null}
        <NexoChat
          replyVersion={replyVersion}
          historyControl={
            listed?.length ? <ChatThreadsToggle onOpen={() => setSheet(true)} /> : undefined
          }
          general={general}
          chat={chat}
          sending={sending}
          subtitle={subtitle}
          onSend={send}
          searchGames={searchGames}
          onPickGame={chooseGame}
          switching={switching}
          trophy={trophy}
          onClearTrophy={() => setTrophy(null)}
        />
      </div>
    </Page>
  )
}
