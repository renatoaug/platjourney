import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ChatThread, ChatThreads } from './threads'

const thread = (over: Partial<ChatThread>): ChatThread => ({
  game: 'game:1',
  np: 'NPWR00001_00',
  name: 'Jogo Exemplo',
  cover_url: null,
  messages: 12,
  last_at: '2026-01-01T10:00:00Z',
  last_question: 'Onde fica o baú da floresta?',
  ...over,
})

const sample: ChatThread[] = [
  thread({}),
  thread({
    game: 'game:2',
    name: 'Outro Jogo',
    messages: 4,
    last_question: 'Tem troféu perdível?',
  }),
  thread({ game: null, np: null, name: null, messages: 2, last_question: null }),
]

const meta = {
  title: 'Components/ChatThreads',
  component: ChatThreads,
  args: { threads: sample, active: 'game:1', onPick: () => {} },
} satisfies Meta<typeof ChatThreads>
export default meta
type Story = StoryObj<typeof meta>

export const List: Story = {}
export const Loading: Story = { args: { threads: null } }
export const Empty: Story = { args: { threads: [] } }
export const PhoneSheet: Story = { args: { open: true, onClose: () => {} } }
