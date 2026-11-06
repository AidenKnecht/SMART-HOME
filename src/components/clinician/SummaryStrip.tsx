import { ChevronRight, CircleAlert, CircleCheck, Minus, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Model } from './model'
import type { Change, TileDef, Tone } from './tiles'

const toneIcon: Record<Tone, { Icon: typeof CircleCheck; cls: string; label: string } | null> = {
  good: { Icon: CircleCheck, cls: 'text-zone-green', label: 'On target' },
  warn: { Icon: TriangleAlert, cls: 'text-zone-yellow', label: 'Watch' },
  bad: { Icon: CircleAlert, cls: 'text-zone-red', label: 'Needs attention' },
  neutral: null,
}
// Color never alone: the bar pairs with the icon + label below the value.
const toneBar: Record<Tone, string> = {
  good: 'bg-zone-green',
  warn: 'bg-zone-yellow-fill',
  bad: 'bg-zone-red',
  neutral: 'bg-border',
}
const toneBorder: Record<Tone, string> = {
  good: '',
  warn: 'border-zone-yellow-fill/70',
  bad: 'border-zone-red/50',
  neutral: '',
}

export function ChangeLine({ change }: { change: Change }) {
  const Arrow = change.direction === 'same' ? Minus : change.rising ? TrendingUp : TrendingDown
  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-1 text-xs font-medium',
        change.direction === 'worse' && 'text-zone-red',
        change.direction === 'better' && 'text-zone-green',
        change.direction === 'same' && 'text-muted-foreground',
      )}
    >
      <Arrow className="size-3.5 shrink-0" aria-hidden />
      <span>
        {change.text}
        <span className="sr-only">
          {change.direction === 'same' ? ', about the same' : change.direction === 'worse' ? ', worse' : ', better'}
        </span>
      </span>
    </p>
  )
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function SummaryStrip({ model, tiles, onOpen }: { model: Model; tiles: TileDef[]; onOpen?: (key: string) => void }) {
  const views = tiles.map((t) => ({ t, v: t.view(model), label: t.labelFor?.(model) ?? t.label }))
  const bad = views.filter((x) => x.v.tone === 'bad').length
  const warn = views.filter((x) => x.v.tone === 'warn').length
  const headline =
    bad || warn
      ? [bad ? plural(bad, 'measure needs attention', 'measures need attention') : '', warn ? plural(warn, 'to watch', 'to watch') : '']
          .filter(Boolean)
          .join(', ')
      : 'Nothing needs attention in this range'

  return (
    <section aria-label="Summary" className="space-y-2">
      <p className="text-sm">
        <span className="font-semibold">{headline}.</span>{' '}
        <span className="text-muted-foreground text-xs">
          Click a widget for its chart and day-by-day detail. &ldquo;Was, now&rdquo; compares the first and second half of the range.
        </span>
      </p>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
        {views.map(({ t, v, label }) => {
          const tone = toneIcon[v.tone]
          const noData = v.value === 'No data'
          return (
            <article
              key={t.key}
              className={cn(
                'bg-card relative flex flex-col overflow-hidden rounded-lg border transition-colors',
                'focus-within:ring-ring/60 hover:border-primary/50 focus-within:ring-2',
                toneBorder[v.tone],
                t.wide && 'sm:col-span-2',
              )}
            >
              <span className={cn('h-[3px] w-full shrink-0', toneBar[v.tone])} aria-hidden />
              <div className="flex flex-1 flex-col px-3.5 pt-2.5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs leading-tight font-medium">
                    <button
                      type="button"
                      onClick={() => onOpen?.(t.key)}
                      aria-label={`${label}: ${v.value}${v.unit ? ` ${v.unit}` : ''}${tone ? `, ${tone.label.toLowerCase()}` : ''}. Open details`}
                      className="text-muted-foreground text-left outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      {label}
                    </button>
                  </h3>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0 opacity-40" aria-hidden />
                </div>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className={cn('font-semibold tracking-tight', t.wide ? 'text-xl' : 'text-2xl')}>{v.value}</span>
                  {v.unit && <span className="text-muted-foreground text-sm">{v.unit}</span>}
                </p>
                {tone ? (
                  <p className={cn('mt-0.5 flex items-center gap-1 text-xs font-medium', tone.cls)}>
                    <tone.Icon className="size-3.5 shrink-0" aria-hidden />
                    {tone.label}
                  </p>
                ) : noData ? (
                  <p className="text-muted-foreground mt-0.5 text-xs font-medium">Not enough data</p>
                ) : null}
                {v.change && <ChangeLine change={v.change} />}
                {v.viz && <div className="mt-2">{v.viz}</div>}
                {v.detail}
                <p className="text-muted-foreground mt-auto line-clamp-2 pt-1.5 text-[11px] leading-snug" title={v.note}>
                  {v.note}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
