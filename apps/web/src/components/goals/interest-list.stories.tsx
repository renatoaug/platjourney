import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Interest } from '../../lib/types'
import { applyCommand, sampleGoals } from './fixtures'
import { InterestList, InterestListSkeleton } from './interest-list'
import type { GoalFilter } from './season'

const meta: Meta = { title: 'Goals/InterestList' }
export default meta
type Story = StoryObj

function Demo({
  interests: initial = sampleGoals.interests,
  filter: startFilter = 'all' as GoalFilter,
}) {
  const [goals, setGoals] = useState({ ...sampleGoals, interests: initial as Interest[] })
  const [filter, setFilter] = useState<GoalFilter>(startFilter)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const run = async (text: string) => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 400))
    setGoals((g) => applyCommand(g, text))
    setBusy(false)
  }
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <InterestList
        interests={goals.interests}
        filter={filter}
        page={page}
        onFilter={(next) => {
          setFilter(next)
          setPage(1)
        }}
        onPage={setPage}
        busy={busy}
        onRemove={(id) => run(`remove ${id}`)}
        onReorder={(ids) => run(`order ${ids.join(',')}`)}
      />
    </div>
  )
}

export const Loaded: Story = { render: () => <Demo /> }

export const EmptyFilter: Story = {
  render: () => <Demo interests={sampleGoals.interests.filter((g) => !g.done)} filter="done" />,
}

export const JustAdded: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 640 }}>
      <InterestList
        interests={sampleGoals.interests}
        filter="all"
        page={1}
        onFilter={() => {}}
        onPage={() => {}}
        newGameId={sampleGoals.interests[0]?.game.id}
        onRemove={() => {}}
        onReorder={async () => {}}
      />
    </div>
  ),
}

export const Loading: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 640 }}>
      <InterestListSkeleton />
    </div>
  ),
}
