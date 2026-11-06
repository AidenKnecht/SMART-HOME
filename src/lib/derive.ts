// Derivation layer: turns one raw SMART@Home patient document into clinician-ready facts.
// Pure TypeScript, relative imports only, so Node scripts can import it too.

import { getQuestion, parseValue, trackerDefinitions } from '../data/trackerDefinition.ts'
import type {
  BaselineReading,
  Question,
  Medication,
  PatientDocument,
  TrackerResponse,
  Zone,
} from '../data/types.ts'

// ---------------------------------------------------------------- Settings

export type DayRule = 'worst' | 'latest'

/** Every clinical threshold in one place, so clinician feedback changes numbers, not code. */
export const THRESHOLDS = {
  adherenceGoodPct: 80,
  adherenceLowPct: 60,
  adherenceDropPts: 20,
  fev1DropPct: 10,
  fev1LowPctPredicted: 80,
  rescueRiseDaysPerWk: 2,
  yellowDaysFlag: 3,
  planExpiringDays: 30,
  trackerSilentDays: 2,
  ginaDaysPerWk: 2,
  ginaWindowDays: 28,
} as const

export const ZONE_RANK: Record<Zone, number> = { green: 0, yellow: 1, red: 2 }

// ---------------------------------------------------------------- Dates

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
})

/** ISO UTC timestamp -> Cincinnati calendar day (YYYY-MM-DD), DST-aware. */
export const localDay = (iso: string) => (iso ? dayFmt.format(new Date(iso)) : '')
/** ISO UTC timestamp -> "1:29 PM" local. */
export const localTime = (iso: string) => timeFmt.format(new Date(iso))

const DAY_MS = 86_400_000
export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
/** "2026-11-05" -> "Nov 5" */
export const fmtDay = (day: string) => (day ? shortFmt.format(new Date(`${day}T00:00:00Z`)) : '')
const weekdayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
export const fmtWeekday = (day: string) => weekdayFmt.format(new Date(`${day}T00:00:00Z`))

// ---------------------------------------------------------------- Small helpers

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

/** 'KeepGoingUntilCompletelyEmpty' -> 'Keep going until completely empty' */
export function humanizeCode(code: string): string {
  const special: Record<string, string> = { DontHesitate: "Don't hesitate" }
  if (special[code]) return special[code]
  const words = code.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ')
  return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(' ')
}

/** Controller = scheduled daily medication. The real schema has "How Often", not a controller flag. */
export function isControllerMed(m: Medication): boolean {
  const flag = (m as { isController?: unknown }).isController
  return typeof flag === 'boolean' ? flag : m.howOften === 'Daily'
}

export const isBlank = (sub: TrackerResponse) => sub.responses.every((r) => r.value.trim() === '')

/** Parse one submission into { questionKey: parsedValue }, skipping empty answers. */
export function parseSubmission(sub: TrackerResponse): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const r of sub.responses) {
    const q = getQuestion(sub.trackerId, r.questionId)
    if (!q) continue
    const v = parseValue(q, r.value)
    if (v !== null) out[q.key] = v
  }
  return out
}

// ---------------------------------------------------------------- Day model

export interface ParsedEntry {
  id: string
  submittedAt: string
  time: string
  blank: boolean
  zone?: Zone
  answers: Record<string, unknown>
}

export interface SpiroDay {
  /** Best accepted blow; undefined when every blow that day was rejected */
  fev1?: number
  fvc?: number
  ratio?: number
  pef?: number
  pctPredicted?: number
  pctPersonalBest?: number
  accepted: number
  rejected: number
  coaching: string[]
}

export interface DaySummary {
  day: string
  status: 'none' | 'blank-only' | 'logged'
  entries: ParsedEntry[]
  entryCount: number
  realEntryCount: number
  feeling?: string
  symptoms: string[]
  nightWaking?: boolean
  rescueAnswer?: boolean
  rescuePuffs?: number
  activityLimit?: string
  activityLimited: boolean
  missedSchool?: boolean
  zone?: Zone
  controllerDoses: number
  controllerTimes: string[]
  rescueDoses: number
  /** Rescue use from either signal: tracker answer OR a logged albuterol dose */
  rescueAny: boolean
  spirometry?: SpiroDay
  conflict?: string
  changedAnswer?: string
  /** Every tracker question aggregated to one value per day, by question type and day rule */
  answers: Record<string, unknown>
}

