/** Settings page: the account, connected apps (Telegram and assistants), notifications and
 * preferences, out of the profile. */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { AccountCards, AccountSkeleton } from '../components/account'
import { ConnectedApps, ConnectedAppsSkeleton } from '../components/connected-apps'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { Me } from '../lib/types'
import { ErrorState } from '../ui/states'
import './settings.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Configurações',
    lead: 'A sua conta, os apps conectados, as notificações e as preferências.',
    loadFailed: 'Não conseguimos carregar as configurações.',
  },
  [Language.En]: {
    title: 'Settings',
    lead: 'Your account, connected apps, notifications and preferences.',
    loadFailed: "We couldn't load the settings.",
  },
})

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; user: Me }

export function Settings() {
  const t = useMessages(messages)
  const { me, setMe } = useApp()
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const editing = useRef(false)
  // The account screen needs the full account (the Telegram bot's name), which /api/me answers.
  const fetchMe = useCallback(async () => {
    try {
      const { user } = await api<{ user: Me }>('/api/me')
      setMe(user)
      setLoad({ kind: 'ready', user })
    } catch {
      setLoad({ kind: 'error' })
    }
  }, [setMe])
  useEffect(() => {
    fetchMe()
  }, [fetchMe])
  // A saved preference lands in the app state (setMe): the cards show it without asking again.
  useEffect(() => {
    setLoad((l) => (l.kind === 'ready' ? { kind: 'ready', user: { ...l.user, ...me } } : l))
  }, [me])
  const onEditing = useCallback((open: boolean) => {
    editing.current = open
  }, [])
  return (
    <Page path="/settings">
      <SettingsView
        load={load}
        title={t('title')}
        lead={t('lead')}
        failed={t('loadFailed')}
        onEditing={onEditing}
        apps={(user) => <ConnectedApps user={user} onChanged={fetchMe} />}
      />
    </Page>
  )
}

/**
 * The page from its load state, so its stories need no network.
 * @param apps  the connected apps card for the account (it loads its own list)
 */
export function SettingsView({
  load,
  title,
  lead,
  failed,
  onEditing,
  apps,
}: {
  load: Load
  title: string
  lead: string
  failed: string
  onEditing?: (editing: boolean) => void
  apps: (user: Me) => ReactNode
}) {
  return (
    <div id="settings-page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
      </div>
      {load.kind === 'error' ? (
        <ErrorState>{failed}</ErrorState>
      ) : (
        <div className="settings-grid">
          {load.kind === 'loading' ? (
            <AccountSkeleton>
              <ConnectedAppsSkeleton />
            </AccountSkeleton>
          ) : (
            <AccountCards user={load.user} onEditing={onEditing}>
              {apps(load.user)}
            </AccountCards>
          )}
        </div>
      )}
    </div>
  )
}
