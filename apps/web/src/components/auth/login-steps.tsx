/** The sign-in steps: find the PSN id, then log in, create the account, open the trophies, or claim the profile with a code. */
import { useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { Icon } from '../../ui/icon'
import { toast } from '../../ui/toast'
import { NewPasswordFields, PasswordInput, SubmitButton } from '../password-fields'
import { PrivacySteps } from '../private-notice'
import { useAuthForm } from './use-auth-form'
import './auth-layout.css'
import './login-steps.css'

const messages = defineMessages({
  [Language.PtBR]: {
    back: 'Usar outro PSN ID',
    lookup: {
      titleTop: 'Vamos continuar',
      titleBottom: 'sua jornada?',
      lead: 'Informe seu ID da PlayStation Network para encontrar seu perfil.',
      label: 'Seu PSN ID',
      placeholder: 'ex.: kratos_br',
      hint: 'De 3 a 16 caracteres: letras, números, hífen e sublinhado.',
      busy: 'Procurando perfil…',
      submit: 'Continuar',
      or: 'Sem conta na PSN, ou só quer conhecer?',
      demo: 'Ver demonstração',
      demoBusy: 'Abrindo a demonstração…',
    },
    password: {
      title: 'Bom ter você de volta.',
      lead: 'Entre com sua senha do PlatJourney.',
      sub: 'Perfil PlayStation',
      label: 'Senha do PlatJourney',
      busy: 'Entrando…',
      submit: 'Entrar',
      claim: 'Esqueci a senha, ou este perfil é meu',
    },
    register: {
      sub: 'Primeira vez por aqui. Crie uma senha.',
      label: 'Crie uma senha',
      busy: 'Criando sua conta…',
      submit: 'Criar conta',
    },
    private: {
      sub: 'Seus troféus estão privados.',
      lead: 'O Nexo precisa ver seus troféus para funcionar. Deixe a lista pública e tente de novo:',
      busy: 'Conferindo…',
      submit: 'Já deixei público',
    },
    claim: {
      copied: 'Código copiado',
      return: 'Voltar para entrar',
      sub: 'Confirme que o perfil é seu.',
      copy: 'Copie o código',
      copyTip: 'Copiar',
      pasteBefore: 'Na PSN, abra ',
      pastePath: 'Perfil → Editar perfil → Sobre mim',
      pasteAfter: ', cole o código e salve',
      choose: 'Escolha a nova senha e confirme',
      label: 'Nova senha',
      fresh: 'Começar do zero: apagar conversa, interesses e histórico desta conta',
      busy: 'Conferindo seu perfil…',
      submit: 'Já colei, confirmar',
      validity: {
        one: 'O código vale por {count} minuto. Depois de entrar você pode apagar do perfil.',
        other: 'O código vale por {count} minutos. Depois de entrar você pode apagar do perfil.',
      },
    },
  },
  [Language.En]: {
    back: 'Use another PSN ID',
    lookup: {
      titleTop: 'Shall we continue',
      titleBottom: 'your journey?',
      lead: 'Enter your PlayStation Network ID to find your profile.',
      label: 'Your PSN ID',
      placeholder: 'e.g. kratos_br',
      hint: '3 to 16 characters: letters, numbers, hyphen and underscore.',
      busy: 'Looking for your profile…',
      submit: 'Continue',
      or: 'No PSN account, or just looking around?',
      demo: 'See a demo',
      demoBusy: 'Opening the demo…',
    },
    password: {
      title: 'Good to have you back.',
      lead: 'Sign in with your PlatJourney password.',
      sub: 'PlayStation profile',
      label: 'PlatJourney password',
      busy: 'Signing in…',
      submit: 'Sign in',
      claim: 'I forgot my password, or this profile is mine',
    },
    register: {
      sub: 'First time here. Create a password.',
      label: 'Create a password',
      busy: 'Creating your account…',
      submit: 'Create account',
    },
    private: {
      sub: 'Your trophies are private.',
      lead: 'Nexo needs to see your trophies to work. Make the list public and try again:',
      busy: 'Checking…',
      submit: 'I made it public',
    },
    claim: {
      copied: 'Code copied',
      return: 'Back to sign in',
      sub: 'Confirm the profile is yours.',
      copy: 'Copy the code',
      copyTip: 'Copy',
      pasteBefore: 'On PSN, open ',
      pastePath: 'Profile → Edit profile → About me',
      pasteAfter: ', paste the code and save',
      choose: 'Choose the new password and confirm',
      label: 'New password',
      fresh: 'Start fresh: delete this account’s chat, interests and history',
      busy: 'Checking your profile…',
      submit: 'Pasted it, confirm',
      validity: {
        one: 'The code is valid for {count} minute. Once you are in, you can remove it from your profile.',
        other:
          'The code is valid for {count} minutes. Once you are in, you can remove it from your profile.',
      },
    },
  },
})

/** /api/auth/lookup */
export interface AccountStatus {
  onlineId: string
  avatarUrl?: string
  status: 'new' | 'registered'
  trophiesPrivate: boolean
}

/** /api/auth/claim: the code to paste on the PSN profile. */
export interface Claim {
  onlineId: string
  avatarUrl?: string
  code: string
  minutes: number
  skipVerification?: boolean
}

type Fail = (e: unknown) => void

function AuthError({ message }: { message: string }) {
  if (!message) return null
  return (
    <p className="auth-error" role="alert">
      {message}
    </p>
  )
}

function AuthWho({ account: a, sub }: { account: AccountStatus; sub: string }) {
  return (
    <div className="auth-who">
      <img src={a.avatarUrl || undefined} alt="" />
      <div>
        <b>{a.onlineId}</b>
        <small>{sub}</small>
      </div>
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useMessages(messages)
  return (
    <button type="button" className="ghost" id="auth-back" onClick={onBack}>
      {t('back')}
    </button>
  )
}

// Each step puts the cursor in its first field when it appears, except on a touch screen, where
// focusing would open the keyboard over the screen before the player chose to type.
function useFocus() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) ref.current?.focus()
  }, [])
  return ref
}