function optionSeverity(trackerId: string, key: string, value: string | undefined): number {
  if (value === undefined) return -1
  const q = trackerDefinitions[trackerId]?.questions.find((x) => x.key === key)
  return q?.options?.find((o) => o.value === value)?.severity ?? -1
}

const isNone = (q: Question, v: string) => !!q.noneValue && v.trim() === q.noneValue.trim()

/** Aggregate one question across a day's real entries, by question type. */
function aggregateQuestion(q: Question, vals: unknown[], dayRule: DayRule): unknown {
  if (!vals.length) return undefined
  const sevOf = (v: unknown) => q.options?.find((o) => o.value === v)?.severity ?? -1
  switch (q.type) {
    case 'checkbox':
    case 'icon': {
      const lists = vals.map((v) => (v as string[]).filter((x) => !isNone(q, x)))
      return dayRule === 'latest' ? lists.at(-1) : [...new Set(lists.flat())]
    }
    case 'yesNo':
      return dayRule === 'latest' ? vals.at(-1) : vals.some(Boolean)
    case 'number':
    case 'scale1to10':
      return dayRule === 'latest' ? vals.at(-1) : Math.max(...(vals as number[]))
    case 'faceScale':
    case 'singleChoice':
      return dayRule === 'latest' ? vals.at(-1) : worstBy(vals, sevOf)
    default:
      return vals.at(-1)
  }
}

function worstBy<T>(values: T[], score: (v: T) => number): T | undefined {
  let best: T | undefined
  let bestScore = -Infinity
  for (const v of values) {
    const s = score(v)
    if (s > bestScore) {
      best = v
      bestScore = s
    }
  }
  return best
}

export interface PatientContext {
  doc: PatientDocument
  trackerId: string
  controllerIds: Set<string>
  rescueIds: Set<string>
  dosesPerDay: number
  readingsByDay: Map<string, BaselineReading[]>
  logsByDay: Map<string, PatientDocument['dailyLogs'][number]>
  firstDay: string
  asOf: string
}

export function patientContext(doc: PatientDocument): PatientContext {
  const controllers = doc.medications.filter(isControllerMed)
  const controllerIds = new Set(controllers.map((m) => m.id))
  const rescueIds = new Set(doc.medications.filter((m) => !isControllerMed(m)).map((m) => m.id))
  const dosesPerDay = Math.max(1, ...controllers.filter((m) => !m.archived).map((m) => m.timesPerDay ?? 1))
  const readingsByDay = new Map<string, BaselineReading[]>()
  for (const dev of doc.medicalDevices)
    for (const r of dev.baselineReadings) {
      const d = localDay(r.readingDate)
      readingsByDay.set(d, [...(readingsByDay.get(d) ?? []), r])
    }
  const logsByDay = new Map(doc.dailyLogs.map((l) => [l.day, l]))
  const allDays = [...logsByDay.keys(), ...readingsByDay.keys()].sort()
  return {
    doc,
    trackerId: doc.assignedTrackerIds[0],
    controllerIds,
    rescueIds,
    dosesPerDay,
    readingsByDay,
    logsByDay,
    firstDay: allDays[0] ?? '',
    asOf: lastActivity(doc).overall,
  }
}

function spiroForDay(ctx: PatientContext, readings: BaselineReading[] | undefined): SpiroDay | undefined {
  const plan = ctx.doc.asthmaTreatmentPlan
  if (!readings?.length || !plan) return undefined
  const accepted = readings.filter((r) => r.accepted)
  const best = worstBy(accepted, (r) => r.fev1)
  const coaching = [...new Set(readings.flatMap((r) => r.qualityReport.qualityIndications.map((q) => humanizeCode(q.code))))]
  return {
    fev1: best && round(best.fev1, 2),
    fvc: best && round(best.fvc, 2),
    ratio: best && round(best.fev1FvcRatio, 2),
    pef: best && Math.round(best.pef),
    pctPredicted: best && Math.round((best.fev1 / plan.predictedFev1) * 100),
    pctPersonalBest: best && Math.round((best.pef / plan.personalBestPef) * 100),
    accepted: accepted.length,
    rejected: readings.length - accepted.length,
    coaching,
  }
}

