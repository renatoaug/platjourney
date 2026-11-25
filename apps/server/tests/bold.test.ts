import { expect, test } from 'bun:test'
import { BOLD } from '../../../shared/bold.ts'
import { plainText } from '../src/notify.ts'

const names = (text: string) => [...text.matchAll(BOLD)].map((m) => m[1])

test('a bold name keeps the asterisks of its own', () => {
  expect(names('🏆 **T***, rabeta, droga e grana**\n🏆 **Confia**')).toEqual([
    'T***, rabeta, droga e grana',
    'Confia',
  ])
  expect(names('Vá de **Digno** e depois **Pomar**.')).toEqual(['Digno', 'Pomar'])
  expect(plainText('🏆 **T***, rabeta, droga e grana** em **GTA VI**')).toBe(
    '🏆 T***, rabeta, droga e grana em GTA VI',
  )
})
