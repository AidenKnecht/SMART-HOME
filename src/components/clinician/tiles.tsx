import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import type { Question } from '@/data/types'
import { fmtDay, perWeek, questionStats, type RangeStats } from '@/lib/derive'
import type { Model } from './model'
import { zoneFill } from './Zone'
import { cn } from '@/lib/utils'

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'
export interface Change {
  text: string
  direction: 'worse' | 'better' | 'same'
  rising?: boolean
}
export interface TileView {
  value: string
  unit?: string
  tone: Tone
  change?: Change
  note: string
  detail?: ReactNode
}
export type MeasureGroup = 'Summary' | 'Lung function' | 'Action plan' | 'Check-in questions'
export interface TileDef {
  key: string
  label: string
  group: MeasureGroup
  /** One-line description for the Customize panel */
  hint: string
  wide?: boolean
  /** Whether this patient's data can support the measure (tracker questions, devices, plan) */
  available: (m: Model) => boolean
  view: (m: Model) => TileView
}

function compare(
  a: number | undefined,
  b: number | undefined,
  higherIsWorse: boolean,
  tol: number,
  fmt: (x: number) => string,
): Change | undefined {
  if (a === undefined || b === undefined) return undefined
  const diff = b - a
  const direction = Math.abs(diff) <= tol ? 'same' : (diff > 0) === higherIsWorse ? 'worse' : 'better'
  return { text: `Was ${fmt(a)}, now ${fmt(b)}`, direction, rising: diff > 0 }
}

const wk = (s: RangeStats, n: number) => perWeek(n, s.daysInRange)
const loggedNote = (s: RangeStats) => `of ${s.loggedDays} days with a check-in (${s.daysInRange} in range)`
const hasQ = (m: Model, ...keys: string[]) => keys.every((k) => m.tracker.questions.some((q) => q.key === k))
const isAsthma = (m: Model) => m.tracker.condition === 'Asthma'
const rescueName = (m: Model) =>
  m.doc.medications.find((x) => m.ctx.rescueIds.has(x.id) && !x.archived)?.name.replace(/ HFA$/, '') ?? 'rescue'

