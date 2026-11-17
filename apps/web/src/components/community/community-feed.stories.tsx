import type { Meta, StoryObj } from '@storybook/react-vite'
import { communityEvents, communityPeople } from '../../fixtures'
import { CommunityFeed, type FeedState } from './community-feed'

const meta: Meta<typeof CommunityFeed> = {
  title: 'Community/Feed',
  component: CommunityFeed,
  args: {
    scope: 'all',
    me: 'beto',
    onScope: () => {},
    onReact: () => {},
    onFollow: () => {},
    onMore: () => {},
    onRetry: () => {},
  },
}
export default meta
type Story = StoryObj<typeof CommunityFeed>

const ok = (over: Partial<Extract<FeedState, { status: 'ok' }>> = {}): FeedState => ({
  status: 'ok',
  events: communityEvents,
  people: communityPeople,
  following: ['ana'],
  next: null,
  visible: true,
  ...over,
})

export const Loaded: Story = { args: { state: ok({ next: '2026-11-14T20:00:00Z' }) } }
export const Loading: Story = { args: { state: { status: 'loading' } } }
export const Empty: Story = { args: { state: ok({ events: [] }) } }
export const EmptyFollowing: Story = {
  args: { scope: 'following', state: ok({ events: [], following: [] }) },
}
export const Hidden: Story = { args: { scope: 'me', state: ok({ visible: false }) } }
export const Failed: Story = { args: { state: { status: 'error' } } }
