import type { ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { fmtDay, perWeek, type RangeStats } from '@/lib/derive'
import type { Lens, Model } from './model'
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
export interface TileDef {
  key: string
  label: string
  /** Lenses this tile appears in; order within a lens comes from LENS_ORDER */
  lenses: Lens[]
  wide?: boolean
  view: (m: Model) => TileView
}

const ALL: Lens[] = ['pulm', 'pcp', 'nurse', 'gi', 'neuro']

function compare(a: number | undefined, b: number | undefined, higherIsWorse: boolean, tol: number, fmt: (x: number) => string): Change | undefined {
  if (a === undefined || b === undefined) return undefined
  const diff = b - a
  const direction = Math.abs(diff) <= tol ? 'same' : (diff > 0) === higherIsWorse ? 'worse' : 'better'
  return { text: `Was ${fmt(a)}, now ${fmt(b)}`, direction, rising: diff > 0 }
}

const wk = (s: RangeStats, n: number) => perWeek(n, s.daysInRange)
const loggedNote = (s: RangeStats) => `of ${s.loggedDays} days with a check-in (${s.daysInRange} in range)`

export const TILES: TileDef[] = [
  {
    key: 'control',
    label: 'Asthma control',
    lenses: ALL,
    wide: true,
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
    lenses: ALL,
    view: ({ stats, first, second }) => {
      const p = stats.adherencePct
      return {
        value: p === undefined ? 'No data' : `${p}`,
        unit: p === undefined ? undefined : '%',
        tone: p === undefined ? 'neutral' : p >= 80 ? 'good' : p >= 60 ? 'warn' : 'bad',
        change: compare(first.adherencePct, second.adherencePct, false, 5, (x) => `${x}%`),
        note: `${stats.controllerDoses} of ${stats.scheduledDoses} scheduled doses. Self-reported as taken, not verified.`,
      }
    },
  },
  {
    key: 'symptoms',
    label: 'Symptom days',
    lenses: ALL,
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
    label: 'Rescue inhaler days',
    lenses: ['pulm', 'pcp', 'nurse'],
    view: ({ stats, first, second }) => ({
      value: `${stats.rescueDays}`,
      unit: 'days',
      tone: wk(stats, stats.rescueDays) > 2 ? 'bad' : 'neutral',
      change: compare(wk(first, first.rescueDays), wk(second, second.rescueDays), true, 0.5, (x) => `${x}/wk`),
      note: `From check-in answers and logged albuterol doses (${stats.rescueDosesTotal} doses).`,
    }),
  },
  {
    key: 'fev1',
    label: 'FEV1, latest best blow',
    lenses: ['pulm', 'pcp'],
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
              text: `${stats.fev1ChangePct > 0 ? 'Up' : 'Down'} ${Math.abs(stats.fev1ChangePct)}% (${stats.fev1Start.toFixed(2)} to ${stats.fev1End.toFixed(2)} L)`,
              direction: Math.abs(stats.fev1ChangePct) < 5 ? 'same' : stats.fev1ChangePct < 0 ? 'worse' : 'better',
              rising: stats.fev1ChangePct > 0,
            }
          : undefined,
      note: `${stats.fev1LatestPctPredicted ?? '–'}% of predicted ${doc.asthmaTreatmentPlan.predictedFev1.toFixed(2)} L, on ${fmtDay(stats.fev1LatestDay ?? '')}. Accepted blows only.`,
    }),
  },
  {
    key: 'zones',
    label: 'Action plan zone days',
    lenses: ['pulm', 'pcp', 'nurse'],
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
    lenses: ALL,
    view: ({ stats, first, second }) => ({
      value: `${stats.schoolDays}`,
      unit: 'days',
      tone: stats.schoolDays > 0 ? 'warn' : 'good',
      change: compare(first.schoolDays, second.schoolDays, true, 0, (x) => `${x}`),
      note: `Night waking from asthma on ${stats.nightDays} ${stats.nightDays === 1 ? 'night' : 'nights'}.`,
    }),
  },
]

/** Tile order per specialty lens (Step 3). Tiles not listed for a lens are hidden. */
export const LENS_ORDER: Record<Lens, string[]> = {
  pulm: ['control', 'fev1', 'adherence', 'rescue', 'zones', 'symptoms', 'school'],
  pcp: ['control', 'adherence', 'symptoms', 'rescue', 'fev1', 'zones', 'school'],
  nurse: ['adherence', 'zones', 'control', 'rescue', 'symptoms', 'school'],
  gi: ['control', 'adherence', 'symptoms', 'school'],
  neuro: ['control', 'adherence', 'symptoms', 'school'],
}

export function tilesFor(lens: Lens): TileDef[] {
  return LENS_ORDER[lens].map((k) => TILES.find((t) => t.key === k)!).filter((t) => t.lenses.includes(lens))
}
