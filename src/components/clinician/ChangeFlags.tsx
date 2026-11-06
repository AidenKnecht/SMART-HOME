import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { Flag, FlagSeverity } from '@/lib/derive'
import { cn } from '@/lib/utils'

const sev: Record<FlagSeverity, { Icon: typeof Info; cls: string; label: string }> = {
  high: { Icon: CircleAlert, cls: 'text-zone-red', label: 'Needs attention' },
  medium: { Icon: TriangleAlert, cls: 'text-zone-yellow', label: 'Worth discussing' },
  info: { Icon: Info, cls: 'text-muted-foreground', label: 'For context' },
}

export function ChangeFlags({ flags }: { flags: Flag[] }) {
  return (
    <section aria-labelledby="flags-h" className="bg-card rounded-lg border">
      <h2 id="flags-h" className="border-b px-4 py-2 text-sm font-semibold">
        What to discuss today
      </h2>
      {flags.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">Nothing stands out in this range.</p>
      ) : (
        <ul className="divide-y">
          {flags.map((f) => {
            const s = sev[f.severity]
            return (
              <li key={f.key} className="flex items-start gap-2 px-4 py-2 text-sm leading-snug">
                <s.Icon className={cn('mt-0.5 size-4 shrink-0', s.cls)} aria-label={s.label} />
                <span>{f.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
