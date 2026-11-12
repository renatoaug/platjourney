import type { Meta, StoryObj } from '@storybook/react-vite'
import { TrophyMedal } from './trophy-medal'

const meta = {
  title: 'UI/TrophyMedal',
  component: TrophyMedal,
  args: { type: 'platinum' },
} satisfies Meta<typeof TrophyMedal>
export default meta
type Story = StoryObj<typeof meta>

/** The four tiers side by side, at the icon size. */
export const AllTiers: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {(['platinum', 'gold', 'silver', 'bronze'] as const).map((type) => (
        <TrophyMedal key={type} type={type} />
      ))}
    </div>
  ),
}
export const Platinum: Story = {}
export const Gold: Story = { args: { type: 'gold' } }
