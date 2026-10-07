import { afterEach, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SAMPLE_ME } from '../../src/app/app-state'
import { Login } from '../../src/pages/login'
import { mockApi, reply } from '../support/web'

afterEach(() => mock.restore())

const registered = { onlineId: 'jogador', status: 'registered', trophiesPrivate: false }
const fresh = { onlineId: 'jogador', status: 'new', trophiesPrivate: false }
const hidden = { onlineId: 'jogador', status: 'new', trophiesPrivate: true }
const claim = { onlineId: 'jogador', code: 'PJ-1234', minutes: 30 }

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

async function lookup() {
  fill('Seu PSN ID', 'jogador')
  press('Continuar')
}

async function newPassword(label: string) {
  fill(label, 'segredo123')
  fill('Repita a senha', 'segredo123')
}

test('a returning player signs in with the password', async () => {
  const onSignedIn = mock()
  const calls = mockApi({
    'POST /api/auth/lookup': registered,
    'POST /api/auth/login': { user: SAMPLE_ME },
  })
  render(<Login onSignedIn={onSignedIn} />)
  await lookup()
  expect(await screen.findByRole('heading', { name: 'Bom ter você de volta.' })).toBeTruthy()
  fill('Senha do PlatJourney', 'segredo123')
  press('Entrar')
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(SAMPLE_ME))
  expect(calls.map((c) => c.body)).toEqual([
    { onlineId: 'jogador' },
    { onlineId: 'jogador', password: 'segredo123' },
  ])
})

test('a wrong password shows the server message on a fresh step', async () => {
  mockApi({
    'POST /api/auth/lookup': registered,
    'POST /api/auth/login': reply(401, { error: 'bad_password', message: 'Senha incorreta.' }),
  })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  await screen.findByLabelText('Senha do PlatJourney')
  fill('Senha do PlatJourney', 'errada')
  press('Entrar')
  expect((await screen.findByRole('alert')).textContent).toBe('Senha incorreta.')
  expect((screen.getByLabelText('Senha do PlatJourney') as HTMLInputElement).value).toBe('')
})

test('a lookup that cannot reach the server says so', async () => {
  mockApi({ 'POST /api/auth/lookup': () => Promise.reject(new TypeError('offline')) })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Não conseguimos falar com o servidor. Tente de novo.',
  )
})

test('"Usar outro PSN ID" goes back to the first step', async () => {
  mockApi({ 'POST /api/auth/lookup': registered })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  await screen.findByLabelText('Senha do PlatJourney')
  press('Usar outro PSN ID')
  expect(screen.getByLabelText('Seu PSN ID')).toBeTruthy()
})

test('a new player creates the account', async () => {
  const onSignedIn = mock()
  const calls = mockApi({
    'POST /api/auth/lookup': fresh,
    'POST /api/auth/register': { user: SAMPLE_ME },
  })
  render(<Login onSignedIn={onSignedIn} />)
  await lookup()
  await screen.findByLabelText('Crie uma senha')
  await newPassword('Crie uma senha')
  press('Criar conta')
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(SAMPLE_ME))
  expect(calls[1]).toMatchObject({
    path: '/api/auth/register',
    body: { onlineId: 'jogador', password: 'segredo123' },
  })
})

test('an id taken meanwhile turns the step into the password one', async () => {
  mockApi({
    'POST /api/auth/lookup': fresh,
    'POST /api/auth/register': reply(409, { error: 'taken', message: 'Esse perfil já tem conta.' }),
  })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  await screen.findByLabelText('Crie uma senha')
  await newPassword('Crie uma senha')
  press('Criar conta')
  expect(await screen.findByRole('heading', { name: 'Bom ter você de volta.' })).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toBe('Esse perfil já tem conta.')
})

test('private trophies: rechecking until the list is public', async () => {
  let lookups = 0
  mockApi({ 'POST /api/auth/lookup': () => (++lookups < 3 ? hidden : fresh) })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  await screen.findByText('Seus troféus estão privados.')
  press('Já deixei público')
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Ainda aparece privado. A PSN pode levar alguns minutos para atualizar.',
  )
  press('Já deixei público')
  expect(await screen.findByLabelText('Crie uma senha')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('claiming the profile with a code sets a new password', async () => {
  const onSignedIn = mock()
  const calls = mockApi({
    'POST /api/auth/lookup': registered,
    'POST /api/auth/claim': claim,
    'POST /api/auth/claim/finish': { user: SAMPLE_ME },
  })
  render(<Login onSignedIn={onSignedIn} />)
  await lookup()
  await screen.findByLabelText('Senha do PlatJourney')
  press('Esqueci a senha, ou este perfil é meu')
  expect(await screen.findByText('PJ-1234')).toBeTruthy()
  await newPassword('Nova senha')
  fireEvent.click(screen.getByLabelText(/Começar do zero/))
  press('Já colei, confirmar')
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(SAMPLE_ME))
  expect(calls.at(-1)?.body).toEqual({ onlineId: 'jogador', password: 'segredo123', fresh: true })
})

test('a code that expired goes back to the password step', async () => {
  mockApi({
    'POST /api/auth/lookup': registered,
    'POST /api/auth/claim': claim,
    'POST /api/auth/claim/finish': reply(400, {
      error: 'no_pending_verification',
      message: 'O código expirou.',
    }),
  })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  await screen.findByLabelText('Senha do PlatJourney')
  press('Esqueci a senha, ou este perfil é meu')
  await screen.findByText('PJ-1234')
  await newPassword('Nova senha')
  press('Já colei, confirmar')
  expect(await screen.findByRole('heading', { name: 'Bom ter você de volta.' })).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toBe('O código expirou.')
})

test('"Voltar para entrar" leaves the claim and scrolls back to the step', async () => {
  const scroll = mock()
  const original = HTMLElement.prototype.scrollIntoView
  HTMLElement.prototype.scrollIntoView = scroll
  try {
    mockApi({ 'POST /api/auth/lookup': registered, 'POST /api/auth/claim': claim })
    render(<Login onSignedIn={() => {}} />)
    await lookup()
    await screen.findByLabelText('Senha do PlatJourney')
    press('Esqueci a senha, ou este perfil é meu')
    await screen.findByText('PJ-1234')
    press('Voltar para entrar')
    expect(screen.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeTruthy()
    expect(scroll).toHaveBeenCalledTimes(1)
  } finally {
    HTMLElement.prototype.scrollIntoView = original
  }
})

test('a code that cannot be made says why', async () => {
  let message: string | undefined = 'Muitas tentativas.'
  mockApi({
    'POST /api/auth/lookup': registered,
    'POST /api/auth/claim': () => reply(429, message ? { message } : {}),
  })
  render(<Login onSignedIn={() => {}} />)
  await lookup()
  await screen.findByLabelText('Senha do PlatJourney')
  press('Esqueci a senha, ou este perfil é meu')
  expect((await screen.findByRole('alert')).textContent).toBe('Muitas tentativas.')
  message = undefined
  press('Esqueci a senha, ou este perfil é meu')
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe('Não conseguimos gerar o código.'),
  )
})
