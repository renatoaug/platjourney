import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthLayout } from '../../../src/components/auth/auth-layout'
import {
  type AccountStatus,
  ClaimStep,
  LookupStep,
  PasswordStep,
  PrivateStep,
  RegisterStep,
} from '../../../src/components/auth/login-steps'
import { ToastHost } from '../../../src/ui/toast'

// The same accounts the stories use.
const registered: AccountStatus = {
  onlineId: 'kratos_br',
  avatarUrl: '/nexo-avatar.svg',
  status: 'registered',
  trophiesPrivate: false,
}
const fresh: AccountStatus = { ...registered, status: 'new' }
const claim = { onlineId: 'kratos_br', code: 'PJ-4821', minutes: 30 }
const noop = () => {}

const show = (step: ReactNode) =>
  render(
    <>
      <AuthLayout>{step}</AuthLayout>
      <ToastHost />
    </>,
  )

const type = (label: string, value: string) => {
  const input = screen.getByLabelText(label)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

const button = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement

describe('AuthLayout', () => {
  test('frames the step with the story and the footnote', () => {
    show(<h1>Um passo</h1>)
    expect(screen.getByRole('region', { name: 'PlatJourney' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Um passo' })).toBeTruthy()
    expect(screen.getByText(/sem vínculo com a PlayStation/)).toBeTruthy()
  })
})

describe('LookupStep', () => {
  test('a valid PSN id is looked up, trimmed', async () => {
    const onLookup = mock(async () => {})
    show(<LookupStep message="" onLookup={onLookup} onFail={noop} />)
    expect(document.activeElement).toBe(screen.getByLabelText('Seu PSN ID'))
    expect(button('Continuar').disabled).toBe(true)
    type('Seu PSN ID', ' kratos_br ')
    fireEvent.click(button('Continuar'))
    await waitFor(() => expect(onLookup).toHaveBeenCalledWith('kratos_br'))
  })

  test('an invalid id explains the rule once the field is left', () => {
    show(<LookupStep message="" onLookup={async () => {}} onFail={noop} />)
    const hint = screen.getByText(/De 3 a 16 caracteres/)
    expect(hint.hidden).toBe(true)
    type('Seu PSN ID', 'a!')
    expect(hint.hidden).toBe(false)
    expect(screen.getByLabelText('Seu PSN ID').getAttribute('aria-invalid')).toBe('true')
  })

  test('a failed lookup goes to onFail and the message shows', async () => {
    const onFail = mock()
    show(
      <LookupStep
        message="Não encontramos esse PSN ID."
        onLookup={async () => {
          throw new Error('404')
        }}
        onFail={onFail}
      />,
    )
    expect(screen.getByRole('alert').textContent).toBe('Não encontramos esse PSN ID.')
    type('Seu PSN ID', 'kratos_br')
    fireEvent.click(button('Continuar'))
    await waitFor(() => expect(onFail).toHaveBeenCalled())
    expect(button('Continuar').disabled).toBe(false)
  })

  test('the button shows its busy label while looking', async () => {
    show(<LookupStep message="" onLookup={() => new Promise(() => {})} onFail={noop} />)
    type('Seu PSN ID', 'kratos_br')
    fireEvent.click(button('Continuar'))
    expect(await screen.findByRole('button', { name: 'Procurando perfil…' })).toBeTruthy()
  })
})

describe('PasswordStep', () => {
  test('logs in, shows the password on request, and offers the other paths', async () => {
    const onLogin = mock(async () => {})
    const onClaim = mock()
    const onBack = mock()
    show(
      <PasswordStep
        account={registered}
        message="Senha incorreta."
        onLogin={onLogin}
        onClaim={onClaim}
        onBack={onBack}
        onFail={noop}
      />,
    )
    expect(screen.getByText('kratos_br')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Senha incorreta.')
    const password = screen.getByLabelText('Senha do PlatJourney') as HTMLInputElement
    expect(password.type).toBe('password')
    fireEvent.click(button('Mostrar senha'))
    expect(password.type).toBe('text')
    fireEvent.click(button('Esconder senha'))
    type('Senha do PlatJourney', 'segredo')
    fireEvent.click(button('Entrar'))
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('segredo'))
    fireEvent.click(button(/Esqueci a senha/))
    expect(onClaim).toHaveBeenCalled()
    fireEvent.click(button('Usar outro PSN ID'))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('RegisterStep', () => {
  test('creates the account once both passwords match the rules', async () => {
    const onRegister = mock(async () => {})
    show(
      <RegisterStep
        account={fresh}
        message=""
        onRegister={onRegister}
        onBack={noop}
        onFail={noop}
      />,
    )
    expect(screen.getByText('Primeira vez por aqui. Crie uma senha.')).toBeTruthy()
    type('Crie uma senha', 'curta')
    expect(screen.getByLabelText('Crie uma senha').getAttribute('aria-invalid')).toBe('true')
    type('Crie uma senha', 'senha-forte')
    type('Repita a senha', 'senha-fraca')
    expect(button('Criar conta').disabled).toBe(true)
    type('Repita a senha', 'senha-forte')
    expect(screen.getByText('As duas senhas iguais').className).toBe('met')
    fireEvent.click(button('Criar conta'))
    await waitFor(() => expect(onRegister).toHaveBeenCalledWith('senha-forte'))
  })
})

describe('PrivateStep', () => {
  test('rechecks the privacy once the player made the list public', async () => {
    const onRecheck = mock(async () => {})
    show(
      <PrivateStep
        account={{ ...fresh, trophiesPrivate: true, avatarUrl: undefined }}
        message="Ainda aparece privado."
        onRecheck={onRecheck}
        onBack={noop}
        onFail={noop}
      />,
    )
    expect(screen.getByText('Seus troféus estão privados.')).toBeTruthy()
    fireEvent.click(button('Já deixei público'))
    await waitFor(() => expect(onRecheck).toHaveBeenCalled())
  })
})

describe('ClaimStep', () => {
  test('copies the code, and a registered account can start fresh', async () => {
    const onFinish = mock(async () => {})
    const onReturn = mock()
    show(
      <ClaimStep
        account={registered}
        claim={claim}
        message=""
        onFinish={onFinish}
        onReturn={onReturn}
        onBack={noop}
        onFail={noop}
      />,
    )
    expect(screen.getByText(/O código vale por 30 minutos/)).toBeTruthy()
    fireEvent.click(button(/PJ-4821/))
    expect(await screen.findByText('Código copiado')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Começar do zero/))
    type('Nova senha', 'senha-nova')
    type('Repita a senha', 'senha-nova')
    fireEvent.click(button('Já colei, confirmar'))
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('senha-nova', true))
    fireEvent.click(button(/Voltar para entrar/))
    expect(onReturn).toHaveBeenCalled()
  })

  test('a new account has no fresh start option', () => {
    show(
      <ClaimStep
        account={fresh}
        claim={claim}
        message=""
        onFinish={async () => {}}
        onReturn={noop}
        onBack={noop}
        onFail={noop}
      />,
    )
    expect(screen.queryByLabelText(/Começar do zero/)).toBeNull()
  })
})
