import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { rankingData } from '../components/game-cards.stories'
import { recsData } from '../components/recommendations.stories'
import { serversData } from '../components/servers.stories'
import { Language } from '../i18n/i18n'
import { Discover } from './discover'

const meta: Meta = { title: 'Pages/Discover', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

// Recommendations come from the cache, as after the first visit, so the story makes no request.
export const Loaded: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, ranking: rankingData, servers: serversData },
        cache: { recs: recsData },
      }}
    >
      <Discover />
    </MockAppState>
  ),
}

export const Empty: Story = {
  render: () => (
    <MockAppState value={{ cache: { recs: { profile: null, items: [] } } }}>
      <Discover />
    </MockAppState>
  ),
}

// The recommendations request never settles, so they stay loading too.
export const Loading: Story = {
  render: () => (
    <MockAppState value={{ data: null, cache: { recsLoad: new Promise(() => {}) } }}>
      <Discover />
    </MockAppState>
  ),
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
