/** Settings page: Telegram, notifications, preferences and the account, out of the profile. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { Page } from '../app/page'
import { AccountCards, AccountSkeleton } from '../components/account'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import type { Me } from '../lib/types'
import { ErrorState } from '../ui/states'
import './settings.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Configurações',
    lead: 'Telegram, notificações, preferências e a sua conta.',
    loadFailed: 'Não conseguimos carregar as configurações.',
  },
  [Language.En]: {
    title: 'Settings',
    lead: 'Telegram, notifications, preferences and your account.',
    loadFailed: "We couldn't load the settings.",
  },
})

type Load = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; user: Me }

export function Settings() {
  const t = useMessages(messages)
  const { setMe } = useApp()
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
        onChanged={fetchMe}
        onEditing={onEditing}
      />
    </Page>
  )
}

/** The page from its load state, so its stories need no network. */
export function SettingsView({
  load,
  title,
  lead,
  failed,
  onChanged,
  onEditing,
}: {
  load: Load
  title: string
  lead: string
  failed: string
  onChanged: () => void
  onEditing?: (editing: boolean) => void
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
            <AccountSkeleton />
          ) : (
            <AccountCards user={load.user} onChanged={onChanged} onEditing={onEditing} />
          )}
        </div>
      )}
    </div>
  )
}
