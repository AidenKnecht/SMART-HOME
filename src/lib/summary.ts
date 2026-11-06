// AI pre-visit summary: builds the input from the model, calls the serverless function, caches
// results in the browser, and falls back to a rule-based summary from the same numbers.
import { measuresFor } from '@/components/clinician/tiles'
import type { Model } from '@/components/clinician/model'
import { fmtDay } from './derive'
import type { SummaryInput, SummaryResponse } from './summaryTypes'

export type { SummaryInput, SummaryResponse } from './summaryTypes'

export type SummarySource = 'ai' | 'cache' | 'fallback'
export interface SummaryResult {
  text: string
  source: SummarySource
  model?: string
  generatedAt?: string
  /** Why the fallback was used */
  reason?: string
}

const RANGE_LABEL: Record<string, string> = {
  visit: 'since last visit',
  '14': 'last 14 days',
  '30': 'last 30 days',
  '90': 'last 90 days',
}

/** `order` = the clinician's view measure keys; those come first, so the summary follows their priorities. */
export function buildSummaryInput(m: Model, rangeKey = 'visit', order: string[] = []): SummaryInput {
  const { doc, stats, gina, flags, last, tracker } = m
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length)
  const measures = [...measuresFor(m)].sort((a, b) => rank(a.key) - rank(b.key)).map((t) => {
    const v = t.view(m)
    return { label: t.labelFor?.(m) ?? t.label, value: v.value, unit: v.unit, tone: v.tone, change: v.change?.text, note: v.note }
  })
  return {
    patient: {
      firstName: doc.firstName,
      age: doc.age,
      sex: doc.sex === 'F' ? 'female' : 'male',
      condition: tracker.condition,
      tracker: tracker.name,
    },
    range: {
      from: m.from,
      to: m.to,
      days: stats.daysInRange,
      loggedDays: stats.loggedDays,
      label: RANGE_LABEL[rangeKey] ?? rangeKey,
    },
    lastVisit: m.lastVisit,
    lastActivity: { overall: last.overall, checkIn: last.tracker, dose: last.dose, spirometry: last.spirometry },
    measures,
    control: gina
      ? {
          label: gina.label,
          basedOnDays: gina.basedOnDays,
          windowDays: gina.windowDays,
          criteria: gina.criteria.map(({ text, met, evidence }) => ({ text, met, evidence })),
        }
      : undefined,
    flags: flags.map(({ severity, text }) => ({ severity, text })),
  }
}

/** Deterministic summary from the same numbers, used when the AI is unavailable. */
export function fallbackSummary(i: SummaryInput): string {
  const s: string[] = []
  s.push(
    `${i.patient.firstName}, ${i.patient.age}, ${i.patient.condition.toLowerCase()}: ${i.range.days} days ${i.range.label} (${fmtDay(i.range.from)} to ${fmtDay(i.range.to)}), with a check-in on ${i.range.loggedDays} of them.`,
  )
  const bad = i.measures.filter((x) => x.tone === 'bad')
  const warn = i.measures.filter((x) => x.tone === 'warn')
  const fmt = (x: SummaryInput['measures'][number]) => `${x.label.toLowerCase()} ${x.value}${x.unit ? ` ${x.unit}` : ''}`
  if (bad.length) s.push(`Needs attention: ${bad.map(fmt).join('; ')}.`)
  else if (warn.length) s.push(`Nothing needs attention; to watch: ${warn.map(fmt).join('; ')}.`)
  else s.push('Nothing needs attention in this range.')
  const top = i.flags.filter((f) => f.severity !== 'info').slice(0, 2)
  if (top.length) s.push(`${top.map((f) => f.text).join('. ')}.`)
  const adh = i.measures.find((x) => /doses logged/i.test(x.label))
  if (adh && adh.value !== 'No data') s.push(`${adh.label}: ${adh.value}${adh.unit ?? ''}, self-reported.`)
  return s.slice(0, 4).join(' ')
}

// ---------------------------------------------------------------- Cache

const SUMMARY_VERSION = '4'
const keyFor = (i: SummaryInput, dayRule: string) =>
  `smarthome.summary.v${SUMMARY_VERSION}|${i.patient.firstName}|${i.range.from}|${i.range.to}|${dayRule}|${i.measures
    .slice(0, 4)
    .map((x) => x.label)
    .join(',')}`

function readCache(key: string): SummaryResult | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    return { ...(JSON.parse(raw) as SummaryResponse), source: 'cache' }
  } catch {
    return undefined
  }
}
function writeCache(key: string, r: SummaryResponse) {
  try {
    localStorage.setItem(key, JSON.stringify(r))
  } catch {
    // Storage full or blocked: we just refetch next time
  }
}

// ---------------------------------------------------------------- Fetch

export async function fetchSummary(input: SummaryInput, signal?: AbortSignal): Promise<SummaryResponse> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  signal?.addEventListener('abort', () => ctrl.abort())
  try {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    })
    // Under `vite dev` there is no function: the SPA fallback answers with HTML.
    if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('No summary service')
    const data = (await res.json()) as Partial<SummaryResponse> & { error?: string }
    if (!res.ok || !data.text) throw new Error(data.error ?? `HTTP ${res.status}`)
    return { text: data.text, model: data.model ?? 'unknown', generatedAt: data.generatedAt ?? new Date().toISOString() }
  } finally {
    clearTimeout(timer)
  }
}

export async function getSummary(
  input: SummaryInput,
  dayRule: string,
  opts: { force?: boolean; signal?: AbortSignal } = {},
): Promise<SummaryResult> {
  const key = keyFor(input, dayRule)
  if (!opts.force) {
    const hit = readCache(key)
    if (hit) return hit
  }
  try {
    const r = await fetchSummary(input, opts.signal)
    writeCache(key, r)
    return { ...r, source: 'ai' }
  } catch (e) {
    return { text: fallbackSummary(input), source: 'fallback', reason: e instanceof Error ? e.message : String(e) }
  }
}

/** Warm the cache for the demo: sequential, errors ignored. */
export async function prefetchSummaries(items: { input: SummaryInput; dayRule: string }[]) {
  for (const { input, dayRule } of items) {
    const key = keyFor(input, dayRule)
    if (readCache(key)) continue
    try {
      writeCache(key, await fetchSummary(input))
    } catch {
      // Fallback is used on demand
    }
  }
}
