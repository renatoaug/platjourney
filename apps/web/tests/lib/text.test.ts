import { describe, expect, test } from 'bun:test'
import { esc, md, plainText, uiText, userText } from '../../src/lib/text'

test('esc escapes HTML and accepts anything', () => {
  expect(esc('<b class="x">a & b</b>')).toBe('&lt;b class=&quot;x&quot;&gt;a &amp; b&lt;/b&gt;')
  expect(esc(null)).toBe('')
  expect(esc(42)).toBe('42')
})

test('plainText drops decorative emoji', () => {
  expect(plainText('🏆 Achados e perdidos 👍🏽')).toBe(' Achados e perdidos ')
  expect(plainText('1️⃣ passo')).toBe(' passo')
  expect(plainText(undefined)).toBe('')
})

test('uiText drops emoji and escapes', () => {
  expect(uiText('🔥 <script>')).toBe(' &lt;script&gt;')
})

test('userText keeps **bold** and escapes the rest', () => {
  expect(userText('pegue **Isto é uma faca** <agora>')).toBe(
    'pegue <strong>Isto é uma faca</strong> &lt;agora&gt;',
  )
})

describe('md', () => {
  test('paragraphs, with single line breaks kept', () => {
    expect(md('primeira\nlinha\n\nsegunda')).toBe('<p>primeira<br>linha</p><p>segunda</p>')
  })

  test('a heading line followed by its list', () => {
    expect(md('Como pegar:\n- mate o Quebrador\n2) use a faca')).toBe(
      '<p>Como pegar:</p><ul><li>mate o Quebrador</li><li>use a faca</li></ul>',
    )
  })

  test('text after a list starts a new paragraph', () => {
    expect(md('• um\n• dois\ndepois')).toBe('<ul><li>um</li><li>dois</li></ul><p>depois</p>')
  })

  test('bold, italics and code', () => {
    expect(md('**forte**, *leve* e `R2`')).toBe(
      '<p><strong>forte</strong>, <em>leve</em> e <code>R2</code></p>',
    )
  })

  test('quoted trophy names are highlighted', () => {
    expect(md('pegue “De raspão” logo')).toBe('<p>pegue <strong>“De raspão”</strong> logo</p>')
  })

  test('escapes what Nexo wrote before adding tags', () => {
    expect(md('<img src=x>')).toBe('<p>&lt;img src=x&gt;</p>')
  })
})
