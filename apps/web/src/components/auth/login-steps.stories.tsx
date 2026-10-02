import type { Meta, StoryObj } from '@storybook/react-vite'
import { Language } from '../../i18n/i18n'
import { AuthLayout } from './auth-layout'
import {
  type AccountStatus,
  ClaimStep,
  LookupStep,
  OfflineStep,
  PasswordStep,
  PrivateStep,
  RegisterStep,
} from './login-steps'

const meta: Meta = { title: 'Auth/Login steps', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

const registered: AccountStatus = {
  onlineId: 'kratos_br',
  avatarUrl: '/nexo-avatar.svg',
  status: 'registered',
  trophiesPrivate: false,
}
const fresh: AccountStatus = { ...registered, status: 'new' }
const claim = { onlineId: 'kratos_br', code: 'PJ-4821', minutes: 30 }
const wait = () => new Promise<void>(() => {})
const noop = () => {}

export const Lookup: Story = {
  render: () => (
    <AuthLayout>
      <LookupStep message="" onLookup={wait} onFail={noop} />
    </AuthLayout>
  ),
}

/** With the demo action under the form, as the sign-in screen shows it. */
export const LookupWithDemo: Story = {
  render: () => (
    <AuthLayout>
      <LookupStep message="" onLookup={wait} onDemo={wait} onFail={noop} />
    </AuthLayout>
  ),
}

export const LookupWithDemoEnglish: Story = { ...LookupWithDemo, globals: { locale: Language.En } }

export const LookupError: Story = {
  render: () => (
    <AuthLayout>
      <LookupStep message="Não encontramos esse PSN ID." onLookup={wait} onFail={noop} />
    </AuthLayout>
  ),
}

export const Password: Story = {
  render: () => (
    <AuthLayout>
      <PasswordStep
        account={registered}
        message=""
        onLogin={wait}
        onClaim={noop}
        onBack={noop}
        onFail={noop}
      />
    </AuthLayout>
  ),
}

export const WrongPassword: Story = {
  render: () => (
    <AuthLayout>
      <PasswordStep
        account={registered}
        message="Senha incorreta."
        onLogin={wait}
        onClaim={noop}
        onBack={noop}
        onFail={noop}
      />
    </AuthLayout>
  ),
}

export const Register: Story = {
  render: () => (
    <AuthLayout>
      <RegisterStep account={fresh} message="" onRegister={wait} onBack={noop} onFail={noop} />
    </AuthLayout>
  ),
}

export const TrophiesPrivate: Story = {
  render: () => (
    <AuthLayout>
      <PrivateStep
        account={{ ...fresh, trophiesPrivate: true }}
        message="Ainda aparece privado. A PSN pode levar alguns minutos para atualizar."
        onRecheck={wait}
        onBack={noop}
        onFail={noop}
      />
    </AuthLayout>
  ),
}

export const Claim: Story = {
  render: () => (
    <AuthLayout>
      <ClaimStep
        account={registered}
        claim={claim}
        message=""
        onFinish={wait}
        onReturn={noop}
        onBack={noop}
        onFail={noop}
      />
    </AuthLayout>
  ),
}

export const Offline: Story = {
  render: () => (
    <AuthLayout>
      <OfflineStep />
    </AuthLayout>
  ),
}
