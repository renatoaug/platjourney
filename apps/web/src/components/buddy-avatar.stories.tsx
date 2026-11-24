import type { Meta, StoryObj } from '@storybook/react-vite'
import { BUDDIES } from '../../../../shared/buddy'
import { BuddyAvatar } from './buddy-avatar'

const meta: Meta<typeof BuddyAvatar> = {
  title: 'Components/BuddyAvatar',
  component: BuddyAvatar,
}
export default meta
type Story = StoryObj<typeof BuddyAvatar>

/** Every buddy alive at once, at the chat's size: each one breathes, blinks and plays its gestures. */
export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {BUDDIES.map((buddy) => (
        <BuddyAvatar key={buddy} buddy={buddy} width={72} height={72} />
      ))}
    </div>
  ),
}

/** Small, as in a message's author line. */
export const Small: Story = { args: { buddy: 'heart', width: 24, height: 24 } }
