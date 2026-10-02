import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import type { RankingItem } from '../lib/types'
import { EmptyState } from '../ui/states'
import { GameCardsSkeleton, RadarCard, RankingRow, RankingRowsSkeleton } from './game-cards'

export const rankingData: RankingItem[] = [
  {
    game: current.game.id,
    name: current.name,
    platform: current.platform,
    icon: current.icon,
    progress: 26,
    remaining: 33,
    hours: 18,
    total: 46,
    earned: 12,
    dlc: { earned: 0, total: 15 },
  },
  {
    game: 'game:1',
    name: 'Ghost of Tsushima',
    platform: 'PS5',
    icon: '/logo.svg',
    progress: 81,
    remaining: 9,
    hours: 64.5,
    total: 52,
    earned: 42,
    dlc: null,
  },
  {
    game: 'game:2',
    name: 'Astro Bot',
    platform: 'PS5',
    icon: '/logo.svg',
    progress: 55,
    remaining: 20,
    total: 45,
    earned: 25,
    dlc: null,
  },
]

const meta: Meta = { title: 'Components/GameCards', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

export const Radar: Story = {
  render: () => (
    <div className="game-grid">
      {rankingData.map((r, i) => (
        <RadarCard key={r.game} item={r} index={i} />
      ))}
    </div>
  ),
}

export const RadarLoading: Story = {
  render: () => (
    <div className="game-grid">
      <GameCardsSkeleton />
    </div>
  ),
}

export const Ranking: Story = {
  render: () => (
    <div className="card">
      <h2>Próxima platina · sua biblioteca</h2>
      {rankingData.map((r, i) => (
        <RankingRow key={r.game} item={r} index={i} />
      ))}
    </div>
  ),
}

export const RankingLoading: Story = {
  render: () => (
    <div className="card">
      <h2>Próxima platina · sua biblioteca</h2>
      <RankingRowsSkeleton n={6} />
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <div className="card">
      <EmptyState>nada em andamento</EmptyState>
    </div>
  ),
}
