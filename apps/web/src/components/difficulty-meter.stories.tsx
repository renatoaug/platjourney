import type { Meta, StoryObj } from '@storybook/react-vite'
import { DifficultyMeter, type MeterLook } from './difficulty-meter'

const meta: Meta = { title: 'Game/DifficultyMeter' }
export default meta
type Story = StoryObj

const LOOKS: { look: MeterLook; title: string; where: string }[] = [
  { look: 'score', title: 'A · Nota grande', where: 'cabeçalho do jogo e card "Sobre"' },
  { look: 'compact', title: 'B · Compacta', where: 'cards de guia, recomendações e interesses' },
  { look: 'badge', title: 'C · Escudo', where: 'cabeçalho do jogo' },
]

/** The three looks side by side, for each band and an estimated one. */
export const Options: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 28, maxWidth: 1100 }}>
      {LOOKS.map(({ look, title, where }) => (
        <section key={look} className="card" style={{ display: 'grid', gap: 16 }}>
          <div>
            <span className="eyebrow">{title}</span>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Para: {where}
            </p>
          </div>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 40px', alignItems: 'center' }}
          >
            <DifficultyMeter value={2} look={look} />
            <DifficultyMeter value={5} look={look} />
            <DifficultyMeter value={7} look={look} />
            <DifficultyMeter value={9} look={look} />
            <DifficultyMeter value="hard" look={look} estimated />
          </div>
        </section>
      ))}
    </div>
  ),
}

export const Score: Story = { render: () => <DifficultyMeter value={3} /> }
export const Compact: Story = { render: () => <DifficultyMeter value={6} look="compact" /> }
export const Badge: Story = { render: () => <DifficultyMeter value={8} look="badge" /> }
export const Estimated: Story = {
  render: () => <DifficultyMeter value="medium" look="compact" estimated />,
}
