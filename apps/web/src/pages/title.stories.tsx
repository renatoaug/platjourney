import type { Meta, StoryObj } from '@storybook/react-vite'
import { SimilarGames } from '../components/similar-games'
import { similarGamesData } from '../components/similar-games.stories'
import { current } from '../fixtures'
import { Language } from '../i18n/i18n'
import type { Game, GuideDetail } from '../lib/types'
import { type TitleDetail, TitleScreen } from './title'

const meta: Meta = {
  title: 'Pages/Title',
  parameters: { layout: 'fullscreen' },
  excludeStories: /Data$/,
}
export default meta
type Story = StoryObj

const trophies = current.trophies

export const ownedData: TitleDetail = {
  owned: true,
  np: current.np,
  game: current.game as Game,
  name: current.name,
  platform: current.platform,
  icon: current.icon,
  hoursPlayed: current.hoursPlayed,
  progress: current.progress,
  earned: current.earned,
  total: current.total,
  groups: current.groups,
  trophies,
  guide: current.guide as GuideDetail,
  building: false,
}

// Not owned: catalog trophies, without rarity or progress.
export const recommendedData: TitleDetail = {
  ...ownedData,
  owned: false,
  np: undefined,
  hoursPlayed: null,
  trophies: trophies.map(({ rarity, earnedRate, earnedAt, ...t }) => ({ ...t, earned: false })),
}

export const Owned: Story = {
  render: () => <TitleScreen owned load={{ kind: 'ready', d: ownedData }} />,
}

// "Parecidos com este" under the showcase, the expansion and the series first.
export const WithSimilar: Story = {
  render: () => (
    <TitleScreen
      owned
      load={{ kind: 'ready', d: ownedData }}
      similar={<SimilarGames state={{ status: 'ok', items: similarGamesData }} />}
    />
  ),
}

export const NotOwned: Story = {
  render: () => <TitleScreen owned={false} load={{ kind: 'ready', d: recommendedData }} />,
}

/** Not owned and not in the catalog: the guide takes the width. */
export const NotOwnedWithoutTrophies: Story = {
  render: () => (
    <TitleScreen
      owned={false}
      load={{ kind: 'ready', d: { ...recommendedData, trophies: null } }}
    />
  ),
}

export const GuideBuilding: Story = {
  render: () => (
    <TitleScreen owned load={{ kind: 'ready', d: { ...ownedData, guide: null, building: true } }} />
  ),
}

export const Loading: Story = { render: () => <TitleScreen owned load={{ kind: 'loading' }} /> }

export const LoadingNotOwned: Story = {
  render: () => <TitleScreen owned={false} load={{ kind: 'loading' }} />,
}

export const NotFound: Story = { render: () => <TitleScreen owned load={{ kind: 'error' }} /> }

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Owned, globals: { locale: Language.En } }
