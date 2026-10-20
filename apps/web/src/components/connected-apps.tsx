/** Settings card: what is connected to the account. Telegram, where notices arrive and Nexo answers,
 * then the assistants connected through MCP (Claude, ChatGPT…) with when each was connected and last
 * used; disconnecting one ends its access at once. */
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { defineMessages, Language, useMessages } from '../i18n/i18n'
import { ApiError, api, del } from '../lib/api'
import { fmtAgo, fmtShortDate } from '../lib/format'
import type { Me } from '../lib/types'
import { Icon } from '../ui/icon'
import { Sk } from '../ui/skeleton'
import { toast } from '../ui/toast'
import { DemoNote } from './demo'
import './onboarding.css'
import './install-guide.css'
import './account.css'
import './connected-apps.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Apps conectados',
    assistants: 'Assistentes',
    lead: 'Leem seus troféus e os guias pelo endereço {url}.',
    telegram: {
      tapStart: 'Toque em Iniciar no Telegram para concluir.',
      linkFailed: 'Não conseguimos gerar o link. Tente de novo.',
      connectedTo: 'Conexão ativa com ',
      connectedRest:
        '. As atualizações da sua jornada de platina chegam por lá, e você conversa com o Nexo quando quiser.',
      unlink: 'Desconectar',
      lead: 'Receba atualizações da sua jornada de platina e converse com o Nexo direto pelo celular.',
      link: 'Conectar',
    },
    how: 'Como conectar',
    hide: 'Fechar',
    notYet: 'Ainda não conectado.',
    copy: 'Copiar endereço',
    copied: 'Copiado!',
    copyValue: 'Copiar {value}',
    menus: 'Os nomes dos menus podem mudar um pouco com o tempo.',
    guideEyebrow: 'CONECTAR ASSISTENTE',
    guideTitle: 'Como conectar o {name}',
    guideLead: 'Leva um minuto, e é feito lá no {name}. O endereço do PlatJourney é {url}.',
    steps: {
      claude: {
        step1: 'No Claude, abra **Configurações** e depois **Conectores**.',
        step2: 'Clique em **Adicionar conector personalizado**.',
        step3: 'Dê o nome `PlatJourney` e cole o endereço `{url}`.',
        step4:
          'Clique em **Conectar**, entre com a sua conta do PlatJourney e clique em **Permitir**.',
      },
      chatgpt: {
        step1: 'No ChatGPT, abra **Configurações** e depois **Plugins**.',
        step2: 'Clique em **Adicionar** e escolha **Adicionar servidor MCP**.',
        step3:
          'Dê o nome `PlatJourney`, escolha o tipo **Streamable HTTP** e cole o endereço `{url}`.',
        step4:
          'Salve. Na lista, clique em **Authenticate** (ou **Autenticar**) ao lado de `PlatJourney`, entre com a sua conta e clique em **Permitir**.',
      },
    },
    connected: 'Conectado',
    used: 'usado {when}',
    unused: 'ainda não usado',
    since: 'desde {date}',
    disconnect: 'Desconectar',
    disconnected: '{name} desconectado.',
    failed: 'Não deu para desconectar agora. Tente de novo.',
    loadFailed: 'Não conseguimos carregar os apps conectados.',
  },
  [Language.En]: {
    title: 'Connected apps',
    assistants: 'Assistants',
    lead: 'They read your trophies and the guides at {url}.',
    telegram: {
      tapStart: 'Tap Start in Telegram to finish.',
      linkFailed: 'Could not create the link. Try again.',
      connectedTo: 'Connected to ',
      connectedRest:
        '. Updates on your platinum journey arrive there, and you can talk to Nexo whenever you like.',
      unlink: 'Disconnect',
      lead: 'Get updates on your platinum journey and talk to Nexo right from your phone.',
      link: 'Connect',
    },
    how: 'How to connect',
    hide: 'Close',
    notYet: 'Not connected yet.',
    copy: 'Copy address',
    copied: 'Copied!',
    copyValue: 'Copy {value}',
    menus: 'Menu names may change a little over time.',
    guideEyebrow: 'CONNECT AN ASSISTANT',
    guideTitle: 'How to connect {name}',
    guideLead: 'It takes a minute, and it is done in {name}. The PlatJourney address is {url}.',
    steps: {
      claude: {
        step1: 'In Claude, open **Settings**, then **Connectors**.',
        step2: 'Click **Add custom connector**.',
        step3: 'Name it `PlatJourney` and paste the address `{url}`.',
        step4: 'Click **Connect**, sign in with your PlatJourney account and click **Allow**.',
      },
      chatgpt: {
        step1: 'In ChatGPT, open **Settings**, then **Plugins**.',
        step2: 'Click **Add** and pick **Add MCP server**.',
        step3:
          'Name it `PlatJourney`, pick the **Streamable HTTP** type and paste the address `{url}`.',
        step4:
          'Save. In the list, click **Authenticate** next to `PlatJourney`, sign in with your account and click **Allow**.',
      },
    },
    connected: 'Connected',
    used: 'used {when}',
    unused: 'not used yet',
    since: 'since {date}',
    disconnect: 'Disconnect',
    disconnected: '{name} disconnected.',
    failed: "Couldn't disconnect right now. Try again.",
    loadFailed: "We couldn't load the connected apps.",
  },
})

