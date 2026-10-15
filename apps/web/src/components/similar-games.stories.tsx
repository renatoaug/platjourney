import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SimilarGame } from '../lib/types'
import { SimilarGames, type SimilarGamesState } from './similar-games'

export const similarGamesData: SimilarGame[] = [
  {
    game: { id: 'game:40', name: 'Ghost of Tsushima', cover_url: '/logo.svg' },
    difficulty: 4,
    hours: 45,
    relation: 'similar',
  },
  {
    game: { id: 'game:41', name: 'Days Gone: Broken Road' },
    difficulty: 3,
    hours: 8,
    relation: 'expansion',
  },
  {
    game: { id: 'game:42', name: 'The Last of Us Part II', cover_url: '/logo.svg' },
    difficulty: 5,
    hours: 35,
    relation: 'similar',
  },
  {
    game: { id: 'game:43', name: 'Days Gone Remastered', cover_url: '/logo.svg' },
    difficulty: 3,
    hours: 70,
    relation: 'series',
  },
  {
    game: { id: 'game:44', name: 'Horizon Zero Dawn', cover_url: '/logo.svg' },
    difficulty: 3,
    hours: 50,
    relation: 'similar',
  },
]

const meta: Meta = { title: 'Components/SimilarGames', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

// Expansions, the base game and the series come first, with their tag.
export const Loaded: Story = {
  render: () => <SimilarGames state={{ status: 'ok', items: similarGamesData }} />,
}

export const BaseGame: Story = {
  render: () => (
    <SimilarGames
      state={{
        status: 'ok',
        items: [{ ...similarGamesData[3], relation: 'base' }, similarGamesData[0]],
      }}
    />
  ),
}

export const Loading: Story = { render: () => <SimilarGames state={{ status: 'loading' }} /> }

// No similar game, or a failed request: the section is left out, so only the caption shows.
const LeftOut = ({ state }: { state: SimilarGamesState }) => (
  <>
    <p className="muted">The section is left out below this line.</p>
    <SimilarGames state={state} />
  </>
)

export const Empty: Story = { render: () => <LeftOut state={{ status: 'ok', items: [] }} /> }

export const LoadError: Story = { render: () => <LeftOut state={{ status: 'error' }} /> }
