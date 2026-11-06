import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fmtDay, fmtWeekday, rollingAdherence, type DaySummary } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Model } from './model'
import { ZONE_LABEL, zoneFill } from './Zone'

// Shared horizontal geometry so Recharts plots and HTML rows line up day for day.
const GUTTER = 96 // px: y-axis / row-label column
const RIGHT = 12

const INK = '#14202b'
const MUTED = '#52606d'
const SERIES = '#0b4f6c'
const GRID = '#e3e8ed'

interface Point {
  i: number
  day: string
  fev1?: number
  pct?: number
  adherence?: number
  doses: number
}

function DayTip({ d, model }: { d?: DaySummary; model: Model }) {
  if (!d) return null
  const s = d.spirometry
  return (
    <div className="bg-popover min-w-52 rounded-md border px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold">
        {fmtWeekday(d.day)} {fmtDay(d.day)}
      </p>
      <p>
        FEV1:{' '}
        {s?.fev1 !== undefined
          ? `${s.fev1.toFixed(2)} L (${s.pctPredicted}% predicted)`
          : s
            ? `no accepted blow (${s.rejected} rejected)`
            : 'not done'}
      </p>
      <p>
        Controller doses logged: {d.controllerDoses} of {model.ctx.dosesPerDay}
      </p>
      <p>Symptoms: {d.status !== 'logged' ? 'no check-in' : d.symptoms.length ? d.symptoms.join(', ').toLowerCase() : 'none'}</p>
      <p>Rescue: {d.rescueAny ? `yes (${d.rescueDoses} doses logged)` : d.status === 'logged' ? 'no' : 'no check-in'}</p>
      <p>Zone: {d.zone ? ZONE_LABEL[d.zone] : 'none recorded'}</p>
    </div>
  )
}

function PanelTitle({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-2 px-4 pt-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <span className="text-muted-foreground text-xs">{note}</span>
    </div>
  )
}

