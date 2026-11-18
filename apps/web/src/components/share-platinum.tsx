/** Sharing a platinum: draws its card and hands it to the phone's share sheet (Reddit, WhatsApp,
 * Instagram, whatever the player uses) with a line and a link; where a browser cannot share
 * files, and on a computer, it copies the image to paste and saves it. */
import { useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { drawPlatinumCard, fetchPlatinumCard, SHARE_HOST } from '../lib/share-card'
import { Icon } from '../ui/icon'
import { toast } from '../ui/toast'
import './share-platinum.css'

const messages = defineMessages({
  [Language.PtBR]: {
    share: 'Compartilhar a platina de {game}',
    shareLabel: 'Compartilhar platina',
    text: 'Platinei {game}! Platina #{number} 🏆',
    copied: 'Imagem copiada, é só colar no post. O arquivo também foi salvo.',
    savedOnly: 'Imagem salva.',
    failed: 'Não foi possível montar a imagem. Tente de novo.',
  },
  [Language.En]: {
    share: 'Share the {game} platinum',
    shareLabel: 'Share platinum',
    text: 'Platinumed {game}! Platinum #{number} 🏆',
    copied: 'Image copied, paste it into your post. The file was saved too.',
    savedOnly: 'Image saved.',
    failed: 'Could not build the image. Try again.',
  },
})

const fileName = (name: string) =>
  `platina-${name
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()}.png`

const touch = () => window.matchMedia?.('(pointer: coarse)').matches === true

const copyImage = (blob: Blob) =>
  typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write
    ? Promise.resolve(false)
    : navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
        () => true,
        () => false,
      )

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function SharePlatinum({
  gameId,
  name,
  labeled = false,
}: {
  gameId: string
  name: string
  /** With its words, as a button of its own; without, an icon beside a list row. */
  labeled?: boolean
}) {
  const t = useMessages(messages)
  const [busy, setBusy] = useState(false)

  const share = async () => {
    setBusy(true)
    try {
      const card = await fetchPlatinumCard(gameId)
      const blob = await drawPlatinumCard(card)
      const file = new File([blob], fileName(card.game.name), { type: 'image/png' })
      const link = `https://${SHARE_HOST}/profiles/${encodeURIComponent(card.player.onlineId)}?ref=share`
      const text = `${t('text', { game: card.game.name, number: card.number })}\n${link}`
      // A phone's share sheet takes the image with the line as its caption. A computer's would
      // offer "Copy", which pastes the image twice; there the image goes to the clipboard on its
      // own, to paste into the post, and is saved as a file too.
      if (touch() && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch((e: Error) => {
          // Closing the share sheet is not a failure.
          if (e.name !== 'AbortError') throw e
        })
        return
      }
      const copied = await copyImage(blob)
      save(blob, file.name)
      toast(copied ? t('copied') : t('savedOnly'), 'success')
    } catch {
      toast(t('failed'))
    } finally {
      setBusy(false)
    }
  }

  if (labeled)
    return (
      <button
        type="button"
        className="button secondary share-platinum-labeled"
        aria-busy={busy || undefined}
        disabled={busy}
        onClick={share}
      >
        <Icon name="share" /> {t('shareLabel')}
      </button>
    )
  return (
    <button
      type="button"
      className="icon-button share-platinum"
      aria-label={t('share', { game: name })}
      title={t('share', { game: name })}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={share}
    >
      <Icon name="share" />
    </button>
  )
}
