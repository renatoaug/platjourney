import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthLayout } from './auth-layout'

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
      <h1>Um passo do login</h1>
      <p className="muted">O quadro à esquerda, o passo à direita e a nota de rodapé.</p>
    </AuthLayout>
  ),
}
