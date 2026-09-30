/** Login and account claim flow, with password rules and form validation. */
import { Fragment, useEffect, useRef, useState } from 'react'
import { AuthLayout } from '../components/auth/auth-layout'
import {
  type AccountStatus,
  type Claim,
  ClaimStep,
  LookupStep,
  OfflineStep,
  PasswordStep,
  PrivateStep,
  RegisterStep,
} from '../components/auth/login-steps'
import { defineMessages, Language, translator } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import type { Me } from '../lib/types'

const messages = defineMessages({
  [Language.PtBR]: {
    serverDown: 'Não conseguimos falar com o servidor. Tente de novo.',
    stillPrivate: 'Ainda aparece privado. A PSN pode levar alguns minutos para atualizar.',
    codeFailed: 'Não conseguimos gerar o código.',
  },
  [Language.En]: {
    serverDown: 'We could not reach the server. Try again.',
    stillPrivate: 'It still shows as private. PSN can take a few minutes to update.',
    codeFailed: 'We could not create the code.',
  },
})
const t = translator(messages)

const friendly = (e: unknown) => (e instanceof ApiError ? e.friendly : undefined)

export function Login({
  offline = false,
  onSignedIn,
}: {
  offline?: boolean
  onSignedIn: (me: Me) => void
}) {
  // account: once the PSN id is known. claim: the pending code while proving the profile is theirs.
  const [account, setAccount] = useState<AccountStatus | null>(null)
  const [claim, setClaim] = useState<Claim | null>(null)
  // Every change redraws the step from scratch (fresh fields, focus on the first), like a new page.
  const [view, setView] = useState({ message: '', key: 0 })
  const stepRef = useRef<HTMLDivElement>(null)
  const scrollToStep = useRef(false)

  const show = (message = '') => setView((v) => ({ message, key: v.key + 1 }))

  // After "Voltar para entrar" the redrawn step is brought back into view.
  useEffect(() => {
    if (!scrollToStep.current) return
    scrollToStep.current = false
    stepRef.current?.scrollIntoView({ block: 'start' })
  })

  // Steps redraw on failure, with the server's message.
  const fail = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : undefined
    if (code === 'no_pending_verification') setClaim(null)
    if (code === 'taken') setAccount((a) => a && { ...a, status: 'registered' })
    show(friendly(e) ?? t('serverDown'))
  }

  const back = () => {
    setAccount(null)
    setClaim(null)
    show()
  }

  const signIn = async (path: string, body: Record<string, unknown>) => {
    const r = await api<{ user: Me }>(path, body)
    onSignedIn(r.user)
  }

  const lookup = (onlineId: string) => api<AccountStatus>('/api/auth/lookup', { onlineId })

  const step = () => {
    if (offline) return <OfflineStep />
    if (!account)
      return (
        <LookupStep
          message={view.message}
          onFail={fail}
          onDemo={() => signIn('/api/auth/demo', {})}
          onLookup={async (onlineId) => {
            setAccount(await lookup(onlineId))
            show()
          }}
        />
      )
    const onlineId = account.onlineId
    if (claim)
      return (
        <ClaimStep
          account={account}
          claim={claim}
          message={view.message}
          onFail={fail}
          onBack={back}
          onReturn={() => {
            setClaim(null)
            scrollToStep.current = true
            show()
          }}
          onFinish={(password, fresh) =>
            signIn('/api/auth/claim/finish', { onlineId, password, fresh })
          }
        />
      )
    if (account.status === 'new' && account.trophiesPrivate)
      return (
        <PrivateStep
          account={account}
          message={view.message}
          onFail={fail}
          onBack={back}
          onRecheck={async () => {
            const next = await lookup(onlineId)
            setAccount(next)
            show(next.trophiesPrivate ? t('stillPrivate') : '')
          }}
        />
      )
    if (account.status === 'new')
      return (
        <RegisterStep
          account={account}
          message={view.message}
          onFail={fail}
          onBack={back}
          onRegister={(password) => signIn('/api/auth/register', { onlineId, password })}
        />
      )
    return (
      <PasswordStep
        account={account}
        message={view.message}
        onFail={fail}
        onBack={back}
        onLogin={(password) => signIn('/api/auth/login', { onlineId, password })}
        onClaim={() =>
          api<Claim>('/api/auth/claim', { onlineId })
            .then((c) => {
              setClaim(c)
              show()
            })
            .catch((e) => show(friendly(e) ?? t('codeFailed')))
        }
      />
    )
  }

  return (
    <AuthLayout stepRef={stepRef}>
      <Fragment key={view.key}>{step()}</Fragment>
    </AuthLayout>
  )
}
