import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { current } from '../fixtures'
import { Language } from '../i18n/i18n'
import { type DeskTab, GameDesk } from './game-desk'

/** A game's page on a large screen (1280px and up): the head with its numbers, the tabs and the
 * summary beside them. */
const meta: Meta<typeof GameDesk> = {
  title: 'Components/GameDesk',
  component: GameDesk,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof meta>

function Desk({ game = current, catalog }: { game?: typeof current; catalog?: boolean }) {
  const [tab, setTab] = useState<DeskTab>('journey')
  return (
    <div style={{ padding: 24 }}>
      <GameDesk
        game={game}
        trophies={game.trophies}
        progress={game.progress}
        np={game.np}
        tab={tab}
        onTab={setTab}
        catalog={catalog ? <button type="button">Salvar nos interesses</button> : undefined}
        page={
          <section className="card" style={{ padding: 24, minHeight: 400 }}>
            {tab}
          </section>
        }
      />
    </div>
  )
}

export const Owned: Story = { render: () => <Desk /> }

export const Catalog: Story = { render: () => <Desk catalog /> }

export const WithoutGuide: Story = { render: () => <Desk game={{ ...current, guide: null }} /> }

export const PlatinumEarned: Story = {
  render: () => (
    <Desk
      game={{
        ...current,
        trophies: current.trophies.map((t) => ({ ...t, earned: true })),
        progress: 100,
      }}
    />
  ),
}

export const English: Story = { ...Owned, globals: { locale: Language.En } }
