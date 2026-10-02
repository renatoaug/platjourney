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
