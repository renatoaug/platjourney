import type { Meta, StoryObj } from '@storybook/react-vite'
import { CoverWall } from './cover-wall'

const meta: Meta = { title: 'Auth/CoverWall' }
export default meta
type Story = StoryObj

// Placeholder tiles: stories stay off the network, so the covers are empty images.
const covers = Array.from({ length: 24 }, () => '/logo.svg')

export const Wall: Story = {
  render: () => <CoverWall load={async () => ({ covers, guides: 1130 })} />,
}
