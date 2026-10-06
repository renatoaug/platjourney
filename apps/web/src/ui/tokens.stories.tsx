import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta = { title: 'Tokens' }
export default meta
type Story = StoryObj

// Read the semantic tokens straight from theme.css, so this page never goes stale.
const tokens = (prefix: string) =>
  [...document.styleSheets]
    .flatMap((s) => {
      try {
        return [...s.cssRules]
      } catch {
        return []
      }
    })
    .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === ':root')
    .flatMap((r) => [...r.style].filter((p) => p.startsWith(prefix)))
    .filter((p, i, all) => all.indexOf(p) === i)

export const Colors: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      {tokens('--color-').map((t) => (
        <div key={t} className="card">
          <div
            style={{
              background: `var(${t})`,
              height: 48,
              borderRadius: 'var(--radius-control)',
              border: '1px solid var(--color-border)',
            }}
          />
          <code className="text-sm text-fg-muted">{t}</code>
        </div>
      ))}
    </div>
  ),
}

export const Typography: Story = {
  render: () => (
    <div className="stack">
      {tokens('--text-').map((t) => (
        <div key={t} style={{ fontSize: `var(${t})` }}>
          <code className="text-sm text-fg-muted">{t}</code> Cada troféu é um passo.
        </div>
      ))}
    </div>
  ),
}

export const Radius: Story = {
  render: () => (
    <div className="flex gap-4">
      {tokens('--radius-').map((t) => (
        <div key={t} className="text-center">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: `var(${t})`,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border-strong)',
            }}
          />
          <code className="text-sm text-fg-muted">{t}</code>
        </div>
      ))}
    </div>
  ),
}
