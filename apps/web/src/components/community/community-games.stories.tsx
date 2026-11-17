import type { Meta, StoryObj } from '@storybook/react-vite'
import { communityGames } from '../../fixtures'
import { CommunityGames } from './community-games'

const meta: Meta<typeof CommunityGames> = {
  title: 'Community/Games',
  component: CommunityGames,
  args: { onRetry: () => {} },
}
export default meta
type Story = StoryObj<typeof CommunityGames>

export const Loaded: Story = { args: { state: { status: 'ok', data: communityGames } } }
export const Loading: Story = { args: { state: { status: 'loading' } } }
export const Empty: Story = {
  args: { state: { status: 'ok', data: { playing: [], platinumed: [], wanted: [] } } },
}
export const Failed: Story = { args: { state: { status: 'error' } } }
