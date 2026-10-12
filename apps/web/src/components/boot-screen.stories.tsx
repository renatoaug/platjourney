import type { Meta, StoryObj } from '@storybook/react-vite'
import { BootScreen } from './boot-screen'

const meta = { title: 'Components/BootScreen', component: BootScreen } satisfies Meta<
  typeof BootScreen
>
export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {}
export const Leaving: Story = { args: { leaving: true } }
