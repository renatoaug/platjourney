/** Account cards on the profile page: Telegram link, DLC and language preferences, password and deletion. */
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useApp } from '../app/app-state'
import { defineMessages, Language, translator, useMessages } from '../i18n/i18n'
import { ApiError, api, del } from '../lib/api'
import type { Me } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { type AuthForm, useAuthForm } from './auth/use-auth-form'
import { DemoNote } from './demo'
import { LanguageSetting } from './language-switcher'
import { OPEN_ONBOARDING } from './onboarding'
import { NewPasswordFields, PasswordInput, SubmitButton } from './password-fields'
import './auth/auth-layout.css'
import './account.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Conta',
    psnId: 'ID da PlayStation Network',
    saveFailed: 'Não conseguimos salvar. Tente de novo.',
    cancel: 'Cancelar',
    logout: 'Sair',
    leaving: 'Saindo…',
    logoutFailed: 'Não conseguimos sair agora. Tente de novo.',
    telegram: {
      tapStart: 'Toque em Iniciar no Telegram para concluir.',
      linkFailed: 'Não conseguimos gerar o link. Tente de novo.',
      connectedTo: 'Conexão ativa com ',
      connectedRest:
        '. As atualizações da sua jornada de platina chegam por lá, e você conversa com o Nexo quando quiser.',
      unlink: 'Desconectar',
      lead: 'Receba atualizações da sua jornada de platina e converse com o Nexo direto pelo celular.',
      link: 'Conectar Telegram',
    },
    preferences: {
      title: 'Preferências',
      saveFailed: 'Não conseguimos salvar a preferência. Tente de novo.',
      withDlc: 'O progresso agora conta as DLCs.',
      baseOnly: 'O progresso agora mostra só o jogo base.',
      dlc: 'Contar DLCs no progresso',
      dlcHint:
        'A platina só pede o jogo base. Ligue para ver o progresso com as DLCs em todo o app, no Telegram e no Nexo.',
      notices: 'Avisos escritos pelo Nexo',
      noticesHint:
        'Ao começar um jogo e a cada troféu, o Nexo comenta e diz o próximo passo. Desligado, você recebe um aviso simples, sem o comentário.',
      noticesOn: 'O Nexo volta a escrever seus avisos.',
      noticesOff: 'Seus avisos agora são simples.',
      intro: 'Introdução',
      introHint: 'As cinco fases que mostram como o PlatJourney funciona.',
      introOpen: 'Rever',
    },
    password: {
      changed: 'Senha trocada. As outras sessões foram encerradas.',
      open: 'Trocar senha',
      current: 'Senha atual',
      new: 'Nova senha',
      busy: 'Salvando…',
      submit: 'Salvar nova senha',
    },
    delete: {
      open: 'Excluir minha conta',
      lead: 'Apaga sua conversa com o Nexo, interesses, histórico e a conexão com o Telegram. Não dá para desfazer.',
      typeBefore: 'Digite ',
      typeAfter: ' para confirmar',
      busy: 'Excluindo…',
      submit: 'Excluir conta',
    },
  },
  [Language.En]: {
    title: 'Account',
    psnId: 'PlayStation Network ID',
    saveFailed: 'Could not save. Try again.',
    cancel: 'Cancel',
    logout: 'Sign out',
    leaving: 'Signing out…',
    logoutFailed: 'Could not sign out right now. Try again.',
    telegram: {
      tapStart: 'Tap Start in Telegram to finish.',
      linkFailed: 'Could not create the link. Try again.',
      connectedTo: 'Connected to ',
      connectedRest:
        '. Updates on your platinum journey arrive there, and you can talk to Nexo whenever you like.',
      unlink: 'Disconnect',
      lead: 'Get updates on your platinum journey and talk to Nexo right from your phone.',
      link: 'Connect Telegram',
    },
    preferences: {
      title: 'Preferences',
      saveFailed: 'Could not save the preference. Try again.',
      withDlc: 'Progress now counts DLC.',
      baseOnly: 'Progress now shows the base game only.',
      dlc: 'Count DLC in progress',
      dlcHint:
        'The platinum only needs the base game. Turn on to see progress with DLC across the app, on Telegram and in Nexo.',
      notices: 'Notices written by Nexo',
      noticesHint:
        'When you start a game and on every trophy, Nexo comments and says the next step. Off, you get a plain notice, without the comment.',
      noticesOn: 'Nexo writes your notices again.',
      noticesOff: 'Your notices are now plain.',
      intro: 'Introduction',
      introHint: 'The five phases that show how PlatJourney works.',
      introOpen: 'Watch again',
    },
    password: {
      changed: 'Password changed. Your other sessions were signed out.',
      open: 'Change password',
      current: 'Current password',
      new: 'New password',
      busy: 'Saving…',
      submit: 'Save new password',
    },
    delete: {
      open: 'Delete my account',
      lead: 'Deletes your chat with Nexo, interests, history and the Telegram connection. This cannot be undone.',
      typeBefore: 'Type ',
      typeAfter: ' to confirm',
      busy: 'Deleting…',
      submit: 'Delete account',
    },
  },
})
const t = translator(messages)

