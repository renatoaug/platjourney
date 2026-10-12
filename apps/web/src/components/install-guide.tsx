/** Before the introduction, on a phone: how to put PlatJourney on the home screen, so it opens full
 * screen like an app. Shown once per device, and never inside the installed app. */
import { useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import './onboarding.css'
import './install-guide.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Instalar o PlatJourney',
    eyebrow: 'MELHOR NO CELULAR',
    title: 'Coloque o PlatJourney na tela inicial',
    body: 'Assim ele abre em tela cheia, como um app, e fica a um toque de distância. Leva dez segundos.',
    ios: {
      share: 'Toque em Compartilhar, o quadrado com a seta, na barra do navegador.',
      add: 'Role e escolha "Adicionar à Tela de Início".',
      open: 'Abra o PlatJourney pelo ícone novo na tela inicial.',
    },
    android: {
      menu: 'Toque no menu ⋮ do navegador.',
      add: 'Escolha "Instalar app" ou "Adicionar à tela inicial".',
      open: 'Abra o PlatJourney pelo ícone novo na tela inicial.',
    },
    install: 'Instalar app',
    later: 'Agora não',
    done: 'Já instalei',
  },
  [Language.En]: {
    label: 'Install PlatJourney',
    eyebrow: 'BETTER ON YOUR PHONE',
    title: 'Put PlatJourney on your home screen',
    body: 'It then opens full screen, like an app, one tap away. It takes ten seconds.',
    ios: {
      share: 'Tap Share, the square with the arrow, in the browser bar.',
      add: 'Scroll and pick "Add to Home Screen".',
      open: 'Open PlatJourney from the new icon on your home screen.',
    },
    android: {
      menu: 'Tap the browser menu ⋮.',
      add: 'Pick "Install app" or "Add to Home screen".',
      open: 'Open PlatJourney from the new icon on your home screen.',
    },
    install: 'Install app',
    later: 'Not now',
    done: 'Done',
  },
})

const SEEN = 'platjourney:install-guide-seen'

// Chrome on Android offers its own install prompt once the page qualifies; it is kept here so the
// guide's button can open it. The event fires early, so the listener starts with the module.
interface InstallPrompt extends Event {
  prompt: () => Promise<void>
}
let installPrompt: InstallPrompt | null = null
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPrompt = e as InstallPrompt
  })

export type InstallPlatform = 'ios' | 'android' | null

/** The phone the page runs on, for the steps to show; null on a computer. */
export function installPlatform(
  agent = navigator.userAgent,
  touch = navigator.maxTouchPoints,
): InstallPlatform {
  // iPadOS reports a Mac; its touch screen gives it away.
  if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && touch > 1)) return 'ios'
  if (/Android/.test(agent)) return 'android'
  return null
}

/** Whether the page already runs as the installed app. */
export function installed(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** The guide is due: a phone, a browser tab (not the app), and not shown on this device yet. */
export function installGuideDue(): boolean {
  if (!installPlatform() || installed()) return false
  try {
    return !localStorage.getItem(SEEN)
  } catch {
    return false
  }
}

export function InstallGuide({
  platform,
  onDone,
}: {
  platform: Exclude<InstallPlatform, null>
  onDone: () => void
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  const [canPrompt] = useState(() => platform === 'android' && installPrompt !== null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  const close = () => {
    try {
      localStorage.setItem(SEEN, '1')
    } catch {}
    onDone()
  }
  const steps =
    platform === 'ios'
      ? [t('ios.share'), t('ios.add'), t('ios.open')]
      : [t('android.menu'), t('android.add'), t('android.open')]
  return (
    <dialog
      ref={ref}
      className="onb install-guide"
      aria-label={t('label')}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="onb-grid" aria-hidden="true" />
      <div className="onb-card">
        <div className="onb-body">
          <div className="onb-copy">
            <span className="eyebrow">{t('eyebrow')}</span>
            <h2>{t('title')}</h2>
            <p>{t('body')}</p>
            {canPrompt ? null : (
              <ol className="install-steps">
                {steps.map((s, i) => (
                  <li key={s}>
                    <span className="install-step-n">{i + 1}</span>
                    <span>
                      {platform === 'ios' && i === 0 && <Icon name="share" />}
                      {s}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        <footer className="onb-controls">
          <button type="button" className="ghost sm" onClick={close}>
            {t('later')}
          </button>
          {canPrompt ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                installPrompt
                  ?.prompt()
                  .catch(() => {})
                  .finally(close)
              }}
            >
              {t('install')}
            </button>
          ) : (
            <button type="button" className="button" onClick={close}>
              {t('done')} <Icon name="arrow-right" />
            </button>
          )}
        </footer>
      </div>
    </dialog>
  )
}
