import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { Login } from './login'

const meta: Meta<typeof Login> = {
  title: 'Pages/Login',
  component: Login,
  parameters: { layout: 'fullscreen' },
  args: { onSignedIn: () => {} },
}
export default meta
type Story = StoryObj<typeof Login>

/** First step: the PSN id. The other steps are in Auth/Login steps. */
export const Lookup: Story = {}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Lookup, globals: { locale: Language.En } }
