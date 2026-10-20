import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_ME } from '../app/app-state'
import { Page } from '../app/page'
import { ConnectedAppsCard, TelegramRow } from '../components/connected-apps'
import { SettingsView } from './settings'

const meta: Meta = { title: 'Pages/Settings', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const view = (load: Parameters<typeof SettingsView>[0]['load']) => (
  <Page path="/settings">
    <SettingsView
      load={load}
      title="Configurações"
      lead="A sua conta, os apps conectados, as notificações e as preferências."
      failed="Não conseguimos carregar as configurações."
      apps={(user) => (
        <ConnectedAppsCard
          telegram={<TelegramRow user={user} onChanged={() => {}} />}
          load={{
            kind: 'ready',
            list: [
              {
                id: 'oauth_token:1',
                name: 'Claude',
                created_at: '2026-10-19T10:00:00Z',
                used_at: '2026-10-19T12:00:00Z',
              },
            ],
          }}
          onDisconnect={() => {}}
        />
      )}
    />
  </Page>
)

/** Telegram linked, push available on the instance. */
export const Loaded: Story = {
  render: () =>
    view({
      kind: 'ready',
      user: {
        ...SAMPLE_ME,
        telegramLinked: true,
        telegramBot: { username: 'nexo_bot', name: 'Nexo' },
        pushKey: 'AQID',
      },
    }),
}

export const Loading: Story = { render: () => view({ kind: 'loading' }) }

export const Failed: Story = { name: 'Error', render: () => view({ kind: 'error' }) }