/** Measures computed from several signals at once. */
export const BUILT_IN: TileDef[] = [
  {
    key: 'control',
    label: 'Asthma control',
    group: 'Summary',
    hint: 'GINA-style, from the four control questions over the last 4 weeks',
    wide: true,
    available: (m) => hasQ(m, 'symptoms', 'nightWaking', 'rescueUsed'),
    view: ({ gina }) => ({
      value: gina.label,
      tone: gina.level === 'well' ? 'good' : gina.level === 'partly' ? 'warn' : 'bad',
      note: `GINA-style, from home data, last 4 weeks. Based on ${gina.basedOnDays} of ${gina.windowDays} days with a check-in.`,
      detail: (
        <ul className="mt-2 space-y-0.5 text-xs">
          {gina.criteria.map((c) => (
            <li key={c.key} className="flex items-start gap-1.5">
              {c.met ? (
                <X className="text-zone-red mt-px size-3.5 shrink-0" aria-label="Yes" />
              ) : (
                <Check className="text-zone-green mt-px size-3.5 shrink-0" aria-label="No" />
              )}
              <span>
                {c.text}
                <span className="text-muted-foreground">: {c.evidence}</span>
              </span>
            </li>
          ))}
        </ul>
      ),
    }),
  },
  {
    key: 'adherence',
    label: 'Controller doses logged',
    group: 'Summary',
    hint: 'Scheduled daily medication marked as taken (self-reported)',
    available: (m) => m.ctx.controllerIds.size > 0,
    view: (m) => {
      const { stats, first, second } = m
      const p = stats.adherencePct
      return {
        value: p === undefined ? 'No data' : `${p}`,
        unit: p === undefined ? undefined : '%',
        tone: p === undefined ? 'neutral' : p >= 80 ? 'good' : p >= 60 ? 'warn' : 'bad',
        change: compare(first.adherencePct, second.adherencePct, false, 5, (x) => `${x}%`),
        note: `${stats.controllerDoses} of ${stats.scheduledDoses} scheduled ${isAsthma(m) ? '' : 'daily-medication '}doses. Self-reported as taken, not verified.`,
      }
    },
  },
  {
    key: 'symptoms',
    label: 'Symptom days',
    group: 'Summary',
    hint: 'Days with any symptom ticked',
    available: (m) => hasQ(m, 'symptoms'),
    view: ({ stats, first, second }) => ({
      value: `${stats.symptomDays}`,
      unit: 'days',
      tone: wk(stats, stats.symptomDays) > 2 ? 'bad' : stats.symptomDays > 0 ? 'neutral' : 'good',
      change: compare(wk(first, first.symptomDays), wk(second, second.symptomDays), true, 0.5, (x) => `${x}/wk`),
      note: loggedNote(stats),
    }),
  },
  {
    key: 'rescue',
    label: 'Rescue medication days',
    group: 'Summary',
    hint: 'Days with rescue use, from check-in answers or logged doses',
    available: (m) => m.ctx.rescueIds.size > 0 || hasQ(m, 'rescueUsed'),
    view: (m) => {
      const { stats, first, second } = m
      return {
        value: `${stats.rescueDays}`,
        unit: 'days',
        tone: wk(stats, stats.rescueDays) > 2 ? 'bad' : 'neutral',
        change: compare(wk(first, first.rescueDays), wk(second, second.rescueDays), true, 0.5, (x) => `${x}/wk`),
        note: `From check-in answers and logged ${rescueName(m).toLowerCase()} doses (${stats.rescueDosesTotal} doses).`,
      }
    },
  },
  {
    key: 'fev1',
    label: 'FEV1, latest best blow',
    group: 'Lung function',
    hint: 'Home spirometry, best accepted blow, % of predicted and trend',
    available: (m) => m.doc.medicalDevices.length > 0 && !!m.doc.asthmaTreatmentPlan,
    view: ({ stats, doc }) => ({
      value: stats.fev1Latest !== undefined ? stats.fev1Latest.toFixed(2) : 'No data',
      unit: stats.fev1Latest !== undefined ? 'L' : undefined,
      tone:
        stats.fev1LatestPctPredicted === undefined
          ? 'neutral'
          : stats.fev1LatestPctPredicted >= 80
            ? 'good'
            : stats.fev1LatestPctPredicted >= 60
              ? 'warn'
              : 'bad',
      change:
        stats.fev1Start !== undefined && stats.fev1End !== undefined && stats.fev1ChangePct !== undefined
          ? {
              text:
                Math.abs(stats.fev1ChangePct) < 1
                  ? `Steady (${stats.fev1Start.toFixed(2)} to ${stats.fev1End.toFixed(2)} L)`
                  : `${stats.fev1ChangePct > 0 ? 'Up' : 'Down'} ${Math.abs(stats.fev1ChangePct)}% (${stats.fev1Start.toFixed(2)} to ${stats.fev1End.toFixed(2)} L)`,
              direction: Math.abs(stats.fev1ChangePct) < 5 ? 'same' : stats.fev1ChangePct < 0 ? 'worse' : 'better',
              rising: stats.fev1ChangePct > 0,
            }
          : undefined,
      note: `${stats.fev1LatestPctPredicted ?? '–'}% of predicted ${doc.asthmaTreatmentPlan?.predictedFev1.toFixed(2)} L, on ${fmtDay(stats.fev1LatestDay ?? '')}. Accepted blows only.`,
    }),
  },
  {
    key: 'zones',
    label: 'Action plan zone days',
    group: 'Action plan',
    hint: 'Green, yellow and red days from the app’s action plan',
    available: (m) => !!m.doc.asthmaTreatmentPlan,
    view: ({ stats, first, second }) => {
      const z = stats.zones
      const total = stats.zoneDays || 1
      return {
        value: `${z.yellow + z.red}`,
        unit: 'yellow or red',
        tone: z.red > 0 ? 'bad' : z.yellow > 0 ? 'warn' : 'good',
        change: compare(first.zones.yellow + first.zones.red, second.zones.yellow + second.zones.red, true, 1, (x) => `${x}`),
        note: `${z.green} green, ${z.yellow} yellow, ${z.red} red, of ${stats.zoneDays} days with a zone.`,
        detail: (
          <div className="bg-muted mt-2 flex h-2 w-full overflow-hidden rounded-sm" aria-hidden>
            {(['green', 'yellow', 'red'] as const).map((k) => (
              <div key={k} className={cn(zoneFill[k])} style={{ width: `${(100 * z[k]) / total}%` }} />
            ))}
          </div>
        ),
      }
    },
  },
  {
    key: 'school',
    label: 'School days missed',
    group: 'Summary',
    hint: 'Days the teen reported missing school',
    available: (m) => hasQ(m, 'missedSchool'),
    view: ({ stats, first, second }) => ({
      value: `${stats.schoolDays}`,
      unit: 'days',
      tone: stats.schoolDays > 0 ? 'warn' : 'good',
      change: compare(first.schoolDays, second.schoolDays, true, 0, (x) => `${x}`),
      note: `Reported on check-ins; ${stats.loggedDays} of ${stats.daysInRange} days had one.`,
    }),
  },
]

