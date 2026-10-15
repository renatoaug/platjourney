// Jobs at a fixed time of day in Brazil (UTC-3 all year since 2019), so they do not move with each
// deploy the way "every 24 hours from start" does.

const HOUR = 3_600_000
const DAY = 24 * HOUR
const BRAZIL_OFFSET = -3 * HOUR

/** Milliseconds from `now` to the next `hour`:`minute` in Brazil (tomorrow when it already passed). */
export function untilNext(hour: number, minute: number, now = Date.now()): number {
  const local = now + BRAZIL_OFFSET
  const midnight = local - (((local % DAY) + DAY) % DAY)
  let at = midnight + hour * HOUR + minute * 60_000
  if (at <= local) at += DAY
  return at - local
}

/** The weekday (0 = Sunday) in Brazil at `now`. */
export const brazilWeekday = (now = Date.now()) => new Date(now + BRAZIL_OFFSET).getUTCDay()

/** Runs `job` every day at `hour`:`minute` in Brazil; a failure is logged and waits for the next day. */
export function everyDayAt(
  hour: number,
  minute: number,
  name: string,
  job: () => Promise<unknown>,
) {
  const next = () =>
    setTimeout(
      async () => {
        await job().catch((e) => console.error(`${name} failed:`, (e as Error).message))
        next()
      },
      untilNext(hour, minute),
    ).unref()
  next()
}