const handled = (e: unknown) => e instanceof ApiError && e.handled
const friendly = (e: unknown) => (e instanceof ApiError ? e.friendly : undefined)

const deleteAccount = (onlineId: string) => del('/api/account', { onlineId })

// Leaving the account starts over from the login screen.
const restart = () => {
  location.hash = '#/'
  location.reload()
}

function TelegramCard({ user, onChanged }: { user: Me; onChanged: () => void }) {
  const t = useMessages(messages)
  const [linking, setLinking] = useState(false)
  const bot = user.telegramBot
  const link = async () => {
    setLinking(true)
    try {
      const { url } = await api<{ url: string }>('/api/telegram/link', {})
      window.open(url, '_blank', 'noopener')
      toast(t('telegram.tapStart'), 'info')
    } catch (e) {
      if (!handled(e)) toast(t('telegram.linkFailed'))
    }
    setLinking(false)
  }
  const unlink = async () => {
    await del('/api/telegram/link').catch(() => {})
    onChanged()
  }
  return (
    <div className="card" id="telegram-card">
      {/* Telegram's paper plane mark (Simple Icons, CC0): white plane on its brand blue. */}
      <h2 className="telegram-title">
        <img className="telegram-logo" src="/telegram.svg" alt="" />
        Telegram
      </h2>
      {user.telegramLinked ? (
        <>
          <p className="muted">
            {t('telegram.connectedTo')}
            <b>{bot?.name ?? 'Nexo'}</b>
            {bot && (
              <>
                {' · '}
                <a
                  className="text-link"
                  href={`https://t.me/${bot.username}`}
                  target="_blank"
                  rel="noopener"
                >
                  @{bot.username}
                </a>
              </>
            )}
            {t('telegram.connectedRest')}
          </p>
          <div className="chips" style={{ marginTop: 14 }}>
            <button type="button" className="ghost sm" id="telegram-unlink" onClick={unlink}>
              {t('telegram.unlink')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">{t('telegram.lead')}</p>
          <div className="chips" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="sm"
              id="telegram-link"
              disabled={linking || user.demo}
              onClick={link}
            >
              {t('telegram.link')}
            </button>
          </div>
          {user.demo && <DemoNote />}
        </>
      )}
    </div>
  )
}

// Whether Nexo writes this player's automatic notices; only shown when the instance allows it.
function NoticesSetting({ user }: { user: Me }) {
  const t = useMessages(messages)
  const { setMe } = useApp()
  const [on, setOn] = useState(user.aiNotices !== false)
  const [saving, setSaving] = useState(false)
  useEffect(() => setOn(user.aiNotices !== false), [user.aiNotices])
  const change = async (next: boolean) => {
    setOn(next)
    setSaving(true)
    try {
      const saved = await api<{ user: Me }>('/api/account/preferences', { aiNotices: next })
      setMe(saved.user)
      toast(next ? t('preferences.noticesOn') : t('preferences.noticesOff'), 'success')
    } catch (e) {
      setOn(!next)
      if (!handled(e)) toast(t('preferences.saveFailed'))
    }
    setSaving(false)
  }
  return (
    <label className="setting-row">
      <span className="setting-text">
        <b>{t('preferences.notices')}</b>
        <small>{t('preferences.noticesHint')}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        id="pref-notices"
        checked={on}
        aria-checked={on}
        disabled={saving || user.demo}
        onChange={(e) => change(e.target.checked)}
      />
    </label>
  )
}

function PreferencesCard({ user }: { user: Me }) {
  const t = useMessages(messages)
  const { setMe } = useApp()
  const [dlc, setDlc] = useState(user.includeDlcProgress)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDlc(user.includeDlcProgress), [user.includeDlcProgress])
  const change = async (next: boolean) => {
    setDlc(next)
    setSaving(true)
    let saved: { user: Me } | null = null
    try {
      saved = await api<{ user: Me }>('/api/account/preferences', { includeDlcProgress: next })
    } catch (e) {
      setDlc(!next)
      if (!handled(e)) toast(t('preferences.saveFailed'))
    }
    setSaving(false)
    if (!saved) return
    setMe(saved.user)
    setDlc(saved.user.includeDlcProgress)
    toast(
      saved.user.includeDlcProgress ? t('preferences.withDlc') : t('preferences.baseOnly'),
      'success',
    )
    document.dispatchEvent(new Event('preferences:changed'))
  }
  return (
    <div className="card" id="preferences-card">
      <h2>{t('preferences.title')}</h2>
      <label className="setting-row">
        <span className="setting-text">
          <b>{t('preferences.dlc')}</b>
          <small>{t('preferences.dlcHint')}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          id="pref-dlc"
          checked={dlc}
          aria-checked={dlc}
          disabled={saving || user.demo}
          onChange={(e) => change(e.target.checked)}
        />
      </label>
      {user.aiNoticesAvailable && <NoticesSetting user={user} />}
      {user.demo && <DemoNote />}
      <LanguageSetting />
      <div className="setting-row">
        <span className="setting-text">
          <b>{t('preferences.intro')}</b>
          <small>{t('preferences.introHint')}</small>
        </span>
        <button
          type="button"
          className="ghost sm"
          onClick={() => document.dispatchEvent(new Event(OPEN_ONBOARDING))}
        >
          <Icon name="play" /> {t('preferences.introOpen')}
        </button>
      </div>
    </div>
  )
}

