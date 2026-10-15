import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import type { RankingItem } from '../lib/types'
import { EmptyState } from '../ui/states'
import { GameShelf } from './game-band'
import { GameCardsSkeleton, LibraryCard, RadarCard } from './game-cards'

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

export const Library: Story = {
  render: () => (
    <GameShelf
      id="library-title"
      eyebrow="SUA BIBLIOTECA"
      title="Próxima platina"
      cards={rankingData.map((r, i) => <LibraryCard key={r.game} item={r} index={i} />)}
    />
  ),
}

// With the guide's estimate and difficulty, when the server sends them.
export const LibraryWithGuide: Story = {
  render: () => (
    <GameShelf
      id="library-title"
      title="Próxima platina"
      cards={rankingData.map((r, i) => (
        <LibraryCard key={r.game} item={{ ...r, guideHours: 70, difficulty: 3 + i }} index={i} />
      ))}
    />
  ),
}

export const LibraryLoading: Story = {
  render: () => <GameShelf id="library-title" title="Próxima platina" cards={[]} loading />,
}

export const Empty: Story = {
  render: () => (
    <div className="card">
      <EmptyState>nada em andamento</EmptyState>
    </div>
  ),
}
