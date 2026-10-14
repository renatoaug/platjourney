import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageHero } from './page-hero'

const meta: Meta = { title: 'Layout/PageHero' }
export default meta
type Story = StoryObj

const covers = ['/logo.svg', '/logo.svg', '/logo.svg', '/logo.svg', '/logo.svg', '/logo.svg']

export const Covers: Story = {
  render: () => (
    <PageHero
      eyebrow="GUIAS DE PLATINA"
      title="Guias"
      lead="Todos os jogos com guia."
      images={covers}
      look="covers"
    />
  ),
}

export const Shelf: Story = {
  render: () => (
    <PageHero
      eyebrow="SUA LISTA DE PLATINAS"
      title="Interesses"
      lead="Os jogos que você quer platinar."
      images={covers}
      look="shelf"
    />
  ),
}

export const Art: Story = {
  render: () => (
    <PageHero
      eyebrow="SUA PRÓXIMA PLATINA"
      title="Descobrir"
      lead="O que platinar a seguir."
      images={covers}
      look="art"
    />
  ),
}

export const NoArt: Story = {
  render: () => (
    <PageHero title="Interesses" lead="Ainda sem jogos salvos." images={[]} look="shelf" />
  ),
}