// One of the inline account forms: hidden behind its open button, reset on cancel.
function useAccountPanel(form: AuthForm) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) first.current?.focus()
  }, [open])
  const close = () => {
    form.reset()
    setOpen(false)
    setError('')
  }
  const onError = (e: unknown) => setError(friendly(e) ?? t('saveFailed'))
  return { open, setOpen, error, first, close, onError }
}

function PanelError({ error }: { error: string }) {
  return (
    <p className="auth-error" data-error role="alert" hidden={!error}>
      {error}
    </p>
  )
}

function PanelActions({
  form,
  busyLabel,
  danger,
  onClose,
  children,
}: {
  form: AuthForm
  busyLabel: string
  danger?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const t = useMessages(messages)
  return (
    <div className="chips">
      <SubmitButton form={form} busyLabel={busyLabel} className={danger ? 'sm danger' : 'sm'}>
        {children}
      </SubmitButton>
      <button type="button" className="ghost sm" data-close onClick={onClose}>
        {t('cancel')}
      </button>
    </div>
  )
}

function AccountCard({ user, onEditing }: { user: Me; onEditing?: (editing: boolean) => void }) {
  const t = useMessages(messages)
  const pwForm = useAuthForm(['current', 'password', 'again'])
  const pw = useAccountPanel(pwForm)
  const delForm = useAuthForm(['confirm'], user.onlineId)
  const delPanel = useAccountPanel(delForm)
  const editing = pw.open || delPanel.open
  useEffect(() => onEditing?.(editing), [editing, onEditing])

  const changePassword = async () => {
    await api('/api/account/password', {
      current: pwForm.value('current'),
      next: pwForm.value('password'),
    })
    pw.close()
    toast(t('password.changed'), 'success')
  }
  // Stays busy until the page reloads into the login screen.
  // Ends the session only when the server confirms it: otherwise the session stays alive there and
  // a reload would sign the player back in. On a failure the player stays, told why.
  const [leaving, setLeaving] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const logout = async () => {
    setLeaving(true)
    setLogoutFailed(false)
    try {
      await api('/api/auth/logout', {})
      restart()
    } catch {
      setLeaving(false)
      setLogoutFailed(true)
    }
  }

  return (
    <div className="card account-card">
      <h2>{t('title')}</h2>
      <div className="account-id">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" />
        ) : (
          <span className="account-avatar-empty">
            <Icon name="gamepad" />
          </span>
        )}
        <div>
          <b>{user.onlineId}</b>
          <small>{t('psnId')}</small>
        </div>
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="ghost sm"
          id="password-open"
          hidden={pw.open}
          disabled={user.demo}
          onClick={() => pw.setOpen(true)}
        >
          {t('password.open')}
        </button>
        <button
          type="button"
          className="ghost sm"
          id="logout"
          disabled={leaving}
          aria-busy={leaving}
          onClick={logout}
        >
          {leaving ? t('leaving') : t('logout')}
        </button>
      </div>
      {logoutFailed && (
        <p className="auth-error" role="alert">
          {t('logoutFailed')}
        </p>
      )}
      {user.demo && <DemoNote />}
      <form
        className="auth-form account-form"
        id="password-form"
        hidden={!pw.open}
        noValidate
        onSubmit={pwForm.submit(changePassword, pw.onError)}
      >
        <PasswordInput
          id="pw-current"
          label={t('password.current')}
          autoComplete="current-password"
          field={pwForm.input('current')}
          inputRef={pw.first}
        />
        <NewPasswordFields prefix="pw" label={t('password.new')} form={pwForm} />
        <PanelError error={pw.error} />
        <PanelActions form={pwForm} busyLabel={t('password.busy')} onClose={pw.close}>
          {t('password.submit')}
        </PanelActions>
      </form>
      <div className="danger-zone">
        <button
          type="button"
          className="text-danger"
          id="delete-open"
          hidden={delPanel.open}
          disabled={user.demo}
          onClick={() => delPanel.setOpen(true)}
        >
          {t('delete.open')}
        </button>
        <form
          className="auth-form account-form"
          id="delete-form"
          hidden={!delPanel.open}
          noValidate
          onSubmit={delForm.submit(async () => {
            await deleteAccount(delForm.value('confirm').trim())
            restart()
          }, delPanel.onError)}
        >
          <p className="muted">{t('delete.lead')}</p>
          <label htmlFor="delete-confirm">
            {t('delete.typeBefore')}
            <b>{user.onlineId}</b>
            {t('delete.typeAfter')}
          </label>
          <input
            id="delete-confirm"
            ref={delPanel.first}
            data-expect={user.onlineId}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            {...delForm.input('confirm')}
          />
          <PanelError error={delPanel.error} />
          <PanelActions form={delForm} busyLabel={t('delete.busy')} danger onClose={delPanel.close}>
            {t('delete.submit')}
          </PanelActions>
        </form>
      </div>
    </div>
  )
}

