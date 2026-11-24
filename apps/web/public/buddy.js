// Right after the boot screen is read: the buddy this browser last showed (lib/buddy.ts keeps it)
// takes Nexo's place, so the loading shows it from the first frame instead of switching once the
// account loads. A plain script; anything unexpected leaves Nexo.
try {
  const buddy = JSON.parse(localStorage.getItem('platjourney:buddy') || 'null')?.buddy
  if (typeof buddy === 'string' && /^[a-z]+$/.test(buddy) && buddy !== 'nexo') {
    const img = document.querySelector('.boot-screen .boot-nexo')
    if (img) img.src = `/buddies/${buddy}/base.webp`
  }
} catch {}
