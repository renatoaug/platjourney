import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Cover } from './cover'
import { Icon } from './icon'
import { Markdown } from './markdown'
import { Pager } from './pager'
import { Sk } from './skeleton'
import { SourceNote } from './source-note'
import { EmptyState, ErrorState, PendingState } from './states'
import { toast } from './toast'

const meta: Meta = { title: 'UI/Primitives' }
export default meta
type Story = StoryObj

const ICONS = [
  'trophy',
  'dashboard',
  'gamepad',
  'target',
  'compass',
  'history',
  'check',
  'circle',
  'plus',
  'minus',
  'edit',
  'trash',
  'clock',
  'warning',
  'shield',
  'nexo',
  'arrow',
  'refresh',
  'close',
  'globe',
  'chevron-up',
  'chevron-down',
  'bookmark',
  'grip',
  'search',
  'bookmark-filled',
  'layers',
  'bolt',
  'copy',
  'eye',
  'eye-off',
  'bell',
]

export const Icons: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-4">
      {ICONS.map((name) => (
        <div key={name} className="flex items-center gap-2 text-fg-soft text-md">
          <Icon name={name} /> {name}
        </div>
      ))}
    </div>
  ),
}

export const Toasts: Story = {
  render: () => (
    <div className="chips">
      <button type="button" onClick={() => toast('Salvo nos interesses.', 'success')}>
        Sucesso
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() => toast('Não foi possível salvar. Tente de novo.')}
      >
        Erro
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() => toast('Guia atualizado.', 'info', { href: '/game', label: 'Abrir' })}
      >
        Info com ação
      </button>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="card stack">
      <EmptyState action={<a href="/discover">Descobrir jogos</a>}>Nada por aqui ainda.</EmptyState>
      <ErrorState>Não conseguimos carregar. Tente de novo.</ErrorState>
      <PendingState>Pesquisando o guia deste jogo…</PendingState>
    </div>
  ),
}

function PagerDemo({ look }: { look?: 'numbers' | 'arrows' }) {
  const [page, setPage] = useState(1)
  return <Pager page={page} size={8} total={25} onPage={setPage} look={look} />
}

export const Paging: Story = {
  render: () => (
    <div className="card">
      <PagerDemo />
    </div>
  ),
}

// The band's pager: previous, "1/4", next.
export const PagingArrows: Story = {
  render: () => (
    <div className="card">
      <PagerDemo look="arrows" />
    </div>
  ),
}

export const Skeleton: Story = {
  render: () => (
    <div className="card">
      <Sk w="40%" h={16} />
      <Sk w="100%" h={11} style={{ marginTop: 12 }} />
      <Sk w="85%" h={11} style={{ marginTop: 6 }} />
    </div>
  ),
}

export const Covers: Story = {
  render: () => (
    <div className="flex gap-4">
      <Cover url="/logo.svg" name="PlatJourney" className="entry-cover" />
      <Cover name="Days Gone" className="entry-cover" />
    </div>
  ),
}

export const Source: Story = {
  render: () => (
    <div className="card">
      <Markdown
        text={
          'Pegue o **Nitro 3** no Lago Diamond antes de tentar.\n\n- Derrape por 5 segundos\n- Mantenha o nitro'
        }
      />
      <SourceNote text="Fonte: Trophy Guides e Platinum Forum" />
    </div>
  ),
}

export const Tooltip: Story = {
  render: () => (
    <button
      type="button"
      className="icon-button"
      aria-label="Atualizar dados"
      data-tip="Dados sincronizados às 10:42"
    >
      <Icon name="refresh" />
    </button>
  ),
}
