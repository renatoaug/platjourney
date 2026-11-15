import type { Meta, StoryObj } from '@storybook/react-vite'
import { PushInviteView } from './push-invite'

const meta: Meta = { title: 'Components/PushInvite' }
export default meta
type Story = StoryObj

// On Home, while notices are off on this device.
export const Card: Story = {
  render: () => <PushInviteView variant="card" onEnable={() => {}} onDismiss={() => {}} />,
}

// At the top of the bell's list, while notices are off.
export const Row: Story = {
  render: () => <PushInviteView variant="row" onEnable={() => {}} />,
}

// Blocked on an iPhone: the system will not ask again, so the line says where to allow it.
export const BlockedOnIphone: Story = {
  render: () => <PushInviteView variant="row" blocked ios onEnable={() => {}} />,
}

// Blocked in a browser.
export const BlockedInBrowser: Story = {
  render: () => <PushInviteView variant="row" blocked onEnable={() => {}} />,
}

// Turning it on: the button waits for the system's answer.
export const Busy: Story = {
  render: () => <PushInviteView variant="card" busy onEnable={() => {}} onDismiss={() => {}} />,
}
