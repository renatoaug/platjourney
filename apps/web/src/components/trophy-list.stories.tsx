import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { current } from '../fixtures'
import type { Trophy } from '../lib/types'
import { TrophyList } from './trophy-list'

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

/** "Pedir dica" on each trophy still to earn: a link to Nexo with that trophy attached. */
export const WithHelp: Story = {
  render: () => card(<TrophyList trophies={many} np="story-np" />),
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
