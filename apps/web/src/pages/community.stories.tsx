import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommunityFeed } from '../components/community/community-feed'
import { CommunityRankings } from '../components/community/community-rankings'
import { communityEvents, communityPeople, communityRankings } from '../fixtures'
import { CommunityView } from './community'

const meta: Meta = { title: 'Pages/Community', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const noop = () => {}

export const Feed: Story = {
  render: () => (
    <CommunityView tab="feed" onTab={noop}>
      <CommunityFeed
        state={{
          status: 'ok',
          events: communityEvents,
          people: communityPeople,
          following: [],
          next: null,
          visible: true,
        }}
        scope="all"
        onScope={noop}
        onReact={noop}
        onFollow={noop}
        onMore={noop}
        onRetry={noop}
        me="beto"
      />
    </CommunityView>
  ),
}

export const Rankings: Story = {
  render: () => (
    <CommunityView tab="rankings" onTab={noop}>
      <CommunityRankings
        state={{ status: 'ok', data: communityRankings }}
        period="month"
        onPeriod={noop}
        onRetry={noop}
      />
    </CommunityView>
  ),
}
