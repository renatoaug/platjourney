import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { rankingData } from '../components/game-cards.stories'
import { recsData } from '../components/recommendations.stories'
import { serversData } from '../components/servers.stories'
import { similarData } from '../components/similar-picks.stories'
import { Language } from '../i18n/i18n'
import { Discover } from './discover'

const meta: Meta = { title: 'Pages/Discover', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

// The similar games come from the cache and Nexo has no saved batch, so the story makes no request.
export const Loaded: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, ranking: rankingData, servers: serversData },
        cache: { similar: similarData, recsChecked: true },
      }}
    >
      <Discover />
    </MockAppState>
  ),
}

// The player asked Nexo: its picks first, the taste profile and "Gerar de novo".
export const NexoPicks: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, ranking: rankingData, servers: serversData },
        cache: { similar: similarData, recs: recsData },
      }}
    >
      <Discover />
    </MockAppState>
  ),
}

export const Empty: Story = {
  render: () => (
    <MockAppState
      value={{ cache: { similar: { items: [], quick: [], series: [] }, recsChecked: true } }}
    >
      <Discover />
    </MockAppState>
  ),
}

// Neither the similar games nor the look for a saved batch settles, so both stay loading.
export const Loading: Story = {
  render: () => (
    <MockAppState
      value={{
        data: null,
        cache: { similarLoad: new Promise(() => {}), storedLoad: new Promise(() => {}) },
      }}
    >
      <Discover />
    </MockAppState>
  ),
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
