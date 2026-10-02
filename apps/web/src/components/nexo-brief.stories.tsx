import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { current, tips } from '../fixtures'
import type { CurrentGame, Tip } from '../lib/types'
import { NexoBrief, NexoBriefSkeleton } from './nexo-brief'

export const currentData: CurrentGame = current
export const tipsData: Tip[] = tips

const sessionTip: Tip = {
  id: 'tip:next',
  kind: 'session',
  created_at: '2026-09-29T20:00:00Z',
  game: current.game,
  content:
    'Boa sessão.\n\nPróximo alvo: **Faça você mesmo no Oregon**.\n\nComo pegar: construa as melhorias do acampamento de Copeland antes de seguir a história.',
}

const meta: Meta = { title: 'Components/NexoBrief', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

const Card = ({ children }: { children: ReactNode }) => (
  <aside className="card nexo-brief" style={{ maxWidth: 420 }}>
    {children}
  </aside>
)

export const NextStep: Story = {
  render: () => (
    <Card>
      <NexoBrief current={currentData} tips={[sessionTip, ...tipsData]} />
    </Card>
  ),
}

export const LatestTip: Story = {
  render: () => (
    <Card>
      <NexoBrief current={currentData} tips={tipsData} />
    </Card>
  ),
}

export const GuideOnly: Story = {
  render: () => (
    <Card>
      <NexoBrief current={currentData} tips={[]} />
    </Card>
  ),
}

export const NoGame: Story = {
  render: () => (
    <Card>
      <NexoBrief current={null} tips={[]} />
    </Card>
  ),
}

export const Loading: Story = {
  render: () => (
    <Card>
      <NexoBriefSkeleton />
    </Card>
  ),
}
