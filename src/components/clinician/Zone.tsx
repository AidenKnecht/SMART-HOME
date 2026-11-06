import type { Zone } from '@/data/types'
import { cn } from '@/lib/utils'

export const ZONE_LABEL: Record<Zone, string> = { green: 'Green', yellow: 'Yellow', red: 'Red' }

const zoneClass: Record<Zone, string> = {
  green: 'bg-zone-green-bg text-zone-green border-zone-green/40',
  yellow: 'bg-zone-yellow-bg text-zone-yellow border-zone-yellow/40',
  red: 'bg-zone-red-bg text-zone-red border-zone-red/40',
}
export const zoneFill: Record<Zone, string> = {
  green: 'bg-zone-green',
  yellow: 'bg-zone-yellow-fill',
  red: 'bg-zone-red',
}

/** Zone pill: color is always paired with the zone name. */
export function ZonePill({ zone, className }: { zone?: Zone; className?: string }) {
  if (!zone) return <span className="text-muted-foreground text-xs">No zone</span>
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-semibold',
        zoneClass[zone],
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', zoneFill[zone])} aria-hidden />
      {ZONE_LABEL[zone]}
    </span>
  )
}
