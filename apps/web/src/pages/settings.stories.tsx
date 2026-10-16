import type { Meta, StoryObj } from '@storybook/react-vite'
import { SAMPLE_ME } from '../app/app-state'
import { Page } from '../app/page'
import { SettingsView } from './settings'

const meta: Meta = { title: 'Pages/Settings', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const view = (load: Parameters<typeof SettingsView>[0]['load']) => (
  <Page path="/settings">
    <SettingsView
      load={load}
      title="Configurações"
      lead="Telegram, notificações, preferências e a sua conta."
      failed="Não conseguimos carregar as configurações."
      onChanged={() => {}}
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
