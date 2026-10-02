import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Language, type Locale } from '../i18n/i18n'
import { LanguageSetting, LanguageSwitcher } from './language-switcher'

const meta: Meta<typeof LanguageSwitcher> = {
  title: 'Components/LanguageSwitcher',
  component: LanguageSwitcher,
  args: { value: Language.PtBR, onChange: () => {} },
}
export default meta
type Story = StoryObj<typeof LanguageSwitcher>

export const Portuguese: Story = {}

export const English: Story = { args: { value: Language.En } }

// While the choice is being saved.
export const Saving: Story = { args: { disabled: true } }

// Clicking moves the selection, without touching the page's language.
export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<Locale>(Language.PtBR)
    return <LanguageSwitcher value={value} onChange={setValue} />
  },
}

// The row on the account screen, inside its card; it follows the toolbar's language.
export const InPreferences: Story = {
  render: () => (
    <div className="card" style={{ maxWidth: 420 }}>
      <LanguageSetting />
    </div>
  ),
}
