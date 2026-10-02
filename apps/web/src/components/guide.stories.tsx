import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import type { GuideDetail } from '../lib/types'
import { Guide, type GuideGame, GuideSkeleton } from './guide'

const meta: Meta = { title: 'Game/Guide' }
export default meta
type Story = StoryObj

const guide = current.guide as GuideDetail
const game: GuideGame = {
  name: current.name,
  guide,
  trophies: current.trophies,
  deepGuide: {
    chunks: 184,
    sources: [
      { source: 'Trophy Guides', url: 'https://guides.example.com' },
      { source: 'Platinum Forum', url: 'https://forum.example.com' },
    ],
    indexing: false,
    indexedAt: '2026-09-20T12:00:00Z',
  },
}

const card = (g: GuideGame | null) => (
  <div className="card" id="guide-card" style={{ maxWidth: 640 }}>
    <Guide key={g?.name} game={g} />
  </div>
)

export const Loaded: Story = { render: () => card(game) }

/** Missables, online trophies and a detailed glossary, to see the tab counts and sidebar. */
export const WithMissablesAndOnline: Story = {
  render: () =>
    card({
      ...game,
      guide: {
        ...guide,
        hasMissables: true,
        hasOnline: true,
        missables: [
          {
            trophy: 'Entrega especial',
            when: 'Capítulo 2',
            how: 'Entregue antes de sair do acampamento.',
          },
        ],
        onlineTrophies: [
          { trophy: 'Juntos', what: 'Complete uma partida cooperativa.', boostable: true },
        ],
        unobtainable: null,
      },
      deepGuide: { chunks: 0, sources: [], indexing: true },
    }),
}

export const Building: Story = { render: () => card({ name: 'Novo jogo', guide: null }) }

export const Queued: Story = {
  render: () => card({ name: 'Novo jogo', guide: null, queued: true }),
}

export const Loading: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 640 }}>
      <GuideSkeleton />
    </div>
  ),
}
