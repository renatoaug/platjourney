import type { Meta, StoryObj } from '@storybook/react-vite'
import { NotificationSettingsView } from './notification-settings'

const meta: Meta<typeof NotificationSettingsView> = {
  title: 'Components/Notification settings',
  component: NotificationSettingsView,
  args: {
    push: 'off',
    pushAvailable: true,
    telegramLinked: true,
    notifyTelegram: true,
    busy: false,
    onPush: () => {},
    onTest: () => {},
    onTelegram: () => {},
  },
}
export default meta
type Story = StoryObj<typeof NotificationSettingsView>

/** Push off on this device, Telegram linked and on. */
export const Off: Story = {}

/** Push on: the test button shows. */
export const On: Story = { args: { push: 'on' } }

/** Reading the device's state. */
export const Loading: Story = { args: { push: 'loading' } }

/** An iPhone browser tab: push needs the home screen first. */
export const NeedsInstall: Story = { args: { push: 'install' } }

/** The player blocked notifications for the site. */
export const Denied: Story = { args: { push: 'denied' } }

/** The native app, which has no push yet. */
export const NativeApp: Story = { args: { push: 'native' } }

/** No Telegram linked: its switch waits for the link. */
export const NoTelegram: Story = { args: { telegramLinked: false } }

/** The instance has push off: only Telegram is left. */
export const PushOff: Story = { args: { pushAvailable: false } }

/** The shared demo: nothing changes. */
export const Demo: Story = { args: { demo: true } }
