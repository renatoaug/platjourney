import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import type { GuideDetail } from '../lib/types'
import { NextTrophy } from './next-trophy'

const meta: Meta = { title: 'Components/NextTrophy' }
export default meta
type Story = StoryObj

// Without a session plan: the first missing trophy of the guide's phase the player is in.
export const FromTheGuide: Story = {
  render: () => (
    <NextTrophy
      trophies={current.trophies}
      guide={current.guide as GuideDetail}
      game={current.game.id}
    />
  ),
}

// No guide yet: the most common trophy still missing.
export const WithoutAGuide: Story = {
  render: () => <NextTrophy trophies={current.trophies} game={current.game.id} />,
}
