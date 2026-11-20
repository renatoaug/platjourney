import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState } from '../app/app-state'
import { VISITOR } from '../app/visitor'
import { current } from '../fixtures'
import { VisitorJourney } from './visitor-journey'

/** The journey for someone without an account: blurred from placeholders, the way in on top. */
const meta: Meta<typeof VisitorJourney> = {
  title: 'Journey/VisitorJourney',
  component: VisitorJourney,
  decorators: [
    (Story) => (
      <MockAppState value={{ me: VISITOR, data: null }}>
        <Story />
      </MockAppState>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof VisitorJourney>

/** A game with a guide: its phases still shape the blurred route. */
export const WithGuide: Story = { args: { game: current } }

/** A game without a guide yet: the route is the trophy list alone. */
export const WithoutGuide: Story = { args: { game: { ...current, guide: null } } }
