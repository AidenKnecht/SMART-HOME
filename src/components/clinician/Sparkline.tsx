// Tiny in-widget visuals. Decorative: the number and change line beside them carry the meaning,
// so both are aria-hidden. Inline SVG / flex, no Recharts, cheap enough for a dozen widgets.
import type { Zone } from '@/data/types'
import { cn } from '@/lib/utils'
import { zoneFill } from './Zone'

interface SparklineProps {
  /** One value per day; undefined = no reading that day (line connects across gaps) */
  values: (number | undefined)[]
  /** Dashed horizontal reference, e.g. 80% of predicted */
  reference?: number
  min?: number
  max?: number
  className?: string
}

const W = 100
const H = 32
const PAD = 2

export function Sparkline({ values, reference, min, max, className }: SparklineProps) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== undefined)
  if (pts.length < 2) return <div className={cn('bg-muted/60 h-8 w-full rounded-sm', className)} aria-hidden />
  const ys = pts.map((p) => p[1])
  const lo = Math.min(min ?? Infinity, reference ?? Infinity, ...ys)
  const hi = Math.max(max ?? -Infinity, reference ?? -Infinity, ...ys)
  const span = hi - lo || 1
  const n = Math.max(1, values.length - 1)
  const x = (i: number) => PAD + ((W - 2 * PAD) * i) / n
  const y = (v: number) => PAD + (H - 2 * PAD) * (1 - (v - lo) / span)
  const d = pts.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')
  const last = pts.at(-1)!
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('h-8 w-full overflow-visible', className)}
      aria-hidden
    >
      {reference !== undefined && (
        <line
          x1={0}
          x2={W}
          y1={y(reference)}
          y2={y(reference)}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeDasharray="2 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={d}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* End marker drawn as a short line so it survives non-uniform scaling */}
      <line
        x1={x(last[0])}
        x2={x(last[0])}
        y1={y(last[1])}
        y2={y(last[1])}
        stroke="var(--primary)"
        strokeWidth={6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export type DotState = 'on' | 'off' | 'none'

/** One cell per day: filled = yes, faint = no, dash-height = no check-in. Same encoding as the trend rows. */
export function DayDots({ states, className }: { states: DotState[]; className?: string }) {
  return (
    <div className={cn('flex h-3 w-full items-center', states.length <= 45 && 'gap-px', className)} aria-hidden>
      {states.map((s, i) => (
        <span
          key={i}
          className={cn(
            'min-w-0 flex-1 rounded-[1px]',
            s === 'on' ? 'bg-primary h-3' : s === 'off' ? 'bg-border h-3' : 'bg-muted-foreground/40 h-px',
          )}
        />
      ))}
    </div>
  )
}

/** One cell per day colored by action-plan zone; grey = no zone recorded. */
export function ZoneDots({ zones, className }: { zones: (Zone | undefined)[]; className?: string }) {
  return (
    <div className={cn('flex h-3 w-full', zones.length <= 45 && 'gap-px', className)} aria-hidden>
      {zones.map((z, i) => (
        <span key={i} className={cn('min-w-0 flex-1 rounded-[1px]', z ? zoneFill[z] : 'bg-muted')} />
      ))}
    </div>
  )
}
