// Before the first frame: the accent color this browser last used (lib/accent.ts keeps it), so
// the page does not flash in the default lime while the account loads. A plain script, run as the
// page is read; anything unexpected leaves the default.
try {
  const accent = localStorage.getItem('platjourney:accent')
  if (accent && /^[a-z]{2,16}$/.test(accent)) document.documentElement.dataset.accent = accent
} catch {}
