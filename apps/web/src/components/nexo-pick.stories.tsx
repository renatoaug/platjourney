import type { Meta, StoryObj } from '@storybook/react-vite'
import { type NexoPick, NexoPickPanel } from './nexo-pick'

export const picksData: NexoPick[] = [
  {
    id: 'recommendation:3',
    game: { id: 'game:2', name: 'Inside', cover_url: '/logo.svg' },
    why: 'Umas 5 horas, dificuldade 2 e nada online: dá para fechar em duas noites depois do trabalho.',
    firstStep:
      'Jogue a história com o guia de colecionáveis aberto: os orbes são o único perdível.',
    mood: 'Algo curto',
    scope: 'interests',
    ownedOnly: false,
    fits: true,
    at: '2026-10-18T21:10:00Z',
  },
  {
    id: 'recommendation:2',
    game: { id: 'game:7', name: 'Journey', cover_url: '/logo.svg' },
    why: 'Parecido com Abzu, que você platinou: curto, calmo e lindo.',
    firstStep: 'Comece pelo capítulo 1 e pegue os símbolos brilhantes no caminho.',
    mood: 'Pra relaxar',
    scope: 'any',
    ownedOnly: true,
    fits: true,
    at: '2026-10-15T20:00:00Z',
  },
  {
    id: 'recommendation:1',
    game: { id: 'game:1', name: 'Days Gone', cover_url: '/logo.svg' },
    why: 'Você já está em 40% e falta pouco da história.',
    firstStep: 'Termine as missões de Iron Mike antes de ir para o sul.',
    mood: null,
    scope: 'interests',
    ownedOnly: false,
    fits: true,
    at: '2026-10-10T19:00:00Z',
  },
]

/** The latest pick made by Claude in its chat, with no first step. */
export const assistantPicksData: NexoPick[] = [
  {
    id: 'recommendation:4',
    game: { id: 'game:9', name: 'Far Cry 5', cover_url: '/logo.svg' },
    why: 'Faltam só 6 troféus, dificuldade baixa e sem perdíveis.',
    firstStep: null,
    mood: null,
    scope: null,
    ownedOnly: false,
    fits: true,
    recommender: 'claude',
    at: '2026-10-20T14:37:00Z',
  },
  ...picksData,
]

// The sample picks are shared with the tests, not a story.
const meta: Meta = {
  title: 'Discover/NexoPick',
  excludeStories: ['picksData', 'assistantPicksData'],
}
export default meta
type Story = StoryObj

const ask = () => {}

export const FirstTime: Story = { render: () => <NexoPickPanel picks={[]} onAsk={ask} /> }
export const Loading: Story = { render: () => <NexoPickPanel picks={null} onAsk={ask} /> }
export const Thinking: Story = {
  render: () => <NexoPickPanel picks={picksData} asking onAsk={ask} />,
}
export const PickedByAssistant: Story = {
  render: () => <NexoPickPanel picks={assistantPicksData} onAsk={ask} />,
}
export const Picked: Story = { render: () => <NexoPickPanel picks={picksData} onAsk={ask} /> }
// Nothing on the list matched the mood: Nexo says so and offers to look beyond it.
export const NoFit: Story = {
  render: () => (
    <NexoPickPanel
      picks={[
        {
          ...picksData[0],
          mood: 'Um desafio',
          fits: false,
          why: 'Nada difícil na lista; Inside é o que mais se aproxima.',
        },
      ]}
      onAsk={ask}
    />
  ),
}
export const NothingToPick: Story = {
  render: () => <NexoPickPanel picks={[]} none initialScope="interests" onAsk={ask} />,
}
export const Failed: Story = {
  render: () => <NexoPickPanel picks={picksData} failed onAsk={ask} />,
}
export const Demo: Story = { render: () => <NexoPickPanel picks={[]} disabled onAsk={ask} /> }
