// Before the first frame: the skin this browser last used (lib/skin.ts keeps it) and its display
// font, so the page does not flash in the default look while the account loads. A plain script,
// run as the page is read; anything unexpected leaves the default.
try {
  const fonts = {
    neon: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700&display=swap',
    pixel:
      'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap',
    vice_city: 'https://fonts.googleapis.com/css2?family=Anton&display=swap',
    christmas:
      'https://fonts.googleapis.com/css2?family=Mountains+of+Christmas:wght@700&display=swap',
    aurora: 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&display=swap',
  }
  const skin = localStorage.getItem('platjourney:skin')
  if (skin && fonts[skin]) {
    document.documentElement.dataset.skin = skin
    const link = document.createElement('link')
    link.id = 'skin-font'
    link.rel = 'stylesheet'
    link.href = fonts[skin]
    document.head.append(link)
  }
} catch {}