/** HTML row of per-day cells aligned with the chart plot area. */
function DayRow({
  label,
  days,
  hover,
  onHover,
  cell,
}: {
  label: string
  days: DaySummary[]
  hover: number | null
  onHover: (i: number | null) => void
  cell: (d: DaySummary) => { cls: string; title: string; mark?: boolean }
}) {
  return (
    <div className="flex items-center" style={{ paddingRight: RIGHT }}>
      <div className="text-muted-foreground shrink-0 pr-2 text-right text-xs" style={{ width: GUTTER }}>
        {label}
      </div>
      <div className="flex h-4 flex-1" onMouseLeave={() => onHover(null)}>
        {days.map((d, i) => {
          const c = cell(d)
          return (
            <div
              key={d.day}
              title={c.title}
              onMouseEnter={() => onHover(i)}
              className={cn('flex flex-1 items-center justify-center', hover === i && 'bg-accent')}
            >
              <span className={cn('block', c.cls)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TrendPanels({ model }: { model: Model }) {
  const { days, ctx, doc, dropDay } = model
  const [hover, setHover] = useState<number | null>(null)
  const roll = rollingAdherence(days, ctx)
  const data: Point[] = days.map((d, i) => ({
    i,
    day: d.day,
    fev1: d.spirometry?.fev1,
    pct: d.spirometry?.pctPredicted,
    adherence: roll[i],
    doses: d.controllerDoses,
  }))
  const n = days.length
  const predicted = doc.asthmaTreatmentPlan.predictedFev1
  const ref80 = Math.round(predicted * 0.8 * 100) / 100
  const fevVals = data.map((p) => p.fev1).filter((x): x is number => x !== undefined)
  const yMin = Math.floor(Math.min(ref80, ...fevVals) * 10 - 2) / 10
  const yMax = Math.ceil(Math.max(predicted, ...fevVals) * 10 + 1) / 10
  const dropIdx = dropDay ? days.findIndex((d) => d.day === dropDay) : -1
  const xAxis = (
    <XAxis type="number" dataKey="i" domain={[-0.5, n - 0.5]} hide allowDataOverflow />
  )
  const tip = (
    <Tooltip
      cursor={{ stroke: MUTED, strokeWidth: 1, strokeDasharray: '3 3' }}
      isAnimationActive={false}
      content={({ active, payload }) => {
        const i = (payload?.[0]?.payload as Point | undefined)?.i
        return active && i !== undefined ? <DayTip d={days[i]} model={model} /> : null
      }}
    />
  )
  const dropLine =
    dropIdx >= 0 ? (
      <ReferenceLine
        x={dropIdx}
        stroke={INK}
        strokeDasharray="4 3"
        label={{ value: `Controller doses fell, ${fmtDay(dropDay!)}`, position: 'insideTopLeft', fill: INK, fontSize: 11 }}
      />
    ) : null
  const margin = { top: 8, right: RIGHT, bottom: 4, left: 0 }
  const syncProps = { syncId: 'days', syncMethod: 'value' as const }
  const labelEvery = n > 45 ? 14 : n > 20 ? 7 : 2

  return (
    <section aria-labelledby="trend-h" className="bg-card rounded-lg border pb-3">
      <h2 id="trend-h" className="sr-only">
        Trends
      </h2>

      <PanelTitle title="Lung function" note={`FEV1, best accepted blow per day (L). Dashed line: 80% of predicted ${predicted.toFixed(2)} L`} />
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={margin} {...syncProps}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {xAxis}
            <YAxis
              width={GUTTER}
              domain={[yMin, yMax]}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(1)} L`}
              axisLine={false}
              tickLine={false}
              tickCount={4}
            />
            <ReferenceLine
              y={ref80}
              stroke={MUTED}
              strokeDasharray="2 3"
              label={{ value: '80% predicted', position: 'insideBottomRight', fill: MUTED, fontSize: 11 }}
            />
            {dropLine}
            {tip}
            <Line
              dataKey="fev1"
              stroke={SERIES}
              strokeWidth={2}
              connectNulls
              dot={{ r: 2.5, fill: SERIES, strokeWidth: 0 }}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <PanelTitle title="Controller medication" note="Doses logged as taken, 7-day rolling % of scheduled. Self-reported." />
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={margin} {...syncProps}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {xAxis}
            <YAxis
              width={GUTTER}
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tick={{ fill: MUTED, fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={80} stroke={MUTED} strokeDasharray="2 3" label={{ value: '80% goal', position: 'insideBottomRight', fill: MUTED, fontSize: 11 }} />
            {dropLine}
            {tip}
            <Area
              dataKey="adherence"
              type="monotone"
              stroke={SERIES}
              strokeWidth={2}
              fill={SERIES}
              fillOpacity={0.12}
              connectNulls
              isAnimationActive={false}
              activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <PanelTitle title="Daily check-ins" note="Filled dot: yes. Small dash: no check-in that day." />
      <div className="mt-1 space-y-1">
        {(
          [
            ['Symptoms', (d: DaySummary) => d.symptoms.length > 0],
            ['Rescue inhaler', (d: DaySummary) => d.rescueAny],
            ['Night waking', (d: DaySummary) => !!d.nightWaking],
          ] as const
        ).map(([label, yes]) => (
          <DayRow
            key={label}
            label={label}
            days={days}
            hover={hover}
            onHover={setHover}
            cell={(d) => {
              const on = yes(d)
              const none = d.status !== 'logged' && !on
              return {
                cls: on ? 'size-2 rounded-full bg-primary' : none ? 'h-px w-1.5 bg-muted-foreground/50' : 'size-1 rounded-full bg-border',
                title: `${fmtDay(d.day)}: ${label.toLowerCase()} ${on ? 'yes' : none ? 'no check-in' : 'no'}`,
              }
            }}
          />
        ))}
        <DayRow
          label="Zone"
          days={days}
          hover={hover}
          onHover={setHover}
          cell={(d) => ({
            cls: cn('h-4 w-full border-r-2 border-card', d.zone ? zoneFill[d.zone] : 'bg-muted'),
            title: `${fmtDay(d.day)}: ${d.zone ? `${ZONE_LABEL[d.zone]} zone` : 'no zone recorded'}`,
          })}
        />
        {/* Date labels */}
        <div className="flex" style={{ paddingRight: RIGHT }}>
          <div style={{ width: GUTTER }} className="shrink-0" />
          <div className="relative h-4 flex-1">
            {days.map((d, i) =>
              i % labelEvery === 0 ? (
                <span
                  key={d.day}
                  className="text-muted-foreground absolute -translate-x-1/2 text-[11px] whitespace-nowrap"
                  style={{ left: `${((i + 0.5) / n) * 100}%` }}
                >
                  {fmtDay(d.day)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ paddingLeft: GUTTER }}>
        {(['green', 'yellow', 'red'] as const).map((z) => (
          <span key={z} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-sm', zoneFill[z])} aria-hidden /> {ZONE_LABEL[z]} zone
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="bg-muted size-2.5 rounded-sm border" aria-hidden /> No zone recorded
        </span>
      </div>
    </section>
  )
}
