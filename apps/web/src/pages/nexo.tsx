/** Chat with Nexo. The conversation is fetched once and kept in the app cache, so navigating away and back keeps it (and an answer still in flight). */
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { type ChatLoad, type ChatMessage, NexoChat } from '../components/chat/chat'
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
    subtitleNoGame: 'Pergunta qualquer coisa sobre a platina ou o game.',
    switched: 'Agora falando sobre {name}.',
    switchFailed: 'Não consegui trocar o jogo. Tenta de novo.',
  },
  [Language.En]: {
    sendFailed: 'Could not reach Nexo. Try again.',
    subtitleLoading: 'One step closer to the platinum.',
    subtitleGame: 'Talking about {name} ({progress}%).',
    subtitleNoGame: 'Ask anything about the platinum or the game.',
    switched: 'Now talking about {name}.',
    switchFailed: 'Could not switch the game. Try again.',
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
  const cached = () => (Array.isArray(cache.chat) ? (cache.chat as ChatMessage[]) : null)
  const [chat, setChat] = useState<ChatLoad>(() => cached() ?? 'loading')
  const [sending, setSending] = useState(() => cache.chatSending === true)

  // Writes go to the cache first: a reply that lands after the player left is still there on return.
  const update = useCallback(
    (next: (list: ChatMessage[]) => ChatMessage[]) => {
      const list = next(Array.isArray(cache.chat) ? (cache.chat as ChatMessage[]) : [])
      cache.chat = list
      setChat(list)
    },
    [cache],
  )

  useEffect(() => {
    if (Array.isArray(cache.chat)) return
    api<ChatMessage[]>('/api/chat')
      .then((list) => update(() => list))
      .catch(() => setChat('error'))
  }, [cache, update])

  const send = async (text: string) => {
    if (cache.chatSending === true) return
    cache.chatSending = true
    setSending(true)
    update((list) => [...list, { role: 'user', content: text, optimistic: true }])
    try {
      const r = await api<ChatReply>('/api/chat', { text })
      const messages = r.messages
      if (messages) update(() => messages)
      else update((list) => [...list, { role: 'assistant', content: r.text ?? r.error ?? '' }])
      modelWorkDone()
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
      ? t('subtitleGame', { name: current.name, progress: current.progress })
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
      await api('/api/current', { np: game.np })
      await loadState()
      toast(t('switched', { name: game.name }), 'success')
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('switchFailed'))
    } finally {
      setSwitching(null)
    }
  }

  return (
    <Page path="/nexo">
      <NexoChat
        chat={chat}
        sending={sending}
        subtitle={subtitle}
        onSend={send}
        searchGames={searchGames}
        onPickGame={pickGame}
        switching={switching}
      />
    </Page>
  )
}
