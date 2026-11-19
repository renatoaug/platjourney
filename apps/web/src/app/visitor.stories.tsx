import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { MockAppState } from './app-state'
import { SignInPrompt, VISITOR, VisitorAccount, VisitorActions } from './visitor'

/** What takes the account's place for someone without one. */
const meta: Meta = {
  title: 'App/Visitor',
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

/** The end of the top bar. A phone keeps only "Sign in". */
export const TopBar: Story = { render: () => <VisitorActions /> }

/** The end of the menu, where the player's card would be. */
export const Sidebar: Story = {
  render: () => (
    <div className="sidebar-account" style={{ maxWidth: 220 }}>
      <VisitorAccount />
    </div>
  ),
}

/** A screen of the account (the journey, settings), opened without one. */
export const AccountScreen: Story = { render: () => <SignInPrompt path="/game" /> }

export const English: Story = { ...AccountScreen, globals: { locale: Language.En } }
