import type { Meta, StoryObj } from '@storybook/react-vite'
import { communityEvents, communityPeople } from '../../fixtures'
import { CommunityHighlightsView } from './community-highlights'

const meta: Meta<typeof CommunityHighlightsView> = {
  title: 'Community/Highlights',
  component: CommunityHighlightsView,
}
export default meta
type Story = StoryObj<typeof CommunityHighlightsView>

export const Loaded: Story = {
  args: { state: { status: 'ok', events: communityEvents.slice(0, 3), people: communityPeople } },
}
export const Loading: Story = { args: { state: { status: 'loading' } } }
export const Empty: Story = { args: { state: { status: 'ok', events: [], people: {} } } }
