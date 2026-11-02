import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_DATA } from '../app/app-state'
import { StatTiles, StatTilesSkeleton } from './stat-tiles'

const meta: Meta = { title: 'Components/StatTiles' }
export default meta
type Story = StoryObj

export const Loaded: Story = {
  render: () => (
    <section className="tiles" aria-label="Suas conquistas">
      <StatTiles profile={SAMPLE_DATA.profile} goals={SAMPLE_DATA.goals} />
    </section>
  ),
}

export const NoTarget: Story = {
  render: () => (
    <section className="tiles" aria-label="Suas conquistas">
      <StatTiles profile={SAMPLE_DATA.profile} goals={{ ...SAMPLE_DATA.goals, target: 0 }} />
    </section>
  ),
}

export const NoProfile: Story = {
  render: () => (
    <section className="tiles" aria-label="Suas conquistas">
      <StatTiles profile={null} goals={SAMPLE_DATA.goals} />
    </section>
  ),
}

export const Loading: Story = {
  render: () => (
    <section className="tiles" aria-label="Suas conquistas">
      <StatTilesSkeleton />
    </section>
  ),
}

// Invented totals exercise wrapping and progress bars without using account data.
export const LargeTotals: Story = {
  render: () => (
    <section className="tiles" aria-label="Suas conquistas">
      <StatTiles
        profile={{
          ...SAMPLE_DATA.profile,
          onlineId: 'Player',
          level: 325,
          levelProgress: 42,
          earned: { platinum: 48, gold: 256, silver: 512, bronze: 2048 },
        }}
        goals={{ ...SAMPLE_DATA.goals, done: 12, target: 18 }}
      />
    </section>
  ),
}
