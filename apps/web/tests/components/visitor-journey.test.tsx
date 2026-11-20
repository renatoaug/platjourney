import { expect, test } from 'bun:test'
import { screen, within } from '@testing-library/react'
import { VISITOR } from '../../src/app/visitor'
import { lockedRoadmap, VisitorJourney } from '../../src/components/visitor-journey'
import { current } from '../../src/fixtures'
import { renderApp } from '../support/web'

const label = (n: number) => `Troféu ${n}`
const phase = (n: number) => `Fase ${n}`

test('the locked route keeps the shape and nothing to read', () => {
  const locked = lockedRoadmap(current, label, phase)
  expect(locked.trophies).toHaveLength(current.trophies.length)
  expect(locked.trophies.map((t) => t.type)).toEqual(current.trophies.map((t) => t.type))
  for (const t of locked.trophies) {
    expect(t.name).toMatch(/^Troféu \d+$/)
    expect(t.iconUrl).toBeUndefined()
    expect(t.earned).toBe(false)
  }
  const real = new Set(current.trophies.map((t) => t.name))
  const guide = locked.guide
  expect(guide?.missables).toEqual([])
  expect(guide?.earlyTips).toEqual([])
  for (const p of guide?.roadmap ?? []) {
    expect(p.phase).toMatch(/^Fase \d+$/)
    expect(p.goal).toBe('')
    for (const n of p.trophies) expect(real.has(n)).toBe(false)
  }
  // The phases still place the trophies they named.
  const placed = (current.guide?.roadmap ?? []).flatMap((p) => p.trophies)
  if (placed.length) expect(guide?.roadmap.flatMap((p) => p.trophies).length).toBeGreaterThan(0)
  expect(lockedRoadmap({ ...current, guide: null }, label, phase).guide).toBeNull()
})

test('the blurred route sits behind the way in, which comes back to the game', () => {
  renderApp(<VisitorJourney game={current} />, {
    path: '/title/game/game%3A19561?view=journey',
    value: { me: VISITOR },
  })
  const preview = document.querySelector('.visitor-journey-preview')
  expect(preview?.getAttribute('aria-hidden')).toBe('true')
  expect(preview?.hasAttribute('inert')).toBe(true)
  expect(preview?.textContent).not.toContain(current.trophies[0].name)
  const card = screen.getByRole('region', { name: 'Sua jornada até a platina' })
  const join = within(card).getByRole('link', { name: /Conectar minha PSN/ })
  expect(join.getAttribute('href')).toBe(
    `/entrar?next=${encodeURIComponent('/title/game/game%3A19561?view=journey')}`,
  )
  expect(within(card).getByRole('link', { name: 'Já tenho conta' })).toBeTruthy()
})
