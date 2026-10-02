import type { Meta, StoryObj } from '@storybook/react-vite'
import type { YearGoals } from '../lib/types'
import { AnnualGoal, AnnualGoalSkeleton } from './annual-goal'
import { sampleGoals } from './goals/fixtures'

const meta: Meta = { title: 'Home/AnnualGoal' }
export default meta
type Story = StoryObj

const Card = ({ goals }: { goals: YearGoals }) => (
  <div className="card annual-goal" style={{ maxWidth: 360 }}>
    <AnnualGoal goals={goals} />
  </div>
)

export const Loaded: Story = { render: () => <Card goals={sampleGoals} /> }

export const NoTarget: Story = { render: () => <Card goals={{ ...sampleGoals, target: 0 }} /> }

export const Achieved: Story = {
  render: () => <Card goals={{ ...sampleGoals, target: 7, done: 7 }} />,
}

export const Loading: Story = {
  render: () => (
    <div className="card annual-goal" style={{ maxWidth: 360 }}>
      <AnnualGoalSkeleton />
    </div>
  ),
}
