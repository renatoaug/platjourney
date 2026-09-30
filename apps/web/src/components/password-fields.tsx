/** Password inputs with the show/hide eye, the new-password pair with live rules, and the submit button with its busy label. */
import { type ReactNode, type Ref, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import { type AuthForm, type FieldProps, MIN_PASSWORD } from './auth/use-auth-form'

const messages = defineMessages({
  [Language.PtBR]: {
    show: 'Mostrar senha',
    hide: 'Esconder senha',
    again: 'Repita a senha',
    length: {
      one: 'Pelo menos {count} caractere',
      other: 'Pelo menos {count} caracteres',
    },
    match: 'As duas senhas iguais',
  },
  [Language.En]: {
    show: 'Show password',
    hide: 'Hide password',
    again: 'Repeat the password',
    length: {
      one: 'At least {count} character',
      other: 'At least {count} characters',
    },
    match: 'Both passwords match',
  },
})

export function PasswordInput({
  id,
  label,
  autoComplete,
  field,
  inputRef,
}: {
  id: string
  label: string
  autoComplete: string
  field: FieldProps
  inputRef?: Ref<HTMLInputElement>
}) {
  const t = useMessages(messages)
  const [shown, setShown] = useState(false)
  const own = useRef<HTMLInputElement | null>(null)
  const setRef = (el: HTMLInputElement | null) => {
    own.current = el
    if (typeof inputRef === 'function') inputRef(el)
    else if (inputRef) inputRef.current = el
  }
  const tip = shown ? t('hide') : t('show')
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input
          id={id}
          ref={setRef}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          maxLength={200}
          required
          {...field}
        />
        <button
          type="button"
          className="auth-eye"
          aria-label={tip}
          aria-pressed={shown}
          data-tip={tip}
          onClick={() => {
            setShown(!shown)
            own.current?.focus()
          }}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} />
        </button>
      </div>
    </>
  )
}

/** A new password is typed twice, with the rules ticking off as they are met. */
export function NewPasswordFields({
  prefix,
  label,
  form,
  inputRef,
}: {
  prefix: string
  label: string
  form: AuthForm
  inputRef?: Ref<HTMLInputElement>
}) {
  const t = useMessages(messages)
  return (
    <>
      <PasswordInput
        id={`${prefix}-password`}
        label={label}
        autoComplete="new-password"
        field={form.input('password')}
        inputRef={inputRef}
      />
      <PasswordInput
        id={`${prefix}-again`}
        label={t('again')}
        autoComplete="new-password"
        field={form.input('again')}
      />
      <ul className="auth-rules" aria-live="polite">
        <li data-rule="length" className={form.rules.length ? 'met' : undefined}>
          <Icon name="check" />
          {t('length', { count: MIN_PASSWORD })}
        </li>
        <li data-rule="match" className={form.rules.match ? 'met' : undefined}>
          <Icon name="check" />
          {t('match')}
        </li>
      </ul>
    </>
  )
}

/** Locked until the form is valid; shows `busyLabel` while the request runs. */
export function SubmitButton({
  form,
  busyLabel,
  className,
  children,
}: {
  form: AuthForm
  busyLabel: string
  className?: string
  children: ReactNode
}) {
  return (
    <button type="submit" className={className} disabled={form.busy || !form.valid}>
      {form.busy ? busyLabel : children}
    </button>
  )
}
