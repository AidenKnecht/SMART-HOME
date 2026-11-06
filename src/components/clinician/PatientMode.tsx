import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { addDays, fmtDay, type DaySummary } from '@/lib/derive'
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

  let story: string | null = null
  if (dropDay) {
    const before = days.filter((d) => d.day < dropDay)
    const after = days.filter((d) => d.day >= dropDay)
    const hb = before.filter(hard).length
    const ha = after.filter(hard).length
    story = `Before ${fmtDay(dropDay)}, when you were taking your controller inhaler most days, you had ${hb === 0 ? 'no' : hb} harder ${hb === 1 ? 'day' : 'days'} in ${before.length}. Since then, you've had ${ha} in ${after.length}.`
  } else {
    // A dose change inside the range (new active entry, older archived entry with the same name)
    const active = doc.medications.find((m) => ctx.controllerIds.has(m.id) && !m.archived)
    const changed = active && doc.medications.some((m) => m.archived && m.name === active.name)
    if (active && changed && active.startDate > days[0].day && active.startDate <= days.at(-1)!.day) {
      const before = days.filter((d) => d.day < active.startDate)
      const after = days.filter((d) => d.day >= active.startDate)
      const wk = (xs: DaySummary[]) => Math.round((xs.filter(hard).length / xs.length) * 7 * 10) / 10
      story = `Before your ${active.name.toLowerCase()} dose changed on ${fmtDay(active.startDate)}, you had about ${wk(before)} ${names.harder}s a week. Since then, about ${wk(after)} a week.`
    }
  }

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

      {story && <p className="bg-muted mt-6 rounded-lg px-5 py-4 text-xl leading-snug font-medium">{story}</p>}

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
