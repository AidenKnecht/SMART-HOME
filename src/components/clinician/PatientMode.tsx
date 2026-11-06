import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { addDays, fmtDay, type DaySummary } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Model } from './model'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dow = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()
const hard = (d: DaySummary) => d.zone === 'yellow' || d.zone === 'red'

function longestStreak(days: DaySummary[], perDay: number) {
  let best = 0
  let run = 0
  for (const d of days) {
    run = d.controllerDoses >= perDay ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

function Cell({ d }: { d?: DaySummary }) {
  if (!d) return <div />
  const num = Number(d.day.slice(8))
  const style =
    d.zone === 'green'
      ? 'bg-zone-green-bg text-zone-green border-zone-green/30'
      : d.zone === 'yellow'
        ? 'bg-zone-yellow-bg text-zone-yellow border-zone-yellow/40'
        : d.zone === 'red'
          ? 'bg-zone-red-bg text-zone-red border-zone-red/40'
          : 'bg-muted text-muted-foreground border-transparent'
  const Icon = d.zone === 'green' ? CircleCheck : d.zone === 'yellow' ? TriangleAlert : d.zone === 'red' ? CircleAlert : null
  const name = d.zone === 'green' ? 'good day' : d.zone === 'yellow' ? 'harder day' : d.zone === 'red' ? 'tough day' : 'no check-in'
  return (
    <div
      className={cn('flex h-11 flex-col items-center justify-center rounded-md border text-sm font-semibold', style)}
      title={`${fmtDay(d.day)}: ${name}`}
      aria-label={`${fmtDay(d.day)}: ${name}`}
    >
      <span>{num === 1 ? fmtDay(d.day) : num}</span>
      {Icon && <Icon className="mt-0.5 size-4" aria-hidden />}
    </div>
  )
}

export function PatientMode({ model }: { model: Model }) {
  const { days, doc, ctx, dropDay, stats } = model
  const perDay = ctx.dosesPerDay
  const goodDays = stats.zones.green
  const hardDays = stats.zones.yellow + stats.zones.red
  const fullDoseDays = days.filter((d) => d.controllerDoses >= perDay).length
  const streak = longestStreak(days, perDay)
  const badges = doc.earnedTrackerBadges.length + doc.earnedMedicationBadges.length

  // Calendar grid padded to whole weeks
  const start = addDays(days[0].day, -dow(days[0].day))
  const byDay = new Map(days.map((d) => [d.day, d]))
  const cells: (DaySummary | undefined)[] = []
  for (let d = start; d <= days.at(-1)!.day || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(byDay.get(d))

  let story: string | null = null
  if (dropDay) {
    const before = days.filter((d) => d.day < dropDay)
    const after = days.filter((d) => d.day >= dropDay)
    const hb = before.filter(hard).length
    const ha = after.filter(hard).length
    story = `Before ${fmtDay(dropDay)}, when you were taking your controller inhaler most days, you had ${hb === 0 ? 'no' : hb} harder ${hb === 1 ? 'day' : 'days'} in ${before.length}. Since then, you've had ${ha} in ${after.length}.`
  }

  return (
    <section aria-labelledby="pm-h" className="bg-card mx-auto max-w-5xl rounded-xl border px-10 py-8">
      <h2 id="pm-h" className="text-3xl font-bold tracking-tight">
        {doc.firstName}&rsquo;s {days.length} days, {fmtDay(days[0].day)} to {fmtDay(days.at(-1)!.day)}
      </h2>
      <p className="text-muted-foreground mt-1 text-lg">Here&rsquo;s what your check-ins and inhaler logs show.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="bg-zone-green-bg rounded-lg p-5">
          <p className="text-zone-green text-5xl font-bold">{goodDays}</p>
          <p className="mt-1 text-lg font-medium">good days</p>
          <p className="text-muted-foreground text-sm">Green zone on your action plan</p>
        </div>
        <div className="bg-zone-yellow-bg rounded-lg p-5">
          <p className="text-zone-yellow text-5xl font-bold">{hardDays}</p>
          <p className="mt-1 text-lg font-medium">harder days</p>
          <p className="text-muted-foreground text-sm">
            Yellow or red zone ({stats.zones.red} red)
          </p>
        </div>
        <div className="bg-accent rounded-lg p-5">
          <p className="text-primary text-5xl font-bold">{fullDoseDays}</p>
          <p className="mt-1 text-lg font-medium">days with every controller dose</p>
          <p className="text-muted-foreground text-sm">
            Out of {days.length}. Best streak: {streak} days in a row.
          </p>
        </div>
      </div>

      {story && <p className="bg-muted mt-6 rounded-lg px-5 py-4 text-xl leading-snug font-medium">{story}</p>}

      <div className="mt-6">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-sm font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => (
            <Cell key={i} d={d} />
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <CircleCheck className="text-zone-green size-4" aria-hidden /> Good day (green)
          </span>
          <span className="flex items-center gap-1.5">
            <TriangleAlert className="text-zone-yellow size-4" aria-hidden /> Harder day (yellow)
          </span>
          <span className="flex items-center gap-1.5">
            <CircleAlert className="text-zone-red size-4" aria-hidden /> Tough day (red)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-muted size-4 rounded-sm" aria-hidden /> No check-in
          </span>
        </div>
      </div>

      {badges > 0 && (
        <p className="mt-6 text-lg">
          You&rsquo;ve earned <span className="font-semibold">{badges} badges</span> for logging. Keep it going.
        </p>
      )}
    </section>
  )
}
