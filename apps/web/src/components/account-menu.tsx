/** The player's photo in the top bar. A tap opens a small menu: who is signed in, the profile, and
 * signing out, which stays busy until the page reloads into the sign-in screen. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { api } from '../lib/api'
import { number } from '../lib/format'
import { Icon } from '../ui/icon'
import { connectAccount } from './demo'
import './account-menu.css'

const messages = defineMessages({
  [Language.PtBR]: {
    open: 'Abrir o menu da conta',
    line: 'Nível {level} · {platinums} platinas',
    profile: 'Meu perfil',
    settings: 'Configurações',
    logout: 'Sair',
    leaveDemo: 'Sair da demo',
    leaving: 'Saindo…',
    failed: 'Não deu para sair. Tente de novo.',
  },
  [Language.En]: {
    open: 'Open the account menu',
    line: 'Level {level} · {platinums} platinums',
    profile: 'My profile',
    settings: 'Settings',
    logout: 'Sign out',
    leaveDemo: 'Leave the demo',
    leaving: 'Signing out…',
    failed: 'Could not sign out. Try again.',
  },
})

// How long the menu takes to close (account-menu.css).
const CLOSE_MS = 140

/** Ends the session when the server confirms it, then starts over from the sign-in screen. */
async function signOut(): Promise<void> {
  await api('/api/auth/logout', {})
  location.hash = '#/'
  location.reload()
}

export function AccountMenu({
  onLogout,
  initiallyOpen = false,
}: {
  onLogout?: () => Promise<void>
  initiallyOpen?: boolean
}) {
  const t = useMessages(messages)
  const { me, data } = useApp()
  const p = data?.profile
  const [state, setState] = useState<'closed' | 'open' | 'closing'>(
    initiallyOpen ? 'open' : 'closed',
  )
  const [leaving, setLeaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined)

  const close = useCallback(() => {
    setState('closing')
    clearTimeout(closing.current)
    closing.current = setTimeout(() => setState('closed'), CLOSE_MS)
  }, [])

  useEffect(() => {
    if (state !== 'open') return
    // pointerdown, not click: on iOS a tap on plain content never fires click on the document.
    const outside = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.('.account-menu')) close()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [state, close])

  const logout = async () => {
    setLeaving(true)
    setFailed(false)
    try {
      await (onLogout ?? (me.demo ? connectAccount : signOut))()
    } catch {
      setLeaving(false)
      setFailed(true)
    }
  }

  const avatar = p?.avatarUrl
  return (
    <div className="account-menu">
      <button
        ref={button}
        type="button"
        className="topbar-avatar"
        aria-label={t('open')}
        aria-haspopup="menu"
        aria-expanded={state === 'open'}
        aria-controls="account-menu-panel"
        onClick={() => (state === 'open' ? close() : setState('open'))}
      >
        {avatar ? <img src={avatar} alt="" /> : <Icon name="circle" />}
      </button>
      {state !== 'closed' && (
        <div
          className={`account-menu-panel${state === 'closing' ? ' is-closing' : ''}`}
          id="account-menu-panel"
          role="menu"
        >
          {p && (
            <div className="account-menu-who">
              {avatar ? <img src={avatar} alt="" /> : <Icon name="circle" />}
              <div>
                <b>{p.onlineId}</b>
                <small>{t('line', { level: p.level, platinums: number(p.earned.platinum) })}</small>
              </div>
            </div>
          )}
          <Link to="/profile" role="menuitem" className="account-menu-item" onClick={close}>
            <Icon name="dashboard" />
            {t('profile')}
          </Link>
          <Link to="/settings" role="menuitem" className="account-menu-item" onClick={close}>
            <Icon name="settings" />
            {t('settings')}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="account-menu-item account-menu-logout"
            onClick={logout}
            disabled={leaving}
            aria-busy={leaving}
          >
            {leaving ? (
              <span className="account-menu-spinner" aria-hidden="true" />
            ) : (
              <Icon name="arrow-right" />
            )}
            {leaving ? t('leaving') : t(me.demo ? 'leaveDemo' : 'logout')}
          </button>
          {failed && (
            <p className="account-menu-error" role="alert">
              {t('failed')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
