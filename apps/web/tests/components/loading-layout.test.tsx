import { expect, test } from 'bun:test'
import { ConsoleSkeleton } from '../../src/components/console'
import { GuideSkeleton } from '../../src/components/guide'
import { JourneySkeleton } from '../../src/components/journey'
import { GoalsSkeleton } from '../../src/pages/goals'
import { renderApp } from '../support/web'

test('owned game loading keeps the journey hierarchy instead of the old two-column layout', () => {
  const { container } = renderApp(<JourneySkeleton />)
  expect(container.querySelector('.journey > .hero.immersive')).toBeTruthy()
  expect(container.querySelector('.trophy-roadmap')).toBeTruthy()
  expect(container.querySelector('.journey-session')).toBeTruthy()
  expect(container.querySelector('.journey-trophies')).toBeTruthy()
  expect(container.querySelector('.journey-guide')).toBeTruthy()
  expect(container.querySelector('[role="tablist"]')).toBeNull()
  expect(container.querySelector('.hero-aside')).toBeNull()
  expect(container.querySelector('[role="progressbar"]')).toBeNull()
})

test('interests and annual achievements load only their own tab content', () => {
  const { container, rerender } = renderApp(<GoalsSkeleton section="interests" />)
  expect(container.querySelector('.next-up')).toBeTruthy()
  expect(container.querySelector('.goal-list')).toBeTruthy()
  expect(container.querySelector('.goal-season')).toBeNull()
  expect(container.querySelector('.year-card')).toBeNull()
  rerender(<GoalsSkeleton section="goals" />)
  expect(container.querySelector('.goal-list')).toBeNull()
  expect(container.querySelector('.next-up')).toBeNull()
  expect(container.querySelector('.goal-season')).toBeTruthy()
  expect(container.querySelectorAll('.goal-month')).toHaveLength(12)
  expect(container.querySelector('.year-card')).toBeTruthy()
  expect(container.querySelectorAll('.year-month')).toHaveLength(12)
})

test('home loading reserves its actions and cover shelf without clickable fake games', () => {
  const { container } = renderApp(<ConsoleSkeleton />)
  expect(container.querySelector('.console-actions')).toBeTruthy()
  expect(container.querySelector('.console-progress')).toBeTruthy()
  expect(container.querySelectorAll('.console-cover')).toHaveLength(6)
  expect(container.querySelectorAll('button:not([disabled])')).toHaveLength(0)
})

test('guide loading reserves quick facts before its summary and matches tab order', () => {
  const { container } = renderApp(<GuideSkeleton />)
  expect(container.querySelectorAll('.quick-fact')).toHaveLength(8)
  expect(container.querySelectorAll('.quick-facts-primary .quick-fact')).toHaveLength(3)
  expect(container.querySelectorAll('.quick-facts-conditions .quick-fact')).toHaveLength(5)
  expect(
    [...container.querySelectorAll('.guide-tabs.section-tabs button')].map(
      (tab) => tab.textContent,
    ),
  ).toEqual(['Resumo', 'Roadmap', 'Macetes', 'Perdíveis', 'Glossário'])
})
