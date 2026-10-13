import { expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  addItem,
  effectiveProfile,
  emptyPrefs,
  removeItem,
  samePrefs,
  TasteEditor,
  type TastePrefs,
} from '../../src/components/taste-editor'

const profile = { genres: ['RPG', 'Metroidvania'], traits: [], avoid: ['Terror'] }
const prefs: TastePrefs = {
  ...emptyPrefs(),
  added: { genres: ['Metroidvania'], traits: [], avoid: [] },
}

test('a tag the player added just goes; one the model wrote is remembered as removed', () => {
  expect(removeItem(prefs, 'genres', 'metroidvania').added.genres).toEqual([])
  expect(removeItem(prefs, 'genres', 'RPG').removed.genres).toEqual(['RPG'])
})

test("adding brings back a removed tag, or keeps one of the player's own once", () => {
  const removed = removeItem(emptyPrefs(), 'avoid', 'Terror')
  expect(addItem(removed, 'avoid', 'terror').removed.avoid).toEqual([])
  const once = addItem(addItem(emptyPrefs(), 'traits', 'Curtas'), 'traits', 'curtas ')
  expect(once.added.traits).toEqual(['Curtas'])
  expect(addItem(emptyPrefs(), 'traits', '  ')).toEqual(emptyPrefs())
})

test('the player removes, adds from a suggestion and sets rules', () => {
  const onChange = mock((_: TastePrefs) => {})
  render(<TasteEditor profile={profile} prefs={prefs} editable onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Tirar RPG' }))
  expect(onChange.mock.calls[0][0].removed.genres).toEqual(['RPG'])
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar em Você curte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Platinas curtas' }))
  expect(onChange.mock.calls[1][0].added.traits).toEqual(['Platinas curtas'])
  fireEvent.click(screen.getByRole('button', { name: 'Sem online' }))
  expect(onChange.mock.calls[2][0].filters).toEqual({ noOnline: true })
  fireEvent.change(screen.getByRole('combobox', { name: 'Horas até a platina' }), {
    target: { value: '40' },
  })
  expect(onChange.mock.calls[3][0].filters).toEqual({ maxHours: 40 })
})

test('a typed tag is added on Enter', () => {
  const onChange = mock((_: TastePrefs) => {})
  render(<TasteEditor profile={profile} prefs={emptyPrefs()} editable onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar em Evitando' }))
  const input = screen.getByRole('textbox', { name: 'Adicionar em Evitando' })
  fireEvent.change(input, { target: { value: 'Corrida' } })
  fireEvent.submit(input)
  expect(onChange.mock.calls[0][0].added.avoid).toEqual(['Corrida'])
})

test('read-only shows the tags without controls', () => {
  render(<TasteEditor profile={profile} prefs={prefs} editable={false} onChange={() => {}} />)
  expect(screen.queryByRole('button', { name: 'Tirar RPG' })).toBeNull()
  expect(screen.queryByText('Regras para as recomendações')).toBeNull()
})

test('an unsaved draft offers to discard, save, or save and get new picks', () => {
  const onSave = mock((_: boolean) => {})
  const onDiscard = mock(() => {})
  render(
    <TasteEditor
      profile={profile}
      prefs={prefs}
      editable
      dirty
      onChange={() => {}}
      onSave={onSave}
      onDiscard={onDiscard}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Salvar e gerar novas recomendações' }))
  expect(onDiscard).toHaveBeenCalled()
  expect(onSave.mock.calls.map((c) => c[0])).toEqual([false, true])
})

test('the profile shown follows the draft', () => {
  const base = { genres: ['RPG', 'Terror'], traits: [], avoid: [] }
  const draft = removeItem(addItem(emptyPrefs(), 'genres', 'Soulslike'), 'genres', 'terror')
  expect(effectiveProfile(base, draft).genres).toEqual(['RPG', 'Soulslike'])
  expect(samePrefs(emptyPrefs(), emptyPrefs())).toBe(true)
  expect(samePrefs(emptyPrefs(), draft)).toBe(false)
})
