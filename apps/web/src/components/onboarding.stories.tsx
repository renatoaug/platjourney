import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA, SAMPLE_ME } from '../app/app-state'
import { current } from '../fixtures'
import { Language } from '../i18n/i18n'
import { rankingData } from './game-cards.stories'
import { Tour, WelcomeDialog } from './onboarding'

const meta: Meta = { title: 'Components/Onboarding', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const player = { ...SAMPLE_ME, onboarded: false }
const demo = { ...player, onlineId: 'PlatJourneyDemo', demo: true }
// A player with a game in progress, so every stop of the tour applies.
const data = { ...SAMPLE_DATA, current, ranking: rankingData }

export const Welcome: Story = {
  render: () => (
    <MockAppState>
      <WelcomeDialog me={player} data={data} onStart={() => {}} onSkip={() => {}} />
    </MockAppState>
  ),
}

// The tour's card on its own; in the app it sits beside the page of its tab.
const stop = (step: number, me = player): Story => ({
  render: () => (
    <MockAppState>
      {/* The card portals to the body; this stands in for the page it sits beside. */}
      <div style={{ minHeight: '100vh' }} />
      <Tour step={step} setStep={() => {}} me={me} data={data} onDone={() => {}} />
    </MockAppState>
  ),
})

export const Overview = stop(1)
// A library with nothing in progress yet: the radar shows sample games and says so.
export const OverviewEmptyLibrary: Story = {
  render: () => (
    <MockAppState>
      <div style={{ minHeight: '100vh' }} />
      <Tour
        step={1}
        setStep={() => {}}
        me={player}
        data={{ ...data, ranking: [] }}
        onDone={() => {}}
      />
    </MockAppState>
  ),
}
export const CurrentGame = stop(2)
export const Notices = stop(3)
export const Trophies = stop(4)
export const SessionRoute = stop(5)
export const Nexo = stop(6)
export const NexoInTheDemo = stop(6, demo)
export const Guides = stop(7)
export const Discover = stop(8)
export const Goals = stop(9)
export const Profile = stop(10)
export const ProfileInTheDemo = stop(10, demo)
export const English: Story = { ...Welcome, globals: { locale: Language.En } }
