import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShareCollection } from './share-collection'

const meta: Meta = { title: 'Components/ShareCollection' }
export default meta
type Story = StoryObj

/** In a platinum list's heading: the button opens this month, this year or all of them. */
export const Button: Story = {
  render: () => (
    <div
      className="card"
      style={{ maxWidth: 480, display: 'flex', justifyContent: 'space-between' }}
    >
      <span>Platinas de 2026</span>
      <ShareCollection />
    </div>
  ),
}
