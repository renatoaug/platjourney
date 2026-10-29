import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA, SAMPLE_ME } from '../app/app-state'
import { current } from '../fixtures'
import { Language } from '../i18n/i18n'
import { profileData } from '../pages/profile.stories'
import { rankingData } from './game-cards.stories'
import { Stories } from './onboarding'

const meta: Meta = { title: 'Components/Onboarding', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const player = { ...SAMPLE_ME, onboarded: false }
// A player with a game in progress and a profile, so every slide has something to say.
const data = { ...SAMPLE_DATA, current, ranking: rankingData }

export const Story: Story = {
  render: () => (
    <MockAppState>
      <Stories me={player} data={data} profile={profileData} onDone={() => {}} />
    </MockAppState>
  ),
}

// The first PSN sync still running: the first slide waits with the sync line.
export const Syncing: Story = {
  render: () => (
    <MockAppState>
      <Stories me={player} data={null} profile={null} onDone={() => {}} />
    </MockAppState>
  ),
}

export const English: Story = { ...Story, globals: { locale: Language.En } }
