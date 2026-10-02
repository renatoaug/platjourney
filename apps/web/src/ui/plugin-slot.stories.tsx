import type { Meta, StoryObj } from '@storybook/react-vite'
import { PluginSlot } from './plugin-slot'

const meta: Meta<typeof PluginSlot> = { title: 'UI/PluginSlot', component: PluginSlot }
export default meta
type Story = StoryObj<typeof PluginSlot>

/** With a plugin filling the slot; a plain build renders nothing there. */
export const Filled: Story = {
  args: {
    name: 'top-bar',
    module: { slots: { 'top-bar': () => <span className="pill">plugin</span> } },
  },
}
