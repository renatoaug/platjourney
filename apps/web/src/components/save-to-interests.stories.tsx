import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { GameCard, GameShelf } from './game-band'
import { SaveToInterests } from './save-to-interests'
import { pickItem } from './similar-picks'
import { similarData } from './similar-picks.stories'

const meta: Meta = { title: 'Components/SaveToInterests' }
export default meta
type Story = StoryObj

const [astro, stray] = similarData.quick

// On cards, as on Discover's bands: it shows on hover (always on touch); a saved game keeps it.
const Cards = () => (
  <GameShelf
    id="save-title"
    title="Platina relâmpago"
    cards={[astro, stray].map((p) => (
      <GameCard
        key={p.game.id}
        item={pickItem(p)}
        actions={<SaveToInterests game={p.game} source="recommendations" />}
      />
    ))}
  />
)

export const OnCards: Story = { render: () => <Cards /> }

// The first game already in the interests: its bookmark is filled and stays in sight.
export const Saved: Story = {
  render: () => (
    <MockAppState
      value={{
        data: {
          ...SAMPLE_DATA,
          goals: {
            ...SAMPLE_DATA.goals,
            interests: [
              { id: 'interest:1', game: astro.game, position: 1, progress: 0, done: false },
            ],
          },
        },
      }}
    >
      <Cards />
    </MockAppState>
  ),
}

export const Alone: Story = {
  render: () => <SaveToInterests game={astro.game} source="recommendations" />,
}