function buildDay(ctx: PatientContext, day: string, dayRule: DayRule): DaySummary {
  const log = ctx.logsByDay.get(day)
  const subs = [...(log?.trackerResponses ?? [])].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const entries: ParsedEntry[] = subs.map((s) => ({
    id: s.id,
    submittedAt: s.submittedAt,
    time: localTime(s.submittedAt),
    blank: isBlank(s),
    zone: s.actionPlanZone,
    answers: parseSubmission(s),
  }))
  const real = entries.filter((e) => !e.blank)
  const tid = subs[0]?.trackerId ?? ctx.trackerId

  // Pick values per day rule. "latest": most recent real entry that answered the question.
  const pick = <T>(key: string, worst: (vals: T[]) => T | undefined): T | undefined => {
    const vals = real.map((e) => e.answers[key] as T | undefined).filter((v): v is T => v !== undefined)
    if (!vals.length) return undefined
    return dayRule === 'latest' ? vals.at(-1) : worst(vals)
  }
  const anyTrue = (vals: boolean[]) => vals.some(Boolean)
  const cleanSymptoms = (v: string[]) => v.filter((s) => s.trim() !== 'None of these')

  const feeling = pick<string>('feeling', (v) => worstBy(v, (x) => optionSeverity(tid, 'feeling', x)))
  const symptomLists = pick<string[]>('symptoms', (v) => [...new Set(v.flatMap(cleanSymptoms))])
  const symptoms = cleanSymptoms(symptomLists ?? [])
  const activityLimit = pick<string>('activityLimit', (v) => worstBy(v, (x) => optionSeverity(tid, 'activityLimit', x)))
  const zones = real.map((e) => e.zone).filter((z): z is Zone => !!z)
  const zone = zones.length ? (dayRule === 'latest' ? zones.at(-1) : worstBy(zones, (z) => ZONE_RANK[z])) : undefined

  const doses = log?.medicationAdministrations ?? []
  const controller = doses.filter((d) => ctx.controllerIds.has(d.medicationId))
  const rescueDoses = doses.filter((d) => ctx.rescueIds.has(d.medicationId)).length
  const rescueAnswer = pick<boolean>('rescueUsed', anyTrue)

  // Conflicts the old grid hides
  let conflict: string | undefined
  for (const e of real) {
    const f = e.answers.feeling as string | undefined
    const s = cleanSymptoms((e.answers.symptoms as string[] | undefined) ?? [])
    const notable = s.filter((x) => x === 'Wheezing' || x === 'Shortness Of Breath')
    if (f === 'Great' && notable.length) {
      conflict = `Felt ${f} but reported ${notable.map((x) => x.toLowerCase()).join(' and ')}`
      break
    }
  }
  const feelings = real.map((e) => e.answers.feeling as string | undefined).filter((x): x is string => !!x)
  const sev = feelings.map((f) => optionSeverity(tid, 'feeling', f))
  const changedAnswer =
    sev.length > 1 && Math.max(...sev) - Math.min(...sev) >= 2 ? [...new Set(feelings)].join(' → ') : undefined

  return {
    day,
    status: real.length ? 'logged' : entries.length ? 'blank-only' : 'none',
    entries,
    entryCount: entries.length,
    realEntryCount: real.length,
    feeling,
    symptoms,
    nightWaking: pick<boolean>('nightWaking', anyTrue),
    rescueAnswer,
    rescuePuffs: pick<number>('rescuePuffs', (v) => Math.max(...v)),
    activityLimit,
    activityLimited: optionSeverity(tid, 'activityLimit', activityLimit) >= 1 || symptoms.includes('Activity limitations'),
    missedSchool: pick<boolean>('missedSchool', anyTrue),
    zone,
    controllerDoses: Math.min(controller.length, ctx.dosesPerDay),
    controllerTimes: controller.map((d) => localTime(d.administeredAt)),
    rescueDoses,
    rescueAny: rescueAnswer === true || rescueDoses > 0,
    spirometry: spiroForDay(ctx, ctx.readingsByDay.get(day)),
    conflict,
    changedAnswer,
    answers: Object.fromEntries(
      (trackerDefinitions[tid]?.questions ?? [])
        .filter((q) => q.type !== 'spirometry')
        .map((q) => [
          q.key,
          aggregateQuestion(
            q,
            real.map((e) => e.answers[q.key]).filter((v) => v !== undefined),
            dayRule,
          ),
        ]),
    ),
  }
}

