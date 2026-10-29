import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import { GameBackdrop } from './game-backdrop'

const meta: Meta = { title: 'Components/GameBackdrop' }
export default meta
type Story = StoryObj

// It portals into the app frame (#app), so the story gives it one.
export const Art: Story = {
  render: () => (
    <div className="app" id="app" style={{ minHeight: 600, display: 'block' }}>
      <GameBackdrop src={current.icon} tint={current.game.tint} />
    </div>
  ),
}
