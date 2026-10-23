/** A platinum's difficulty at a glance: the number, its band (Fácil, Média, Difícil, Muito difícil)
 * and ten segments in the band's color. Three looks for now, to pick one. */
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import './difficulty-meter.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Dificuldade {value} de 10: {band}',
    estimated: 'estimada',
    band: { easy: 'Fácil', medium: 'Média', hard: 'Difícil', brutal: 'Muito difícil' },
  },
  [Language.En]: {
    label: 'Difficulty {value} of 10: {band}',
    estimated: 'estimated',
    band: { easy: 'Easy', medium: 'Medium', hard: 'Hard', brutal: 'Very hard' },
  },
})

type Band = 'easy' | 'medium' | 'hard' | 'brutal'

export const bandOf = (value: number): Band =>
  value <= 3 ? 'easy' : value <= 5 ? 'medium' : value <= 7 ? 'hard' : 'brutal'

export type MeterLook = 'score' | 'compact' | 'badge'

export function DifficultyMeter({
  value,
  look = 'score',
  estimated = false,
}: {
  /** 1 to 10; a band alone (estimated from rarity) has no number. */
  value: number | Band
  look?: MeterLook
  estimated?: boolean
}) {
  const t = useMessages(messages)
  const band = typeof value === 'number' ? bandOf(value) : value
  // An estimated band fills the middle of its range.
  const filled =
    typeof value === 'number' ? value : { easy: 2, medium: 4, hard: 6, brutal: 9 }[value]
  const name = t(`band.${band}`)
  const label = t('label', { value: typeof value === 'number' ? value : '?', band: name })
  const segments = (
    <span className="dm-segments" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ten fixed segments
        <i key={i} className={i < filled ? 'on' : ''} />
      ))}
    </span>
  )
  const number = typeof value === 'number' ? value : '~'
  return (
    <span className={`dm dm-${look} dm-${band}`} role="img" aria-label={label}>
      {look === 'badge' ? (
        <span className="dm-shield">{number}</span>
      ) : (
        <b className="dm-number">
          {number}
          {look === 'compact' && typeof value === 'number' && <small>/10</small>}
        </b>
      )}
      <span className="dm-body">
        <span className="dm-band">
          <span className="dm-name">
            {name}
            {estimated && <em> · {t('estimated')}</em>}
          </span>
          {look === 'score' && <span className="dm-of">/10</span>}
        </span>
        {segments}
      </span>
    </span>
  )
}
