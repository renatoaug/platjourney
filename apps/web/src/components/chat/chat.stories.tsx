import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Language } from '../../i18n/i18n'
import { type ChatLoad, type ChatMessage, NexoChat } from './chat'

const meta: Meta<typeof NexoChat> = { title: 'Nexo/Chat', component: NexoChat }
export default meta
type Story = StoryObj<typeof NexoChat>

const game = { id: 'game:19561', name: 'Days Gone' }

const MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: 'Tem algum missable perto de onde estou?',
    created_at: '2026-09-29T21:02:00Z',
    game,
  },
  {
    id: 'm2',
    role: 'assistant',
    content:
      'Sim: antes de terminar **Sarah está viva**, pegue os colecionáveis do acampamento de Lost Lake.\n\n- Placas de informação do NERO\n- Plantas de Sarah\n\nFonte: Trophy Guides e Platinum Forum',
    created_at: '2026-09-29T21:02:20Z',
    game,
  },
  { id: 'm3', role: 'user', content: 'E depois disso?', created_at: '2026-09-29T21:05:00Z', game },
  {
    id: 'm4',
    role: 'assistant',
    content:
      'Depois o mapa fica todo aberto de novo. Siga com as hordas quando tiver o *Hellfire*.',
    created_at: '2026-09-29T21:05:12Z',
    game,
  },
]

const base = { subtitle: 'Falando sobre DAYS GONE (13%).', sending: false, onSend: () => {} }

export const Loaded: Story = { args: { ...base, chat: MESSAGES } }
/** The demo: the chat is closed, with sample exchanges and a call to connect an account. */
export const Demo: Story = { args: { ...base, chat: [], demo: true } }
export const DemoEnglish: Story = { ...Demo, globals: { locale: Language.En } }
export const Empty: Story = { args: { ...base, chat: [] } }
export const Loading: Story = { args: { ...base, chat: 'loading' } }
export const Failed: Story = { args: { ...base, chat: 'error' } }
export const Pending: Story = {
  args: {
    ...base,
    sending: true,
    chat: [...MESSAGES, { role: 'user', content: 'Travei nessa parte.', optimistic: true }],
  },
}

// Sends for real in the story: the answer arrives after a moment.
function Interactive() {
  const [chat, setChat] = useState<ChatLoad>(MESSAGES)
  const [sending, setSending] = useState(false)
  const send = (text: string) => {
    setSending(true)
    setChat((c) => [
      ...(Array.isArray(c) ? c : []),
      { role: 'user', content: text, optimistic: true },
    ])
    setTimeout(() => {
      setChat((c) => [
        ...(Array.isArray(c) ? c : []),
        { role: 'assistant', content: `Anotado: "${text}". Vamos por partes.` },
      ])
      setSending(false)
    }, 1200)
  }
  return <NexoChat chat={chat} sending={sending} subtitle={base.subtitle} onSend={send} />
}

export const Conversation: Story = { render: () => <Interactive /> }
