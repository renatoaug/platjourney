import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommunityVisibilityView } from './community-visibility'

const meta = {
  title: 'Community/Visibility',
  component: CommunityVisibilityView,
  args: { onChange: () => {} },
} satisfies Meta<typeof CommunityVisibilityView>
export default meta

type Story = StoryObj<typeof meta>

export const On: Story = { args: { on: true } }
export const Off: Story = { args: { on: false } }
export const Demo: Story = { args: { on: true, disabled: true } }
