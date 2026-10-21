import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { rankingData } from '../components/game-cards.stories'
import { picksData } from '../components/nexo-pick.stories'
import { recsData } from '../components/recommendations.stories'
import { ReleasesView } from '../components/releases'
import { releasesData } from '../components/releases.stories'
import { serversData } from '../components/servers.stories'
import { similarData } from '../components/similar-picks.stories'
import { Language } from '../i18n/i18n'
import { Discover } from './discover'

// The calendar in a fixed state, so the stories need no network.
const releases = (
  <ReleasesView
    load={{ status: 'ok', releases: releasesData }}
    now={Date.UTC(2026, 9, 13, 15)}
    look="band"
  />
)

const meta: Meta = { title: 'Pages/Discover', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

// The similar games come from the cache and Nexo has no saved batch, so the story makes no request.
export const Loaded: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, ranking: rankingData, servers: serversData },
        cache: { similar: similarData, recsChecked: true, picks: [] },
      }}
    >
      <Discover releases={releases} />
    </MockAppState>
  ),
}

// The player asked Nexo: its picks first, the taste profile and "Gerar de novo".
export const NexoPicks: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, ranking: rankingData, servers: serversData },
        cache: { similar: similarData, recs: recsData, picks: picksData },
      }}
    >
      <Discover releases={releases} />
    </MockAppState>
  ),
}

export const Empty: Story = {
  render: () => (
    <MockAppState
      value={{
        cache: { similar: { items: [], quick: [], series: [] }, recsChecked: true, picks: [] },
      }}
    >
      <Discover releases={releases} />
    </MockAppState>
  ),
}

// Neither the similar games nor the look for a saved batch settles, so both stay loading.
export const Loading: Story = {
  render: () => (
    <MockAppState
      value={{
        data: null,
        cache: {
          similarLoad: new Promise(() => {}),
          storedLoad: new Promise(() => {}),
          picksLoad: new Promise(() => {}),
        },
      }}
    >
      <Discover releases={releases} />
    </MockAppState>
  ),
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
