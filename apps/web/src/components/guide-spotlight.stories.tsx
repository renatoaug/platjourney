import type { Meta, StoryObj } from '@storybook/react-vite'
import { GuideSpotlight } from './guide-spotlight'

const meta: Meta = { title: 'Components/GuideSpotlight' }
export default meta
type Story = StoryObj

const game = {
  id: 'game:19560',
  name: 'God of War',
  cover_url: null,
  platforms: ['PS4', 'PS5'],
  release_year: 2018,
  shot: 'sc5tqf',
  guide: { difficulty: 4, hours: 40, hasMissables: false },
}

export const GuideOfTheDay: Story = { render: () => <GuideSpotlight game={game} /> }

// A long name wraps; missables show as a warning.
export const LongNameWithMissables: Story = {
  render: () => (
    <GuideSpotlight
      game={{
        ...game,
        name: 'Death Stranding 2: On the Beach',
        guide: { difficulty: 7, hours: 100, hasMissables: true },
      }}
    />
  ),
}
