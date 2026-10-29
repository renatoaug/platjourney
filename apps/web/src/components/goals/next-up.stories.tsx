import type { Meta, StoryObj } from '@storybook/react-vite'
import { sampleGoals } from './fixtures'
import { NextUp, nextUp } from './next-up'

const meta: Meta = { title: 'Goals/NextUp' }
export default meta
type Story = StoryObj

const first = nextUp(sampleGoals.interests)

// The first game of the list, with its progress, or "not started" when it was never played.
export const Started: Story = {
  render: () => <>{first && <NextUp interest={{ ...first, progress: 38 }} />}</>,
}

export const NotStarted: Story = {
  render: () => <>{first && <NextUp interest={{ ...first, progress: null }} />}</>,
}
