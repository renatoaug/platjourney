import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState } from '../app/app-state'
import { VISITOR } from '../app/visitor'
import { CommunityHighlightsView } from '../components/community/community-highlights'
import { GuideSpotlight, GuideSpotlightSkeleton } from '../components/guide-spotlight'
import { ReleasesView } from '../components/releases'
import { releasesData } from '../components/releases.stories'
import { communityEvents, communityPeople } from '../fixtures'
import { Language } from '../i18n/i18n'
import { PublicHome, VisitorGames } from './public-home'

/** The app without an account: its home and its games screen, read from what is public. */
const meta: Meta = {
  title: 'Pages/PublicHome',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MockAppState value={{ me: VISITOR, data: null }}>
        <Story />
      </MockAppState>
    ),
  ],
}
export default meta
type Story = StoryObj

const spotlight = {
  id: 'game:19560',
  name: 'God of War',
  cover_url: null,
  platforms: ['PS4', 'PS5'],
  release_year: 2018,
  shot: 'sc5tqf',
  guide: { difficulty: 4, hours: 40, hasMissables: false },
}

const releases = (
  <ReleasesView load={{ status: 'ok', releases: releasesData }} now={Date.UTC(2026, 9, 13, 15)} />
)

const community = (
  <CommunityHighlightsView
    state={{ status: 'ok', events: communityEvents.slice(0, 3), people: communityPeople }}
  />
)

export const Home: Story = {
  render: () => (
    <PublicHome
      spotlight={<GuideSpotlight game={spotlight} />}
      releases={releases}
      community={community}
    />
  ),
}

export const Loading: Story = {
  render: () => (
    <PublicHome
      spotlight={<GuideSpotlightSkeleton />}
      releases={<ReleasesView load={{ status: 'loading' }} />}
      community={<CommunityHighlightsView state={{ status: 'loading' }} />}
    />
  ),
}

export const Games: Story = {
  render: () => <VisitorGames releases={releases} community={community} />,
}

export const English: Story = { ...Home, globals: { locale: Language.En } }
