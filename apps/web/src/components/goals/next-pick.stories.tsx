import type { Meta, StoryObj } from '@storybook/react-vite'
import { type NextPick, NextPickCard } from './next-pick'

const pick: NextPick = {
  game: { id: 'game:2', name: 'Inside', cover_url: '/logo.svg' },
  why: 'Depois de duas platinas longas, uma de umas 5 horas e sem dificuldade fecha o mês com folga.',
  firstStep: 'Jogue a história com o guia de colecionáveis aberto: os orbes são o único perdível.',
}

const meta: Meta = { title: 'Goals/NextPick' }
export default meta
type Story = StoryObj

const box = (node: React.ReactNode) => (
  <div className="card" style={{ maxWidth: 560 }}>
    {node}
  </div>
)

export const Ask: Story = {
  render: () => box(<NextPickCard state={{ status: 'idle' }} onAsk={() => {}} />),
}
export const Thinking: Story = {
  render: () => box(<NextPickCard state={{ status: 'loading' }} onAsk={() => {}} />),
}
export const Picked: Story = {
  render: () => box(<NextPickCard state={{ status: 'ok', pick }} onAsk={() => {}} />),
}
export const Failed: Story = {
  render: () => box(<NextPickCard state={{ status: 'error' }} onAsk={() => {}} />),
}
