import type { Meta, StoryObj } from '@storybook/react-vite'
import { SharePlatinum } from './share-platinum'

const meta: Meta = { title: 'Components/SharePlatinum' }
export default meta
type Story = StoryObj

/** Beside a platinum in the year's list; a tap draws the card and opens the share sheet. */
export const Button: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: 1 }}>A Plague Tale: Requiem</span>
      <SharePlatinum gameId="game:152242" name="A Plague Tale: Requiem" />
    </div>
  ),
}