// The browser's password manager needs the account name next to the password.
const Username = ({ id }: { id: string }) => (
  <input type="text" autoComplete="username" value={id} hidden readOnly />
)

/** Opens the read-only demo player, for anyone without a PSN account to connect. */
function DemoAction({ onDemo, onFail }: { onDemo: () => Promise<void>; onFail: Fail }) {
  const t = useMessages(messages)
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      await onDemo()
    } catch (e) {
      setBusy(false)
      onFail(e)
    }
  }
  return (
    <div className="auth-demo">
      <span className="muted">{t('lookup.or')}</span>
      <button
        type="button"
        className="ghost"
        id="auth-demo"
        disabled={busy}
        aria-busy={busy}
        onClick={open}
      >
        <Icon name="play" /> {busy ? t('lookup.demoBusy') : t('lookup.demo')}
      </button>
    </div>
  )
}

export function LookupStep({
  message,
  onLookup,
  onDemo,
  onFail,
}: {
  message: string
  onLookup: (onlineId: string) => Promise<void>
  /** Signs in as the demo player; without it the step has no demo action. */
  onDemo?: () => Promise<void>
  onFail: Fail
}) {
  const t = useMessages(messages)
  const form = useAuthForm(['psn'])
  const focus = useFocus()
  return (
    <>
      <h1>
        {t('lookup.titleTop')}
        <br />
        {t('lookup.titleBottom')}
      </h1>
      <p className="muted">{t('lookup.lead')}</p>
      <form
        id="auth-form"
        className="auth-form"
        noValidate
        onSubmit={form.submit(() => onLookup(form.value('psn').trim()), onFail)}
      >
        <label htmlFor="auth-id">{t('lookup.label')}</label>
        <input
          id="auth-id"
          ref={focus}
          name="psn"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={16}
          placeholder={t('lookup.placeholder')}
          required
          {...form.input('psn')}
        />
        <p className="auth-error" data-hint="psn" hidden={!form.complain('psn')}>
          {t('lookup.hint')}
        </p>
        <AuthError message={message} />
        <SubmitButton form={form} busyLabel={t('lookup.busy')}>
          {t('lookup.submit')}
        </SubmitButton>
      </form>
      {onDemo && <DemoAction onDemo={onDemo} onFail={onFail} />}
    </>
  )
}

export function PasswordStep({
  account,
  message,
  onLogin,
  onClaim,
  onBack,
  onFail,
}: {
  account: AccountStatus
  message: string
  onLogin: (password: string) => Promise<void>
  onClaim: () => void
  onBack: () => void
  onFail: Fail
}) {
  const t = useMessages(messages)
  const form = useAuthForm(['current'])
  const focus = useFocus()
  return (
    <>
      <h1>{t('password.title')}</h1>
      <p className="muted">{t('password.lead')}</p>
      <AuthWho account={account} sub={t('password.sub')} />
      <form
        id="auth-form"
        className="auth-form"
        noValidate
        onSubmit={form.submit(() => onLogin(form.value('current')), onFail)}
      >
        <Username id={account.onlineId} />
        <PasswordInput
          id="auth-password"
          label={t('password.label')}
          autoComplete="current-password"
          field={form.input('current')}
          inputRef={focus}
        />
        <AuthError message={message} />
        <SubmitButton form={form} busyLabel={t('password.busy')}>
          {t('password.submit')}
        </SubmitButton>
      </form>
      <button type="button" className="ghost" id="auth-claim" onClick={onClaim}>
        {t('password.claim')}
      </button>
      <BackButton onBack={onBack} />
    </>
  )
}

