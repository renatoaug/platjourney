import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_ME } from '../app/app-state'
import { Language } from '../i18n/i18n'
import {
  ConnectedAppsCard,
  ConnectedAppsSkeleton,
  type Connection,
  TelegramRow,
} from './connected-apps'

const meta: Meta = { title: 'Settings/Connected apps' }
export default meta
type Story = StoryObj

const telegram = <TelegramRow user={SAMPLE_ME} onChanged={() => {}} />
const linked = (
  <TelegramRow
    user={{
      ...SAMPLE_ME,
      telegramLinked: true,
      telegramBot: { username: 'platjourney_bot', name: 'Nexo' },
    }}
    onChanged={() => {}}
  />
)

const list: Connection[] = [
  {
    id: 'oauth_token:1',
    name: 'Claude',
    created_at: '2026-10-19T10:00:00Z',
    used_at: '2026-10-19T12:00:00Z',
  },
  { id: 'oauth_token:2', name: 'ChatGPT', created_at: '2026-10-12T10:00:00Z', used_at: null },
  { id: 'oauth_token:3', name: 'MCP Inspector', created_at: '2026-10-10T10:00:00Z', used_at: null },
]

/** Telegram linked and three assistants, one without a known mark. */
export const Connected: Story = {
  render: () => (
    <ConnectedAppsCard telegram={linked} load={{ kind: 'ready', list }} onDisconnect={() => {}} />
  ),
}
export const ConnectedEnglish: Story = { ...Connected, globals: { locale: Language.En } }

/** While one is being disconnected its button waits. */
export const Disconnecting: Story = {
  render: () => (
    <ConnectedAppsCard
      telegram={linked}
      load={{ kind: 'ready', list }}
      busy="oauth_token:1"
      onDisconnect={() => {}}
    />
  ),
}

/** Nothing connected yet: the Telegram button and an empty list. */
export const Empty: Story = {
  render: () => (
    <ConnectedAppsCard
      telegram={telegram}
      load={{ kind: 'ready', list: [] }}
      onDisconnect={() => {}}
    />
  ),
}

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <ConnectedAppsCard telegram={telegram} load={{ kind: 'error' }} onDisconnect={() => {}} />
  ),
}

export const Loading: Story = { render: () => <ConnectedAppsSkeleton /> }
