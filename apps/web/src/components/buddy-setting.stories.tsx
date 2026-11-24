import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_ME } from '../app/app-state'
import { BuddySettings } from './buddy-setting'

const meta: Meta<typeof BuddySettings> = {
  title: 'Components/BuddySettings',
  component: BuddySettings,
  args: { user: SAMPLE_ME },
  decorators: [
    (Story) => (
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="setting-group">
          <Story />
        </div>
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof BuddySettings>

/** Nobody picked yet: Nexo, with its own name. */
export const Default: Story = {}

/** An object picked and named. */
export const Named: Story = { args: { user: { ...SAMPLE_ME, buddy: 'coffee', buddyName: 'Zé' } } }

/** The demo account sees the gallery but cannot change it. */
export const Demo: Story = { args: { user: { ...SAMPLE_ME, demo: true } } }