export function RegisterStep({
  account,
  message,
  onRegister,
  onBack,
  onFail,
}: {
  account: AccountStatus
  message: string
  onRegister: (password: string) => Promise<void>
  onBack: () => void
  onFail: Fail
}) {
  const t = useMessages(messages)
  const form = useAuthForm(['password', 'again'])
  const focus = useFocus()
  return (
    <>
      <AuthWho account={account} sub={t('register.sub')} />
      <form
        id="auth-form"
        className="auth-form"
        noValidate
        onSubmit={form.submit(() => onRegister(form.value('password')), onFail)}
      >
        <Username id={account.onlineId} />
        <NewPasswordFields prefix="auth" label={t('register.label')} form={form} inputRef={focus} />
        <AuthError message={message} />
        <SubmitButton form={form} busyLabel={t('register.busy')}>
          {t('register.submit')}
        </SubmitButton>
      </form>
      <BackButton onBack={onBack} />
    </>
  )
}

export function PrivateStep({
  account,
  message,
  onRecheck,
  onBack,
  onFail,
}: {
  account: AccountStatus
  message: string
  onRecheck: () => Promise<void>
  onBack: () => void
  onFail: Fail
}) {
  const t = useMessages(messages)
  const form = useAuthForm([])
  return (
    <>
      <AuthWho account={account} sub={t('private.sub')} />
      <p className="muted">{t('private.lead')}</p>
      <PrivacySteps />
      <form
        id="auth-form"
        className="auth-form"
        noValidate
        onSubmit={form.submit(onRecheck, onFail)}
      >
        <AuthError message={message} />
        <SubmitButton form={form} busyLabel={t('private.busy')}>
          {t('private.submit')}
        </SubmitButton>
      </form>
      <BackButton onBack={onBack} />
    </>
  )
}

export function ClaimStep({
  account,
  claim,
  message,
  onFinish,
  onReturn,
  onBack,
  onFail,
}: {
  account: AccountStatus
  claim: Claim
  message: string
  onFinish: (password: string, fresh: boolean) => Promise<void>
  onReturn: () => void
  onBack: () => void
  onFail: Fail
}) {
  const t = useMessages(messages)
  const form = useAuthForm(['password', 'again'])
  const [fresh, setFresh] = useState(false)
  const focus = useFocus()
  const copy = async () => {
    await navigator.clipboard?.writeText(claim.code).catch(() => {})
    toast(t('claim.copied'), 'info')
  }
  return (
    <>
      <button type="button" className="ghost auth-return" id="auth-return" onClick={onReturn}>
        <Icon name="chevron-down" /> {t('claim.return')}
      </button>
      <AuthWho account={account} sub={t('claim.sub')} />
      <ol className="auth-steps">
        <li>
          {t('claim.copy')}
          <button
            type="button"
            className="auth-code"
            id="auth-copy"
            data-tip={t('claim.copyTip')}
            onClick={copy}
          >
            {claim.code}
            <Icon name="copy" />
          </button>
        </li>
        <li>
          {t('claim.pasteBefore')}
          <b>{t('claim.pastePath')}</b>
          {t('claim.pasteAfter')}
        </li>
        <li>{t('claim.choose')}</li>
      </ol>
      <form
        id="auth-form"
        className="auth-form"
        noValidate
        onSubmit={form.submit(() => onFinish(form.value('password'), fresh), onFail)}
      >
        <NewPasswordFields prefix="auth" label={t('claim.label')} form={form} inputRef={focus} />
        {account.status === 'registered' && (
          <label className="auth-check">
            <input
              type="checkbox"
              id="auth-fresh"
              checked={fresh}
              onChange={(e) => setFresh(e.target.checked)}
            />{' '}
            {t('claim.fresh')}
          </label>
        )}
        <AuthError message={message} />
        <SubmitButton form={form} busyLabel={t('claim.busy')}>
          {t('claim.submit')}
        </SubmitButton>
      </form>
      <BackButton onBack={onBack} />
      <small className="muted">{t('claim.validity', { count: claim.minutes })}</small>
    </>
  )
}
