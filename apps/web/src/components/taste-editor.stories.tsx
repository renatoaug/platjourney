import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TasteEditor, type TastePrefs } from './taste-editor'

const profile = {
  genres: ['Ação', 'Aventura', 'Metroidvania'],
  traits: ['Exploração', 'Platinas curtas'],
  avoid: ['Troféus online'],
}

const prefs: TastePrefs = {
  added: { genres: ['Metroidvania'], traits: ['Platinas curtas'], avoid: [] },
  removed: { genres: [], traits: [], avoid: [] },
  filters: { noMissables: true, maxHours: 40 },
}

const meta: Meta = { title: 'Components/TasteEditor' }
export default meta
type Story = StoryObj

function Editor({ editable = true, dirty = false }: { editable?: boolean; dirty?: boolean }) {
  const [current, setCurrent] = useState(prefs)
  return (
    <div className="card taste" style={{ maxWidth: 560, display: 'grid', gap: 14 }}>
      <TasteEditor
        profile={profile}
        prefs={current}
        editable={editable}
        dirty={dirty}
        onChange={setCurrent}
        onSave={() => {}}
        onDiscard={() => {}}
      />
    </div>
  )
}

export const Editable: Story = { render: () => <Editor /> }
export const Unsaved: Story = { render: () => <Editor dirty /> }
export const ReadOnly: Story = { render: () => <Editor editable={false} /> }
