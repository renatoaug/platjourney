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

/** With trophy kinds in the guide: natural ones step back, hunts and grinds stand out. */
export const WithKinds: Story = {
  args: {
    game: (() => {
      const game = routeGame()
      const kinds = ['natural', 'hunt', 'natural', 'grind'] as const
      return {
        ...game,
        trophies: game.trophies.map((x, i) => (i === 3 ? { ...x, hidden: true } : x)),
        guide: {
          ...game.guide,
          tricks: [
            ...(game.guide?.tricks ?? []),
            {
              trophy: 'Primeiro Passo',
              trick:
                'Logo no começo, siga a estrada até a ponte velha.\nSegure o botão de interação na alavanca até a barra encher.\nO troféu sai assim que a ponte baixar.',
            },
          ],
          trophyKinds: game.trophies
            .filter((x) => x.type !== 'platinum')
            .map((x, i) => ({ trophy: x.name, kind: kinds[i % 4] })),
        },
      } as typeof game
    })(),
  },
}

// The guide places each trophy along the game: the route follows the chapters and the advice says
// when each trophy falls.
const placed = routeGame(['Primeiro Passo', 'Segundo Ato'])
export const PlacedAlongTheGame: Story = {
  args: {
    game: {
      ...placed,
      guide: placed.guide && {
        ...placed.guide,
        storyline: { unit: 'chapter', total: 3 },
        trophyPlaces: [
          { trophy: 'Primeiro Passo', from: 1 },
          { trophy: 'Mira Certeira', from: 1 },
          { trophy: 'Segundo Ato', from: 2 },
          { trophy: 'Piedade', from: 3 },
          { trophy: 'Terceiro Ato', from: 3 },
          { trophy: 'Colecionador', from: 1, to: 3 },
          { trophy: 'Fim da Jornada', from: 3 },
        ],
        trophyKinds: [
          { trophy: 'Terceiro Ato', kind: 'natural' },
          { trophy: 'Fim da Jornada', kind: 'natural' },
          { trophy: 'Colecionador', kind: 'grind' },
        ],
      },
    },
  },
}
