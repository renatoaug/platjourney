import type { Meta, StoryObj } from '@storybook/react-vite'
import { communityRankings } from '../../fixtures'
import { CommunityRankings } from './community-rankings'

const meta: Meta<typeof CommunityRankings> = {
  title: 'Community/Rankings',
  component: CommunityRankings,
  args: { period: 'month', onPeriod: () => {}, onRetry: () => {} },
}
export default meta
type Story = StoryObj<typeof CommunityRankings>

export const Loaded: Story = { args: { state: { status: 'ok', data: communityRankings } } }
export const Loading: Story = { args: { state: { status: 'loading' } } }
export const Empty: Story = {
  args: {
    state: { status: 'ok', data: { ...communityRankings, platinums: [], rare: [], fastest: [] } },
  },
}
export const Failed: Story = { args: { state: { status: 'error' } } }