export interface Connection {
  id: string
  name: string
  created_at: string
  used_at: string | null
}

export type ConnectedLoad =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; list: Connection[] }

/** @param onChanged  the account changed on the server (Telegram unlinked); reload the page's data */
export function ConnectedApps({ user, onChanged }: { user: Me; onChanged: () => void }) {
  const t = useMessages(messages)
  const [load, setLoad] = useState<ConnectedLoad>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    api<{ connections: Connection[] }>('/api/connections')
      .then((r) => setLoad({ kind: 'ready', list: r.connections ?? [] }))
      .catch(() => setLoad({ kind: 'error' }))
  }, [])
  const disconnect = async (c: Connection) => {
    setBusy(c.id)
    try {
      const r = await del<{ connections: Connection[] }>('/api/connections', { id: c.id })
      setLoad({ kind: 'ready', list: r.connections ?? [] })
      toast(t('disconnected', { name: c.name }), 'success')
    } catch {
      toast(t('failed'), 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <ConnectedAppsCard
      telegram={<TelegramRow user={user} onChanged={onChanged} />}
      load={load}
      busy={busy}
      onDisconnect={disconnect}
    />
  )
}

/** The card from its load state, so its stories need no network. */
export function ConnectedAppsCard({
  telegram,
  load,
  busy = null,
  onDisconnect,
}: {
  telegram: ReactNode
  load: ConnectedLoad
  busy?: string | null
  onDisconnect: (c: Connection) => void
}) {
  const t = useMessages(messages)
  return (
    <div className="card" id="connected-apps">
      <h2>{t('title')}</h2>
      {telegram}
      <h3 className="connected-sub">{t('assistants')}</h3>
      <p className="connected-lead">{t('lead', { url: `${window.location.origin}/mcp` })}</p>
      <div className="connected-list">
        {load.kind === 'loading' && <Sk w="60%" h={13} />}
        {load.kind === 'error' && <p className="connected-empty">{t('loadFailed')}</p>}
        {load.kind === 'ready' &&
          load.list.map((c) => (
            <div className="setting-row static connected-row" key={c.id}>
              <span className="setting-text">
                <b className="app-title">
                  <AppLogo name={c.name} />
                  {c.name}
                </b>
                <small className="connected-meta">
                  <span className="connected-status">{t('connected')}</span>
                  {' · '}
                  {c.used_at ? t('used', { when: fmtAgo(c.used_at) }) : t('unused')}
                  {' · '}
                  {t('since', { date: fmtShortDate(c.created_at) })}
                </small>
              </span>
              <button
                type="button"
                className="ghost sm"
                disabled={busy === c.id}
                onClick={() => onDisconnect(c)}
              >
                {t('disconnect')}
              </button>
            </div>
          ))}
        {load.kind === 'ready' &&
          ASSISTANTS.filter((a) => !load.list.some((c) => a.match.test(c.name))).map((a) => (
            <HowToConnect key={a.key} assistant={a} />
          ))}
      </div>
    </div>
  )
}

/** The card while the settings load: Telegram's row and the assistants, at the same place. */
export function ConnectedAppsSkeleton() {
  const t = useMessages(messages)
  return (
    <div className="card">
      <h2>{t('title')}</h2>
      <div className="setting-row static">
        <span className="setting-text grow">
          <b className="app-title">
            <img className="app-logo" src="/telegram.svg" alt="" />
            Telegram
          </b>
          <Sk w="85%" h={10} />
        </span>
        <Sk w="150px" h={36} style={{ borderRadius: 'var(--radius-control)' }} />
      </div>
      <h3 className="connected-sub">{t('assistants')}</h3>
      <Sk w="90%" h={12} />
      <Sk w="50%" h={13} style={{ marginTop: 14 }} />
    </div>
  )
}

const handled = (e: unknown) => e instanceof ApiError && e.handled

// The assistants people connect most: their marks (Simple Icons, CC0), found by the name the
// assistant registered with, and the page where a connector is added. Any other gets a plain icon.
const ASSISTANTS = [
  { key: 'claude', name: 'Claude', match: /claude/i, logo: '/claude.svg' },
  { key: 'chatgpt', name: 'ChatGPT', match: /chatgpt|openai|codex/i, logo: '/chatgpt.svg' },
] as const
type Assistant = (typeof ASSISTANTS)[number]

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const

// How long a copy button says it copied.
const COPIED_MS = 1800

/** Copies `text` and says so for a moment on the button itself, instead of a toast. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(null), COPIED_MS)
    return () => clearTimeout(id)
  }, [copied])
  const copy = async (text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(text)
  }
  return { copied, copy }
}

// Something to type or paste, in the accent, with its own copy button.
function CopyValue({ value }: { value: string }) {
  const t = useMessages(messages)
  const { copied, copy } = useCopy()
  return (
    <span className="connect-value">
      {value}
      <button
        type="button"
        className={`connect-copy ${copied ? 'is-copied' : ''}`}
        aria-label={copied ? t('copied') : t('copyValue', { value })}
        onClick={() => copy(value)}
      >
        <Icon name={copied ? 'check' : 'copy'} />
      </button>
    </span>
  )
}

// A step names what to click in **bold** and what to type or paste in `green`, with a copy button.
function marked(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part) => {
    if (part.startsWith('**')) return <b key={part}>{part.slice(2, -2)}</b>
    if (part.startsWith('`')) return <CopyValue key={part} value={part.slice(1, -1)} />
    return part
  })
}

// An assistant cannot be connected from here: the player adds the connector there. Its row opens
// the steps in a dialog, with the address to copy.
function HowToConnect({ assistant: a }: { assistant: Assistant }) {
  const t = useMessages(messages)
  const [open, setOpen] = useState(false)
  return (
    <div className="setting-row static connected-row">
      <span className="setting-text">
        <b className="app-title">
          <AppLogo name={a.name} />
          {a.name}
        </b>
        <small>{t('notYet')}</small>
      </span>
      <button type="button" className="ghost sm" onClick={() => setOpen(true)}>
        {t('how')}
      </button>
      {open && <ConnectGuide assistant={a} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** The steps to add PlatJourney as a connector in one assistant, in the introduction's dialog. */
function ConnectGuide({ assistant: a, onClose }: { assistant: Assistant; onClose: () => void }) {
  const t = useMessages(messages)
  const ref = useRef<HTMLDialogElement>(null)
  const url = `${window.location.origin}/mcp`
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal?.()
  }, [])
  const { copied, copy } = useCopy()
  return (
    <dialog
      ref={ref}
      className="onb install-guide connect-guide"
      aria-label={t('guideTitle', { name: a.name })}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="onb-grid" aria-hidden="true" />
      <div className="onb-card">
        <div className="onb-body">
          <div className="onb-copy">
            <span className="eyebrow">{t('guideEyebrow')}</span>
            <h2 className="app-title">
              <AppLogo name={a.name} />
              {t('guideTitle', { name: a.name })}
            </h2>
            <p>{t('guideLead', { name: a.name, url })}</p>
            <ol className="install-steps">
              {STEPS.map((n, i) => (
                <li key={n}>
                  <span className="install-step-n">{i + 1}</span>
                  <span>{marked(t(`steps.${a.key}.${n}`, { url }))}</span>
                </li>
              ))}
            </ol>
            <small className="connected-menus">{t('menus')}</small>
          </div>
        </div>
        <footer className="onb-controls">
          <button type="button" className="ghost sm" onClick={onClose}>
            {t('hide')}
          </button>
          <button
            type="button"
            className={`button connect-copy-all ${copied ? 'is-copied' : ''}`}
            onClick={() => copy(url)}
          >
            <Icon name={copied ? 'check' : 'copy'} /> {copied ? t('copied') : t('copy')}
          </button>
        </footer>
      </div>
    </dialog>
  )
}