/**
 * @param onChanged  the account changed on the server (Telegram unlinked); reload the page's data
 * @param onEditing  a password or deletion form opened or closed, so background refreshes can wait
 */
export function AccountCards({
  user,
  onChanged,
  onEditing,
}: {
  user: Me
  onChanged: () => void
  onEditing?: (editing: boolean) => void
}) {
  return (
    <>
      <TelegramCard user={user} onChanged={onChanged} />
      <PreferencesCard user={user} />
      <AccountCard user={user} onEditing={onEditing} />
    </>
  )
}

export function AccountSkeleton() {
  const t = useMessages(messages)
  return (
    <>
      <div className="card">
        <h2 className="telegram-title">
          <Sk w="26px" h={26} style={{ borderRadius: '50%', flex: 'none' }} />
          Telegram
        </h2>
        <Sk w="92%" h={12} />
        <Sk w="70%" h={12} style={{ marginTop: 8 }} />
        <Sk w="150px" h={36} style={{ marginTop: 18, borderRadius: 'var(--radius-control)' }} />
      </div>
      <div className="card">
        <h2>{t('title')}</h2>
        <div className="account-id">
          <Sk w="44px" h={44} style={{ borderRadius: '50%', flex: 'none' }} />
          <div className="grow">
            <Sk w="40%" h={14} />
            <Sk w="60%" h={10} style={{ marginTop: 6 }} />
          </div>
        </div>
        <div className="chips" style={{ marginTop: 16 }}>
          <Sk w="110px" h={36} style={{ borderRadius: 'var(--radius-control)' }} />
          <Sk w="60px" h={36} style={{ borderRadius: 'var(--radius-control)' }} />
        </div>
        <Sk w="120px" h={12} style={{ marginTop: 28 }} />
      </div>
    </>
  )
}
