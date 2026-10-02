import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plan } from '../components/plan'
import { samplePlan } from '../components/plan.stories'
import { current } from '../fixtures'
import { Language } from '../i18n/i18n'
import type { CurrentGame } from '../lib/types'
import { GameScreen } from './game'

const meta: Meta = { title: 'Pages/Game', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const game: CurrentGame = current
const noop = () => {}
const plan = (p: typeof samplePlan | null | undefined) => (
  <Plan
    plan={p}
    minutes={120}
    onMinutes={noop}
    onGo={noop}
    onCancel={noop}
    onNew={noop}
    onDiscard={noop}
  />
)

export const Loaded: Story = { render: () => <GameScreen current={game} plan={plan(samplePlan)} /> }

export const WithoutPlan: Story = { render: () => <GameScreen current={game} plan={plan(null)} /> }

export const GuideBuilding: Story = {
  render: () => <GameScreen current={{ ...game, guide: null }} plan={plan(null)} />,
}

/** No game started yet: the hero says how to begin. */
export const NoGame: Story = { render: () => <GameScreen current={null} plan={plan(null)} /> }

export const Loading: Story = {
  render: () => <GameScreen current={undefined} plan={plan(undefined)} />,
}

// The same screen in English (the toolbar switches any story).
export const English: Story = { ...Loaded, globals: { locale: Language.En } }
