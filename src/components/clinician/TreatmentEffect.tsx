// "Did the treatment change help?": one thin panel per measure, all on the same day axis, with a
// vertical line on the change day and the before/after average on each side. Small multiples on
// purpose: measures have different units, so they never share a y-axis.
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DaySummary, DayRule } from '@/lib/derive'
import { adherenceDropDay, daysAround, fmtDay, fmtWeekday, treatmentEvents } from '@/lib/derive'
import type { Model } from './model'
import { ChangeLine } from './SummaryStrip'
import type { Change } from './tiles'

const INK = '#14202b'
const MUTED = '#52606d'
const SERIES = '#0b4f6c'
const LABEL_W = 230
const MAX_SERIES = 5
const ROLL = 7

type Kind = 'rate' | 'mean' | 'pct'
export interface EffectSeries {
  key: string
  label: string
  unit: string
  kind: Kind
  higherIsWorse: boolean
  /** Same-or-not tolerance for the before/after verdict */
  tol: (before: number) => number
  /** One value per day; undefined = nothing recorded that day */
  raw: (d: DaySummary) => number | undefined
  fixed?: [number, number]
}

const COVERED = new Set(['symptoms', 'rescueUsed', 'missedSchool', 'spirometry'])
const logged01 = (d: DaySummary, yes: boolean) => (yes ? 1 : d.status === 'logged' ? 0 : undefined)

/** Every measure this patient's data can chart, keyed like the widgets. */
export function effectSeriesFor(m: Model): EffectSeries[] {
  const { ctx, doc, tracker } = m
  const hasQ = (k: string) => tracker.questions.some((q) => q.key === k)
  const asthma = tracker.condition === 'Asthma'
  const out: EffectSeries[] = []
  const perWk = { unit: 'days/wk', kind: 'rate' as const, higherIsWorse: true, tol: () => 0.5, fixed: [0, 7] as [number, number] }
  if (hasQ('symptoms')) out.push({ key: 'symptoms', label: 'Symptom days', ...perWk, raw: (d) => logged01(d, d.symptoms.length > 0) })
  if (ctx.rescueIds.size || hasQ('rescueUsed')) out.push({ key: 'rescue', label: 'Rescue medication days', ...perWk, raw: (d) => logged01(d, d.rescueAny) })
  if (doc.asthmaTreatmentPlan)
    out.push({ key: 'zones', label: 'Yellow or red zone days', ...perWk, raw: (d) => (d.zone ? (d.zone === 'green' ? 0 : 1) : undefined) })
  if (hasQ('missedSchool')) out.push({ key: 'school', label: 'School days missed', ...perWk, raw: (d) => logged01(d, !!d.missedSchool) })
  if (doc.medicalDevices.length)
    out.push({ key: 'fev1', label: 'FEV1, best blow', unit: 'L', kind: 'mean', higherIsWorse: false, tol: (b) => b * 0.03, raw: (d) => d.spirometry?.fev1 })
  for (const q of tracker.questions) {
    if (COVERED.has(q.key)) continue
    const key = `q:${q.key}`
    if (q.type === 'yesNo')
      out.push({ key, label: `${q.shortLabel} days`, ...perWk, raw: (d) => (typeof d.answers[q.key] === 'boolean' ? (d.answers[q.key] ? 1 : 0) : undefined) })
    else if (q.type === 'number' || q.type === 'scale1to10')
      out.push({
        key,
        label: q.shortLabel,
        unit: q.type === 'scale1to10' ? 'of 10' : (q.unit ?? ''),
        kind: 'mean',
        higherIsWorse: true,
        tol: (b) => (q.type === 'scale1to10' ? 0.5 : Math.max(0.3, b * 0.1)),
        raw: (d) => (d.answers[q.key] === undefined ? undefined : Number(d.answers[q.key])),
        fixed: q.type === 'scale1to10' ? [0, 10] : undefined,
      })
  }
  if (ctx.controllerIds.size)
    out.push({
      key: 'adherence',
      label: asthma ? 'Controller doses logged' : 'Daily medication doses logged',
      unit: '%',
      kind: 'pct',
      higherIsWorse: false,
      tol: () => 5,
      raw: (d) => (100 * d.controllerDoses) / ctx.dosesPerDay,
      fixed: [0, 100],
    })
  return out
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)
const scale = (s: EffectSeries, v: number) => (s.kind === 'rate' ? v * 7 : v)
const fmt = (s: EffectSeries, v: number | undefined) =>
  v === undefined ? 'no data' : s.kind === 'pct' ? `${Math.round(v)}%` : s.key === 'fev1' ? `${v.toFixed(2)} L` : `${Math.round(v * 10) / 10} ${s.unit}`

