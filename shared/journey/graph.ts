/**
 * What a trophy depends on, when the guide says (`trophyGraph`): the quests and choices that lead to
 * it, and the point after which it can no longer be earned. The guide writes it for games whose
 * trophies hang on branching lines played in any order, where a line of steps (`places.ts`) cannot
 * say what comes first. ADR-014.
 *
 * PSN only says which trophies were earned, never which quest the player finished, so a step counts
 * as done only when a trophy that needs it was earned. Everything else is still to do, which errs on
 * the side of telling the player one step too many.
 */
import { trophyMatches } from './ongoing'

const KINDS = ['unlocks', 'anyOf', 'closes'] as const
export type EdgeKind = (typeof KINDS)[number]

interface GraphNode {
  id: string
  // How the guide names it: a quest, a choice or a trophy.
  label: string
  // When the node is a trophy: its name, as in the trophy list.
  trophy?: string
}

interface GraphEdge {
  from: string
  to: string
  // `unlocks`: `to` needs `from`. `anyOf`: `to` needs one of its `anyOf` parents. `closes`: once
  // `from` is done, `to` can no longer be earned.
  kind: EdgeKind
}

export interface TrophyGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphGuide {
  trophyGraph?: TrophyGraph | null
}

export interface GraphTrophy {
  name: string
  nameEn?: string
  earned: boolean
  groupId: string
}

/** A graph the app can read: every edge joins two nodes it lists, with a kind it knows. */
function usable(g?: GraphGuide | null): TrophyGraph | undefined {
  const graph = g?.trophyGraph
  if (!graph?.nodes?.length || !graph.edges?.length) return undefined
  const ids = new Set(graph.nodes.map((n) => n.id))
  const valid = graph.edges.every(
    (e) => ids.has(e.from) && ids.has(e.to) && (KINDS as readonly string[]).includes(e.kind),
  )
  return valid ? graph : undefined
}

/** The base-game trophy a node stands for, matched by a name no other trophy shares. */
function trophyOf<T extends GraphTrophy>(node: GraphNode, trophies: T[]) {
  if (!node.trophy) return undefined
  const name = node.trophy
  const found = trophies.filter((t) => t.groupId === 'default' && trophyMatches(t, name))
  return found.length === 1 ? found[0] : undefined
}

const parents = (graph: TrophyGraph, id: string, kind: EdgeKind) =>
  graph.edges.filter((e) => e.to === id && e.kind === kind).map((e) => e.from)

const children = (graph: TrophyGraph, id: string) =>
  graph.edges.filter((e) => e.from === id && e.kind !== 'closes').map((e) => e.to)

/**
 * The nodes known to be done: earned trophies, and every step an earned trophy needed. A node with
 * several `anyOf` parents does not say which one the player took, so none of them is marked.
 */
function doneNodes<T extends GraphTrophy>(graph: TrophyGraph, trophies: T[]) {
  const done = new Set(graph.nodes.filter((n) => trophyOf(n, trophies)?.earned).map((n) => n.id))
  const queue = [...done]
  while (queue.length) {
    const id = queue.pop() as string
    const any = parents(graph, id, 'anyOf')
    const needed = [...parents(graph, id, 'unlocks'), ...(any.length === 1 ? any : [])]
    for (const p of needed)
      if (!done.has(p)) {
        done.add(p)
        queue.push(p)
      }
  }
  return done
}

/** The steps still to do before a node, nearest the start first; `anyOf` choices kept together. */
function pendingBefore(graph: TrophyGraph, id: string, done: Set<string>) {
  const steps: string[][] = []
  const seen = new Set<string>()
  const visit = (node: string) => {
    if (seen.has(node)) return
    seen.add(node)
    for (const p of parents(graph, node, 'unlocks')) if (!done.has(p)) visit(p)
    const any = parents(graph, node, 'anyOf')
    if (any.length && !any.some((p) => done.has(p))) steps.push(any)
    if (node !== id && !done.has(node)) steps.push([node])
  }
  visit(id)
  return steps
}

const label = (graph: TrophyGraph, id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id

interface TrophyNeeds {
  // Steps still to do, in order; a step with several labels needs only one of them.
  steps: string[][]
  // The point after which it can no longer be earned, while it has not passed.
  closesAt?: string
  // That point has passed and the trophy was not earned: not in this save.
  lost?: string
}

/** What an open trophy still needs, from the guide's graph. Undefined when the graph says nothing. */
export function trophyNeeds<T extends GraphTrophy>(
  trophy: T,
  trophies: T[],
  guide?: GraphGuide | null,
): TrophyNeeds | undefined {
  const graph = usable(guide)
  if (!graph || trophy.earned) return undefined
  const node = graph.nodes.find((n) => trophyOf(n, trophies) === trophy)
  if (!node) return undefined
  const done = doneNodes(graph, trophies)
  const closer = graph.edges.find((e) => e.to === node.id && e.kind === 'closes')
  if (closer && done.has(closer.from)) return { steps: [], lost: label(graph, closer.from) }
  const steps = pendingBefore(graph, node.id, done).map((s) => s.map((id) => label(graph, id)))
  const closesAt = closer ? label(graph, closer.from) : undefined
  if (!steps.length && !closesAt) return undefined
  return { steps, ...(closesAt ? { closesAt } : {}) }
}

/** The open, still earnable trophies a node leads to. */
function opensFrom<T extends GraphTrophy>(
  graph: TrophyGraph,
  id: string,
  trophies: T[],
  lost: Set<T>,
) {
  const found: { trophy: T; hops: number }[] = []
  const seen = new Set([id])
  let level = [id]
  for (let hops = 1; level.length; hops++) {
    level = level.flatMap((n) => children(graph, n)).filter((n) => !seen.has(n))
    for (const n of level) {
      seen.add(n)
      const node = graph.nodes.find((x) => x.id === n)
      const t = node && trophyOf(node, trophies)
      if (t && !t.earned && !lost.has(t)) found.push({ trophy: t, hops })
    }
  }
  return found
}

/**
 * The trophy to aim at when one step opens several: among the steps the player can do now (all
 * they need is done), the one that leads to the most open trophies, two at least. The trophy given
 * is the nearest of them, so the suggestion names something the player can earn. Undefined when no
 * step opens more than one.
 */
export function keyStep<T extends GraphTrophy>(trophies: T[], guide?: GraphGuide | null) {
  const graph = usable(guide)
  if (!graph) return undefined
  const done = doneNodes(graph, trophies)
  const lost = new Set(
    graph.edges
      .filter((e) => e.kind === 'closes' && done.has(e.from))
      .flatMap((e) => {
        const node = graph.nodes.find((n) => n.id === e.to)
        const t = node && trophyOf(node, trophies)
        return t && !t.earned ? [t] : []
      }),
  )
  const ready = graph.nodes.filter(
    (n) =>
      !n.trophy &&
      !done.has(n.id) &&
      parents(graph, n.id, 'unlocks').every((p) => done.has(p)) &&
      (!parents(graph, n.id, 'anyOf').length ||
        parents(graph, n.id, 'anyOf').some((p) => done.has(p))),
  )
  let best: { step: string; trophy: T; opens: number } | undefined
  for (const n of ready) {
    const opens = opensFrom(graph, n.id, trophies, lost)
    if (opens.length < 2 || (best && opens.length <= best.opens)) continue
    const nearest = opens.reduce((a, b) => (b.hops < a.hops ? b : a))
    best = { step: n.label, trophy: nearest.trophy, opens: opens.length }
  }
  return best
}
