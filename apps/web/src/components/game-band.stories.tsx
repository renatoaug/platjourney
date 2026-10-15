import type { Meta, StoryObj } from '@storybook/react-vite'
import { EmptyState } from '../ui/states'
import { GameCard, GameShelf } from './game-band'
import { pickItem } from './similar-picks'
import { similarData } from './similar-picks.stories'

const meta: Meta = { title: 'Components/GameShelf' }
export default meta
type Story = StoryObj

const picks = [...similarData.quick, ...similarData.items, ...similarData.series]
// Enough cards for two pages.
const many = [...picks, ...picks].map((p, i) => ({
  ...pickItem(p),
  game: { ...p.game, id: `${p.game.id}-${i}` },
}))

export const Loaded: Story = {
  render: () => (
    <GameShelf
      id="shelf-title"
      eyebrow="ATÉ 10 HORAS"
      title="Platina relâmpago"
      cards={many.map((item) => <GameCard key={item.game.id} item={item} />)}
    />
  ),
}

// Every fact, a tag over the cover and a three-line reason.
export const FullCard: Story = {
  render: () => (
    <GameShelf
      id="shelf-title"
      title="Escolhas do Nexo"
      cards={[
        <GameCard
          key="full"
          item={{
            ...pickItem(similarData.items[1]),
            hasOnline: true,
            hasDifficultyTrophy: true,
            tag: 'Expansão',
            reason:
              'Combate exigente e três finais: um desafio de verdade depois de Tsushima, com chefes que pedem paciência.',
            reasonTitle:
              'Combate exigente e três finais: um desafio de verdade depois de Tsushima, com chefes que pedem paciência.',
            reasonLines: 3,
          }}
        />,
        <GameCard key="plain" item={pickItem(similarData.items[0])} />,
      ]}
    />
  ),
}

// The game page's smaller cards.
export const Compact: Story = {
  render: () => (
    <GameShelf
      id="shelf-title"
      title="Parecidos com este"
      size="compact"
      cards={many.map((item) => <GameCard key={item.game.id} item={item} />)}
    />
  ),
}

export const Loading: Story = {
  render: () => <GameShelf id="shelf-title" title="Platina relâmpago" cards={[]} loading />,
}

// With a fallback, an empty section says so.
export const Empty: Story = {
  render: () => (
    <GameShelf
      id="shelf-title"
      title="Parecidos com seus jogos"
      cards={[]}
      fallback={<EmptyState icon="compass">Nada por aqui ainda.</EmptyState>}
    />
  ),
}

// Without a fallback, an empty section is left out, so only the caption shows.
export const LeftOut: Story = {
  render: () => (
    <>
      <p className="muted">The section is left out below this line.</p>
      <GameShelf id="shelf-title" title="Platina relâmpago" cards={[]} />
    </>
  ),
}
