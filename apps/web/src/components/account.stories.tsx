import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_ME } from '../app/app-state'
import { AccountCards, AccountSkeleton } from './account'

const meta: Meta<typeof AccountCards> = {
  title: 'Components/Account',
  component: AccountCards,
  args: { user: SAMPLE_ME, onChanged: () => {} },
  decorators: [
    (Story) => (
      <div className="stack" style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof AccountCards>

export const TelegramOff: Story = {}

export const TelegramLinked: Story = {
  args: {
    user: {
      ...SAMPLE_ME,
      telegramLinked: true,
      includeDlcProgress: true,
      telegramBot: { username: 'platjourney_bot', name: 'Nexo' },
    },
  },
}

export const NoAvatar: Story = { args: { user: { ...SAMPLE_ME, avatarUrl: undefined } } }

export const Loading: Story = { render: () => <AccountSkeleton /> }
