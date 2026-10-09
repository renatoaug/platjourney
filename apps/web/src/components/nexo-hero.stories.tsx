import type { Meta, StoryObj } from '@storybook/react-vite'
import { NexoHero } from './nexo-hero'

const meta = { title: 'Components/NexoHero', component: NexoHero } satisfies Meta<typeof NexoHero>
export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}
export const Working: Story = { args: { working: true } }
