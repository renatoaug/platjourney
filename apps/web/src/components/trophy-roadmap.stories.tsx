import type { Meta, StoryObj } from '@storybook/react-vite'
import { current } from '../fixtures'
import { requiemGame } from '../fixtures/requiem'
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

export const EarnedDetails: Story = {
  args: {
    game: {
      ...current,
      trophies: current.trophies.map((t, i) => ({
        ...t,
        earned: true,
        name: i === 0 ? 'Uma conquista com nome longo que continua legível no histórico' : t.name,
        detail:
          i === 0
            ? 'Descrição ilustrativa completa para conferir a leitura e a quebra natural em telas pequenas, sem esconder o objetivo conquistado.'
            : t.detail,
        iconUrl: i === 1 ? undefined : t.iconUrl,
      })),
    },
  },
}

export const OngoingObjectives: Story = {
  args: {
    game: {
      ...current,
      name: 'Demonstração de objetivos contínuos',
      focus: null,
      trophies: current.trophies.map((t, i) => ({
        ...t,
        earned: false,
        hidden: false,
        progressTarget: i === 1 ? 10 : undefined,
        progressValue: i === 1 ? 0 : undefined,
      })),
      guide: current.guide
        ? {
            ...current.guide,
            missables: [
              {
                trophy: current.trophies[0].name,
                when: 'Durante a campanha.',
                how: 'Orientação ilustrativa para validar a apresentação; não é uma dica deste jogo.',
              },
            ],
          }
        : null,
    },
  },
}

export const StartComparison: Story = {
  ...OngoingObjectives,
  args: { ...OngoingObjectives.args, preview: true },
}

export const ReviewedRequiemStart: Story = { args: { game: requiemGame() } }
export const ReviewedRequiemMiddle: Story = {
  args: { game: requiemGame(['chapter-1', 'chapter-2', 'chapter-3']) },
}
export const ReviewedRequiemOutOfOrder: Story = { args: { game: requiemGame(['chapter-8']) } }
export const ReviewedRequiemPartialList: Story = {
  args: { game: { ...requiemGame(), trophies: requiemGame().trophies.slice(0, 8) } },
}
