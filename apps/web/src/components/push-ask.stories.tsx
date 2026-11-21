import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../i18n/i18n'
import { PushAskView } from './push-ask'

const meta: Meta = { title: 'Components/PushAsk', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

// A screen behind the bar, which stays usable under it.
const Behind = () => (
  <div style={{ padding: 24, display: 'grid', gap: 16 }}>
    {['Grand Theft Auto VI', 'Black Myth: Wukong', 'ELDEN RING'].map((name) => (
      <section key={name} className="card" style={{ padding: 20 }}>
        <h2 style={{ margin: 0 }}>{name}</h2>
        <p>Próximo troféu e o que fazer agora.</p>
      </section>
    ))}
  </div>
)

// The first time the native app opens on a device, before the system's dialog.
export const Story: Story = {
  render: () => (
    <>
      <Behind />
      <PushAskView onEnable={() => {}} onLater={() => {}} />
    </>
  ),
}

// Asked again, a week after a "not now", over a trophy notice the player did not see.
export const MissedTrophy: Story = {
  render: () => (
    <>
      <Behind />
      <PushAskView
        missed={{ game: 'Grand Theft Auto VI', ago: 'há 2 horas' }}
        onEnable={() => {}}
        onLater={() => {}}
      />
    </>
  ),
}

// Waiting for the system's answer after "Turn on".
export const Busy: Story = {
  render: () => (
    <>
      <Behind />
      <PushAskView busy onEnable={() => {}} onLater={() => {}} />
    </>
  ),
}

export const English: Story = { ...Story, globals: { locale: Language.En } }
