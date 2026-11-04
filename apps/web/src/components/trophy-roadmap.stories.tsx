import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_ME } from '../app/app-state'
import { current } from '../fixtures'
import { routeGame } from '../fixtures/route'
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
export const Revealed: Story = {
  ...HiddenAndLong,
  decorators: [
    (Story) => (
      <MockAppState value={{ me: { ...SAMPLE_ME, revealedTrophyGames: [current.game.id] } }}>
        <Story />
      </MockAppState>
    ),
  ],
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

export const GuideRouteStart: Story = { args: { game: routeGame() } }
export const GuideRouteMiddle: Story = {
  args: { game: routeGame(['Primeiro Passo', 'Mira Certeira', 'Segundo Ato']) },
}
export const GuideRouteOutOfOrder: Story = { args: { game: routeGame(['Fim da Jornada']) } }
export const GuideRoutePartialList: Story = {
  args: { game: { ...routeGame(), trophies: routeGame().trophies.slice(0, 4) } },
}

export const ConfirmedChronology: Story = {
  args: {
    game: {
      ...routeGame(['Primeiro Passo', 'Fim da Jornada', 'Mira Certeira']),
      trophies: routeGame(['Primeiro Passo', 'Fim da Jornada', 'Mira Certeira']).trophies.map(
        (t) => ({
          ...t,
          earnedAt:
            t.name === 'Primeiro Passo'
              ? '2024-01-03T12:00:00Z'
              : t.name === 'Fim da Jornada'
                ? '2024-01-02T12:00:00Z'
                : undefined,
        }),
      ),
    },
  },
}
