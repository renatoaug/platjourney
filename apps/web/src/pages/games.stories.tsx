import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { current } from '../fixtures'
import type { OwnedLibrary } from '../lib/types'
import { GamesView } from './games'

export const sampleLibrary: OwnedLibrary = {
  total: 4,
  page: 1,
  size: 12,
  items: [
    {
      np: current.np,
      name: current.name,
      platform: 'PS4',
      icon: current.icon ?? null,
      cover: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co94bn.jpg',
      art: 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/r5mn9rt7aqvf5nrn8dqq.jpg',
      progress: 38,
      earned: 23,
      total: 61,
      platinum: false,
      current: true,
      owned: true,
    },
    {
      np: 'fixture-ghost',
      name: 'Ghost of Tsushima',
      cover: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2crj.jpg',
      platform: 'PS5',
      icon: null,
      progress: 64,
      earned: 40,
      total: 77,
      platinum: false,
      current: false,
      owned: true,
    },
    {
      np: 'fixture-astro',
      name: 'ASTRO BOT',
      platform: 'PS5',
      icon: null,
      progress: 100,
      earned: 44,
      total: 44,
      platinum: true,
      current: false,
      owned: true,
    },
    {
      np: 'fixture-horizon',
      name: 'Horizon Forbidden West — Complete Edition',
      platform: 'PS5',
      icon: null,
      progress: 0,
      earned: 0,
      total: 80,
      platinum: false,
      current: false,
      owned: true,
    },
  ],
}
const meta = {
  excludeStories: ['sampleLibrary'],
  title: 'Pages/Games',
  component: GamesView,
  parameters: { layout: 'fullscreen' },
  args: {
    library: sampleLibrary,
    onSide: () => {},
    onQuery: () => {},
    onPage: () => {},
    onRetry: () => {},
  },
} satisfies Meta<typeof GamesView>
export default meta
type Story = StoryObj<typeof meta>
export const Loaded: Story = {}
export const MissingArt: Story = {
  args: {
    library: {
      ...sampleLibrary,
      items: sampleLibrary.items.map((g) => ({ ...g, icon: null, art: null, cover: null })),
    },
  },
}
export const BrokenArt: Story = {
  args: {
    library: {
      ...sampleLibrary,
      items: [{ ...sampleLibrary.items[0], art: '/missing-game-art.jpg' }],
    },
  },
}
export const Empty: Story = { args: { library: { ...sampleLibrary, total: 0, items: [] } } }
export const NoMatches: Story = {
  args: { library: { ...sampleLibrary, total: 0, items: [] }, query: 'unknown' },
}
export const Loading: Story = { args: { library: null } }
export const Failed: Story = { args: { library: null, failed: true } }
export const Interests: Story = {
  args: {
    side: 'interests',
    interests: [
      {
        id: 'interest:fixture',
        game: { id: 'game:fixture', name: 'Clair Obscur: Expedition 33' },
        position: 0,
        progress: null,
        done: false,
      },
    ],
  },
}
export const EmptyInterests: Story = { args: { side: 'interests', interests: [] } }
export const Search: Story = {
  render: (args) => {
    const [query, setQuery] = useState('')
    const items = sampleLibrary.items.filter((g) =>
      g.name.toLowerCase().includes(query.toLowerCase()),
    )
    return (
      <GamesView
        {...args}
        query={query}
        onQuery={setQuery}
        library={{ ...sampleLibrary, items, total: items.length }}
      />
    )
  },
}
