import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { SimilarRecs } from '../lib/types'
import type { Recommendation } from './recommendations'
import { SimilarPicks, type SimilarState } from './similar-picks'

export const similarData: SimilarRecs = {
  items: [
    {
      game: { id: 'game:10', name: 'Horizon Zero Dawn', cover_url: '/logo.svg' },
      platform: 'PS4',
      difficulty: 3,
      hours: 50,
      playthroughs: 1,
      hasMissables: false,
      hasDifficultyTrophy: false,
      because: ['Days Gone', 'Ghost of Tsushima'],
      platinumed: ['Days Gone'],
    },
    {
      game: { id: 'game:11', name: 'Sekiro: Shadows Die Twice' },
      platform: 'PS4',
      difficulty: 7,
      hours: 60,
      playthroughs: 3,
      hasMissables: true,
      hasDifficultyTrophy: null,
      because: ['Bloodborne'],
      platinumed: ['Bloodborne'],
    },
    {
      game: { id: 'game:12', name: 'Marvel’s Spider-Man', cover_url: '/logo.svg' },
      platform: 'PS4',
      difficulty: 2,
      hours: 30,
      playthroughs: null,
      hasMissables: false,
      hasDifficultyTrophy: true,
      because: ['Days Gone', 'Ghost of Tsushima', 'inFAMOUS Second Son'],
    },
  ],
  quick: [
    {
      game: { id: 'game:20', name: 'Astro’s Playroom', cover_url: '/logo.svg' },
      platform: 'PS5',
      difficulty: 2,
      hours: 6,
      playthroughs: 1,
      hasMissables: false,
      hasDifficultyTrophy: false,
      because: ['Ratchet & Clank: Em Uma Outra Dimensão'],
    },
    {
      game: { id: 'game:21', name: 'Stray' },
      platform: 'PS5',
      difficulty: 3,
      hours: 8,
      playthroughs: 2,
      hasMissables: true,
      hasDifficultyTrophy: false,
      because: ['Little Nightmares'],
    },
  ],
  series: [
    {
      game: { id: 'game:30', name: 'Horizon Forbidden West', cover_url: '/logo.svg' },
      platform: 'PS5',
      difficulty: 3,
      hours: 60,
      playthroughs: 1,
      hasMissables: false,
      hasDifficultyTrophy: false,
      because: ['Horizon Zero Dawn'],
      platinumed: ['Horizon Zero Dawn'],
    },
  ],
}

const meta: Meta = { title: 'Components/SimilarPicks', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

function Card({ state, filtered }: { state: SimilarState; filtered?: boolean }) {
  const [current, setCurrent] = useState(state)
  // Dismissing only drops the row here; the real screen asks the server.
  const dismiss = (r: Recommendation) =>
    setCurrent((s) =>
      s.status === 'ok'
        ? {
            status: 'ok',
            recs: { ...s.recs, items: s.recs.items.filter((x) => x.game.id !== r.game.id) },
          }
        : s,
    )
  return (
    <SimilarPicks state={current} onDismiss={dismiss} filtered={filtered} onFilters={() => {}} />
  )
}

const none: SimilarRecs = { items: [], quick: [], series: [] }

export const Loaded: Story = { render: () => <Card state={{ status: 'ok', recs: similarData }} /> }

export const Loading: Story = { render: () => <Card state={{ status: 'loading' }} /> }

export const Empty: Story = { render: () => <Card state={{ status: 'ok', recs: none }} /> }

// The player's rules left every similar game out.
export const EmptyByFilters: Story = {
  render: () => <Card state={{ status: 'ok', recs: none }} filtered />,
}

export const NoLibrary: Story = {
  render: () => <Card state={{ status: 'ok', recs: { ...none, reason: 'no-library' } }} />,
}

export const LoadError: Story = { render: () => <Card state={{ status: 'error' }} /> }
