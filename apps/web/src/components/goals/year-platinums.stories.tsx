import type { Meta, StoryObj } from '@storybook/react-vite'
import { emptyGoals, sampleGoals } from './fixtures'
import { YearPlatinums } from './year-platinums'

const meta: Meta = { title: 'Goals/YearPlatinums' }
export default meta
type Story = StoryObj

const wrap = { maxWidth: 520 }

export const Loaded: Story = {
  render: () => (
    <div style={wrap}>
      <YearPlatinums goals={sampleGoals} />
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <div style={wrap}>
      <YearPlatinums goals={emptyGoals} />
    </div>
  ),
}