/** Question keys already represented by a built-in measure. */
const COVERED = new Set(['symptoms', 'rescueUsed', 'missedSchool', 'spirometry'])

function rangeLabel(n: number) {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** One generic measure for a tracker question, rendered by its question type. */
export function questionTile(q: Question): TileDef {
  const key = `q:${q.key}`
  const base = { key, label: q.shortLabel, group: 'Check-in questions' as const, hint: q.text, available: () => true }
  const halves = (m: Model) => [questionStats(m.firstDays, q), questionStats(m.secondDays, q)] as const
  switch (q.type) {
    case 'yesNo':
      return {
        ...base,
        view: (m) => {
          const s = questionStats(m.days, q)
          const [a, b] = halves(m)
          return {
            value: `${s.yesDays ?? 0}`,
            unit: 'days',
            tone: 'neutral',
            change: compare(a.yesDays, b.yesDays, true, 0, (x) => rangeLabel(x)),
            note: `Answered “yes” on ${rangeLabel(s.yesDays ?? 0)} of ${s.answeredDays} answered.`,
          }
        },
      }
    case 'number':
    case 'scale1to10':
      return {
        ...base,
        view: (m) => {
          const s = questionStats(m.days, q)
          const [a, b] = halves(m)
          const unit = q.type === 'scale1to10' ? 'of 10' : q.unit
          return {
            value: s.mean !== undefined ? `${s.mean}` : 'No data',
            unit: s.mean !== undefined ? `${unit ?? ''} average`.trim() : undefined,
            tone: 'neutral',
            change: compare(a.mean, b.mean, true, q.type === 'scale1to10' ? 0.5 : 0.3, (x) => `${x}`),
            note: s.answeredDays ? `On ${rangeLabel(s.answeredDays)} answered. Highest ${s.max}${unit && unit !== 'of 10' ? ` ${unit}` : ''}.` : 'Not answered in this range.',
          }
        },
      }
    case 'checkbox':
    case 'icon':
      return {
        ...base,
        view: (m) => {
          const s = questionStats(m.days, q)
          return {
            value: `${s.anyDays ?? 0}`,
            unit: 'days',
            tone: 'neutral',
            note: `Days with at least one ticked, of ${s.answeredDays} answered.`,
            detail: s.topItems?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {s.topItems.slice(0, 4).map((t) => (
                  <span key={t.label} className="bg-secondary rounded-sm px-1.5 py-px text-xs">
                    {t.label} <span className="text-muted-foreground">{t.count}</span>
                  </span>
                ))}
              </div>
            ) : undefined,
          }
        },
      }
    default: {
      // faceScale / singleChoice: count days in the worse half of the scale
      return {
        ...base,
        view: (m) => {
          const s = questionStats(m.days, q)
          const [a, b] = halves(m)
          const maxSev = Math.max(0, ...(q.options ?? []).map((o) => o.severity ?? 0))
          const cut = Math.ceil((maxSev + 1) / 2)
          const worse = (x: typeof s) => x.distribution?.filter((o) => o.severity >= cut).reduce((n, o) => n + o.count, 0) ?? 0
          const cutLabel = q.options?.find((o) => o.severity === cut)?.label ?? ''
          return {
            value: `${worse(s)}`,
            unit: 'days',
            tone: 'neutral',
            change: compare(worse(a), worse(b), true, 0, (x) => rangeLabel(x)),
            note: `“${cutLabel}” or worse, of ${s.answeredDays} answered.`,
            detail: (
              <p className="text-muted-foreground mt-1 text-xs">
                {s.distribution?.map((o) => `${o.label} ${o.count}`).join(', ')}
              </p>
            ),
          }
        },
      }
    }
  }
}

/** Every measure this patient's data supports: built-ins first, then one per remaining question. */
export function measuresFor(m: Model): TileDef[] {
  const builtIns = BUILT_IN.filter((t) => t.available(m))
  const questions = m.tracker.questions.filter((q) => !COVERED.has(q.key)).map(questionTile)
  return [...builtIns, ...questions]
}
