/** Settings' buddy rows, in the appearance card: who walks the road to the platinum with the player (Nexo or one of the
 * living objects) and the name it answers to, on every screen and in the chat. */
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { BUDDIES, BUDDY_NAME_MAX, type Buddy, DEFAULT_BUDDY } from '../../../../shared/buddy'
import { useApp } from '../app/app-state'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api } from '../lib/api'
import type { Me } from '../lib/types'
import { Icon } from '../ui/icon'
import { SettingTitle } from '../ui/setting-title'
import { toast } from '../ui/toast'
import { BuddyAvatar } from './buddy-avatar'
import { useDemoLock } from './demo'
import './onboarding.css'
import './install-guide.css'
import './buddy-setting.css'

// The texts swap the word for the player's name of choice, so these never say it: Nexo's own
// label is written outside them.
const messages = defineMessages({
  [Language.PtBR]: {
    pick: 'Parceiro',
    pickHint: 'Quem te acompanha no app: aparece nas telas e na conversa.',
    change: 'Trocar',
    dialogEyebrow: 'Parceiro',
    dialogTitle: 'Escolha quem vai com você',
    dialogLead: 'Cada um tem seu jeito: respira, pisca e apronta enquanto você joga.',
    close: 'Fechar',
    name: 'Nome do parceiro',
    nameHint: 'Como ele se chama nas telas e na conversa. Vazio, fica o nome de sempre.',
    save: 'Salvar nome',
    saved: 'Parceiro salvo.',
    nameSaved: 'Nome salvo.',
    saveFailed: 'Não deu para salvar. Tente de novo.',
    buddy: {
      controller: 'Controle',
      cartridge: 'Cartucho',
      trophy: 'Troféu',
      coffee: 'Café',
      heart: 'Coração',
      crt: 'CRT',
      arcade: 'Fliperama',
      headset: 'Headset',
      bomb: 'Bomba',
      energy: 'Energético',
      handheld: 'Portátil',
    },
  },
  [Language.En]: {
    pick: 'Buddy',
    pickHint: 'Who keeps you company in the app: on the screens and in the chat.',
    change: 'Change',
    dialogEyebrow: 'Buddy',
    dialogTitle: 'Pick who comes along',
    dialogLead: 'Each one has its own ways: it breathes, blinks and acts up while you play.',
    close: 'Close',
    name: "Buddy's name",
    nameHint: 'What it is called on the screens and in the chat. Empty, it keeps its usual name.',
    save: 'Save name',
    saved: 'Buddy saved.',
    nameSaved: 'Name saved.',
    saveFailed: "Couldn't save. Try again.",
    buddy: {
      controller: 'Controller',
      cartridge: 'Cartridge',
      trophy: 'Trophy',
      coffee: 'Coffee',
      heart: 'Heart',
      crt: 'CRT',
      arcade: 'Arcade',
      headset: 'Headset',
      bomb: 'Bomb',
      energy: 'Energy drink',
      handheld: 'Handheld',
    },
  },
})

const handled = (e: unknown) => e instanceof ApiError && e.handled

export function BuddySettings({ user }: { user: Me }) {
  const t = useMessages(messages)
  const { setMe } = useApp()
  const locked = useDemoLock(user.demo)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState(user.buddyName ?? '')
  useEffect(() => setName(user.buddyName ?? ''), [user.buddyName])
  const current = user.buddy ?? DEFAULT_BUDDY
  const label = (buddy: Buddy) => (buddy === 'nexo' ? 'Nexo' : t(`buddy.${buddy}`))

  const save = async (fields: { buddy?: Buddy; buddyName?: string }, done: string) => {
    const before = user
    // The screens change before the answer, so the pick feels instant; a failure puts it back.
    setMe({
      ...user,
      ...(fields.buddy ? { buddy: fields.buddy } : {}),
      ...(fields.buddyName !== undefined ? { buddyName: fields.buddyName.trim() || null } : {}),
    })
    setSaving(true)
    try {
      const saved = await api<{ user: Me }>('/api/account/preferences', fields)
      setMe(saved.user)
      toast(done, 'success')
    } catch (e) {
      setMe(before)
      if (!handled(e)) toast(t('saveFailed'))
    }
    setSaving(false)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() !== (user.buddyName ?? '')) save({ buddyName: name }, t('nameSaved'))
  }
  const disabled = saving || !!user.demo

  return (
    <>
      <div className="setting-row buddy-current">
        <SettingTitle title={t('pick')} hint={t('pickHint')} note={locked} />
        <span className="buddy-current-pick">
          <BuddyAvatar className="buddy-current-art" />
          <b>{label(current)}</b>
          <button
            type="button"
            className="ghost sm"
            disabled={disabled}
            onClick={() => setPicking(true)}
          >
            {t('change')}
          </button>
        </span>
      </div>
      <form className="setting-row buddy-name" onSubmit={submit}>
        <SettingTitle title={t('name')} hint={t('nameHint')} htmlFor="buddy-name" />
        <span className="buddy-name-field">
          <input
            id="buddy-name"
            value={name}
            maxLength={BUDDY_NAME_MAX}
            placeholder={label(current)}
            autoComplete="off"
            disabled={disabled}
            onChange={(e) => setName(e.target.value)}
            onBlur={submit}
          />
          <button type="submit" className="ghost sm" disabled={disabled}>
            {t('save')}
          </button>
        </span>
      </form>
      {picking && (
        <BuddyDialog
          current={current}
          label={label}
          onPick={(buddy) => {
            setPicking(false)
            if (buddy !== current) save({ buddy }, t('saved'))
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

/** The gallery, over the page: every buddy alive, the current one marked. Picking one closes it. */
function BuddyDialog({
  current,
  label,
  onPick,
  onClose,
}: {
  current: Buddy
  label: (buddy: Buddy) => string
  onPick: (buddy: Buddy) => void
  onClose: () => void
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is on the backdrop; Esc (onCancel) and the X close it from the keyboard
    <dialog
      ref={ref}
      className="buddy-dialog"
      aria-label={t('dialogTitle')}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // A click outside the card lands on the dialog itself (its backdrop): that closes it too.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="onb-card">
        <button
          type="button"
          className="ghost sm buddy-dialog-close"
          aria-label={t('close')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
        <div className="onb-body">
          <div className="onb-copy">
            <span className="eyebrow">{t('dialogEyebrow')}</span>
            <h2>{t('dialogTitle')}</h2>
            <p>{t('dialogLead')}</p>
            <fieldset className="buddy-gallery" aria-label={t('pick')}>
              {BUDDIES.map((buddy) => (
                <button
                  key={buddy}
                  type="button"
                  aria-pressed={buddy === current}
                  className={`buddy-option${buddy === current ? ' is-on' : ''}`}
                  onClick={() => onPick(buddy)}
                >
                  <BuddyAvatar buddy={buddy} className="buddy-option-art" />
                  <span>{label(buddy)}</span>
                  {buddy === current && <Icon name="check" />}
                </button>
              ))}
            </fieldset>
          </div>
        </div>
      </div>
    </dialog>
  )
}
