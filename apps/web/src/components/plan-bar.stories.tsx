import type { Meta, StoryObj } from '@storybook/react-vite'
import { samplePlan } from './plan.stories'
import { PlanBarView } from './plan-bar'

const meta: Meta<typeof PlanBarView> = {
  title: 'Shell/PlanBar',
  component: PlanBarView,
  args: { plan: samplePlan, onClose: () => {} },
}
export default meta
type Story = StoryObj<typeof PlanBarView>

/** A plan on: the game and the step to do now, one tap from the whole plan. */
export const Active: Story = {}

/** A long trophy name keeps one line. */
export const LongName: Story = {
  args: {
    plan: {
      ...samplePlan,
      steps: samplePlan.steps.map((s, i) =>
        i === samplePlan.nextIndex
          ? { ...s, trophy: 'Um nome de troféu bem comprido que não cabe numa linha do celular' }
          : s,
      ),
    },
  },
}
