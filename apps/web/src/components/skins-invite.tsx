/** A one-time card on Home that points to the new skins in Settings → Appearance. It hides once the
 * player opens it or dismisses it (remembered on this device), and never shows to a player who
 * already wears a skin. */
import { useState } from 'react'
import { Link } from 'react-router'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import './account.css'
import './skins-invite.css'

const messages = defineMessages({
  [Language.PtBR]: {
    eyebrow: 'NOVO',
    title: 'Deixe o app com a sua cara',
    body: 'Skins Neon e Pixel mudam o visual inteiro, na cor que você escolher.',
    open: 'Ver skins',
    dismiss: 'Dispensar',
  },
  [Language.En]: {
    eyebrow: 'NEW',
    title: 'Make the app your own',
    body: 'The Neon and Pixel skins change the whole look, in the color you pick.',
    open: 'See skins',
    dismiss: 'Dismiss',
  },
})

const KEY = 'pj.skins-invite.done'

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function remember() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {}
}

export function SkinsInvite() {
  const { me } = useApp()
  const [hidden, setHidden] = useState(seen)
  if (hidden || (me.skin && me.skin !== 'default')) return null
  const done = () => {
    remember()
    setHidden(true)
  }
  return <SkinsInviteView onOpen={done} onDismiss={done} />
}

export function SkinsInviteView({
  onOpen,
  onDismiss,
}: {
  onOpen: () => void
  onDismiss: () => void
}) {
  const t = useMessages(messages)
  return (
    <section className="card skins-invite" aria-labelledby="skins-invite-title">
      <div className="skins-invite-swatches" aria-hidden="true">
        <span className="skin-swatch is-neon">
          <i />
        </span>
        <span className="skin-swatch is-pixel">
          <i />
        </span>
      </div>
      <div className="skins-invite-copy">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h2 id="skins-invite-title">{t('title')}</h2>
        <p>{t('body')}</p>
      </div>
      <Link to="/settings#appearance" className="button sm" onClick={onOpen}>
        {t('open')} <Icon name="arrow" />
      </Link>
      <button
        type="button"
        className="ghost sm skins-invite-close"
        aria-label={t('dismiss')}
        onClick={onDismiss}
      >
        <Icon name="close" />
      </button>
    </section>
  )
}
