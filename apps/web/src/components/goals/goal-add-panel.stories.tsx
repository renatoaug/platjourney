import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef, useState } from 'react'
import type { Game } from '../../lib/types'
import { toast } from '../../ui/toast'
import { failingSearch, fakeSearch, sampleGoals } from './fixtures'
import { GoalAddPanel } from './goal-add-panel'

const meta: Meta = { title: 'Goals/GoalAddPanel' }
export default meta
type Story = StoryObj

function Demo({
  search = fakeSearch,
  selection: initial = null,
}: {
  search?: (query: string) => Promise<Game[]>
  selection?: Game | null
}) {
  const [draft, setDraft] = useState(initial?.name ?? '')
  const [selection, setSelection] = useState<Game | null>(initial)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="card" style={{ maxWidth: 640, minHeight: 360 }}>
      <p className="muted">Busque “elden” ou “ghost” (Ghost of Tsushima já está nos interesses).</p>
      <GoalAddPanel
        open
        interests={sampleGoals.interests}
        draft={draft}
        onDraft={setDraft}
        selection={selection}
        onSelection={setSelection}
        onSave={(game) => {
          setDraft('')
          setSelection(null)
          toast(`${game.name} salvo nos interesses`, 'success')
        }}
        onClose={() => {}}
        inputRef={input}
        search={search}
      />
    </div>
  )
}

export const Search: Story = { render: () => <Demo /> }

export const WithSelection: Story = {
  render: () => (
    <Demo
      selection={{
        id: 'game:elden-ring',
        name: 'Elden Ring',
        platforms: ['PS5'],
        release_year: 2022,
      }}
    />
  ),
}

export const SearchUnavailable: Story = { render: () => <Demo search={failingSearch} /> }
