import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import { TrophyRoadmap, TrophyRoadmapSkeleton } from './trophy-roadmap'

const meta: Meta<typeof TrophyRoadmap> = {
  title: 'Components/TrophyRoadmap',
  component: TrophyRoadmap,
  args: { game: current },
}
export default meta
type Story = StoryObj<typeof meta>
export const Progress: Story = {}
export const NewPlayer: Story = {
  args: {
    game: {
      ...current,
      focus: null,
      trophies: current.trophies.map((t) => ({ ...t, earned: false })),
    },
  },
}
export const Completed: Story = {
  args: { game: { ...current, trophies: current.trophies.map((t) => ({ ...t, earned: true })) } },
}
export const WithoutGuide: Story = { args: { game: { ...current, guide: null } } }
export const Empty: Story = { args: { game: { ...current, trophies: [] } } }
export const HiddenAndLong: Story = {
  args: {
    game: {
      ...current,
      trophies: current.trophies.map((t, i) => ({
        ...t,
        hidden: i === 1,
        earned: false,
        name:
          i === 0
            ? 'Um objetivo com um nome muito longo que precisa continuar legível em qualquer tela'
            : t.name,
      })),
    },
  },
}
export const Loading: Story = { render: () => <TrophyRoadmapSkeleton /> }

// Synthetic guide conditions exercise risk signals without attributing them to the fixture game.
export const ChallengeSignals: Story = {
  args: {
    game: {
      ...current,
      name: 'Jogo de demonstração',
      focus: null,
      trophies: current.trophies.map((t, i) => ({
        ...t,
        name: i === 0 ? 'Um encontro que não volta' : i === 1 ? 'O caminho da vitória' : t.name,
        hidden: false,
        earned: false,
      })),
      guide: current.guide
        ? {
            ...current.guide,
            hasMissables: true,
            roadmap: [
              {
                phase: 'Exploração',
                goal: '',
                trophies: ['Um encontro que não volta', 'O caminho da vitória'],
              },
            ],
            missables: [
              {
                trophy: 'Um encontro que não volta',
                when: 'Antes de deixar esta área.',
                how: 'Confira o objetivo antes de seguir. Condição ilustrativa para esta demonstração.',
              },
            ],
            tricks: [],
            buggy: [],
            onlineTrophies: [],
          }
        : null,
    },
  },
}
