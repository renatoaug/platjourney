import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { NexoBubble } from './nexo-bubble'

const meta = {
  title: 'Components/NexoBubble',
  component: NexoBubble,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NexoBubble>
export default meta
type Story = StoryObj<typeof meta>

/** Where a first visit puts it: the bottom right corner. */
export const Corner: Story = {}
/** Dropped by the player near the top left. */
export const Moved: Story = { args: { initial: { x: 40, y: 40 } } }

const news = {
  count: 1,
  latest: {
    game: 'game:2050',
    np: 'NPWR05584_00',
    name: 'LEGO Marvel Super Heroes',
    content: 'Voltei com a resposta sobre os 99% após usar código de trapaça.',
    created_at: '2026-11-23T12:00:00Z',
  },
}

/** Nexo wrote while the player was away: the count, the pulse and the note beside it. */
export const Calling: Story = {
  decorators: [
    (Story) => (
      <MockAppState value={{ data: { ...SAMPLE_DATA, nexo: news } }}>
        <Story />
      </MockAppState>
    ),
  ],
}

/** The same, with Nexo dropped on the left: the note opens to its right. */
export const CallingLeft: Story = { ...Calling, args: { initial: { x: 16, y: 200 } } }
