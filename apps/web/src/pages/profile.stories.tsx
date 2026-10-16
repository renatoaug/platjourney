import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { SAMPLE_ME } from '../app/app-state'
import { Page } from '../app/page'
import { Language } from '../i18n/i18n'
import type { Game } from '../lib/types'
import { ErrorState } from '../ui/states'
import {
  type Platinum,
  type ProfileData,
  ProfilePrivate,
  ProfileSkeleton,
  ProfileView,
} from './profile'

const meta: Meta = { title: 'Pages/Profile', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

const NAMES = [
  'Days Gone',
  'God of War',
  'Ghost of Tsushima',
  'Horizon Zero Dawn',
  'Spider-Man',
  'Bloodborne',
  'Returnal',
  'Astro Bot',
  'Uncharted 4',
  'The Last of Us',
]

const game = (name: string, i: number): Game => ({
  id: `game:${i}`,
  name,
  cover_url: i % 3 ? '/logo.svg' : undefined,
})

const platinums: Platinum[] = NAMES.map((name, i) => ({
  game: game(name, i),
  platform: i % 2 ? 'PS5' : 'PS4',
  earnedAt: new Date(2026, 8 - i, 10).toISOString(),
  rarity: 2.4 + i * 3.1,
  hours: i % 4 ? 20 + i * 7 : null,
}))

export const profileData: ProfileData = {
  summary: {
    onlineId: 'jogador',
    avatarUrl: '/nexo-avatar.svg',
    level: 312,
    levelProgress: 40,
    earned: { bronze: 2140, silver: 610, gold: 180, platinum: 42 },
  },
  platinums,
  pendingPlatinums: 0,
  byYear: [
    { year: 2022, count: 6 },
    { year: 2023, count: 11 },
    { year: 2024, count: 9 },
    { year: 2025, count: 9 },
    { year: 2026, count: 7 },
  ],
  byPlatform: [
    { platform: 'PS5', count: 24 },
    { platform: 'PS4', count: 18 },
  ],
  rarest: platinums[0],
  fastestStreak: { from: '2025-03-01T00:00:00Z', to: '2025-03-29T00:00:00Z', count: 4 },
  totalHours: 2140,
  mostPlayed: [{ game: platinums[1].game, hours: 212 }],
  user: SAMPLE_ME,
}

const inPage = (children: ReactNode) => (
  <Page path="/profile">
    <div id="profile-page">{children}</div>
  </Page>
)

export const Loaded: Story = {
  render: () => inPage(<ProfileView data={profileData} />),
}

export const SyncingPlatinums: Story = {
  render: () =>
    inPage(
      <ProfileView
        data={{ ...profileData, platinums: platinums.slice(0, 2), pendingPlatinums: 40 }}
      />,
    ),
}

export const Empty: Story = {
  render: () =>
    inPage(
      <ProfileView
        data={{
          ...profileData,
          platinums: [],
          byYear: [],
          byPlatform: [],
          rarest: null,
          fastestStreak: null,
          mostPlayed: [],
        }}
      />,
    ),
}

export const Loading: Story = { render: () => inPage(<ProfileSkeleton />) }

export const Failed: Story = {
  name: 'Error',
  render: () => inPage(<ErrorState>Não conseguimos carregar o perfil.</ErrorState>),
}

/** Trophies hidden: no profile, and a way to the settings, where the account is. */
export const TrophiesPrivate: Story = { render: () => inPage(<ProfilePrivate />) }

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
