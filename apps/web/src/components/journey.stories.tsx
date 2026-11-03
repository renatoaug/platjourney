import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import { Journey, JourneySkeleton } from './journey'

const meta: Meta<typeof Journey> = {
  title: 'Components/Journey',
  component: Journey,
  args: {
    game: {
      ...current,
      focus: {
        phases: [],
        trophy: current.trophies.find((t) => !t.earned && t.type !== 'platinum'),
        phase: 'Fase 1',
        trick: 'Confira **o objetivo** antes de avançar. O texto mantém a formatação do guia.',
        missable: {
          trophy: 'Objetivo de exemplo',
          when: 'Nos **Capítulos 2, 3 e 4**, confira antes de avançar além do capítulo indicado pelo guia.',
        },
      },
    },
    plan: null,
  },
}
export default meta
type Story = StoryObj<typeof meta>
export const Progress: Story = {}
export const NoProgress: Story = {
  args: {
    game: {
      ...current,
      earned: 0,
      progress: 0,
      groups: undefined,
      trophies: current.trophies.map((t) => ({ ...t, earned: false })),
      focus: undefined,
    },
  },
}
export const WithoutGuide: Story = { args: { game: { ...current, guide: null, focus: undefined } } }
export const PlatinumEarned: Story = {
  args: {
    game: {
      ...current,
      trophies: current.trophies.map((t) => ({ ...t, earned: true })),
      groups: undefined,
      earned: current.trophies.length,
      total: current.trophies.length,
      progress: 100,
    },
  },
}

export const LongTitle: Story = {
  args: {
    game: {
      ...current,
      name: 'A Plague Tale: Requiem — Uma longa jornada de conquistas',
      game: { ...current.game, screenshot_ids: ['r5mn9rt7aqvf5nrn8dqq'] },
    },
  },
}

export const Loading: Story = { render: () => <JourneySkeleton /> }
