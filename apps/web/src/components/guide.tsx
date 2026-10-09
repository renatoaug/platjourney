/** Trophy guide card: quick facts, roadmap, missables, key trophies and known bugs. */
import { Fragment, type KeyboardEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import { defineMessages, getLocale, Language, type MessageKey, useMessages } from '../i18n/i18n'
import { fmtDate, fmtRate } from '../lib/format'
import { plainText } from '../lib/text'
import type { DeepGuideStats, GuideDetail, KeyTrophy, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { UserText } from '../ui/markdown'
import { repeat, Sk } from '../ui/skeleton'
import { SourceNote } from '../ui/source-note'
import { EmptyState } from '../ui/states'
import { NexoHero } from './nexo-hero'
import { nexoHref } from './tip'
import './guide.css'

const messages = defineMessages({
  [Language.PtBR]: {
    title: 'Guia da platina',
    titleNoPlatinum: 'Guia dos troféus',
    notes: {
      heading: 'Antes de começar',
      collectibles: 'Colecionáveis',
      pointOfNoReturn: 'Ponto sem retorno',
      autopop: 'Autopop PS4 / PS5',
    },
    bugStatus: {
      recent: 'Relatado recentemente',
      old: 'Relato antigo, pode ter sido corrigido',
      fixed: 'Corrigido em atualização',
      unconfirmed: 'Relato isolado',
    },
    key: {
      earned: 'Conquistado',
      earnedOn: 'Conquistado em {date}',
      playersEarned: '{rate}% de quem joga conquistou',
      highlights: 'Destaques da platina',
      highlightsCount: {
        one: '{count} destaque',
        other: '{count} destaques',
      },
      easiest: 'Mais fácil',
      hardest: 'Maior desafio',
      mostTedious: 'Mais trabalhoso',
      tricks: 'Dicas por troféu',
      tricksCount: {
        one: '{count} dica',
        other: '{count} dicas',
      },
      source: 'Fonte: {source}',
      noTricks: 'Nenhum macete registrado',
      noTricksHint: 'Consulte o roadmap para planejar a ordem das conquistas.',
      cautions: 'Cuidados para a platina',
      onlineCount: {
        one: '{count} troféu online',
        other: '{count} troféus online',
      },
      onlineWarning: 'Atenção ao modo online',
      offlineOk: 'Pode seguir offline',
      boostable: 'Dá para combinar com outras pessoas',
      onlineUndetailed: 'O guia indica requisitos online, mas ainda não detalha os troféus.',
      noOnline: 'Sem troféus online indicados neste guia.',
      buggy: 'Troféus com bugs',
      buggyCount: {
        one: '{count} troféu com bugs',
        other: '{count} troféus com bugs',
      },
      bugIssue: 'O que pode acontecer',
      bugWorkaround: 'Como resolver ou evitar',
    },
    facts: {
      difficulty: 'Dificuldade',
      hours: 'Tempo estimado',
      hoursDetail: 'Para a platina, sem DLC',
      unknown: 'Sem dado ainda',
      playthroughs: 'Jogadas mínimas',
      difficultyTrophy: 'Troféu de dificuldade',
      missables: 'Perdíveis',
      none: 'Nenhum',
      online: 'Online',
      onlineTrophies: {
        one: '{count} troféu',
        other: '{count} troféus',
      },
      collectibles: 'Colecionáveis',
      postgame: 'Depois do final',
      postgameValue: 'Dá para continuar',
      yes: 'Sim',
      no: 'Não',
    },
    glossary: {
      label: 'Glossário do jogo',
      search: 'Buscar termo no glossário',
      placeholder: 'Buscar termo ou definição',
      noMatch: 'Nenhum termo encontrado. Tente outra palavra.',
      empty: 'Este guia ainda não tem termos no glossário.',
    },
    deep: {
      title: 'Guia profundo',
      updatedOn: ' · atualizado em {date}',
      updating: ' (atualizando…)',
      askDetails: '. Pergunte detalhes ao Nexo: locais, ordem, colecionáveis.',
      ask: 'Perguntar',
      indexing: 'Indexando os guias completos para respostas detalhadas…',
    },
    tabs: {
      label: 'Seções do guia',
      summary: 'Resumo',
      key: 'Troféus-chave',
      missables: 'Perdíveis',
      missablesSkeleton: 'Perdíveis',
      roadmap: 'Roadmap',
      glossary: 'Glossário',
    },
    earlyTips: 'Dicas para o começo',
    sources: 'Fontes: {sources}',
    queuedTitle: 'Sua próxima conquista começa aqui.',
    queued:
      'O guia está na fila. Enquanto isso, o Nexo já pode ajudar com suas dúvidas sobre o jogo.',
    queuedStatus: 'Guia na fila',
    buildingTitle: 'Deixa o mapa comigo.',
    building: 'Estou pesquisando os troféus e reunindo as pistas para sua próxima conquista.',
    buildingStatus: 'Pesquisando o guia',
    buildingHint: 'O guia aparece aqui assim que estiver pronto.',
    noMissables: 'Nenhum troféu perdível neste jogo.',
  },
  [Language.En]: {
    title: 'Platinum guide',
    titleNoPlatinum: 'Trophy guide',
    notes: {
      heading: 'Before you start',
      collectibles: 'Collectibles',
      pointOfNoReturn: 'Point of no return',
      autopop: 'PS4 / PS5 autopop',
    },
    bugStatus: {
      recent: 'Reported recently',
      old: 'Old report, may be fixed',
      fixed: 'Fixed in an update',
      unconfirmed: 'Single report',
    },
    key: {
      earned: 'Earned',
      earnedOn: 'Earned on {date}',
      playersEarned: '{rate}% of players earned it',
      highlights: 'Platinum highlights',
      highlightsCount: {
        one: '{count} highlight',
        other: '{count} highlights',
      },
      easiest: 'Easiest',
      hardest: 'Hardest',
      mostTedious: 'Most tedious',
      tricks: 'Tips by trophy',
      tricksCount: {
        one: '{count} tip',
        other: '{count} tips',
      },
      source: 'Source: {source}',
      noTricks: 'No tricks recorded',
      noTricksHint: 'Check the roadmap to plan the order of your trophies.',
      cautions: 'Platinum watch-outs',
      onlineCount: {
        one: '{count} online trophy',
        other: '{count} online trophies',
      },
      onlineWarning: 'Mind the online mode',
      offlineOk: 'You can stay offline',
      boostable: 'Can be boosted with other players',
      onlineUndetailed: 'The guide lists online requirements but does not detail the trophies yet.',
      noOnline: 'No online trophies in this guide.',
      buggy: 'Glitched trophies',
      buggyCount: {
        one: '{count} glitched trophy',
        other: '{count} glitched trophies',
      },
      bugIssue: 'What can happen',
      bugWorkaround: 'How to fix or avoid it',
    },
    facts: {
      difficulty: 'Difficulty',
      hours: 'Estimated time',
      hoursDetail: 'For the platinum, without DLC',
      unknown: 'Not known yet',
      playthroughs: 'Minimum playthroughs',
      difficultyTrophy: 'Difficulty trophy',
      missables: 'Missables',
      none: 'None',
      online: 'Online',
      onlineTrophies: {
        one: '{count} trophy',
        other: '{count} trophies',
      },
      collectibles: 'Collectibles',
      postgame: 'After the ending',
      postgameValue: 'You can keep playing',
      yes: 'Yes',
      no: 'No',
    },
    glossary: {
      label: 'Game glossary',
      search: 'Search the glossary',
      placeholder: 'Search a term or definition',
      noMatch: 'No terms found. Try another word.',
      empty: 'This guide has no glossary terms yet.',
    },
    deep: {
      title: 'Deep guide',
      updatedOn: ' · updated on {date}',
      updating: ' (updating…)',
      askDetails: '. Ask Nexo for details: locations, order, collectibles.',
      ask: 'Ask',
      indexing: 'Indexing the full guides for detailed answers…',
    },
    tabs: {
      label: 'Guide sections',
      summary: 'Summary',
      key: 'Key trophies',
      missables: 'Missables',
      missablesSkeleton: 'Missables',
      roadmap: 'Roadmap',
      glossary: 'Glossary',
    },
    earlyTips: 'Tips for the start',
    sources: 'Sources: {sources}',
    queuedTitle: 'Your next achievement starts here.',
    queued:
      'The guide is queued. In the meantime, Nexo can already help with your questions about the game.',
    queuedStatus: 'Guide queued',
    buildingTitle: 'Leave the map to me.',
    building: 'I’m researching trophies and gathering clues for your next achievement.',
    buildingStatus: 'Researching the guide',
    buildingHint: 'Your guide will appear here as soon as it is ready.',
    noMissables: 'No missable trophies in this game.',
  },
})

/** What the guide needs from a game: its name (to keep the open tab), the guide, the trophies and the deep guide. */
export interface GuideGame {
  name: string
  guide?: GuideDetail | null
  trophies?: Trophy[] | null
  deepGuide?: DeepGuideStats | null
  /** No guide yet and none being researched now: it was put on the list to be written. */
  queued?: boolean
  /** Where "ask Nexo" opens the chat: the player's PSN list when they own the game, else its id. */
  np?: string | null
}

// Keep generated text free of decorative emoji; the interface uses SVG icons.
// Same rule as uiText() in lib/text, without the HTML escaping React already does.

const normalize = (name: unknown) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

function KeyArt({ trophy }: { trophy?: Trophy }) {
  return (
    <span className="key-art">
      {trophy?.iconUrl ? (
        <img src={trophy.iconUrl} alt="" loading="lazy" />
      ) : (
        <Icon name="trophy" />
      )}
    </span>
  )
}

function GuideNotes({ g }: { g: GuideDetail }) {
  const t = useMessages(messages)
  const notes = (
    [
      ['layers', t('notes.collectibles'), g.collectibles],
      ['compass', t('notes.pointOfNoReturn'), g.pointOfNoReturn],
      ['refresh', t('notes.autopop'), g.autopop],
    ] as const
  ).filter(([, , content]) => content)
  if (!notes.length) return null
  return (
    <section className="key-notes">
      <h3>{t('notes.heading')}</h3>
      {notes.map(([symbol, title, content], i) => (
        <details key={title} data-key-detail={`note-${i}`} className="key-note">
          <summary>
            <Icon name={symbol} />
            <span>{title}</span>
            <Icon name="chevron-down" />
          </summary>
          <p>{plainText(content)}</p>
        </details>
      ))}
    </section>
  )
}

// A glitch reported twice for the same trophy shows once, with both reports.
function bugsByTrophy(list: GuideDetail['buggy']) {
  const groups = new Map<string, NonNullable<GuideDetail['buggy']>>()
  for (const b of list ?? []) groups.set(b.trophy, [...(groups.get(b.trophy) ?? []), b])
  return [...groups]
}

const BUG_STATUS: Record<string, MessageKey<typeof messages>> = {
  recent: 'bugStatus.recent',
  old: 'bugStatus.old',
  fixed: 'bugStatus.fixed',
  unconfirmed: 'bugStatus.unconfirmed',
}

function BugStatus({ status, reported }: { status?: string | null; reported?: string | null }) {
  const t = useMessages(messages)
  if (!status && !reported) return null
  return (
    <div className="key-bug-meta">
      {status && (
        <span className={`key-bug-status ${status}`}>
          {BUG_STATUS[status] ? t(BUG_STATUS[status]) : status}
        </span>
      )}
      {reported && <span>{reported}</span>}
    </div>
  )
}

/** The game's trophy a guide names, by its pt-BR or English name. */
const trophyNamed = (c: GuideGame, name: string) =>
  (c.trophies ?? []).find(
    (t) => normalize(t.name) === normalize(name) || normalize(t.nameEn) === normalize(name),
  )

function KeyTrophies({ c, g }: { c: GuideGame; g: GuideDetail }) {
  const tr = useMessages(messages)
  const findTrophy = (name: string) => trophyNamed(c, name)
  const featured = (label: string, tone: string, item?: KeyTrophy | null) => {
    if (!item) return null
    const trophy = findTrophy(item.trophy)
    return (
      <details className={`key-feature ${tone}`} data-key-detail={`featured-${tone}`}>
        <summary>
          <KeyArt trophy={trophy} />
          <span className="key-feature-title">
            <span className="key-feature-label">{label}</span>
            <span>{item.trophy}</span>
          </span>
          {trophy?.earned && (
            <span className="key-earned">
              <Icon name="check" />
              <span>{tr('key.earned')}</span>
            </span>
          )}
          <span className="key-disclosure">
            <Icon name="chevron-down" />
          </span>
        </summary>
        <div className="key-feature-content">
          <p>{plainText(item.why)}</p>
          {trophy && (
            <span className="key-rarity">
              {tr('key.playersEarned', { rate: fmtRate(trophy.earnedRate) })}
            </span>
          )}
        </div>
      </details>
    )
  }
  const tricks = g.tricks ?? []
  const online = g.onlineTrophies ?? []
  const buggy = bugsByTrophy(g.buggy)
  const highlightCount = [g.easiest, g.hardest, g.mostTedious].filter(Boolean).length
  const hasOnline = online.length > 0 || g.hasOnline
  return (
    <div className="key-guide">
      {highlightCount > 0 && (
        <section className="key-highlights" aria-label={tr('key.highlights')}>
          <div className="key-section-head">
            <h3>
              <Icon name="trophy" />
              <span>{tr('key.highlights')}</span>
            </h3>
            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the counter reads as a sentence for screen readers */}
            <span
              className="key-count"
              aria-label={tr('key.highlightsCount', { count: highlightCount })}
            >
              {highlightCount}
            </span>
          </div>
          {featured(tr('key.easiest'), 'easy', g.easiest)}
          {featured(tr('key.hardest'), 'hard', g.hardest)}
          {featured(tr('key.mostTedious'), 'tedious', g.mostTedious)}
        </section>
      )}
      <div className="key-workspace">
        <section className="key-strategies">
          <div className="key-section-head">
            <h3>
              <Icon name="compass" />
              <span>{tr('key.tricks')}</span>
            </h3>
            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the counter reads as a sentence for screen readers */}
            <span
              className="key-count"
              aria-label={tr('key.tricksCount', { count: tricks.length })}
            >
              {tricks.length}
            </span>
          </div>
          <div className="key-strategy-list">
            {tricks.length ? (
              tricks.map((t, i) => {
                const trophy = findTrophy(t.trophy)
                return (
                  <details
                    // biome-ignore lint/suspicious/noArrayIndexKey: a guide can hold two tricks for one trophy; the list never reorders
                    key={`${t.trophy}-${i}`}
                    className={`key-strategy ${trophy?.earned ? 'earned' : ''}`}
                    data-key-detail={`trick-${i}`}
                  >
                    <summary>
                      <KeyArt trophy={trophy} />
                      <span className="key-strategy-title">
                        <span>{t.trophy}</span>
                      </span>
                      {trophy?.earned && (
                        <span className="key-earned key-earned-badge">
                          <Icon name="check" /> <span>{tr('key.earned')}</span>
                        </span>
                      )}
                      <span className="key-disclosure">
                        <Icon name="chevron-down" />
                      </span>
                    </summary>
                    <div className="key-strategy-content">
                      {trophy?.earnedAt && (
                        <small className="key-earned-date">
                          {tr('key.earnedOn', { date: fmtDate(trophy.earnedAt) })}
                        </small>
                      )}
                      <p>{plainText(t.trick)}</p>
                      {t.source && <SourceNote text={tr('key.source', { source: t.source })} />}
                    </div>
                  </details>
                )
              })
            ) : (
              <div className="key-empty">
                <Icon name="compass" />
                <div>
                  <b>{tr('key.noTricks')}</b>
                  <p>{tr('key.noTricksHint')}</p>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="key-sidebar" aria-label={tr('key.cautions')}>
          <section className={`key-online ${hasOnline ? 'has-online' : ''}`}>
            <div className="key-note-heading">
              <Icon name={hasOnline ? 'globe' : 'shield'} />
              <div>
                <h3>
                  {online.length
                    ? tr('key.onlineCount', { count: online.length })
                    : g.hasOnline
                      ? tr('key.onlineWarning')
                      : tr('key.offlineOk')}
                </h3>
              </div>
            </div>
            {online.length ? (
              online.map((o) => (
                <div key={o.trophy} className="key-online-item">
                  <h4>{o.trophy}</h4>
                  <p>{plainText(o.what)}</p>
                  {o.boostable && <span className="key-boost">{tr('key.boostable')}</span>}
                </div>
              ))
            ) : (
              <p>{g.hasOnline ? tr('key.onlineUndetailed') : tr('key.noOnline')}</p>
            )}
          </section>
          {buggy.length > 0 && (
            <section className="key-cautions">
              <div className="key-note-heading">
                <Icon name="warning" />
                <div>
                  <h3>{tr('key.buggy')}</h3>
                </div>
                {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the counter reads as a sentence for screen readers */}
                <span
                  className="key-count"
                  aria-label={tr('key.buggyCount', { count: buggy.length })}
                >
                  {buggy.length}
                </span>
              </div>
              {buggy.map(([trophy, items], i) => (
                <details key={trophy} className="key-caution" data-key-detail={`bug-${i}`}>
                  <summary>
                    <KeyArt trophy={findTrophy(trophy)} />
                    <span>{trophy}</span>
                    <Icon name="chevron-down" />
                  </summary>
                  {items.map((b, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: reports of one bug, in the guide's order
                    <div key={j} className="key-bug">
                      <BugStatus status={b.status} reported={b.reported} />
                      <dl className="key-bug-details">
                        <div>
                          <dt>{tr('key.bugIssue')}</dt>
                          <dd>{plainText(b.issue)}</dd>
                        </div>
                        {b.workaround && (
                          <div className="key-bug-solution">
                            <dt>{tr('key.bugWorkaround')}</dt>
                            <dd>{plainText(b.workaround)}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </details>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

// The first questions a hunter asks, answered at a glance. Older guides lack the
// difficulty and post-game fields, so those pills only show when researched.
function QuickFacts({ g }: { g: GuideDetail }) {
  const t = useMessages(messages)
  const first = (text?: string | null) => (text ? text.split(/(?<=[.;])\s/)[0] : '')
  const online = g.onlineTrophies?.length ?? 0
  const missables = g.missables?.length ?? 0
  // [icon, label, value, detail shown on hover]; rows without a known value are left out.
  const facts: [string, string, string, string][] = [
    // 0 means the sources do not say yet.
    ['target', t('facts.difficulty'), g.difficulty ? `${g.difficulty}/10` : t('facts.unknown'), ''],
    [
      'clock',
      t('facts.hours'),
      g.hours ? `~${g.hours}h` : t('facts.unknown'),
      t('facts.hoursDetail'),
    ],
    [
      'refresh',
      t('facts.playthroughs'),
      g.playthroughs ? String(g.playthroughs) : t('facts.unknown'),
      '',
    ],
  ]
  const yesNo = (v: unknown) => (v ? t('facts.yes') : t('facts.no'))
  if (g.difficultyTrophy !== undefined)
    facts.push([
      'shield',
      t('facts.difficultyTrophy'),
      yesNo(g.difficultyTrophy),
      first(g.difficultyTrophy),
    ])
  facts.push(
    ['warning', t('facts.missables'), missables ? String(missables) : t('facts.none'), ''],
    [
      'globe',
      t('facts.online'),
      online ? t('facts.onlineTrophies', { count: online }) : yesNo(g.hasOnline),
      '',
    ],
    ['layers', t('facts.collectibles'), yesNo(g.collectibles), first(g.collectibles)],
  )
  if (g.postgame)
    facts.push(['compass', t('facts.postgame'), t('facts.postgameValue'), first(g.postgame)])
  return (
    <dl className="quick-facts">
      {facts.map(([symbol, label, value, detail]) => (
        <div key={label} className="quick-fact" data-tip={detail || undefined}>
          <Icon name={symbol} />
          <dt>{label}:</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const normalizeTerm = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase(getLocale())

function Glossary({ items }: { items: GuideDetail['glossary'] }) {
  const tr = useMessages(messages)
  const [query, setQuery] = useState('')
  const q = normalizeTerm(query.trim())
  // Matches what the entry shows: the term and its meaning, without the bold markers.
  const shown = items.map((t) =>
    normalizeTerm(`${t.term}${t.meaning.replace(/\*\*/g, '')}`).includes(q),
  )
  const matches = shown.filter(Boolean).length
  return (
    <section className="guide-glossary" aria-label={tr('glossary.label')}>
      <label className="glossary-search">
        <Icon name="search" />
        <input
          type="search"
          data-glossary-search
          aria-label={tr('glossary.search')}
          placeholder={tr('glossary.placeholder')}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <dl className="glossary-list">
        {items.map((t, i) => (
          <div key={t.term} className="glossary-entry" hidden={!shown[i]}>
            <dt>{t.term}</dt>
            <dd>
              <UserText text={t.meaning} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="glossary-empty muted" data-glossary-empty role="status" hidden={matches > 0}>
        {items.length ? tr('glossary.noMatch') : tr('glossary.empty')}
      </p>
    </section>
  )
}

function DeepGuide({ dg, chat }: { dg?: DeepGuideStats | null; chat: string }) {
  const t = useMessages(messages)
  if (dg?.chunks)
    return (
      <div className="deep-guide">
        <Icon name="layers" />
        <span>
          <b>{t('deep.title')}</b>
          {dg.indexedAt ? t('deep.updatedOn', { date: fmtDate(dg.indexedAt) }) : ''}
          {dg.indexing ? t('deep.updating') : ''}
          {t('deep.askDetails')}
        </span>
        <Link className="text-link" to={chat}>
          {t('deep.ask')} <Icon name="arrow" />
        </Link>
      </div>
    )
  if (dg?.indexing)
    return (
      <div className="deep-guide">
        <Icon name="layers" />
        <span>
          <span className="typing">
            <i />
            <i />
            <i />
          </span>{' '}
          {t('deep.indexing')}
        </span>
      </div>
    )
  return null
}

/** A missable trophy: its art, when it can be lost, and how to get it in time. */
function Missable({ c, m }: { c: GuideGame; m: NonNullable<GuideDetail['missables']>[number] }) {
  const tr = useMessages(messages)
  const trophy = trophyNamed(c, m.trophy)
  return (
    <div className="missable">
      <KeyArt trophy={trophy} />
      <div className="missable-body">
        <div className="missable-head">
          <b>{m.trophy}</b>
          {trophy?.earned && (
            <span className="key-earned">
              <Icon name="check" />
              <span>{tr('key.earned')}</span>
            </span>
          )}
        </div>
        <p className="missable-when">{m.when}</p>
        <p className="muted">{plainText(m.how)}</p>
      </div>
    </div>
  )
}

/** The guide skeleton, also shown (with a pending line) while the guide is being researched. */
export function GuideSkeleton() {
  const t = useMessages(messages)
  return (
    <>
      <h2 className="guide-heading">
        <Icon name="book-open" />
        <span>{t('title')}</span>
      </h2>
      <div className="tabs">
        {(
          [
            'tabs.summary',
            'tabs.key',
            'tabs.missablesSkeleton',
            'tabs.roadmap',
            'tabs.glossary',
          ] as const
        ).map((key, i) => (
          <button key={key} type="button" className={i === 0 ? 'active' : ''} disabled>
            {t(key)}
          </button>
        ))}
      </div>
      <div data-panel="0">
        <Sk w="100%" h={13} />
        <Sk w="96%" h={13} style={{ marginTop: 8 }} />
        <Sk w="72%" h={13} style={{ marginTop: 8 }} />
        <h2 style={{ marginTop: 14 }}>{t('earlyTips')}</h2>
        <ul className="clean">
          {repeat(4, (i) => (
            <li>
              <Sk w={`${92 - i * 9}%`} h={12} />
            </li>
          ))}
        </ul>
        <Sk w="55%" h={10} style={{ marginTop: 14 }} />
      </div>
    </>
  )
}

/**
 * The inside of the guide card. `id` is the card's id, used for the tab ids. Give it `key={game.name}`
 * so another game opens on the first tab; the same game keeps its tab and open sections on refresh.
 */
export function Guide({ game: c, id = 'guide-card' }: { game: GuideGame | null; id?: string }) {
  const tr = useMessages(messages)
  const [selected, setSelectedState] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)
  const [moreTabs, setMoreTabs] = useState(false)
  // A shorter panel shrinks the page; when the tabs had scrolled out of sight above, bring them back
  // to the top of the screen instead of leaving the reader wherever the shorter page ends.
  const setSelected = (i: number) => {
    const row = tabsRef.current
    const above = row ? row.getBoundingClientRect().top < 0 : false
    setSelectedState(i)
    // Slide the chosen tab into view inside the row, without moving the page.
    const tab = tabRefs.current[i]
    if (
      row &&
      tab &&
      (tab.offsetLeft < row.scrollLeft ||
        tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth)
    )
      row.scrollTo({ left: tab.offsetLeft - 16, behavior: 'smooth' })
    if (above && row)
      requestAnimationFrame(() =>
        window.scrollTo({ top: window.scrollY + row.getBoundingClientRect().top - 16 }),
      )
    // Otherwise the tabs stay where they were on screen. Safari moves the page when the panel
    // changes height; this puts it back before the frame is painted.
    else if (row) {
      const top = row.getBoundingClientRect().top
      requestAnimationFrame(() => {
        const moved = row.getBoundingClientRect().top - top
        if (Math.abs(moved) > 1) window.scrollBy({ top: moved })
      })
    }
  }
  // A fade on the right edge says there are more tabs to swipe to.
  const checkTabs = () => {
    const el = tabsRef.current
    if (el) setMoreTabs(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const g = c?.guide
  // A list without a platinum (short games, live-service ones) still has a guide: for the 100%.
  const noPlatinum = !!c?.trophies?.length && !c.trophies.some((t) => t.type === 'platinum')
  const heading = tr(noPlatinum ? 'titleNoPlatinum' : 'title')
  if (!g)
    return (
      <>
        <h2 className="guide-heading">
          <Icon name="book-open" />
          <span>{heading}</span>
        </h2>
        <div className="guide-queued" role="status">
          <NexoHero working />
          <div className="guide-work-copy">
            <span className="guide-work-label">
              {tr(c?.queued ? 'queuedStatus' : 'buildingStatus')}
            </span>
            <b>{tr(c?.queued ? 'queuedTitle' : 'buildingTitle')}</b>
            <p>{tr(c?.queued ? 'queued' : 'building')}</p>
            {!c?.queued && <span className="guide-work-hint">{tr('buildingHint')}</span>}
          </div>
        </div>
        {!c?.queued && (
          <div className="guide-research-preview" aria-hidden="true">
            <GuideSkeleton />
          </div>
        )}
      </>
    )
  const missables = g.missables ?? []
  const roadmap = g.roadmap ?? []
  const glossary = g.glossary ?? []
  const earlyTips = g.earlyTips ?? []
  const tabs: [string, number | null][] = [
    [tr('tabs.summary'), null],
    [tr('tabs.key'), null],
    [tr('tabs.missables'), missables.length],
    [tr('tabs.roadmap'), roadmap.length],
    [tr('tabs.glossary'), glossary.length],
  ]
  const panels = [
    <Fragment key="summary">
      <QuickFacts g={g} />
      <p style={{ margin: 0, color: 'var(--color-fg)' }}>{plainText(g.overview)}</p>
      <GuideNotes g={g} />
      {earlyTips.length > 0 && (
        <>
          <h2 style={{ marginTop: 14 }}>{tr('earlyTips')}</h2>
          <ul>
            {earlyTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        {tr('sources', { sources: (g.sources ?? []).join(', ') })}
      </p>
    </Fragment>,
    <KeyTrophies key="key" c={c} g={g} />,
    missables.length ? (
      <Fragment key="missables">
        {missables.map((m, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one trophy can be missable in two places; the list never reorders
          <Missable key={`${m.trophy}-${i}`} c={c} m={m} />
        ))}
      </Fragment>
    ) : (
      <EmptyState key="missables" className="inline-status">
        <Icon name="shield" /> {tr('noMissables')}
      </EmptyState>
    ),
    <ul key="roadmap" className="clean">
      {roadmap.map((r, i) => (
        <li key={r.phase} style={{ margin: '0 0 10px' }}>
          <b className="display" style={{ color: 'var(--color-accent)' }}>
            {i + 1}. {r.phase}
          </b>
          <br />
          {plainText(r.goal)}
          {r.trophies.length > 0 && (
            <>
              <br />
              <small className="muted">{r.trophies.join(' · ')}</small>
            </>
          )}
        </li>
      ))}
    </ul>,
    <Glossary key="glossary" items={glossary} />,
  ]
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + last) % tabs.length,
      Home: 0,
      End: last,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setSelected(next)
    tabRefs.current[next]?.focus()
  }
  return (
    <>
      <h2 className="guide-heading">
        <Icon name="book-open" />
        <span>{heading}</span>
      </h2>
      <DeepGuide dg={c.deepGuide} chat={nexoHref(c.np, c.name)} />
      <div
        ref={(el) => {
          tabsRef.current = el
          if (el && !el.dataset.watched) {
            el.dataset.watched = '1'
            requestAnimationFrame(checkTabs)
          }
        }}
        className={`tabs guide-tabs${moreTabs ? ' has-more' : ''}`}
        role="tablist"
        aria-label={tr('tabs.label')}
        onScroll={checkTabs}
      >
        {tabs.map(([label, count], i) => (
          <button
            key={label}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-controls={`${id}-panel-${i}`}
            aria-selected={i === selected}
            tabIndex={i === selected ? 0 : -1}
            className={i === selected ? 'active' : ''}
            data-tab={i}
            onClick={() => setSelected(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {label}
            {/* Zero is shown too: "Perdíveis 0" is an answer, not a missing number. */}
            {count != null && <span className="guide-tab-count">{count}</span>}
          </button>
        ))}
      </div>
      <div>
        {panels.map((p, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: the five panels are fixed, one per tab
            key={i}
            role="tabpanel"
            id={`${id}-panel-${i}`}
            aria-labelledby={`${id}-tab-${i}`}
            data-panel={i}
            hidden={i !== selected}
          >
            {p}
          </div>
        ))}
      </div>
    </>
  )
}
