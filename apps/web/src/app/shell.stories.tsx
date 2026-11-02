import type { Meta, StoryObj } from '@storybook/react-vite'
import { Nav } from './shell'

const meta: Meta<typeof Nav> = {
  title: 'App/Navigation',
  component: Nav,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <aside className="sidebar">
      <Nav />
    </aside>
  ),
}
export default meta
type Story = StoryObj<typeof meta>
export const Primary: Story = {}