function AppLogo({ name }: { name: string }) {
  const logo = ASSISTANTS.find((a) => a.match.test(name))?.logo
  return logo ? (
    <img className="app-logo" src={logo} alt="" />
  ) : (
    <span className="app-logo app-logo-plain">
      <Icon name="layers" />
    </span>
  )
}

/** Telegram's row: connected to which bot, or the button that opens the bot to connect. */
export function TelegramRow({ user, onChanged }: { user: Me; onChanged: () => void }) {
  const t = useMessages(messages)
  const [linking, setLinking] = useState(false)
  const bot = user.telegramBot
  const link = async () => {
    setLinking(true)
    try {
      const { url } = await api<{ url: string }>('/api/telegram/link', {})
      window.open(url, '_blank', 'noopener')
      toast(t('telegram.tapStart'), 'info')
    } catch (e) {
      if (!handled(e)) toast(t('telegram.linkFailed'))
    }
    setLinking(false)
  }
  const unlink = async () => {
    await del('/api/telegram/link').catch(() => {})
    onChanged()
  }
  return (
    <>
      <div className="setting-row static connected-row" id="telegram-row">
        <span className="setting-text">
          {/* Telegram's paper plane mark (Simple Icons, CC0): white plane on its brand blue. */}
          <b className="app-title">
            <img className="app-logo" src="/telegram.svg" alt="" />
            Telegram
          </b>
          {user.telegramLinked ? (
            <small>
              {t('telegram.connectedTo')}
              <b>{bot?.name ?? 'Nexo'}</b>
              {bot && (
                <>
                  {' · '}
                  <a
                    className="text-link"
                    href={`https://t.me/${bot.username}`}
                    target="_blank"
                    rel="noopener"
                  >
                    @{bot.username}
                  </a>
                </>
              )}
              {t('telegram.connectedRest')}
            </small>
          ) : (
            <small>{t('telegram.lead')}</small>
          )}
        </span>
        {user.telegramLinked ? (
          <button type="button" className="ghost sm" id="telegram-unlink" onClick={unlink}>
            {t('telegram.unlink')}
          </button>
        ) : (
          <button
            type="button"
            className="ghost sm"
            id="telegram-link"
            disabled={linking || user.demo}
            onClick={link}
          >
            {t('telegram.link')}
          </button>
        )}
      </div>
      {!user.telegramLinked && user.demo && <DemoNote />}
    </>
  )
}
