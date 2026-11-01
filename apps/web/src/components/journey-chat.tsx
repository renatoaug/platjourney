import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Nexo } from '../pages/nexo'
import { Icon } from '../ui/icon'
import { NexoHero } from './nexo-hero'
import './journey-chat.css'

const messages = defineMessages({
  [Language.PtBR]: { title: 'Nexo na sua jornada', back: 'Voltar à jornada' },
  [Language.En]: { title: 'Nexo in your journey', back: 'Back to your journey' },
})

export function JourneyChat() {
  const t = useMessages(messages)
  const navigate = useNavigate()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal?.()
    const scroll = window.scrollY
    const body = document.body
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }
    Object.assign(body.style, {
      overflow: 'hidden',
      position: 'fixed',
      top: `${-scroll}px`,
      width: '100%',
    })
    const viewport = window.visualViewport
    const fullHeight = window.innerHeight
    const resize = () => {
      const dialog = ref.current
      if (!dialog || !viewport) return
      dialog.style.setProperty('--journey-viewport-height', `${viewport.height}px`)
      dialog.style.setProperty('--journey-viewport-top', `${viewport.offsetTop}px`)
      dialog.dataset.keyboard = String(viewport.height < fullHeight * 0.8)
    }
    resize()
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => {
      viewport?.removeEventListener('resize', resize)
      viewport?.removeEventListener('scroll', resize)
      Object.assign(body.style, previous)
      window.scrollTo(0, scroll)
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="journey-chat"
      aria-label={t('title')}
      onCancel={(e) => {
        e.preventDefault()
        navigate(-1)
      }}
    >
      <header className="journey-chat-bar">
        <button type="button" className="ghost" onClick={() => navigate(-1)}>
          <Icon name="chevron-left" />
          {t('back')}
        </button>
        <div className="journey-chat-brand">
          <NexoHero />
          <h1>Nexo</h1>
        </div>
      </header>
      <Nexo />
    </dialog>
  )
}
