/** Trophy guide card: quick facts, roadmap, missables, key trophies and known bugs. */
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { defineMessages, getLocale, Language, type MessageKey, useMessages } from '../i18n/i18n'
import { fmtDate, fmtRate } from '../lib/format'
import { nameText } from '../lib/text'
import type { DeepGuideStats, GuideDetail, Trophy } from '../lib/types'
import { Icon } from '../ui/icon'
import { GuideText, UserText } from '../ui/markdown'
import { repeat, Sk } from '../ui/skeleton'
import { SourceNote } from '../ui/source-note'
import { EmptyState } from '../ui/states'
import { TrophyArt } from '../ui/trophy-art'
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
      key: 'Macetes',
      missables: 'Perdíveis',
      missablesSkeleton: 'Perdíveis',
      roadmap: 'Roadmap',
      glossary: 'Glossário',
    },
    earlyTips: 'Durante a história',
    watchOut: 'Fique de olho',
    pointOfNoReturn: 'Ponto sem volta:',
    missableLabel: { one: 'Perdível:', other: 'Perdíveis:' },
    missableCount: { one: '{count} troféu', other: '{count} troféus' },
    missableHow: 'Ver como pegar',
    afterEnding: 'Depois do final',
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
    phaseTrophies: 'Saem nesta fase:',
  },
  [Language.En]: {
    title: 'Platinum guide',
    titleNoPlatinum: 'Trophy guide',
    notes: {
      heading: 'Before you start',
      collectibles: 'Collectibles',
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
      key: 'Tricks',
      missables: 'Missables',
      missablesSkeleton: 'Missables',
      roadmap: 'Roadmap',
      glossary: 'Glossary',
    },
    earlyTips: 'While you play the story',
    watchOut: 'Watch out',
    pointOfNoReturn: 'Point of no return:',
    missableLabel: { one: 'Missable:', other: 'Missables:' },
    missableCount: { one: '{count} trophy', other: '{count} trophies' },
    missableHow: 'See how to get them',
    afterEnding: 'After the ending',
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
    phaseTrophies: 'Earned in this phase:',
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
      <TrophyArt url={trophy?.iconUrl} />
    </span>
  )
}

