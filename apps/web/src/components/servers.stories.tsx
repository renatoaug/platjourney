import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ServerAlert, Servers, ServersSkeleton } from './servers'

export const serversData: ServerAlert[] = [
  {
    id: 'server_status:1',
    game: { id: 'game:1', name: 'Ghost of Tsushima' },
    status: 'active',
    checked_at: '2026-09-29T12:00:00Z',
    note: 'Modo Lendas online funcionando normalmente.',
  },
  {
    id: 'server_status:2',
    game: { id: 'game:3', name: 'Destruction AllStars' },
    status: 'announced',
    date: '31/12/2026',
    checked_at: '2026-09-29T12:00:00Z',
    note: 'Faça os troféus online antes do desligamento.',
  },
  {
    id: 'server_status:3',
    game: { id: 'game:4', name: 'MotorStorm' },
    status: 'closed',
    checked_at: '2026-09-29T12:00:00Z',
    note: 'Troféus online não podem mais ser conquistados.',
  },
]

const meta: Meta = { title: 'Components/Servers', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

export const Loaded: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 480 }}>
      <Servers list={serversData} />
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 480 }}>
      <Servers list={[]} />
    </div>
  ),
}

export const Loading: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 480 }}>
      <ServersSkeleton />
    </div>
  ),
}
