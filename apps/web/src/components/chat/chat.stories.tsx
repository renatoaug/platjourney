import type { Meta, StoryObj } from '@storybook/react-vite'
import { type CSSProperties, useState } from 'react'
import { Language } from '../../i18n/i18n'
import { type ChatLoad, type ChatMessage, NexoChat } from './chat'
import { ChatThreadsToggle } from './threads'
import '../../pages/nexo.css'

const meta: Meta<typeof NexoChat> = {
  title: 'Nexo/Chat',
  component: NexoChat,
  // Standalone stories have no shell bottom bar; keep the same viewport calculation as the app.
  decorators: [
    (Story) => (
      <div style={{ '--bottom-bar': '0px' } as CSSProperties}>
        <Story />
      </div>
    ),
  ],
}
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
export const GameCard: Story = {
  args: {
    ...base,
    chat: [
      { role: 'user', content: 'O que platinar agora?' },
      {
        role: 'assistant',
        content:
          'Curto, tranquilo e combina com o que você terminou por último.\n\n**Primeiro passo:** comece pelo capítulo 1.',
        card: {
          kind: 'game',
          game: 'game:110248',
          name: 'Stray',
          difficulty: 2,
          hours: 10,
          progress: 30,
        },
      },
    ],
  },
}
export const GameCardNoGuide: Story = {
  args: {
    ...base,
    chat: [
      { role: 'user', content: 'What should I play now?' },
      {
        role: 'assistant',
        content: 'A game without a guide yet.',
        card: { kind: 'game', game: 'game:1', name: 'Jogo sem guia' },
      },
    ],
  },
}
export const TrophyCard: Story = {
  args: {
    ...base,
    chat: [
      { role: 'user', content: 'Sobre o troféu **Mira Certeira**: como faço?' },
      {
        role: 'assistant',
        content: 'Carregue cada disparo antes de soltar: errar um alvo reinicia o desafio.',
        game: { id: 'game:1', name: 'Caminho de Exemplo' },
        trophy: {
          id: 2,
          name: 'Mira Certeira',
          detail: 'Acerte os cinco alvos do capítulo 2.',
          type: 'bronze',
          earned: false,
          rarity: 12.4,
        },
      },
    ],
  },
}
export const TrophyContext: Story = {
  args: { ...base, chat: [], trophy: 'Laboratório de bolso' },
  render: function Context(args) {
    const [trophy, setTrophy] = useState(args.trophy)
    return <NexoChat {...args} trophy={trophy} onClearTrophy={() => setTrophy(null)} />
  },
}
export const LongTrophyContext: Story = {
  ...TrophyContext,
  args: { ...TrophyContext.args, trophy: 'Uma jornada muito longa até a última conquista' },
}
export const Loading: Story = { args: { ...base, chat: 'loading' } }
export const Failed: Story = { args: { ...base, chat: 'error' } }
export const Pending: Story = {
  args: {
    ...base,
    sending: true,
    chat: [...MESSAGES, { role: 'user', content: 'Travei nessa parte.', optimistic: true }],
  },
}

// Local synthetic exchange only: no API or model is called.
function Interactive() {
  const [chat, setChat] = useState<ChatLoad>(MESSAGES)
  const [sending, setSending] = useState(false)
  const [replyVersion, setReplyVersion] = useState(0)
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
      setReplyVersion((version) => version + 1)
      setSending(false)
    }, 1200)
  }
  return (
    <NexoChat
      chat={chat}
      sending={sending}
      replyVersion={replyVersion}
      subtitle={base.subtitle}
      onSend={send}
    />
  )
}

export const Conversation: Story = { render: () => <Interactive /> }

const library = [
  {
    np: 'NP1',
    name: 'Ghost of Tsushima',
    platform: 'PS5',
    icon: null,
    progress: 64,
    current: false,
  },
  { np: 'NP2', name: 'Ghostrunner II', platform: 'PS5', icon: null, progress: 0, current: false },
  { np: 'NP3', name: 'Days Gone', platform: 'PS4', icon: null, progress: 30, current: true },
]

/** Typing "/game" (or clicking the subtitle) lists the player's games over the message box. */
export const GameSwitch: Story = {
  args: {
    ...base,
    chat: MESSAGES,
    searchGames: async (q: string) =>
      library.filter((g) => g.name.toLowerCase().includes(q.toLowerCase())),
    onPickGame: () => {},
  },
}

/** Long game name plus the real header control footprint at phone widths. */
export const Header: Story = {
  decorators: [
    (Story) => (
      <div className="nexo-layout nexo-conversation">
        <Story />
      </div>
    ),
  ],
  args: {
    ...base,
    subtitle: 'A Plague Tale: Requiem · 42%',
    chat: [],
    historyControl: <ChatThreadsToggle onOpen={() => {}} />,
    searchGames: async () => library,
  },
}

export const LongConversation: Story = {
  args: {
    ...base,
    historyControl: <ChatThreadsToggle onOpen={() => {}} />,
    chat: Array.from({ length: 8 }, (_, i) => ({
      id: `long-${i}`,
      role: i % 2 ? 'assistant' : 'user',
      content:
        i % 2
          ? 'Confira **o objetivo** e siga os passos:\n\n- Leia a descrição.\n- Confira o requisito.\n- Continue sua jornada quando estiver pronto.'
          : 'Pode explicar o próximo passo?',
      game,
    })),
  },
}

/** The general conversation before its first message: the suggestions are about the player. */
export const General: Story = {
  args: { chat: [], general: true, subtitle: 'Suas platinas, metas e próximos jogos.' },
}