/** One DaySummary per calendar day in [from, to], including days with no data at all. */
export function buildDays(ctx: PatientContext, from: string, to: string, dayRule: DayRule): DaySummary[] {
  const out: DaySummary[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(buildDay(ctx, d, dayRule))
  return out
}

// ---------------------------------------------------------------- Per-question stats (generic tiles)

export interface QuestionStats {
  answeredDays: number
  yesDays?: number
  mean?: number
  max?: number
  /** checkbox/icon: days each item was reported, most frequent first */
  topItems?: { label: string; count: number }[]
  /** checkbox/icon: days with at least one item */
  anyDays?: number
  /** faceScale/singleChoice: days per option, in option order */
  distribution?: { label: string; value: string; severity: number; count: number }[]
  worst?: string
}

export function questionStats(days: DaySummary[], q: Question): QuestionStats {
  const vals = days.map((d) => d.answers[q.key]).filter((v) => v !== undefined)
  const label = (v: string) => q.options?.find((o) => o.value === v)?.label ?? v
  const out: QuestionStats = { answeredDays: vals.length }
  switch (q.type) {
    case 'yesNo':
      out.yesDays = vals.filter(Boolean).length
      break
    case 'number':
    case 'scale1to10': {
      const n = vals as number[]
      if (n.length) {
        out.mean = round(n.reduce((a, b) => a + b, 0) / n.length, 1)
        out.max = Math.max(...n)
      }
      break
    }
    case 'checkbox':
    case 'icon': {
      const counts = new Map<string, number>()
      for (const list of vals as string[][]) for (const x of list) counts.set(x, (counts.get(x) ?? 0) + 1)
      out.topItems = [...counts].sort((a, b) => b[1] - a[1]).map(([v, count]) => ({ label: label(v), count }))
      out.anyDays = (vals as string[][]).filter((l) => l.length).length
      break
    }
    case 'faceScale':
    case 'singleChoice': {
      out.distribution = (q.options ?? []).map((o) => ({
        label: o.label,
        value: o.value,
        severity: o.severity ?? 0,
        count: vals.filter((v) => v === o.value).length,
      }))
      const present = out.distribution.filter((o) => o.count > 0)
      out.worst = present.length ? present.reduce((a, b) => (b.severity > a.severity ? b : a)).label : undefined
      break
    }
  }
  return out
}

// ---------------------------------------------------------------- Range stats

export interface RangeStats {
  from: string
  to: string
  daysInRange: number
  loggedDays: number
  symptomDays: number
  rescueDays: number
  rescueDosesTotal: number
  nightDays: number
  schoolDays: number
  activityDays: number
  conflictDays: number
  zones: Record<Zone, number>
  zoneDays: number
  controllerDoses: number
  scheduledDoses: number
  adherencePct?: number
  spiroDays: number
  fev1Latest?: number
  fev1LatestDay?: string
  fev1LatestPctPredicted?: number
  fev1Mean?: number
  /** Mean of daily best FEV1 in the first and last windows of the range */
  fev1Start?: number
  fev1End?: number
  fev1ChangePct?: number
  hasData: boolean
}

export function summarizeRange(days: DaySummary[], ctx: PatientContext): RangeStats {
  const logged = days.filter((d) => d.status === 'logged')
  const zones: Record<Zone, number> = { green: 0, yellow: 0, red: 0 }
  for (const d of days) if (d.zone) zones[d.zone]++
  const controllerDoses = days.reduce((a, d) => a + d.controllerDoses, 0)
  const scheduledDoses = days.length * ctx.dosesPerDay
  const spiro = days.filter((d) => d.spirometry?.fev1 !== undefined)
  const latest = spiro.at(-1)
  const win = Math.max(3, Math.min(14, Math.floor(days.length / 3)))
  const startDays = days.slice(0, win).filter((d) => d.spirometry?.fev1 !== undefined)
  const endDays = days.slice(-win).filter((d) => d.spirometry?.fev1 !== undefined)
  const fev1Start = mean(startDays.map((d) => d.spirometry!.fev1!))
  const fev1End = mean(endDays.map((d) => d.spirometry!.fev1!))
  const hasData = days.some((d) => d.status !== 'none' || d.controllerDoses > 0 || d.rescueDoses > 0 || d.spirometry)
  return {
    from: days[0]?.day ?? '',
    to: days.at(-1)?.day ?? '',
    daysInRange: days.length,
    loggedDays: logged.length,
    symptomDays: logged.filter((d) => d.symptoms.length > 0).length,
    rescueDays: days.filter((d) => d.rescueAny).length,
    rescueDosesTotal: days.reduce((a, d) => a + d.rescueDoses, 0),
    nightDays: days.filter((d) => d.nightWaking).length,
    schoolDays: days.filter((d) => d.missedSchool).length,
    activityDays: days.filter((d) => d.activityLimited).length,
    conflictDays: days.filter((d) => d.conflict).length,
    zones,
    zoneDays: zones.green + zones.yellow + zones.red,
    controllerDoses,
    scheduledDoses,
    adherencePct: hasData && scheduledDoses ? Math.round((100 * controllerDoses) / scheduledDoses) : undefined,
    spiroDays: spiro.length,
    fev1Latest: latest?.spirometry?.fev1,
    fev1LatestDay: latest?.day,
    fev1LatestPctPredicted: latest?.spirometry?.pctPredicted,
    fev1Mean: mean(spiro.map((d) => d.spirometry!.fev1!)),
    fev1Start,
    fev1End,
    fev1ChangePct:
      fev1Start !== undefined && fev1End !== undefined && startDays.length && endDays.length && days.length >= 14
        ? round(((fev1End - fev1Start) / fev1Start) * 100, 1)
        : undefined,
    hasData,
  }
}

/** Split a range into first and second half, for the "how is it changing" comparison on every tile. */
export function halves(days: DaySummary[]): [DaySummary[], DaySummary[]] {
  const mid = Math.floor(days.length / 2)
  return [days.slice(0, mid), days.slice(mid)]
}

export const perWeek = (n: number, days: number) => (days ? round((n / days) * 7, 1) : 0)

// ---------------------------------------------------------------- GINA-style control

export type ControlLevel = 'well' | 'partly' | 'not'
export interface GinaCriterion {
  key: string
  text: string
  met: boolean
  evidence: string
}
export interface GinaResult {
  level: ControlLevel
  label: string
  metCount: number
  criteria: GinaCriterion[]
  from: string
  to: string
  basedOnDays: number
  windowDays: number
}

export const CONTROL_LABEL: Record<ControlLevel, string> = {
  well: 'Well controlled',
  partly: 'Partly controlled',
  not: 'Not well controlled',
}

/** GINA-style control from home data over the last 4 weeks ending at `to`. */
export function ginaControl(ctx: PatientContext, to: string, dayRule: DayRule): GinaResult {
  const n = THRESHOLDS.ginaWindowDays
  const from = addDays(to, -(n - 1))
  const days = buildDays(ctx, from, to, dayRule)
  const s = summarizeRange(days, ctx)
  const weeks = n / 7
  const limit = THRESHOLDS.ginaDaysPerWk * weeks
  const criteria: GinaCriterion[] = [
    {
      key: 'daytime',
      text: 'Daytime symptoms more than twice a week',
      met: s.symptomDays > limit,
      evidence: `${s.symptomDays} symptom days in ${weeks} weeks`,
    },
    {
      key: 'night',
      text: 'Any night waking due to asthma',
      met: s.nightDays > 0,
      evidence: `${s.nightDays} nights`,
    },
    {
      key: 'reliever',
      text: 'Reliever needed more than twice a week',
      met: s.rescueDays > limit,
      evidence: `${s.rescueDays} rescue days in ${weeks} weeks`,
    },
    {
      key: 'activity',
      text: 'Any activity limitation due to asthma',
      met: s.activityDays > 0,
      evidence: `${s.activityDays} days`,
    },
  ]
  const metCount = criteria.filter((c) => c.met).length
  const level: ControlLevel = metCount === 0 ? 'well' : metCount <= 2 ? 'partly' : 'not'
  return { level, label: CONTROL_LABEL[level], metCount, criteria, from, to, basedOnDays: s.loggedDays, windowDays: n }
}

// ---------------------------------------------------------------- Last activity (fixes the portal bug)

export interface LastActivity {
  overall: string
  tracker: string
  dose: string
  spirometry: string
}

export function lastActivity(doc: PatientDocument): LastActivity {
  let tracker = ''
  let dose = ''
  let spirometry = ''
  for (const log of doc.dailyLogs) {
    for (const t of log.trackerResponses) if (t.submittedAt > tracker) tracker = t.submittedAt
    for (const m of log.medicationAdministrations) if (m.administeredAt > dose) dose = m.administeredAt
  }
  for (const dev of doc.medicalDevices)
    for (const r of dev.baselineReadings) if (r.readingDate > spirometry) spirometry = r.readingDate
  const t = localDay(tracker)
  const d = localDay(dose)
  const s = localDay(spirometry)
  return { overall: [t, d, s].sort().at(-1) ?? '', tracker: t, dose: d, spirometry: s }
}

// ---------------------------------------------------------------- Rolling adherence (chart)

export function rollingAdherence(days: DaySummary[], ctx: PatientContext, window = 7): (number | undefined)[] {
  return days.map((_d, i) => {
    const slice = days.slice(Math.max(0, i - window + 1), i + 1)
    if (slice.length < Math.min(window, 3)) return undefined
    const doses = slice.reduce((a, x) => a + x.controllerDoses, 0)
    return Math.round((100 * doses) / (slice.length * ctx.dosesPerDay))
  })
}

/** First day the 7-day logged-dose rate falls below the low threshold after having been good. */
export function adherenceDropDay(days: DaySummary[], ctx: PatientContext): string | undefined {
  const roll = rollingAdherence(days, ctx)
  let wasGood = false
  for (let i = 0; i < roll.length; i++) {
    const r = roll[i]
    if (r === undefined) continue
    if (r >= THRESHOLDS.adherenceGoodPct) wasGood = true
    else if (wasGood && r < THRESHOLDS.adherenceLowPct) return days[i].day
  }
  return undefined
}

// ---------------------------------------------------------------- What changed

export type FlagSeverity = 'high' | 'medium' | 'info'
export interface Flag {
  key: string
  severity: FlagSeverity
  text: string
}

export function whatChanged(ctx: PatientContext, days: DaySummary[], gina: GinaResult | null): Flag[] {
  const flags: Flag[] = []
  const [a, b] = halves(days)
  const sa = summarizeRange(a, ctx)
  const sb = summarizeRange(b, ctx)
  const all = summarizeRange(days, ctx)
  const plan = ctx.doc.asthmaTreatmentPlan
  const medWord = plan ? 'Controller' : 'Daily medication'
  const tracker = trackerDefinitions[ctx.trackerId]

  // Generic: any yes/no or numeric question whose rate or average moved between halves
  for (const q of tracker?.questions ?? []) {
    if (['rescueUsed', 'missedSchool', 'nightWaking'].includes(q.key)) continue
    const qa = questionStats(a, q)
    const qb = questionStats(b, q)
    if (q.type === 'yesNo' && qa.answeredDays >= 5 && qb.answeredDays >= 5) {
      const wa = perWeek(qa.yesDays ?? 0, a.length)
      const wb = perWeek(qb.yesDays ?? 0, b.length)
      if (Math.abs(wb - wa) >= 1) {
        flags.push({
          key: `q:${q.key}`,
          severity: wb > wa ? 'medium' : 'info',
          text: `${q.shortLabel} ${wb > wa ? 'up' : 'down'} from ${wa} to ${wb} days per week`,
        })
      }
    } else if ((q.type === 'scale1to10' || q.type === 'number') && qa.mean !== undefined && qb.mean !== undefined) {
      const tol = q.type === 'scale1to10' ? 1.5 : Math.max(1, qa.mean * 0.3)
      if (Math.abs(qb.mean - qa.mean) >= tol && qa.answeredDays >= 3 && qb.answeredDays >= 3) {
        const unit = q.type === 'scale1to10' ? ' of 10' : q.unit ? ` ${q.unit}` : ''
        flags.push({
          key: `q:${q.key}`,
          severity: qb.mean > qa.mean ? 'medium' : 'info',
          text: `${q.shortLabel} average ${qb.mean > qa.mean ? 'up' : 'down'} from ${qa.mean} to ${qb.mean}${unit}`,
        })
      }
    }
  }

  if (sa.adherencePct !== undefined && sb.adherencePct !== undefined) {
    if (sa.adherencePct - sb.adherencePct >= THRESHOLDS.adherenceDropPts) {
      const drop = adherenceDropDay(days, ctx)
      flags.push({
        key: 'adherence',
        severity: 'high',
        text: `${medWord} doses logged fell from ${sa.adherencePct}% to ${sb.adherencePct}%${drop ? ` (below ${THRESHOLDS.adherenceLowPct}% from ${fmtDay(drop)})` : ''}`,
      })
    }
  }
  if (
    all.adherencePct !== undefined &&
    all.adherencePct >= THRESHOLDS.adherenceGoodPct &&
    gina?.level === 'not'
  ) {
    flags.push({
      key: 'not-working',
      severity: 'high',
      text: `Controller doses logged ${all.adherencePct}% but still not well controlled: consider whether treatment is working`,
    })
  }
  if (all.fev1ChangePct !== undefined && all.fev1ChangePct <= -THRESHOLDS.fev1DropPct) {
    flags.push({
      key: 'fev1',
      severity: 'high',
      text: `FEV1 down ${Math.abs(all.fev1ChangePct)}% (${all.fev1Start!.toFixed(2)} L to ${all.fev1End!.toFixed(2)} L)`,
    })
  }
  if (all.fev1LatestPctPredicted !== undefined && all.fev1LatestPctPredicted < THRESHOLDS.fev1LowPctPredicted) {
    flags.push({
      key: 'fev1-low',
      severity: 'medium',
      text: `Latest FEV1 ${all.fev1Latest!.toFixed(2)} L is ${all.fev1LatestPctPredicted}% of predicted, below ${THRESHOLDS.fev1LowPctPredicted}%`,
    })
  }
  const ra = perWeek(sa.rescueDays, sa.daysInRange)
  const rb = perWeek(sb.rescueDays, sb.daysInRange)
  if (rb - ra >= THRESHOLDS.rescueRiseDaysPerWk) {
    flags.push({
      key: 'rescue',
      severity: 'medium',
      text: `Rescue ${plan ? 'inhaler' : 'medication'} use up from ${ra} to ${rb} days per week`,
    })
  }
  if (all.zones.red > 0) {
    flags.push({ key: 'red', severity: 'high', text: `${all.zones.red} red-zone day${all.zones.red > 1 ? 's' : ''}` })
  }
  if (all.zones.yellow >= THRESHOLDS.yellowDaysFlag) {
    flags.push({ key: 'yellow', severity: 'medium', text: `${all.zones.yellow} yellow-zone days` })
  }
  if (all.nightDays > 0) {
    flags.push({ key: 'night', severity: 'medium', text: `Woke at night from asthma on ${all.nightDays} day${all.nightDays > 1 ? 's' : ''}` })
  }
  if (all.schoolDays > 0) {
    flags.push({ key: 'school', severity: 'medium', text: `Missed ${all.schoolDays} school day${all.schoolDays > 1 ? 's' : ''}` })
  }
  const today = addDays(ctx.asOf, 1)
  if (plan?.retestTime && plan.retestTime.slice(0, 10) < today) {
    flags.push({ key: 'retest', severity: 'medium', text: `Action plan retest overdue since ${fmtDay(plan.retestTime.slice(0, 10))}` })
  } else if (plan?.retestTime && daysBetween(today, plan.retestTime.slice(0, 10)) <= THRESHOLDS.planExpiringDays) {
    flags.push({ key: 'retest-soon', severity: 'info', text: `Action plan retest due ${fmtDay(plan.retestTime.slice(0, 10))}` })
  }
  if (plan?.expirationDate && daysBetween(today, plan.expirationDate.slice(0, 10)) <= THRESHOLDS.planExpiringDays) {
    flags.push({ key: 'expiring', severity: 'medium', text: `Action plan expires ${fmtDay(plan.expirationDate.slice(0, 10))}` })
  }
  const la = lastActivity(ctx.doc)
  if (la.tracker && daysBetween(la.tracker, la.overall) >= THRESHOLDS.trackerSilentDays) {
    flags.push({
      key: 'silent',
      severity: 'medium',
      text: `No symptom check-in since ${fmtDay(la.tracker)}, but ${ctx.doc.medicalDevices.length ? 'doses and spirometry continue' : 'doses continue'} to ${fmtDay(la.overall)}`,
    })
  }
  if (all.conflictDays > 0) {
    flags.push({
      key: 'conflict',
      severity: 'info',
      text: `${all.conflictDays} day${all.conflictDays > 1 ? 's' : ''} felt "Great" but reported wheezing or shortness of breath`,
    })
  }
  const order: Record<FlagSeverity, number> = { high: 0, medium: 1, info: 2 }
  return flags.sort((x, y) => order[x.severity] - order[y.severity])
}

// ---------------------------------------------------------------- Raw portal grid (the "before")

export interface RawRow {
  id: string
  submittedAt: string
  values: Record<string, string>
}

/** One row per submission, newest first, raw strings: what the portal shows today. */
export function rawRows(doc: PatientDocument): RawRow[] {
  const rows: RawRow[] = []
  for (const log of doc.dailyLogs)
    for (const t of log.trackerResponses) {
      const values: Record<string, string> = {}
      for (const r of t.responses) {
        const q = getQuestion(t.trackerId, r.questionId)
        if (q) values[q.id] = r.value
      }
      rows.push({ id: t.id, submittedAt: t.submittedAt, values })
    }
  return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

/** The portal's two header numbers, computed the portal's (tracker-only) way. */
export function portalHeader(doc: PatientDocument) {
  const days = new Set<string>()
  let last = ''
  for (const log of doc.dailyLogs)
    for (const t of log.trackerResponses) {
      days.add(localDay(t.submittedAt))
      if (t.submittedAt > last) last = t.submittedAt
    }
  return { totalDaysTracked: days.size, lastDayLogged: localDay(last) }
}

// ---------------------------------------------------------------- CSV export

export function daysToCsv(days: DaySummary[]): string {
  const header = [
    'date',
    'zone',
    'feeling',
    'symptoms',
    'night_waking',
    'rescue_used',
    'rescue_doses_logged',
    'controller_doses_logged',
    'fev1_L',
    'fev1_pct_predicted',
    'pef_L_min',
    'missed_school',
    'entries',
    'status',
  ]
  const yn = (v: boolean | undefined) => (v === undefined ? '' : v ? 'yes' : 'no')
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = days.map((d) =>
    [
      d.day,
      d.zone ?? '',
      d.feeling ?? '',
      d.symptoms.join('; '),
      yn(d.nightWaking),
      d.status === 'none' && !d.rescueDoses ? '' : yn(d.rescueAny),
      d.rescueDoses,
      d.controllerDoses,
      d.spirometry?.fev1,
      d.spirometry?.pctPredicted,
      d.spirometry?.pef,
      yn(d.missedSchool),
      d.entryCount,
      d.status,
    ]
      .map(esc)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
