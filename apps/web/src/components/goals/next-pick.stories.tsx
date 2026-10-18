import type { Meta, StoryObj } from '@storybook/react-vite'
import { NextPickLink } from './next-pick'

const meta: Meta = { title: 'Goals/NextPick' }
export default meta
type Story = StoryObj

export const Link: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 560 }}>
      <NextPickLink />
    </div>
  ),
}
