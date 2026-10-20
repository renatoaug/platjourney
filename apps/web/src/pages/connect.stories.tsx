import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_ME } from '../app/app-state'
import { Language } from '../i18n/i18n'
import { ConnectView } from './connect'

const meta: Meta = { title: 'Pages/Connect an assistant', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const ready = { kind: 'ready', name: 'Claude', host: 'claude.ai' } as const

/** An assistant asks to read the account: what it reads, and Allow or Cancel. */
export const Asking: Story = {
  render: () => <ConnectView me={SAMPLE_ME} load={ready} onAnswer={() => {}} />,
}
export const AskingEnglish: Story = { ...Asking, globals: { locale: Language.En } }

/** The answer did not go through: the player can try again. */
export const Failed: Story = {
  name: 'Error',
  render: () => <ConnectView me={SAMPLE_ME} load={ready} failed onAnswer={() => {}} />,
}

/** A link the instance does not know, or one already used. */
export const Invalid: Story = {
  render: () => <ConnectView me={SAMPLE_ME} load={{ kind: 'invalid' }} onAnswer={() => {}} />,
}

export const Loading: Story = {
  render: () => <ConnectView me={SAMPLE_ME} load={{ kind: 'loading' }} onAnswer={() => {}} />,
}

/** On a phone the card takes the whole width. */
export const Phone: Story = { ...Asking, globals: { viewport: { value: 'mobile1' } } }