function GuideNotes({ g }: { g: GuideDetail }) {
  const t = useMessages(messages)
  const notes = (
    [
      ['layers', t('notes.collectibles'), g.collectibles],
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
          <p>
            <GuideText text={content} />
          </p>
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

// The tips tab in one list: the easiest, hardest and most tedious trophies first, set apart, then the
// other tips. A highlighted trophy with its own tip shows both in one entry, so nothing repeats.
function keyTips(g: GuideDetail) {
  const tricks = g.tricks ?? []
  const featured = (
    [
      ['easiest', 'easy', g.easiest],
      ['hardest', 'hard', g.hardest],
      ['mostTedious', 'tedious', g.mostTedious],
    ] as const
  ).flatMap(([label, tone, item]) =>
    item
      ? [
          {
            label,
            tone,
            item,
            trick: tricks.find((t) => normalize(t.trophy) === normalize(item.trophy)),
          },
        ]
      : [],
  )
  const named = new Set(featured.map((f) => normalize(f.item.trophy)))
  const rest = tricks.filter((t) => !named.has(normalize(t.trophy)))
  return { featured, rest, count: featured.length + rest.length }
}

function KeyTrophies({ c, g }: { c: GuideGame; g: GuideDetail }) {
  const tr = useMessages(messages)
  const findTrophy = (name: string) => trophyNamed(c, name)
  const { featured, rest: tricks, count } = keyTips(g)
  const online = g.onlineTrophies ?? []
  const buggy = bugsByTrophy(g.buggy)
  const hasOnline = online.length > 0 || g.hasOnline
  return (
    <div className="key-guide">
      <div className="key-workspace">
        <section className="key-strategies">
          <div className="key-section-head">
            <h3>
              <Icon name="compass" />
              <span>{tr('key.tricks')}</span>
            </h3>
            {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the counter reads as a sentence for screen readers */}
            <span className="key-count" aria-label={tr('key.tricksCount', { count })}>
              {count}
            </span>
          </div>
          <div className="key-strategy-list">
            {featured.map((f) => {
              const trophy = findTrophy(f.item.trophy)
              return (
                <details
                  key={f.tone}
                  className={`key-strategy key-feature ${f.tone} ${trophy?.earned ? 'earned' : ''}`}
                  data-key-detail={`featured-${f.tone}`}
                >
                  <summary>
                    <KeyArt trophy={trophy} />
                    <span className="key-strategy-title key-feature-title">
                      <span className="key-feature-label">{tr(`key.${f.label}`)}</span>
                      <span>{f.item.trophy}</span>
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
                    <p>
                      <GuideText text={f.item.why} />
                    </p>
                    {f.trick && (
                      <p>
                        <GuideText text={f.trick.trick} />
                      </p>
                    )}
                    {trophy && (
                      <span className="key-rarity">
                        {tr('key.playersEarned', { rate: fmtRate(trophy.earnedRate) })}
                      </span>
                    )}
                  </div>
                </details>
              )
            })}
            {count ? (
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
                      <p>
                        <GuideText text={t.trick} />
                      </p>
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
                  <p>
                    <GuideText text={o.what} />
                  </p>
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
                          <dd>
                            <GuideText text={b.issue} />
                          </dd>
                        </div>
                        {b.workaround && (
                          <div className="key-bug-solution">
                            <dt>{tr('key.bugWorkaround')}</dt>
                            <dd>
                              <GuideText text={b.workaround} />
                            </dd>
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
    normalizeTerm(`${t.term}${t.meaning}`.replace(/\*\*/g, '')).includes(q),
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
            <dt>{nameText(t.term)}</dt>
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
function Missable({
  c,
  m,
  spotlit = false,
}: {
  c: GuideGame
  m: NonNullable<GuideDetail['missables']>[number]
  spotlit?: boolean
}) {
  const tr = useMessages(messages)
  const trophy = trophyNamed(c, m.trophy)
  return (
    <div className={`missable${spotlit ? ' spotlit' : ''}`}>
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
        <p className="missable-when">
          <GuideText text={m.when} />
        </p>
        <p className="muted">
          <GuideText text={m.how} />
        </p>
      </div>
    </div>
  )
}

/** The guide skeleton, also shown (with a pending line) while the guide is being researched. */
/** A roadmap phase: a line of context, numbered steps, then tips and warnings set apart. */
function PhaseGoal({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const step = /^\d+[.)]\s+/
  const note = /^(Dica|Atenção|Tip|Warning):\s*/
  const intro = lines.filter((l) => !step.test(l) && !note.test(l))
  const steps = lines.filter((l) => step.test(l))
  const notes = lines.filter((l) => note.test(l))
  return (
    <div className="phase-goal">
      {intro.map((l) => (
        <p key={l}>
          <GuideText text={l} />
        </p>
      ))}
      {steps.length > 0 && (
        <ol>
          {steps.map((l) => (
            <li key={l}>
              <GuideText text={l.replace(step, '')} />
            </li>
          ))}
        </ol>
      )}
      {notes.map((l) => (
        <p key={l} className="phase-note">
          <Icon name={/^(Atenção|Warning)/.test(l) ? 'warning' : 'bolt'} />
          <span>
            <b>{l.match(note)?.[1]}:</b> <GuideText text={l.replace(note, '')} />
          </span>
        </p>
      ))}
    </div>
  )
}

// A guide field written one step per line, as a list.
const lines = (text?: string | null) =>
  (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

// One moment of the game in the summary (during the story, what can be lost, after the ending). An item
// can open with a label ("Perdíveis:"), set apart from the game's names in bold.
type Moment = string | { label: string; text: string; action?: ReactNode }
function MomentList({ title, items }: { title: string; items: Moment[] }) {
  if (!items.length) return null
  return (
    <>
      <h2 style={{ marginTop: 14 }}>{title}</h2>
      <ul>
        {items.map((m) =>
          typeof m === 'string' ? (
            <li key={m}>
              <GuideText text={m} />
            </li>
          ) : (
            <li key={m.label + m.text}>
              <b className="moment-label">{m.label}</b> <GuideText text={m.text} />
              {m.action && <> {m.action}</>}
            </li>
          ),
        )}
      </ul>
    </>
  )
}

// Missables that happen at the same moment read as one line: the moment once, then the trophies.
function missablesByMoment(missables: GuideDetail['missables']) {
  const byWhen = new Map<string, string[]>()
  for (const m of missables) byWhen.set(m.when, [...(byWhen.get(m.when) ?? []), m.trophy])
  return [...byWhen].map(([when, trophies]) => ({ when, trophies }))
}

// "Não há ponto sem volta..." is not a warning: leave it out of "watch out".
const noPointOfNoReturn = (text?: string | null) =>
  /^(não há|nao ha|não existe|nenhum|sem|there is no|no )\b/i.test(lines(text)[0] ?? '')

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
  // The missables a "see how" link pointed at: the Missables tab marks them and scrolls to the first.
  const [spotlight, setSpotlight] = useState<string[]>([])
  useEffect(() => {
    if (!spotlight.length) return
    requestAnimationFrame(() =>
      document
        .querySelector('.missable.spotlit')
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    )
  }, [spotlight])
  const tabsRef = useRef<HTMLDivElement>(null)
  const [moreTabs, setMoreTabs] = useState(false)
  // A shorter panel shrinks the page; when the tabs had scrolled out of sight above, bring them back
  // to the top of the screen instead of leaving the reader wherever the shorter page ends.
  const setSelected = (i: number) => {
    const row = tabsRef.current
    const above = row ? row.getBoundingClientRect().top < 0 : false
    setSelectedState(i)
    setSpotlight([])
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
  // The bar under the active tab slides to the chosen one: its place and width go to the tab row as
  // CSS variables, kept in step with the row's size (fonts loading, a narrower screen).
  useLayoutEffect(() => {
    const row = tabsRef.current
    const place = () => {
      const tab = tabRefs.current[selected]
      if (!row || !tab) return
      row.style.setProperty('--tab-bar-left', `${tab.offsetLeft}px`)
      row.style.setProperty('--tab-bar-width', `${tab.offsetWidth}px`)
    }
    place()
    if (!row) return
    const watch = new ResizeObserver(place)
    watch.observe(row)
    return () => watch.disconnect()
  })
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
    [tr('tabs.roadmap'), roadmap.length],
    [tr('tabs.key'), keyTips(g).count],
    [tr('tabs.missables'), missables.length],
    [tr('tabs.glossary'), glossary.length],
  ]
  const panels = [
    <Fragment key="summary">
      <QuickFacts g={g} />
      <p style={{ margin: 0, color: 'var(--color-fg)' }}>
        <GuideText text={g.overview} />
      </p>
      <GuideNotes g={g} />
      <MomentList title={tr('earlyTips')} items={earlyTips} />
      <MomentList
        title={tr('watchOut')}
        items={[
          ...missablesByMoment(missables).map((m) => ({
            label: tr('missableLabel', { count: m.trophies.length }),
            text:
              m.trophies.length === 1
                ? `**${m.trophies[0]}** — ${m.when}`
                : `${tr('missableCount', { count: m.trophies.length })} — ${m.when}`,
            action: (
              <button
                type="button"
                className="moment-action"
                onClick={() => {
                  setSelected(tabs.findIndex(([name]) => name === tr('tabs.missables')))
                  setSpotlight(m.trophies)
                }}
              >
                {tr('missableHow')} <Icon name="arrow-right" />
              </button>
            ),
          })),
          ...(g.pointOfNoReturn && !noPointOfNoReturn(g.pointOfNoReturn)
            ? [{ label: tr('pointOfNoReturn'), text: lines(g.pointOfNoReturn).join('\n') }]
            : []),
        ]}
      />
      <MomentList title={tr('afterEnding')} items={lines(g.postgame)} />
      {g.sources?.length ? (
        <SourceNote text={tr('sources', { sources: g.sources.join(', ') })} />
      ) : null}
    </Fragment>,
    <ul key="roadmap" className="clean guide-roadmap">
      {roadmap.map((r, i) => (
        <li key={r.phase} style={{ margin: '0 0 14px' }}>
          <b className="display" style={{ color: 'var(--color-accent)' }}>
            {i + 1}. {nameText(r.phase)}
          </b>
          <PhaseGoal text={r.goal} />
          {r.trophies.length > 0 && (
            <p className="phase-trophies">
              <Icon name="trophy" />
              <span>
                <b>{tr('phaseTrophies')}</b> {r.trophies.join(' · ')}
              </span>
            </p>
          )}
        </li>
      ))}
    </ul>,
    <KeyTrophies key="key" c={c} g={g} />,
    missables.length ? (
      <Fragment key="missables">
        {missables.map((m, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one trophy can be missable in two places; the list never reorders
          <Missable key={`${m.trophy}-${i}`} c={c} m={m} spotlit={spotlight.includes(m.trophy)} />
        ))}
      </Fragment>
    ) : (
      <EmptyState key="missables" className="inline-status">
        <Icon name="shield" /> {tr('noMissables')}
      </EmptyState>
    ),
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
            className="guide-panel"
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
