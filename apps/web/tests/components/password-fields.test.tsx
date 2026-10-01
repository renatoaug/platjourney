import { expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useAuthForm } from '../../src/components/auth/use-auth-form'
import {
  NewPasswordFields,
  PasswordInput,
  SubmitButton,
} from '../../src/components/password-fields'

// The change-password form from the stories: current password, the new one twice, and submit.
function ChangePassword({
  onSave,
  inputRef,
}: {
  onSave: () => Promise<void>
  inputRef?: (el: HTMLInputElement | null) => void
}) {
  const form = useAuthForm(['current', 'password', 'again'])
  return (
    <form noValidate onSubmit={form.submit(onSave, () => {})}>
      <PasswordInput
        id="s-current"
        label="Senha atual"
        autoComplete="current-password"
        field={form.input('current')}
        inputRef={inputRef}
      />
      <NewPasswordFields prefix="s" label="Nova senha" form={form} />
      <SubmitButton form={form} busyLabel="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  )
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const rule = (name: string) => document.querySelector(`[data-rule="${name}"]`) as HTMLElement

test('the eye shows and hides the password, keeping the cursor in the field', () => {
  const ref = mock()
  render(<ChangePassword onSave={async () => {}} inputRef={ref} />)
  expect(ref).toHaveBeenCalledWith(field('Senha atual'))
  expect(field('Senha atual').type).toBe('password')
  const [eye] = screen.getAllByRole('button', { name: 'Mostrar senha' })
  fireEvent.click(eye)
  expect(field('Senha atual').type).toBe('text')
  expect(eye.getAttribute('aria-pressed')).toBe('true')
  expect(eye.getAttribute('aria-label')).toBe('Esconder senha')
  expect(document.activeElement === field('Senha atual')).toBe(true)
  fireEvent.click(eye)
  expect(field('Senha atual').type).toBe('password')
})

test('the rules tick off as the new password is typed', () => {
  render(<ChangePassword onSave={async () => {}} />)
  expect(rule('length').className).toBe('')
  type('Nova senha', 'segredo123')
  expect(rule('length').className).toBe('met')
  expect(rule('match').className).toBe('')
  type('Repita a senha', 'segredo123')
  expect(rule('match').className).toBe('met')
})

test('a field turns red only after the person leaves it', () => {
  render(<ChangePassword onSave={async () => {}} />)
  type('Nova senha', 'curta')
  expect(field('Nova senha').getAttribute('aria-invalid')).toBe('false')
  fireEvent.blur(field('Nova senha'))
  expect(field('Nova senha').getAttribute('aria-invalid')).toBe('true')
})

test('submit stays locked until every field passes, then shows its busy label', async () => {
  let finish = () => {}
  const onSave = mock(() => new Promise<void>((r) => (finish = r)))
  render(<ChangePassword onSave={onSave} />)
  const submit = screen.getByRole('button', { name: 'Salvar nova senha' })
  expect(submit.hasAttribute('disabled')).toBe(true)
  type('Senha atual', 'antiga')
  type('Nova senha', 'segredo123')
  type('Repita a senha', 'segredo123')
  expect(submit.hasAttribute('disabled')).toBe(false)
  fireEvent.click(submit)
  expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeTruthy()
  finish()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeTruthy(),
  )
  expect(onSave).toHaveBeenCalledTimes(1)
})
