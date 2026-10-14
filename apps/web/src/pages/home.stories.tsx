import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { rankingData } from '../components/game-cards.stories'
import { currentData, tipsData } from '../components/nexo-brief.stories'
import { ReleasesView } from '../components/releases'
import { releasesData } from '../components/releases.stories'
import { Language } from '../i18n/i18n'
import { Home } from './home'

const meta: Meta = { title: 'Pages/Home', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

export const Loaded: Story = {
  render: () => (
    <MockAppState
      value={{
        data: { ...SAMPLE_DATA, current: currentData, tips: tipsData, ranking: rankingData },
      }}
    >
      <Home
        releases={
          <ReleasesView
            load={{ status: 'ok', releases: releasesData }}
            now={Date.UTC(2026, 9, 13, 15)}
          />
        }
      />
    </MockAppState>
  ),
}

// A new player: nothing being played, no activity yet, PSN profile still on its way.
export const Empty: Story = {
  render: () => (
    <MockAppState value={{ data: { ...SAMPLE_DATA, profile: null } }}>
      <Home
        releases={
          <ReleasesView
            load={{ status: 'ok', releases: releasesData }}
            now={Date.UTC(2026, 9, 13, 15)}
          />
        }
      />
    </MockAppState>
  ),
}

export const Loading: Story = {
  render: () => (
    <MockAppState value={{ data: null }}>
      <Home
        releases={
          <ReleasesView
            load={{ status: 'ok', releases: releasesData }}
            now={Date.UTC(2026, 9, 13, 15)}
          />
        }
      />
    </MockAppState>
  ),
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
