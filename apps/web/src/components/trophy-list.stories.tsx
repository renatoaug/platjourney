import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { current } from '../fixtures'
import type { Trophy } from '../lib/types'
import { helpAnswers, TrophyList } from './trophy-list'

const meta: Meta = { title: 'Game/TrophyList' }
export default meta
type Story = StoryObj

const base = current.trophies

// The fixture has 8 trophies; repeat them (as DLC too) so the pages and the DLC filter show.
const many: Trophy[] = [
  ...base,
  ...base.map((t, i) => ({
    ...t,
    id: 100 + i,
    name: `${t.name} II`,
    earned: false,
    earnedAt: undefined,
  })),
  ...base.map((t, i) => ({
    ...t,
    id: 200 + i,
    groupId: '001',
    name: `${t.name} (DLC)`,
    earned: false,
    earnedAt: undefined,
    progressTarget: i % 2 ? 50 : null,
    progressValue: i % 2 ? 12 + i : null,
    progressRate: i % 2 ? 24 + i * 2 : null,
  })),
]

// Not owned: catalog trophies carry no rarity, no progress, nothing earned.
const catalog: Trophy[] = base.map(({ rarity, earnedRate, earnedAt, ...t }) => ({
  ...t,
  earned: false,
}))

const card = (children: ReactNode) => (
  <div className="card" style={{ maxWidth: 640 }}>
    {children}
  </div>
)

export const Loaded: Story = { render: () => card(<TrophyList trophies={many} />) }

/** "Pedir dica" with one answer in and one on its way. The other buttons would ask the real server. */
export const WithHelp: Story = {
  render: () => {
    helpAnswers.set(
      'story-np',
      new Map([
        [
          8,
          'Aparece na missão **Segura firme**, no capítulo 3.\n\n- Siga a trilha até a ponte\n- Assista a cena\n\nFonte: Trophy Guides',
        ],
        [100, 'loading'],
      ]),
    )
    return card(<TrophyList trophies={many} np="story-np" />)
  },
}

export const CatalogOnly: Story = {
  render: () => card(<TrophyList trophies={catalog} prefix="title-t" />),
}

export const Empty: Story = { render: () => card(<TrophyList trophies={[]} />) }

export const Loading: Story = {
  render: () =>
    card(
      <>
        <h2>Troféus</h2>
        <TrophyList trophies={null} />
      </>,
    ),
}
