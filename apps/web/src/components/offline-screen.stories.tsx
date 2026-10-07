import type { Meta, StoryObj } from '@storybook/react-vite'
import { OfflineScreen } from './offline-screen'

const meta: Meta<typeof OfflineScreen> = {
  title: 'App/Offline screen',
  component: OfflineScreen,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof OfflineScreen>

/** The server cannot be reached; "Try again" asks it again. */
export const Default: Story = { args: { onRetry: async () => false } }

/** The server answers on the next try. */
export const BackOnRetry: Story = { args: { onRetry: async () => true } }

/** Trying again takes a while: the button shows it is working. */
export const Trying: Story = { args: { onRetry: () => new Promise<boolean>(() => {}) } }
