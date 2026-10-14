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
    genres: ['Role-playing (RPG)', 'Adventure'],
    shot: 'sc81fj',
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
const facets: NonNullable<GuidesPage['facets']> = {
  difficulty: { easy: 112, medium: 240, hard: 410, brutal: 655 },
  hours: { '10': 64, '25': 180, '50': 390, '100': 560 },
  noMissables: 302,
  onePlaythrough: 488,
  noOnline: 590,
  genres: [
    { name: 'Adventure', count: 410 },
    { name: 'Role-playing (RPG)', count: 233 },
    { name: 'Shooter', count: 190 },
    { name: 'Indie', count: 150 },
    { name: 'Platform', count: 88 },
  ],
}
const collage = [
  cover('co9pul'),
  cover('cwcj7fd5sulqavyme3vc'),
  cover('cob9mq'),
  cover('co77x7'),
  cover('co1rbm'),
  cover('co6lli'),
  cover('co48x2'),
  cover('co5s15'),
  cover('co8jkn'),
  cover('co1x78'),
  cover('co27bk'),
  cover('cobf3a'),
  cover('co8roc'),
  cover('co6219'),
]
const answer =
  (items: GuideCardItem[], total = items.length) =>
  async (): Promise<GuidesPage> => ({ page: 1, size: 24, total, items, facets, collage })

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
