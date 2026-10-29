import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageTop } from './page-top'

const meta: Meta = { title: 'Layout/PageTop' }
export default meta
type Story = StoryObj

// Without a picture the top is just as tall as its text; the backdrop needs the app frame (#app).
export const TextOnly: Story = {
  render: () => (
    <PageTop
      eyebrow="Sua próxima platina"
      title="Descobrir"
      lead="O que platinar a seguir: da sua biblioteca e fora dela."
    />
  ),
}

export const WithCard: Story = {
  render: () => (
    <PageTop
      eyebrow="Sua lista de platinas"
      title="Interesses"
      lead="Os jogos que você quer platinar, na sua ordem, e a meta do ano."
      aside={<div className="card">Próxima platina</div>}
    />
  ),
}
