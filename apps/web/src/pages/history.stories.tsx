import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { Language } from '../i18n/i18n'
import type { Tip } from '../lib/types'
import { History } from './history'

const meta: Meta<typeof History> = { title: 'Pages/History', component: History }
export default meta
type Story = StoryObj<typeof History>

const game = { id: 'game:19561', name: 'Days Gone' }
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const TIPS: Tip[] = [
  {
    id: 't1',
    kind: 'unlock',
    content:
      'Achados e perdidos (bronze, 40.2% de quem joga). Próximo: **Faça você mesmo no Oregon**.',
    created_at: hoursAgo(1),
    game,
  },
  {
    id: 't2',
    kind: 'chat',
    content: 'Sim: antes de terminar **Sarah está viva**, pegue os colecionáveis de Lost Lake.',
    created_at: hoursAgo(2),
    game,
  },
  {
    id: 't3',
    kind: 'session',
    content: 'Boa sessão: caiu **Faça você mesmo no Oregon** e você tá com 11/46 do jogo base.',
    created_at: hoursAgo(26),
    game,
  },
  {
    id: 't4',
    kind: 'server',
    content: 'Os servidores de *Gran Turismo 7* voltaram.',
    created_at: hoursAgo(80),
    game: null,
  },
  {
    id: 't5',
    kind: 'start',
    content: 'Começou Days Gone. O guia já está pronto: 3/10, ~70h, sem perdíveis.',
    created_at: hoursAgo(200),
    game,
  },
]

export const Loaded: Story = {
  render: () => (
    <MockAppState value={{ data: { ...SAMPLE_DATA, tips: TIPS } }}>
      <History />
    </MockAppState>
  ),
}

export const Empty: Story = {
  render: () => (
    <MockAppState value={{ data: { ...SAMPLE_DATA, tips: [] } }}>
      <History />
    </MockAppState>
  ),
}

// The "chat" filter is on and there is no chat entry: the filter's own empty state.
export const EmptyFilter: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, tips: TIPS.filter((t) => t.kind !== 'chat') },
        cache: { tipKind: 'chat' },
      }}
    >
      <History />
    </MockAppState>
  ),
}

export const Loading: Story = {
  render: () => (
    <MockAppState value={{ data: null }}>
      <History />
    </MockAppState>
  ),
}

export const Failed: Story = {
  render: () => (
    <MockAppState value={{ data: null, sync: 'failed' }}>
      <History />
    </MockAppState>
  ),
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
