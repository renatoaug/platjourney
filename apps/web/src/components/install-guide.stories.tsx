import type { Meta, StoryObj } from '@storybook/react-vite'
import { InstallGuide } from './install-guide'

const meta: Meta = { title: 'Components/Install guide', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

/** On an iPhone: Share, then Add to Home Screen. */
export const IPhone: Story = { render: () => <InstallGuide platform="ios" onDone={() => {}} /> }

/** On Android without the browser's own prompt: the menu, then Install app. */
export const Android: Story = {
  render: () => <InstallGuide platform="android" onDone={() => {}} />,
}
