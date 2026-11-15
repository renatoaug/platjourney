import type { Meta, StoryObj } from '@storybook/react-vite'
import { SkinsInviteView } from './skins-invite'

const meta: Meta = { title: 'Components/SkinsInvite' }
export default meta
type Story = StoryObj

// On Home, until the player opens it or dismisses it.
export const Default: Story = {
  render: () => <SkinsInviteView onOpen={() => {}} onDismiss={() => {}} />,
}
