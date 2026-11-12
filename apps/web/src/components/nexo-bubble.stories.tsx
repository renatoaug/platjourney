import type { Meta, StoryObj } from '@storybook/react-vite'
import { NexoBubble } from './nexo-bubble'

const meta = {
  title: 'Components/NexoBubble',
  component: NexoBubble,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NexoBubble>
export default meta
type Story = StoryObj<typeof meta>

/** Where a first visit puts it: the bottom right corner. */
export const Corner: Story = {}
/** Dropped by the player near the top left. */
export const Moved: Story = { args: { initial: { x: 40, y: 40 } } }
