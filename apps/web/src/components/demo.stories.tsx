import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { DemoBanner, DemoNote } from './demo'

const meta: Meta = { title: 'Demo/Read-only demo' }
export default meta
type Story = StoryObj

/** Above every screen while in the demo. */
export const Banner: Story = { render: () => <DemoBanner onConnect={() => {}} /> }
export const BannerEnglish: Story = { ...Banner, globals: { locale: Language.En } }

/** On a phone the action takes the whole width. */
export const BannerPhone: Story = {
  ...Banner,
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <DemoBanner onConnect={() => {}} />
    </div>
  ),
}

/** Beside an action the demo cannot take. */
export const Note: Story = { render: () => <DemoNote /> }
