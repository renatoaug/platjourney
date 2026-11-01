import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { Games } from './games'

const meta: Meta = { title: 'Pages/Games', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj
export const Loaded: Story = {
  render: () => (
    <MockAppState value={{ data: SAMPLE_DATA }}>
      <Games />
    </MockAppState>
  ),
}
export const Empty: Story = {
  render: () => (
    <MockAppState value={{ data: { ...SAMPLE_DATA, ranking: [] } }}>
      <Games />
    </MockAppState>
  ),
}
export const Loading: Story = {
  render: () => (
    <MockAppState value={{ data: null }}>
      <Games />
    </MockAppState>
  ),
}
export const Failed: Story = {
  render: () => (
    <MockAppState value={{ data: null, sync: 'failed' }}>
      <Games />
    </MockAppState>
  ),
}
