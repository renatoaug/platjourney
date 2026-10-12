import type { Meta, StoryObj } from '@storybook/react-vite'
import { AccountMenu } from './account-menu'

const meta = {
  title: 'Components/AccountMenu',
  component: AccountMenu,
  args: { onLogout: () => new Promise(() => {}) },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 24, minHeight: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountMenu>
export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}
export const Open: Story = { args: { initiallyOpen: true } }
export const Failed: Story = {
  args: { initiallyOpen: true, onLogout: () => Promise.reject(new Error('offline')) },
}
