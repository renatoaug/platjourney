/** Where to post a shared image from a computer: the image is already copied and saved, and each
 * place opens its own posting screen with the line and the link filled in, for the player to paste
 * the image into. A site cannot hand an image to these places; only a phone's share sheet can. */
import { useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { Icon } from '../ui/icon'
import './share-targets.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Pronto para postar',
    copied:
      'A imagem está copiada: abra onde quer postar e cole (Ctrl+V ou ⌘V). O arquivo também foi salvo.',
    savedOnly: 'A imagem foi salva: abra onde quer postar e anexe o arquivo.',
    preview: 'A imagem que vai no post',
    where: 'Postar em',
    or: 'ou',
    copyPost: 'Copiar post',
    postCopied: 'Post copiado',
    close: 'Fechar',
  },
  [Language.En]: {
    title: 'Ready to post',
    copied:
      'The image is copied: open where you want to post and paste it (Ctrl+V or ⌘V). The file was saved too.',
    savedOnly: 'The image was saved: open where you want to post and attach the file.',
    preview: 'The image that goes in the post',
    where: 'Post on',
    or: 'or',
    copyPost: 'Copy post',
    postCopied: 'Post copied',
    close: 'Close',
  },
})

/** The image and the words together: where the post is pasted takes the image, the words or
 * both, as that place reads a paste. Without image copying, the words alone. */
async function copyPost(image: string, words: string) {
  try {
    const blob = await (await fetch(image)).blob()
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
        'text/plain': new Blob([words], { type: 'text/plain' }),
      }),
    ])
  } catch {
    await navigator.clipboard?.writeText(words).catch(() => {})
  }
}

/** Each place's posting screen with the line and the link filled in. */
export function postLinks(text: string, link: string) {
  const q = encodeURIComponent
  return [
    { key: 'x', label: 'X', href: `https://x.com/intent/post?text=${q(text)}&url=${q(link)}` },
    {
      key: 'reddit',
      label: 'Reddit',
      // A text post: the line as its title, the link in its body, where the image is pasted too.
      href: `https://www.reddit.com/submit?type=TEXT&title=${q(text)}&text=${q(link)}`,
    },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${q(`${text}\n${link}`)}` },
    {
      key: 'telegram',
      label: 'Telegram',
      href: `https://t.me/share/url?url=${q(link)}&text=${q(text)}`,
    },
  ]
}

export function ShareTargets({
  image,
  text,
  link,
  copied,
  onClose,
}: {
  /** The image's address, to show what goes in the post. */
  image: string
  text: string
  link: string
  /** Whether the image reached the clipboard; when not, it was only saved. */
  copied: boolean
  onClose: () => void
}) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  const [postCopied, setPostCopied] = useState(false)
  useEffect(() => {
    if (!postCopied) return
    const id = setTimeout(() => setPostCopied(false), 1800)
    return () => clearTimeout(id)
  }, [postCopied])
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  return (
    <dialog
      ref={ref}
      className="share-targets"
      aria-labelledby="share-targets-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <header className="share-targets-head">
        <h2 id="share-targets-title">{t('title')}</h2>
        <button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <img className="share-targets-image" src={image} alt={t('preview')} />
      <p className="share-targets-lead">{copied ? t('copied') : t('savedOnly')}</p>
      <nav className="share-targets-places" aria-label={t('where')}>
        {postLinks(text, link).map((p) => (
          <a
            key={p.key}
            className={`button secondary share-target-${p.key}`}
            aria-label={p.label}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={`/${p.key}.svg`} alt="" />
            {/* X's logo is its name. */}
            {p.key !== 'x' && p.label}
          </a>
        ))}
      </nav>
      <div className="share-targets-or" aria-hidden="true">
        {t('or')}
      </div>
      <button
        type="button"
        className="ghost sm share-targets-copy"
        onClick={() => copyPost(image, `${text}\n${link}`).then(() => setPostCopied(true))}
      >
        <Icon name={postCopied ? 'check' : 'copy'} /> {postCopied ? t('postCopied') : t('copyPost')}
      </button>
    </dialog>
  )
}
