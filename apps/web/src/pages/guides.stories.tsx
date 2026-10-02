import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState } from '../app/app-state'
import { Language } from '../i18n/i18n'
import { type GuideCardItem, Guides, type GuidesPage } from './guides'

const meta: Meta = {
  title: 'Pages/Guides',
  parameters: { layout: 'fullscreen' },
  excludeStories: /Data$/,
}
export default meta
type Story = StoryObj

const cover = (id: string) => `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg`
export const guidesData: GuideCardItem[] = [
  {
    id: 'game:119171',
    name: "Baldur's Gate III",
    cover_url: cover('co670h'),
    platforms: ['PS5'],
    release_year: 2023,
    guide: { difficulty: 6, hours: 140, hasMissables: true, hasOnline: false, unobtainable: null },
  },
  {
    id: 'game:25076',
    name: 'Red Dead Redemption 2',
    cover_url: cover('co1q1f'),
    platforms: ['PS4'],
    release_year: 2018,
    guide: { difficulty: 6, hours: 250, hasMissables: true, hasOnline: true, unobtainable: null },
  },
  {
    id: 'game:2112',
    name: "Mirror's Edge Catalyst",
    cover_url: null,
    platforms: ['PS4'],
    release_year: 2016,
    guide: {
      difficulty: 5,
      hours: 30,
      hasMissables: false,
      hasOnline: true,
      unobtainable: 'Servers closed in December 2023',
    },
  },
  {
    id: 'game:1',
    name: 'A game nobody wrote a guide for yet, with a long name',
    cover_url: null,
    platforms: ['PS5', 'PS4'],
    release_year: 2024,
    guide: null,
  },
]
const answer =
  (items: GuideCardItem[], total = items.length) =>
  async (): Promise<GuidesPage> => ({ page: 1, size: 24, total, items })

export const Loaded: Story = {
  render: () => (
    <MockAppState>
      <Guides load={answer(guidesData, 40)} />
    </MockAppState>
  ),
}

export const Empty: Story = {
  render: () => (
    <MockAppState>
      <Guides load={answer([])} />
    </MockAppState>
  ),
}

export const Loading: Story = {
  render: () => (
    <MockAppState>
      <Guides load={() => new Promise(() => {})} />
    </MockAppState>
  ),
}

export const Failed: Story = {
  render: () => (
    <MockAppState>
      <Guides load={() => Promise.reject(new Error('down'))} />
    </MockAppState>
  ),
}

export const English: Story = { ...Loaded, globals: { locale: Language.En } }
