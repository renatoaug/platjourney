/** Validation and busy state shared by the sign-in steps and the account forms. */
import { type ChangeEvent, type FormEvent, useState } from 'react'

export const PSN_ID = /^[A-Za-z0-9_-]{3,16}$/

export const MIN_PASSWORD = 8

// psn: a PSN id; confirm: must equal `expect`; current: an existing password;
// password: a new one; again: the new one repeated.
export type FieldName = 'psn' | 'confirm' | 'current' | 'password' | 'again'

// Only these turn red; the others just keep the submit locked.
const MARKED: FieldName[] = ['psn', 'password', 'again']

export interface FieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  'data-field': FieldName
  'aria-invalid'?: boolean
}

export type AuthForm = ReturnType<typeof useAuthForm>

/** Checks every field and keeps the submit locked until all pass. A field only turns red after the person left it. */
export function useAuthForm(fields: FieldName[], expect = '') {
  const [values, setValues] = useState<Partial<Record<FieldName, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [busy, setBusy] = useState(false)
  const value = (name: FieldName) => values[name] ?? ''
  const checks: Record<FieldName, boolean> = {
    psn: PSN_ID.test(value('psn').trim()),
    confirm: value('confirm').trim().toLowerCase() === expect.toLowerCase(),
    current: value('current').length > 0,
    password: value('password').length >= MIN_PASSWORD,
    again: value('again') !== '' && value('again') === value('password'),
  }
  const valid = fields.every((name) => checks[name])
  const complain = (name: FieldName) =>
    !checks[name] && touched[name] === true && value(name) !== ''

  const input = (name: FieldName): FieldProps => ({
    value: value(name),
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    'data-field': name,
    ...(MARKED.includes(name) ? { 'aria-invalid': complain(name) } : {}),
  })

  // Locks the button with its busy label while `request` runs; a failure goes to onError.
  const submit =
    (request: () => Promise<void>, onError: (e: unknown) => void) => async (event: FormEvent) => {
      event.preventDefault()
      if (!valid || busy) return
      setBusy(true)
      try {
        await request()
      } catch (e) {
        setBusy(false)
        onError(e)
        return
      }
      setBusy(false)
    }

  const reset = () => {
    setValues({})
    setTouched({})
  }

  return {
    value,
    input,
    complain,
    rules: { length: checks.password, match: checks.again },
    valid,
    busy,
    submit,
    reset,
  }
}
