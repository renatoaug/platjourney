import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { profileData } from '../pages/profile.stories'
import { TrophyRoom } from './trophy-room'

const meta: Meta = { title: 'Components/TrophyRoom' }
export default meta
type Story = StoryObj

export const Records: Story = { render: () => <TrophyRoom platinums={profileData.platinums} /> }

// With few platinums some records come from the same game.
export const FewPlatinums: Story = {
  render: () => <TrophyRoom platinums={profileData.platinums.slice(0, 3)} />,
}

export const English: Story = { ...Records, globals: { locale: Language.En } }
