import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { addDays, fmtDay, treatmentEvents, type DaySummary } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Model } from './model'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
const dow = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()
type Level = 'good' | 'harder' | 'tough'

function longestStreak(days: DaySummary[], perDay: number) {
  let best = 0
  let run = 0
  for (const d of days) {
    run = d.controllerDoses >= perDay ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

function Cell({ d, level, names }: { d?: DaySummary; level?: Level; names: Record<Level, string> }) {
  if (!d) return <div />
  const num = Number(d.day.slice(8))
  const style =
    level === 'good'
      ? 'bg-zone-green-bg text-zone-green border-zone-green/30'
      : level === 'harder'
        ? 'bg-zone-yellow-bg text-zone-yellow border-zone-yellow/40'
        : level === 'tough'
          ? 'bg-zone-red-bg text-zone-red border-zone-red/40'
          : 'bg-muted text-muted-foreground border-transparent'
  const Icon = level === 'good' ? CircleCheck : level === 'harder' ? TriangleAlert : level === 'tough' ? CircleAlert : null
  const name = level ? names[level] : 'no check-in'
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

/** "About 2 harder days a week" in big type, with 7 dots so it reads without any numbers too. */
function WeekBlock({ label, perWeek, harderWord }: { label: string; perWeek: number; harderWord: string }) {
  const n = Math.round(perWeek)
  const text = n > 0 ? `About ${n}` : perWeek > 0 ? 'Almost no' : 'No'
  return (
    <div className="bg-card rounded-lg border p-5">
      <p className="text-muted-foreground text-lg font-medium">{label}</p>
      <p className="mt-1 text-4xl font-bold">{text}</p>
      <p className="text-lg">
        {harderWord} a week
      </p>
      <div className="mt-3 flex gap-2" role="img" aria-label={`${n} of 7 days`}>
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={cn('size-6 rounded-full border-2', i < n ? 'bg-zone-yellow-fill border-zone-yellow' : 'border-zone-green bg-zone-green-bg')}
          />
        ))}
      </div>
    </div>
  )
}

