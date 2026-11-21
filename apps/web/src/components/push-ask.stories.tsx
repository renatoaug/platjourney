import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { PushAskView } from './push-ask'

const meta: Meta = { title: 'Components/PushAsk', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

// The first time the native app opens on a device, before the system's dialog.
export const Story: Story = {
  render: () => <PushAskView onEnable={() => {}} onLater={() => {}} />,
}

// Waiting for the system's answer after "Turn on notices".
export const Busy: Story = {
  render: () => <PushAskView busy onEnable={() => {}} onLater={() => {}} />,
}

export const English: Story = { ...Story, globals: { locale: Language.En } }
