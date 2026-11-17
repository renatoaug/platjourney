import { useState } from 'react'
import { useApp } from '../../app/app-state'
import { defineMessages, Language, useMessages } from '../../i18n/i18n'
import { ApiError, api } from '../../lib/api'
import type { Me } from '../../lib/types'
import { toast } from '../../ui/toast'
import '../account.css'
import './community-visibility.css'

const messages = defineMessages({
  [Language.PtBR]: {
    label: 'Aparecer na Comunidade',
    on: 'Você aparece na Comunidade.',
    off: 'Você saiu da Comunidade: os outros não veem mais o que você conquista.',
    failed: 'Não foi possível salvar. Tente de novo.',
  },
  [Language.En]: {
    label: 'Show up in the Community',
    on: 'You show up in the Community.',
    off: 'You left the Community: others no longer see what you earn.',
    failed: 'Could not save. Try again.',
  },
})

/** The switch to show up in the community, the same one Settings has. */
export function CommunityVisibility({ onChange }: { onChange?: (on: boolean) => void }) {
  const t = useMessages(messages)
  const { me, setMe } = useApp()
  const [saving, setSaving] = useState(false)
  const change = async (next: boolean) => {
    setSaving(true)
    try {
      const saved = await api<{ user: Me }>('/api/account/preferences', { communityVisible: next })
      setMe(saved.user)
      toast(t(next ? 'on' : 'off'), 'success')
      onChange?.(next)
    } catch (e) {
      if (!(e instanceof ApiError && e.handled)) toast(t('failed'))
    }
    setSaving(false)
  }
  return (
    <CommunityVisibilityView
      on={me.communityVisible !== false}
      disabled={saving || me.demo === true}
      onChange={change}
    />
  )
}

export function CommunityVisibilityView({
  on,
  disabled,
  onChange,
}: {
  on: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}) {
  const t = useMessages(messages)
  return (
    <label className="community-visibility" htmlFor="community-visible">
      <span>{t('label')}</span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        id="community-visible"
        checked={on}
        aria-checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}