/** Before/after averages and a rolling line that restarts at the change, so the sides never blend. */
export function seriesView(s: EffectSeries, days: DaySummary[], eventIndex: number) {
  // Rates count over calendar days, like the widgets (a day without a check-in is not a "yes")
  const vals = days.map((d) => (s.kind === 'rate' ? (s.raw(d) ?? 0) : s.raw(d)))
  const side = (i: number) => (i < eventIndex ? 0 : 1)
  const rolled = vals.map((_, i) => {
    const lo = Math.max(i - ROLL + 1, side(i) === 0 ? 0 : eventIndex)
    const xs = vals.slice(lo, i + 1).filter((v): v is number => v !== undefined)
    // Averages (pain, FEV1) are sparse, so one value is enough; rates need a few days
    const need = s.kind === 'mean' ? 1 : 3
    return xs.length >= need ? scale(s, avg(xs)!) : undefined
  })
  const sideAvg = (from: number, to: number) => {
    const a = avg(vals.slice(from, to).filter((v): v is number => v !== undefined))
    return a === undefined ? undefined : scale(s, a)
  }
  const before = sideAvg(0, eventIndex)
  const after = sideAvg(eventIndex, days.length)
  let change: Change | undefined
  if (before !== undefined && after !== undefined) {
    const diff = after - before
    const direction = Math.abs(diff) <= s.tol(before) ? 'same' : diff > 0 === s.higherIsWorse ? 'worse' : 'better'
    change = { text: `Before ${fmt(s, before)}, after ${fmt(s, after)}`, direction, rising: diff > 0 }
  }
  return { rolled, before, after, change }
}

