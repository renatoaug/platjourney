/** PSN timestamps, including legacy UTC rows without a zone. Dates never imply an unlock. */
export function earnedTimestamp(trophy: {
  earned: boolean
  earnedAt?: string
}): number | undefined {
  const value = trophy.earnedAt
  if (!trophy.earned || !value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return
  const time = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
  return Number.isFinite(time) ? time : undefined
}

/** Undated achievements are a separate bucket, never presented as dated chronology. */
export function achievementHistory<
  T extends { id: number; groupId: string; earned: boolean; earnedAt?: string },
>(trophies: T[]) {
  const earned = trophies.filter((t) => t.earned)
  const identity = (a: T, b: T) => a.groupId.localeCompare(b.groupId) || a.id - b.id
  const dated = earned
    .filter((t) => earnedTimestamp(t) !== undefined)
    .sort((a, b) => (earnedTimestamp(a) ?? 0) - (earnedTimestamp(b) ?? 0) || identity(a, b))
  const undated = earned.filter((t) => earnedTimestamp(t) === undefined).sort(identity)
  const tied = new Set(dated.map(earnedTimestamp)).size !== dated.length
  return { dated, undated, uncertain: !!undated.length || tied }
}
