import type { Meta, StoryObj } from '@storybook/react-vite'
import { type Release, ReleasesView } from './releases'

const meta: Meta = { title: 'Home/Releases', excludeStories: /Data$/ }
export default meta
type Story = StoryObj

const NOW = Date.UTC(2026, 9, 13, 15)
const day = (offset: number) => new Date(Date.UTC(2026, 9, 13 + offset)).toISOString()
const cover = (id: string) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`

export const releasesData: Release[] = [
  {
    id: 'game:1',
    name: 'Days Gone',
    cover_url: cover('co94bn'),
    platforms: ['PS4', 'PS5'],
    released_at: day(-6),
    listed: true,
    guide: { difficulty: 3, hours: 40 },
  },
  {
    id: 'game:2',
    name: "Baldur's Gate III",
    cover_url: cover('co670h'),
    platforms: ['PS5'],
    released_at: day(-2),
    listed: true,
    guide: null,
  },
  {
    id: 'game:3',
    name: 'Red Dead Redemption 2',
    cover_url: cover('co1q1f'),
    platforms: ['PS4'],
    released_at: day(0),
    listed: true,
    guide: { difficulty: 6, hours: 250 },
  },
  {
    id: 'game:4',
    name: 'A game coming out tomorrow with a long name',
    cover_url: null,
    platforms: ['PS5', 'PC'],
    released_at: day(1),
    listed: false,
    guide: null,
  },
  {
    id: 'game:5',
    name: 'Elden Ring',
    cover_url: cover('co4jni'),
    platforms: ['PS4', 'PS5'],
    released_at: day(5),
    listed: true,
    guide: null,
  },
  {
    id: 'game:6',
    name: 'Ghost of Tsushima',
    cover_url: cover('co2crj'),
    platforms: ['PS4', 'PS5'],
    released_at: day(12),
    listed: false,
    guide: null,
  },
]

export const Loaded: Story = {
  render: () => <ReleasesView load={{ status: 'ok', releases: releasesData }} now={NOW} />,
}
export const Loading: Story = { render: () => <ReleasesView load={{ status: 'loading' }} /> }
export const Empty: Story = {
  render: () => <ReleasesView load={{ status: 'ok', releases: [] }} now={NOW} />,
}
export const Failed: Story = { render: () => <ReleasesView load={{ status: 'error' }} /> }