function Panel({
  s,
  days,
  eventIndex,
  dropIdx,
  first,
  last,
  eventLabel,
}: {
  s: EffectSeries
  days: DaySummary[]
  eventIndex: number
  dropIdx: number
  first: boolean
  last: boolean
  eventLabel: string
}) {
  const { rolled, before, after, change } = seriesView(s, days, eventIndex)
  // Two series so each side connects over gaps but the line never crosses the change
  const data = days.map((d, i) => ({
    x: i - eventIndex,
    v: rolled[i],
    vBefore: i < eventIndex ? rolled[i] : undefined,
    vAfter: i >= eventIndex ? rolled[i] : undefined,
    day: d.day,
  }))
  const ticks = s.fixed ? [s.fixed[0], s.fixed[1] / 2, s.fixed[1]] : undefined
  const lo = -eventIndex
  const hi = days.length - eventIndex - 1
  const vs = rolled.filter((v): v is number => v !== undefined)
  const domain: [number, number] = s.fixed ?? [Math.floor(Math.min(...vs, before ?? Infinity) * 10 - 1) / 10, Math.ceil(Math.max(...vs, after ?? -Infinity) * 10 + 1) / 10]
  return (
    <div className="flex items-stretch border-t first:border-t-0">
      <div className="shrink-0 py-2 pr-3 pl-4" style={{ width: LABEL_W }}>
        <p className="text-sm font-medium leading-tight">{s.label}</p>
        {change ? <ChangeLine change={change} /> : <p className="text-muted-foreground mt-1 text-xs">Not enough data on one side</p>}
        <p className="text-muted-foreground mt-0.5 text-xs">{s.kind === 'rate' ? '7-day rate, days per week' : s.kind === 'pct' ? '7-day % of scheduled' : `7-day average, ${s.unit}`}</p>
      </div>
      <div className={last ? 'h-[104px] flex-1' : 'h-[84px] flex-1'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: first ? 16 : 6, right: 16, bottom: last ? 0 : 4, left: 0 }} syncId="effect" syncMethod="value">
            <XAxis
              type="number"
              dataKey="x"
              domain={[lo, hi]}
              hide={!last}
              ticks={[lo, ...[-60, -30, 0, 30, 60].filter((t) => t > lo && t < hi), hi]}
              tickFormatter={(t: number) => (t === 0 ? 'Change' : `${t > 0 ? '+' : ''}${t} d`)}
              tick={{ fill: MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDataOverflow
            />
            <YAxis
              width={44}
              domain={domain}
              ticks={ticks}
              tickCount={3}
              tickFormatter={(t: number) => (Number.isInteger(t) ? `${t}` : t.toFixed(1))}
              tick={{ fill: MUTED, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDataOverflow
            />
            <ReferenceLine
              x={0}
              stroke={INK}
              strokeWidth={1.5}
              label={first ? { value: eventLabel, position: 'insideTopLeft', fill: INK, fontSize: 11, dy: -14 } : undefined}
            />
            {dropIdx >= 0 && (
              <ReferenceLine
                x={dropIdx - eventIndex}
                stroke={MUTED}
                strokeDasharray="4 3"
                label={first ? { value: `Doses fell, ${fmtDay(days[dropIdx].day)}`, position: 'insideTopRight', fill: MUTED, fontSize: 11, dy: -14 } : undefined}
              />
            )}
            {before !== undefined && (
              <ReferenceLine segment={[{ x: lo, y: before }, { x: -0.5, y: before }]} stroke={MUTED} strokeDasharray="2 3" ifOverflow="extendDomain" />
            )}
            {after !== undefined && (
              <ReferenceLine segment={[{ x: 0, y: after }, { x: hi, y: after }]} stroke={MUTED} strokeDasharray="2 3" ifOverflow="extendDomain" />
            )}
            <Tooltip
              cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-sm">
                    <p className="font-semibold">
                      {fmtWeekday(p.day)} {fmtDay(p.day)} ({p.x === 0 ? 'change day' : `${p.x > 0 ? '+' : ''}${p.x} d`})
                    </p>
                    <p>
                      {s.label}: {fmt(s, p.v)}
                    </p>
                  </div>
                )
              }}
            />
            {(['vBefore', 'vAfter'] as const).map((k) => (
              <Line
                key={k}
                dataKey={k}
                stroke={SERIES}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
                activeDot={{ r: 3.5, stroke: '#fff', strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function TreatmentEffect({ model, dayRule, order }: { model: Model; dayRule: DayRule; order: string[] }) {
  const events = useMemo(() => treatmentEvents(model.ctx).filter((e) => e.day >= model.from && e.day <= model.to), [model])
  const [picked, setPicked] = useState<string | null>(null)
  const [win, setWin] = useState<'30' | '60'>('60')
  const [chosen, setChosen] = useState<string[] | null>(null)
  const all = useMemo(() => effectSeriesFor(model), [model])
  const ev = events.find((e) => e.day === picked) ?? events.at(-1)
  if (!ev) return null

  const span = Number(win)
  const { days, eventIndex, beforeCount, afterCount } = daysAround(model.ctx, ev.day, span, span, dayRule)
  const defaults = [
    ...order.filter((k) => k !== 'adherence' && all.some((s) => s.key === k)).slice(0, 3),
    ...(all.some((s) => s.key === 'adherence') ? ['adherence'] : []),
  ]
  const keys = (chosen ?? defaults).filter((k) => all.some((s) => s.key === k))
  const shown = keys.map((k) => all.find((s) => s.key === k)!)
  const rest = all.filter((s) => !keys.includes(s.key))
  const drop = adherenceDropDay(days.slice(eventIndex), model.ctx)
  const dropIdx = drop ? days.findIndex((d) => d.day === drop) : -1
  const thin = beforeCount < 21 ? beforeCount : afterCount < 21 ? -afterCount : 0

  return (
    <section aria-labelledby="effect-h" className="bg-card rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
        <div>
          <h2 id="effect-h" className="text-sm font-semibold">
            Did the treatment change help?
          </h2>
          <p className="text-muted-foreground text-xs">
            {events.length > 1 ? 'Choose a change.' : `${ev.label}, ${fmtDay(ev.day)}.`} {beforeCount} days before, {afterCount} days from the change on.
            {thin > 0 && <span className="text-zone-yellow font-medium"> Only {thin} days of data before this change.</span>}
            {thin < 0 && <span className="text-zone-yellow font-medium"> Only {-thin} days of data since this change.</span>}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
          {events.length > 1 && (
            <Select value={ev.day} onValueChange={setPicked}>
              <SelectTrigger className="h-8 w-[300px]" aria-label="Treatment change">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.day + e.label} value={e.day}>
                    {e.label}, {fmtDay(e.day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ToggleGroup type="single" variant="outline" size="sm" value={win} onValueChange={(v) => v && setWin(v as '30' | '60')} aria-label="Days each side">
            <ToggleGroupItem value="30" className="px-3">30 days each side</ToggleGroupItem>
            <ToggleGroupItem value="60" className="px-3">60 days each side</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="py-1">
        {shown.map((s, i) => (
          <Panel
            key={s.key}
            s={s}
            days={days}
            eventIndex={eventIndex}
            dropIdx={dropIdx}
            first={i === 0}
            last={i === shown.length - 1}
            eventLabel={`${ev.label}, ${fmtDay(ev.day)}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t px-4 py-2 print:hidden">
        <span className="text-muted-foreground mr-1 text-xs">Measures ({keys.length} of {MAX_SERIES}):</span>
        {shown.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setChosen(keys.filter((k) => k !== s.key))}
            disabled={keys.length <= 1}
            aria-label={`Remove ${s.label}`}
            className="bg-secondary focus-visible:ring-ring flex items-center gap-1 rounded-md px-2 py-1 text-xs outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            {s.label} <X className="size-3" aria-hidden />
          </button>
        ))}
        {rest.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setChosen([...keys, s.key])}
            disabled={keys.length >= MAX_SERIES}
            className="hover:bg-accent focus-visible:ring-ring flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs outline-none focus-visible:ring-2 disabled:opacity-40"
          >
            <Plus className="size-3" aria-hidden /> {s.label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground border-t px-4 py-2 text-xs">
        Before and after, not cause and effect: season, school and whether doses were logged change too. Dotted lines are
        each side&rsquo;s average. Lines restart at the change so the two sides never blend.
      </p>
    </section>
  )
}
