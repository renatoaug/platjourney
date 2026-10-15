import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { type Recommendation, Recommendations, type Recs, type RecsState } from './recommendations'

export const recsData: Recs = {
  profile: {
    summary:
      'Você curte mundos abertos com progressão clara e platinas de dificuldade média, sem grind online.',
    genres: ['Ação', 'Aventura', 'Mundo aberto', 'RPG'],
    traits: ['Exploração', 'Colecionáveis', 'História forte'],
    avoid: ['Troféus online', 'Grind competitivo'],
  },
  items: [
    {
      game: { id: 'game:10', name: 'Horizon Zero Dawn', cover_url: '/logo.svg' },
      platform: 'PS4',
      difficulty: 3,
      hours: 50,
      playthroughs: 1,
      hasDifficultyTrophy: false,
      why: 'Mundo aberto como **Days Gone**, com colecionáveis rastreáveis e nada perdível.',
      hasMissables: false,
      similarTo: ['Days Gone', 'Ghost of Tsushima'],
    },
    {
      game: { id: 'game:11', name: 'Sekiro: Shadows Die Twice' },
      platform: 'PS4',
      difficulty: 7,
      hours: 60,
      playthroughs: 3,
      hasDifficultyTrophy: null,
      why: 'Combate exigente e três finais: um desafio de verdade depois de Tsushima.',
      hasMissables: true,
    },
  ],
}

const meta: Meta = { title: 'Components/Recommendations', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

function Card({ state }: { state: RecsState }) {
  const [current, setCurrent] = useState(state)
  // Dismissing only drops the row here; the real screen asks the server.
  const dismiss = (r: Recommendation) =>
    setCurrent((s) =>
      s.status === 'ok'
        ? { status: 'ok', recs: { ...s.recs, items: s.recs.items.filter((x) => x !== r) } }
        : s,
    )
  return <Recommendations state={current} onDismiss={dismiss} onRefresh={() => {}} />
}

export const Loaded: Story = { render: () => <Card state={{ status: 'ok', recs: recsData }} /> }

export const Empty: Story = {
  render: () => <Card state={{ status: 'ok', recs: { profile: null, items: [] } }} />,
}

export const Loading: Story = { render: () => <Card state={{ status: 'loading' }} /> }

// Before the player asks Nexo: what the picks are and the button.
export const NotAskedYet: Story = { render: () => <Card state={{ status: 'idle' }} /> }

export const NoLibrary: Story = {
  render: () => (
    <Card state={{ status: 'ok', recs: { profile: null, items: [], reason: 'no-library' } }} />
  ),
}

export const LoadError: Story = { render: () => <Card state={{ status: 'error' }} /> }

// The first game already saved in the interests: the bookmark shows filled.
export const Saved: Story = {
  render: () => (
    <MockAppState
      value={{
        data: {
          ...SAMPLE_DATA,
          goals: {
            ...SAMPLE_DATA.goals,
            interests: [
              {
                id: 'interest:1',
                game: recsData.items[0].game,
                position: 1,
                progress: 0,
                done: false,
              },
            ],
          },
        },
      }}
    >
      <Card state={{ status: 'ok', recs: recsData }} />
    </MockAppState>
  ),
}
