import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthLayout } from './auth-layout'
import { OfflineStep } from './login-steps'

const meta: Meta<typeof AuthLayout> = {
  title: 'Auth/Layout',
  component: AuthLayout,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof AuthLayout>

export const WithStep: Story = {
  render: () => (
    <AuthLayout>
      <OfflineStep />
    </AuthLayout>
  ),
}
