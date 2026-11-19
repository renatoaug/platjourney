import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { JoinLink } from './join-link'

/** What a visitor without an account sees in place of saving a game or asking for one. */
const meta: Meta<typeof JoinLink> = { title: 'Components/JoinLink', component: JoinLink }
export default meta
type Story = StoryObj<typeof meta>

export const Save: Story = {}

export const Request: Story = {
  args: { why: 'request', className: 'button ghost sm' },
}

export const English: Story = { globals: { locale: Language.En } }
