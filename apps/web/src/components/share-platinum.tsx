/** Sharing a platinum: draws its card and hands it to the phone's share sheet (Reddit, WhatsApp,
 * Instagram, whatever the player uses) with a line and a link; where a browser cannot share
 * files, and on a computer, it copies the image to paste and saves it. */
import { useEffect, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { drawPlatinumCard, fetchPlatinumCard, SHARE_HOST } from '../lib/share-card'
import { Icon } from '../ui/icon'
import { toast } from '../ui/toast'
import { ShareTargets } from './share-targets'
import './share-platinum.css'

const messages = defineMessages({
  [Language.PtBR]: {
    share: 'Compartilhar a platina de {game}',
    shareLabel: 'Compartilhar platina',
    text: 'Platinei {game}! Platina #{number} 🏆',
    failed: 'Não foi possível montar a imagem. Tente de novo.',
  },
  [Language.En]: {
    share: 'Share the {game} platinum',
    shareLabel: 'Share platinum',
    text: 'Platinumed {game}! Platinum #{number} 🏆',
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

interface Ready {
  image: string
  text: string
  link: string
  copied: boolean
}

/** Builds an image and shares it: a phone's share sheet takes it with a line and a link to the
 * player's profile as its caption. A computer's would offer "Copy", which pastes the image twice;
 * there the image goes to the clipboard on its own and is saved too, and `panel` shows the places
 * to post it, each opening with the line and the link filled in. */
export function useShare() {
  const t = useMessages(messages)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState<Ready | null>(null)
  // The image's address lives while the panel shows it.
  useEffect(() => (ready ? () => URL.revokeObjectURL(ready.image) : undefined), [ready])
  const run = async (
    build: () => Promise<{ blob: Blob; name: string; text: string; onlineId: string } | string>,
  ) => {
    setBusy(true)
    try {
      const built = await build()
      // Nothing to draw: the builder says why.
      if (typeof built === 'string') {
        toast(built, 'info')
        return
      }
      const { blob, name, text, onlineId } = built
      const file = new File([blob], name, { type: 'image/png' })
      const link = `https://${SHARE_HOST}/profiles/${encodeURIComponent(onlineId)}?ref=share`
      if (touch() && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${link}` }).catch((e: Error) => {
          // Closing the share sheet is not a failure.
          if (e.name !== 'AbortError') throw e
        })
        return
      }
      const copied = await copyImage(blob)
      save(blob, file.name)
      setReady({ image: URL.createObjectURL(blob), text, link, copied })
    } catch {
      toast(t('failed'))
    } finally {
      setBusy(false)
    }
  }
  const panel = ready && <ShareTargets {...ready} onClose={() => setReady(null)} />
  return { busy, run, panel }
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
  const { busy, run, panel } = useShare()
  const share = () =>
    run(async () => {
      const card = await fetchPlatinumCard(gameId)
      return {
        blob: await drawPlatinumCard(card),
        name: fileName(card.game.name),
        text: t('text', { game: card.game.name, number: card.number }),
        onlineId: card.player.onlineId,
      }
    })

  if (labeled)
    return (
      <>
        <button
          type="button"
          className="button secondary share-platinum-labeled"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={share}
        >
          <Icon name="share" /> {t('shareLabel')}
        </button>
        {panel}
      </>
    )
  return (
    <>
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
      {panel}
    </>
  )
}
