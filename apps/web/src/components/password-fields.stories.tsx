import type { Meta, StoryObj } from '@storybook/react-vite'
import { useAuthForm } from './auth/use-auth-form'
import { NewPasswordFields, PasswordInput, SubmitButton } from './password-fields'

const meta: Meta = { title: 'Auth/Password fields' }
export default meta
type Story = StoryObj

function ChangePassword({ busy = false }: { busy?: boolean }) {
  const form = useAuthForm(['current', 'password', 'again'])
  return (
    <form
      className="auth-form"
      noValidate
      style={{ maxWidth: 380 }}
      onSubmit={form.submit(
        () => (busy ? new Promise<void>(() => {}) : Promise.resolve()),
        () => {},
      )}
    >
      <PasswordInput
        id="s-current"
        label="Senha atual"
        autoComplete="current-password"
        field={form.input('current')}
      />
      <NewPasswordFields prefix="s" label="Nova senha" form={form} />
      <SubmitButton form={form} busyLabel="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  )
}

/** Type to see the rules tick off; leave a field to see it turn red. */
export const Interactive: Story = { render: () => <ChangePassword /> }

/** Submitting keeps the busy label (the request never finishes here). */
export const Busy: Story = { render: () => <ChangePassword busy /> }
