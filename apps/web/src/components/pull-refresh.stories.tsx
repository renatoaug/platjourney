import type { Meta, StoryObj } from '@storybook/react-vite'
import { PULL_TRIGGER, PullBadge } from './pull-refresh'

// The badge a finger pulls down at the top of the page, in the installed and the native app.
const meta = {
  title: 'Components/PullRefresh',
  component: PullBadge,
  args: { pull: 40 },
} satisfies Meta<typeof PullBadge>
export default meta
type Story = StoryObj<typeof meta>

export const Pulling: Story = {}
export const Armed: Story = { args: { pull: PULL_TRIGGER + 10 } }
export const Refreshing: Story = { args: { pull: 0, refreshing: true } }
