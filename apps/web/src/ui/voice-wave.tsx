import './voice-wave.css'

/** How many samples the wave keeps: enough to fill a wide box; a narrow one shows the newest. */
export const WAVE_SAMPLES = 220

/** A recording's waveform: one bar per sample of how loud it was (0 to 1), newest on the right.
 * Silence is a dot, so the line reads as waiting even before anyone speaks. `busy` once the
 * recording is over and something is still being done with it: the wave stands still and fades. */
export function VoiceWave({
  levels,
  label,
  busy = false,
}: {
  levels: number[]
  label: string
  busy?: boolean
}) {
  const bars = [...Array(Math.max(0, WAVE_SAMPLES - levels.length)).fill(0), ...levels].slice(
    -WAVE_SAMPLES,
  )
  return (
    <div className={`voice-wave${busy ? ' busy' : ''}`} role="img" aria-label={label}>
      {bars.map((level, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a bar is its position in the line
          key={i}
          style={{ height: `${Math.max(2, Math.round(level * 100))}%` }}
        />
      ))}
    </div>
  )
}
