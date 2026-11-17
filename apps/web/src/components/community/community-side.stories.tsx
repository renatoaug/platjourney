import type { Meta, StoryObj } from '@storybook/react-vite'
import { communityGames, communityRankings } from '../../fixtures'
import { CommunitySideView } from './community-side'

const meta: Meta<typeof CommunitySideView> = {
  title: 'Community/Side',
  component: CommunitySideView,
  args: { onTab: () => {} },
}
export default meta
type Story = StoryObj<typeof CommunitySideView>

export const Filled: Story = {
  args: { state: { status: 'ok', rankings: communityRankings, games: communityGames } },
}
export const Quiet: Story = {
  args: {
    state: {
      status: 'ok',
      rankings: { ...communityRankings, platinums: [] },
      games: { ...communityGames, playing: [] },
    },
  },
}
export const Loading: Story = { args: { state: { status: 'loading' } } }
