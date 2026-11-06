import { CircleAlert, CircleCheck, Minus, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Model } from './model'
import type { Change, TileDef, Tone } from './tiles'

const toneIcon: Record<Tone, { Icon: typeof CircleCheck; cls: string; label: string } | null> = {
  good: { Icon: CircleCheck, cls: 'text-zone-green', label: 'On target' },
  warn: { Icon: TriangleAlert, cls: 'text-zone-yellow', label: 'Watch' },
  bad: { Icon: CircleAlert, cls: 'text-zone-red', label: 'Needs attention' },
  neutral: null,
}

function ChangeLine({ change }: { change: Change }) {
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

export function SummaryStrip({ model, tiles }: { model: Model; tiles: TileDef[] }) {
  return (
    <section aria-label="Summary" className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap">
        {tiles.map((t) => {
          const v = t.view(model)
          const tone = toneIcon[v.tone]
          return (
            <div
              key={t.key}
              className={cn(
                '-mb-px min-w-0 border-r border-b px-4 py-3 last:border-r-0',
                t.wide ? 'min-w-[19rem] flex-[1.9]' : 'min-w-[10.5rem] flex-1',
              )}
            >
              <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                {tone && <tone.Icon className={cn('size-3.5 shrink-0', tone.cls)} aria-label={tone.label} />}
                {t.label}
              </h3>
              <p className="mt-1 flex items-baseline gap-1">
                <span className={cn('font-semibold tracking-tight', t.wide ? 'text-xl' : 'text-2xl')}>{v.value}</span>
                {v.unit && <span className="text-muted-foreground text-sm">{v.unit}</span>}
              </p>
              {v.change && <ChangeLine change={v.change} />}
              {v.detail}
              <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{v.note}</p>
            </div>
          )
        })}
      </div>
      <p className="text-muted-foreground border-t px-4 py-1.5 text-xs">
        &ldquo;Was, now&rdquo; compares the first and second half of the selected range.
      </p>
    </section>
  )
}
