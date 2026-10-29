import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockAppState, SAMPLE_DATA } from '../app/app-state'
import { current } from '../fixtures'
import { profileData } from '../pages/profile.stories'
import { Console, ConsoleSkeleton } from './console'
import { rankingData } from './game-cards.stories'

const meta: Meta = { title: 'Components/Console' }
export default meta
type Story = StoryObj

const data = { ...SAMPLE_DATA, current, ranking: rankingData }

// The profile request is seeded through the app cache, so the shelf shows the platinums too.
export const Loaded: Story = {
  render: () => (
    <MockAppState value={{ data, cache: { profile: profileData } }}>
      <Console data={data} />
    </MockAppState>
  ),
}

export const NothingYet: Story = {
  render: () => (
    <MockAppState value={{ cache: { profile: { ...profileData, platinums: [] } } }}>
      <Console data={{ ...SAMPLE_DATA, current: null, ranking: [] }} />
    </MockAppState>
  ),
}

export const Loading: Story = { render: () => <ConsoleSkeleton /> }
