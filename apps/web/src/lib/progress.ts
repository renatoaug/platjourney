/** Trophy progress as the player chose to see it: the base game only (the default, what the platinum needs) or with DLC counted in. */

interface Count {
  earned: number
  total: number
}

export function shownProgress(base: Count, dlc: Count | null | undefined, includeDlc: boolean) {
  const withDlc = includeDlc && !!dlc
  const earned = base.earned + (withDlc && dlc ? dlc.earned : 0)
  const total = base.total + (withDlc && dlc ? dlc.total : 0)
  return { earned, total, progress: total ? Math.round((earned / total) * 100) : 0, withDlc }
}