export function PatientMode({ model }: { model: Model }) {
  const { days, doc, ctx, dropDay, tracker } = model
  const perDay = ctx.dosesPerDay
  const plan = doc.asthmaTreatmentPlan
  // Asthma: the action plan zone. Other trackers: the main yes/no symptom question (e.g. headache),
  // with a high score on the first 1–10 scale counting as a tough day.
  const mainQ = tracker.questions.find((q) => q.type === 'yesNo' && !['rescueUsed', 'missedSchool', 'nightWaking'].includes(q.key))
  const scaleQ = tracker.questions.find((q) => q.type === 'scale1to10')
  const levelOf = (d: DaySummary): Level | undefined => {
    if (plan) return d.zone === 'green' ? 'good' : d.zone === 'yellow' ? 'harder' : d.zone === 'red' ? 'tough' : undefined
    if (d.status !== 'logged' || !mainQ) return undefined
    if (d.answers[mainQ.key] !== true) return 'good'
    return scaleQ && Number(d.answers[scaleQ.key]) >= 8 ? 'tough' : 'harder'
  }
  const thing = mainQ?.shortLabel.toLowerCase() ?? 'symptom'
  const scaleWord = scaleQ?.shortLabel.replace(/\s*\(.*\)/, '').toLowerCase() ?? 'score'
  const names: Record<Level, string> = plan
    ? { good: 'good day', harder: 'harder day', tough: 'tough day' }
    : { good: `no ${thing}`, harder: `${thing} day`, tough: `bad ${thing} (${scaleWord} 8+)` }
  const levels = days.map(levelOf)
  const hard = (d: DaySummary) => {
    const l = levelOf(d)
    return l === 'harder' || l === 'tough'
  }
  const goodDays = levels.filter((l) => l === 'good').length
  const hardDays = levels.filter((l) => l === 'harder' || l === 'tough').length
  const toughDays = levels.filter((l) => l === 'tough').length
  const medWord = plan ? 'controller' : 'daily medicine'
  const fullDoseDays = days.filter((d) => d.controllerDoses >= perDay).length
  const streak = longestStreak(days, perDay)
  const badges = doc.earnedTrackerBadges.length + doc.earnedMedicationBadges.length

  // Calendar grid padded to whole weeks
  const start = addDays(days[0].day, -dow(days[0].day))
  const byDay = new Map(days.map((d) => [d.day, d]))
  const cells: (DaySummary | undefined)[] = []
  for (let d = start; d <= days.at(-1)!.day || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(byDay.get(d))

  // Before / since split, in the plainest terms: what changed for the teen. Doses falling off is the
  // story when it happened (Jordan); otherwise a medication change in range (Priya).
  const event = treatmentEvents(ctx).filter((e) => e.day > days[0].day && e.day <= days.at(-1)!.day).at(-1)
  const split: { day: string; beforeLabel: string; afterLabel: string; doses: boolean } | null = dropDay
    ? { day: dropDay, beforeLabel: `When you took your ${medWord} most days`, afterLabel: `Since ${fmtDay(dropDay)}`, doses: true }
    : event
      ? {
          day: event.day,
          beforeLabel: `Before ${fmtDay(event.day)}`,
          afterLabel: `Since your ${event.medName.toLowerCase()} ${event.kind === 'dose' ? 'dose changed' : 'started'} on ${fmtDay(event.day)}`,
          doses: false,
        }
      : null
  const perWeek = (xs: DaySummary[]) => (xs.length ? (xs.filter(hard).length / xs.length) * 7 : 0)
  const before = split ? days.filter((d) => d.day < split.day) : []
  const after = split ? days.filter((d) => d.day >= split.day) : []
  const wb = perWeek(before)
  const wa = perWeek(after)
  const harderWord = plan ? 'harder days' : `${names.harder}s`
  const verdict = !split ? null : wa < wb - 0.5 ? 'better' : wa > wb + 0.5 ? 'worse' : 'same'
  const last7 = days.slice(-7)
  const recentFull = last7.filter((d) => d.controllerDoses >= perDay).length

  return (
    <section aria-labelledby="pm-h" className="bg-card mx-auto max-w-5xl rounded-xl border px-10 py-8">
      <h2 id="pm-h" className="text-3xl font-bold tracking-tight">
        {doc.firstName}&rsquo;s {days.length} days, {fmtDay(days[0].day)} to {fmtDay(days.at(-1)!.day)}
      </h2>
      <p className="text-muted-foreground mt-1 text-lg">Here&rsquo;s what your check-ins and {plan ? 'inhaler' : 'medicine'} logs show.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="bg-zone-green-bg rounded-lg p-5">
          <p className="text-zone-green text-5xl font-bold">{goodDays}</p>
          <p className="mt-1 text-lg font-medium">good days</p>
          <p className="text-muted-foreground text-sm">{plan ? 'Green zone on your action plan' : `No ${thing} reported`}</p>
        </div>
        <div className="bg-zone-yellow-bg rounded-lg p-5">
          <p className="text-zone-yellow text-5xl font-bold">{hardDays}</p>
          <p className="mt-1 text-lg font-medium">{plan ? 'harder days' : `${names.harder}s`}</p>
          <p className="text-muted-foreground text-sm">
            {plan ? `Yellow or red zone (${toughDays} red)` : `${toughDays} with ${scaleWord} 8 or more`}
          </p>
        </div>
        <div className="bg-accent rounded-lg p-5">
          <p className="text-primary text-5xl font-bold">{fullDoseDays}</p>
          <p className="mt-1 text-lg font-medium">days with every {medWord} dose</p>
          <p className="text-muted-foreground text-sm">
            Out of {days.length}. Best streak: {streak} days in a row.
          </p>
        </div>
      </div>

      {split && verdict && (
        <div className="bg-muted mt-6 rounded-lg px-5 py-5" aria-labelledby="pm-ba-h">
          <h3 id="pm-ba-h" className="sr-only">
            Before and since
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <WeekBlock label={split.beforeLabel} perWeek={wb} harderWord={harderWord} />
            <WeekBlock label={split.afterLabel} perWeek={wa} harderWord={harderWord} />
          </div>
          <p
            className={cn(
              'mt-4 flex items-center gap-2 text-xl font-semibold',
              verdict === 'better' && 'text-zone-green',
              verdict === 'worse' && 'text-zone-red',
            )}
          >
            {verdict === 'better' ? (
              <CircleCheck className="size-6 shrink-0" aria-hidden />
            ) : verdict === 'worse' ? (
              <CircleAlert className="size-6 shrink-0" aria-hidden />
            ) : null}
            {verdict === 'better'
              ? `Fewer ${harderWord} since then.`
              : verdict === 'worse'
                ? `More ${harderWord} since then. Let's talk about why.`
                : `About the same number of ${harderWord}.`}
          </p>
          {split.doses && (
            <p className="mt-2 text-lg">
              Your {medWord} works best when you take it every day. In the last 7 days you took every dose on {recentFull}{' '}
              {recentFull === 1 ? 'day' : 'days'}.
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-sm font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => (
            <Cell key={i} d={d} level={d ? levels[days.indexOf(d)] : undefined} names={names} />
          ))}
        </div>
        <div className="text-muted-foreground mt-3 flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <CircleCheck className="text-zone-green size-4" aria-hidden /> {plan ? 'Good day (green)' : cap(names.good)}
          </span>
          <span className="flex items-center gap-1.5">
            <TriangleAlert className="text-zone-yellow size-4" aria-hidden /> {plan ? 'Harder day (yellow)' : cap(names.harder)}
          </span>
          <span className="flex items-center gap-1.5">
            <CircleAlert className="text-zone-red size-4" aria-hidden /> {plan ? 'Tough day (red)' : cap(names.tough)}
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
