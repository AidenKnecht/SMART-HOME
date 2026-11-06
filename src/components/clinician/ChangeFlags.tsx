import { useState } from 'react'
import { ChevronRight, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { Flag, FlagSeverity } from '@/lib/derive'
import { cn } from '@/lib/utils'

const sev: Record<FlagSeverity, { Icon: typeof Info; cls: string; label: string }> = {
  high: { Icon: CircleAlert, cls: 'text-zone-red', label: 'Needs attention' },
  medium: { Icon: TriangleAlert, cls: 'text-zone-yellow', label: 'Worth discussing' },
  info: { Icon: Info, cls: 'text-muted-foreground', label: 'For context' },
}

const FIRST = 6

export function ChangeFlags({ flags, onOpen }: { flags: Flag[]; onOpen?: (measure: string) => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? flags : flags.slice(0, FIRST)
  return (
    <section aria-labelledby="flags-h" className="bg-card self-start rounded-lg border">
      <h2 id="flags-h" className="border-b px-4 py-2 text-sm font-semibold">
        What to discuss today
      </h2>
      {flags.length === 0 ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">Nothing stands out in this range.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((f) => {
            const s = sev[f.severity]
            const body = (
              <>
                <s.Icon className={cn('mt-0.5 size-4 shrink-0', s.cls)} aria-label={s.label} />
                <span className="flex-1">{f.text}</span>
              </>
            )
            return (
              <li key={f.key}>
                {f.measure && onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(f.measure!)}
                    className="hover:bg-accent/60 focus-visible:bg-accent/60 flex w-full items-start gap-2 px-4 py-2 text-left text-sm leading-snug outline-none"
                  >
                    {body}
                    <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-label="Open details" />
                  </button>
                ) : (
                  <div className="flex items-start gap-2 px-4 py-2 text-sm leading-snug">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {flags.length > FIRST && (
        <button
          onClick={() => setAll((x) => !x)}
          className="text-primary w-full border-t px-4 py-2 text-left text-sm font-medium hover:underline"
          aria-expanded={all}
        >
          {all ? 'Show fewer' : `Show ${flags.length - FIRST} more`}
        </button>
      )}
    </section>
  )
}
