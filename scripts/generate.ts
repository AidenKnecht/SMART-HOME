// Seeded, reproducible synthetic data generator for the SMART@Home clinician view.
// Writes src/data/patients/patient-{a,b,c}.json, one nested document per fictional patient,
// matching the real Cosmos DB shape (brief §3) and planting every known data quirk.
// Run: npm run gen:data

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ASTHMA_TRACKER_ID, MIGRAINE_TRACKER_ID, asthmaTracker, migraineTracker, questionByKey } from '../src/data/trackerDefinition.ts'
import type {
  AsthmaTreatmentPlan,
  BaselineReading,
  DailyLog,
  EarnedBadge,
  MedicalDevice,
  Medication,
  MedicationAdministration,
  PatientDocument,
  QualityReport,
  Reminder,
  TrackerAnswer,
  TrackerResponse,
  Zone,
} from '../src/data/types.ts'

const END_DATE = '2026-11-05' // day before the visit (visit = 2026-11-06)
const N_DAYS = 90
const OUT_DIR = join(import.meta.dirname, '..', 'src', 'data', 'patients')

// ---------------------------------------------------------------- RNG + helpers

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Rng {
  next: () => number
  constructor(seed: number) {
    this.next = mulberry32(seed)
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
  normal(): number {
    const u = Math.max(this.next(), 1e-12)
    const v = this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  hex(n: number): string {
    let s = ''
    for (let i = 0; i < n; i++) s += Math.floor(this.next() * 16).toString(16)
    return s
  }
  uuid(): string {
    const variant = '89ab'[Math.floor(this.next() * 4)]
    return `${this.hex(8)}-${this.hex(4)}-4${this.hex(3)}-${variant}${this.hex(3)}-${this.hex(12)}`
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
/** Raw device-style precision: 6 decimal places (trailing zeros drop, giving 5–6). */
const raw6 = (x: number) => Math.round(x * 1e6) / 1e6

const END_MS = Date.parse(`${END_DATE}T00:00:00Z`)
const DAY_MS = 86_400_000
const dayStr = (i: number) => new Date(END_MS - (N_DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10)
const dow = (i: number) => new Date(END_MS - (N_DAYS - 1 - i) * DAY_MS).getUTCDay()
const isWeekend = (i: number) => dow(i) === 0 || dow(i) === 6

/** Cincinnati local time (minutes after midnight) -> ISO UTC. DST ends 2026-11-01. */
function localIso(i: number, minutesOfDay: number): string {
  const offsetH = dayStr(i) >= '2026-11-01' ? 5 : 4
  const [y, m, d] = dayStr(i).split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d, offsetH, 0, 0) + Math.round(minutesOfDay * 60_000)
  return new Date(ms).toISOString()
}

// ---------------------------------------------------------------- Patient configs

interface PatientConfig {
  file: string
  seed: number
  patientId: string
  firstName: string
  lastName: string
  dob: string
  age: number
  sex: 'F' | 'M'
  enrolledDate: string
  /** Probability a scheduled controller dose is logged. slot 0 = AM, 1 = PM */
  doseProb: (day: number, slot: 0 | 1) => number
  priorAdherence: number
  severity: number // baseline symptom risk regardless of adherence
  adherenceK: number // extra risk per unit of (lagged) non-adherence
  spike: (day: number) => number // acute flare bumps (risk units)
  baseFev1: number // L, best-effort FEV1 when controlled
  fevAdherenceK: number // fractional FEV1 loss per unit non-adherence
  fevRiskK: number // fractional FEV1 loss per unit risk above baseline
  baseRatio: number // FEV1/FVC
  pefPerL: number // L/min of PEF per L of FEV1
  predictedFev1: number
  logProb: (day: number) => number
  forceLogDays: number[]
  trackerGapDays: number // days at the end with doses/spirometry but no tracker entry
  missedSchoolDays: number
  archivedControllerUntilDay?: number
  burstDay?: number
  twoMessageBlowAfterDay?: number
  yellowRiskThreshold: number
  plan: Pick<AsthmaTreatmentPlan, 'status' | 'createdDate' | 'expirationDate' | 'retestTime'>
}

const patientConfigs: PatientConfig[] = [
  {
    // A: well controlled
    file: 'patient-a.json',
    seed: 1001,
    patientId: 'SH-1042',
    firstName: 'Maya',
    lastName: 'Robinson',
    dob: '2012-03-14',
    age: 14,
    sex: 'F',
    enrolledDate: '2026-06-02',
    doseProb: (_d, slot) => (slot === 0 ? 0.94 : 0.9),
    priorAdherence: 0.92,
    severity: 0.06,
    adherenceK: 0.4,
    spike: (d) => ({ 30: 0.2, 31: 0.3, 32: 0.15 })[d] ?? 0, // a cold
    baseFev1: 3.22,
    fevAdherenceK: 0.1,
    fevRiskK: 0,
    baseRatio: 0.87,
    pefPerL: 141,
    predictedFev1: 3.3,
    logProb: () => 0.88,
    forceLogDays: [],
    trackerGapDays: 1,
    missedSchoolDays: 0,
    yellowRiskThreshold: 0.35,
    plan: { status: 'Active', createdDate: '2026-06-02', expirationDate: '2027-06-02', retestTime: '2026-12-02' },
  },
  {
    // B: DEMO — adherence drops ~day 45 -> symptoms/rescue rise -> FEV1 dips ~15-20% -> yellow/red
    file: 'patient-b.json',
    seed: 2002,
    patientId: 'SH-1057',
    firstName: 'Jordan',
    lastName: 'Whitfield',
    dob: '2011-06-22',
    age: 15,
    sex: 'M',
    enrolledDate: '2026-07-15',
    doseProb: (d, slot) => {
      if (d < 45) return slot === 0 ? 0.93 : 0.88
      const weekend = isWeekend(d) ? 0.6 : 1
      return (slot === 0 ? 0.55 : 0.2) * weekend // evenings and weekends drop first
    },
    priorAdherence: 0.9,
    severity: 0.06,
    adherenceK: 1.0,
    spike: (d) => ({ 70: 0.38, 78: 0.38, 69: 0.05, 71: 0.08, 77: 0.05, 79: 0.08 })[d] ?? 0,
    baseFev1: 3.35,
    fevAdherenceK: 0.3,
    fevRiskK: 0,
    baseRatio: 0.85,
    pefPerL: 145,
    predictedFev1: 3.6,
    logProb: (d) => (d < 50 ? 0.86 : 0.72),
    forceLogDays: [69, 70, 71, 72, 77, 78, 79],
    trackerGapDays: 3,
    missedSchoolDays: 3,
    archivedControllerUntilDay: 14,
    burstDay: 72,
    twoMessageBlowAfterDay: 60,
    yellowRiskThreshold: 0.4,
    plan: { status: 'Active', createdDate: '2026-07-15', expirationDate: '2027-07-15', retestTime: '2026-10-15' },
  },
  {
    // C: takes controller consistently but still symptomatic -> "treatment not working"
    file: 'patient-c.json',
    seed: 3003,
    patientId: 'SH-1063',
    firstName: 'Sam',
    lastName: 'Delgado',
    dob: '2013-01-09',
    age: 13,
    sex: 'F',
    enrolledDate: '2026-07-28',
    doseProb: (_d, slot) => (slot === 0 ? 0.97 : 0.94),
    priorAdherence: 0.95,
    severity: 0.52,
    adherenceK: 0.3,
    spike: () => 0,
    baseFev1: 2.48,
    fevAdherenceK: 0.05,
    fevRiskK: 0.15,
    baseRatio: 0.72,
    pefPerL: 136,
    predictedFev1: 3.2,
    logProb: () => 0.9,
    forceLogDays: [],
    trackerGapDays: 1,
    missedSchoolDays: 3,
    yellowRiskThreshold: 0.45,
    plan: { status: 'Active', createdDate: '2025-11-20', expirationDate: '2026-11-20', retestTime: '2026-11-20' },
  },
]

// ---------------------------------------------------------------- Tracker question handles

const Q = {
  spirometry: questionByKey(asthmaTracker, 'spirometry'),
  feeling: questionByKey(asthmaTracker, 'feeling'),
  symptoms: questionByKey(asthmaTracker, 'symptoms'),
  nightWaking: questionByKey(asthmaTracker, 'nightWaking'),
  rescueUsed: questionByKey(asthmaTracker, 'rescueUsed'),
  rescuePuffs: questionByKey(asthmaTracker, 'rescuePuffs'),
  missedSchool: questionByKey(asthmaTracker, 'missedSchool'),
  activityLimit: questionByKey(asthmaTracker, 'activityLimit'),
  triggers: questionByKey(asthmaTracker, 'triggers'),
  breathingScore: questionByKey(asthmaTracker, 'breathingScore'),
}
const FEELINGS = ['Great', 'Good', 'Okay', 'Bad', 'Awful'] as const
const NONE = Q.symptoms.noneValue!
const REJECT_CODES = [
  'KeepGoingUntilCompletelyEmpty',
  'BlastOutImmediatelyWhenCompletelyFull',
  'DontHesitate',
  'AvoidCoughing',
  'BlowOutFaster',
] as const

// ---------------------------------------------------------------- Day state

interface DayState {
  risk: number
  symptomatic: boolean
  symptoms: string[]
  nightWaking: boolean
  rescueUsed: boolean
  rescuePuffs: number
  missedSchool: boolean
  feeling: (typeof FEELINGS)[number]
  fev1: number // best-effort FEV1 that day
  ratio: number
  session: { id: string; minutes: number } | null
  zone: Zone
}

function generatePatient(cfg: PatientConfig): PatientDocument {
  const rng = new Rng(cfg.seed)

  // --- Medications (random UUID links, duplicate name for archived controller)
  const controller: Medication = {
    id: rng.uuid(),
    name: 'Advair HFA',
    genericName: 'fluticasone propionate/salmeterol',
    dosage: { amount: 2, unit: 'puffs', strength: '115/21 mcg' },
    howOften: 'Daily',
    timesPerDay: 2,
    icon: 'Inhaler',
    relatedCondition: 'Asthma',
    isController: true,
    archived: false,
    index: 1,
    startDate: cfg.archivedControllerUntilDay !== undefined ? dayStr(cfg.archivedControllerUntilDay) : cfg.enrolledDate,
  }
  const rescue: Medication = {
    id: rng.uuid(),
    name: 'Albuterol HFA',
    genericName: 'albuterol sulfate',
    dosage: { amount: 2, unit: 'puffs', strength: '90 mcg' },
    howOften: 'As Needed',
    timesPerDay: null,
    icon: 'Inhaler',
    relatedCondition: 'Asthma',
    isController: false,
    archived: false,
    index: 2,
    startDate: cfg.enrolledDate,
  }
  const medications: Medication[] = []
  let archivedController: Medication | undefined
  if (cfg.archivedControllerUntilDay !== undefined) {
    archivedController = {
      ...controller,
      id: rng.uuid(),
      dosage: { amount: 2, unit: 'puffs', strength: '45/21 mcg' },
      archived: true,
      index: 0,
      startDate: cfg.enrolledDate,
    }
    medications.push(archivedController)
  }
  medications.push(controller, rescue)

  const reminders: Reminder[] = [
    { id: rng.uuid(), medicationId: controller.id, time: '07:30', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], enabled: true },
    { id: rng.uuid(), medicationId: controller.id, time: '20:30', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], enabled: true },
  ]
  if (archivedController) {
    reminders.unshift({
      id: rng.uuid(),
      medicationId: archivedController.id,
      time: '07:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      enabled: false,
    })
  }

  // --- Controller doses first (they drive the clinical state through a lag)
  const doses: MedicationAdministration[][] = Array.from({ length: N_DAYS }, () => [])
  const doseFrac: number[] = []
  for (let d = 0; d < N_DAYS; d++) {
    let taken = 0
    for (const slot of [0, 1] as const) {
      if (!rng.chance(cfg.doseProb(d, slot))) continue
      taken++
      const base = slot === 0 ? 7 * 60 + 30 : 20 * 60 + 45
      const minutes = base + rng.normal() * 35 + (isWeekend(d) ? 75 : 0)
      const med = archivedController && d < cfg.archivedControllerUntilDay! ? archivedController : controller
      doses[d].push({ id: rng.uuid(), medicationId: med.id, administeredAt: localIso(d, minutes), value: '1' })
    }
    doseFrac.push(taken / 2)
  }
  const effAdherence = (d: number) => {
    let s = 0
    for (let j = d - 12; j <= d - 5; j++) s += j < 0 ? cfg.priorAdherence : doseFrac[j]
    return s / 8
  }

  // --- Daily clinical state
  const personalBestPef = raw6(cfg.baseFev1 * cfg.pefPerL * 0.98)
  const states: DayState[] = []
  for (let d = 0; d < N_DAYS; d++) {
    const eff = effAdherence(d)
    const spike = cfg.spike(d)
    const risk = clamp(cfg.severity + cfg.adherenceK * (1 - eff) + spike + rng.normal() * 0.06, 0, 1)
    const symptomatic = spike > 0.25 || rng.chance(risk * 0.9 + 0.03)
    const symptoms: string[] = []
    if (symptomatic) {
      const pool = ['Coughing', 'Wheezing', 'Tight Chest', 'Shortness Of Breath']
      const n = clamp(1 + (risk > 0.5 ? 1 : 0) + (rng.chance(0.3) ? 1 : 0), 1, 4)
      while (symptoms.length < n) {
        const s = rng.pick(pool)
        if (!symptoms.includes(s)) symptoms.push(s)
      }
      if (risk > 0.6 && rng.chance(0.5)) symptoms.push('Activity limitations')
    }
    const nightWaking = symptomatic && rng.chance(risk > 0.3 ? risk * 0.55 : risk * 0.1)
    const rescueUsed = symptomatic ? rng.chance(0.45 + 0.5 * risk) : rng.chance(0.02)
    const rescuePuffs = rescueUsed ? clamp(Math.round(2 + risk * 4 + rng.normal()), 1, 10) : 0
    let sev = clamp(Math.round(risk * 4 + rng.normal() * 0.6), 0, 4)
    if (!symptomatic) sev = Math.min(sev, 1)
    let feeling: (typeof FEELINGS)[number] = FEELINGS[sev]
    if (symptomatic && rng.chance(0.08)) feeling = 'Great' // "Great" while wheezing: conflict quirk

    const fevFactor =
      1 - cfg.fevAdherenceK * (1 - eff) - cfg.fevRiskK * Math.max(0, risk - cfg.severity) - 0.25 * spike
    const fev1 = cfg.baseFev1 * fevFactor * (1 + rng.normal() * 0.025)
    const ratio = clamp(cfg.baseRatio - 0.06 * (1 - fevFactor) + rng.normal() * 0.01, 0.55, 0.95)

    const forceSession = d >= N_DAYS - 2
    const session =
      forceSession || rng.chance(0.5 + 0.2 * risk)
        ? { id: rng.uuid(), minutes: rng.range(17 * 60 + 30, 21 * 60 + 30) }
        : null

    const pctPB = session ? (fev1 * cfg.pefPerL) / personalBestPef : 1
    let zone: Zone = 'green'
    if (risk >= 0.95 || pctPB < 0.5) zone = 'red'
    else if (pctPB < 0.8 || (symptomatic && risk >= cfg.yellowRiskThreshold && (nightWaking || rescueUsed)))
      zone = 'yellow'

    states.push({
      risk,
      symptomatic,
      symptoms,
      nightWaking,
      rescueUsed,
      rescuePuffs,
      missedSchool: false,
      feeling,
      fev1,
      ratio,
      session,
      zone,
    })
  }

  // --- Which days have tracker entries
  const lastTrackerDay = N_DAYS - 1 - cfg.trackerGapDays
  const logged: boolean[] = states.map(
    (_s, d) => d <= lastTrackerDay && (cfg.forceLogDays.includes(d) || d === lastTrackerDay || rng.chance(cfg.logProb(d))),
  )

  // --- Missed school: the highest-risk logged weekdays
  const schoolCandidates = states
    .map((s, d) => ({ d, risk: s.risk }))
    .filter(({ d }) => logged[d] && !isWeekend(d) && states[d].symptomatic)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, cfg.missedSchoolDays)
  for (const { d } of schoolCandidates) states[d].missedSchool = true

  // --- Spirometry blows (baselineReadings)
  const readings: BaselineReading[] = []
  let twoMessagePlanted = false
  for (let d = 0; d < N_DAYS; d++) {
    const s = states[d]
    if (!s.session) continue
    const nBlows = 3 + (rng.chance(0.25) ? 1 : 0)
    for (let b = 0; b < nBlows; b++) {
      const accepted = rng.chance(0.76)
      const minutes = s.session.minutes + b * rng.range(0.6, 1.6)
      let fev1: number
      let ratio = s.ratio + rng.normal() * 0.012
      let fet: number
      const codes: string[] = []
      let grade: QualityReport['grade']
      if (accepted) {
        fev1 = s.fev1 * (1 - Math.abs(rng.normal()) * 0.025)
        fet = rng.range(5.5, 8.5)
        grade = rng.pick(['A', 'A', 'A', 'B', 'B', 'C'] as const)
        if (rng.chance(0.25)) codes.push(rng.pick(REJECT_CODES))
      } else {
        fev1 = s.fev1 * rng.range(0.8, 0.94)
        ratio += 0.05 // stopped early: FVC under-recorded
        fet = rng.range(1.4, 3.6)
        grade = rng.pick(['D', 'E', 'F'] as const)
        codes.push(rng.pick(REJECT_CODES))
        if (!twoMessagePlanted && cfg.twoMessageBlowAfterDay !== undefined && d >= cfg.twoMessageBlowAfterDay) {
          codes.length = 0
          codes.push('BlastOutImmediatelyWhenCompletelyFull', 'KeepGoingUntilCompletelyEmpty')
          twoMessagePlanted = true
        }
      }
      const fvc = fev1 / clamp(ratio, 0.5, 0.98)
      let pef = fev1 * cfg.pefPerL * (1 + rng.normal() * 0.04)
      if (codes.includes('BlastOutImmediatelyWhenCompletelyFull')) pef *= 0.85
      readings.push({
        id: rng.uuid(),
        sessionId: s.session.id,
        readingDate: localIso(d, minutes),
        accepted,
        fev1: raw6(fev1),
        fvc: raw6(fvc),
        fev1FvcRatio: raw6(fev1 / fvc),
        pef: raw6(pef),
        fef2575: raw6(fev1 * ratio * 1.05 * (1 + rng.normal() * 0.06)),
        fet: raw6(fet),
        qualityReport: {
          grade,
          // Device status disagrees with `accepted` on some blows (real-data quirk)
          status: accepted && !rng.chance(0.15) ? 'Acceptable' : 'NotAcceptable',
          qualityIndications: codes.map((code) => ({ code })),
        },
      })
    }
  }

  // --- Rescue doses (logged on rescue days, including days without a tracker entry)
  for (let d = 0; d < N_DAYS; d++) {
    const s = states[d]
    if (!s.rescueUsed) continue
    const times = s.rescuePuffs >= 5 ? 2 : 1
    for (let t = 0; t < times; t++) {
      if (!rng.chance(0.85)) continue // not every rescue use gets marked in the app
      doses[d].push({
        id: rng.uuid(),
        medicationId: rescue.id,
        administeredAt: localIso(d, rng.range(10 * 60, 22 * 60)),
        value: '1',
      })
    }
    doses[d].sort((a, b) => a.administeredAt.localeCompare(b.administeredAt))
  }

  // --- Tracker submissions
  const blankResponses = (): TrackerAnswer[] =>
    rng.chance(0.5) ? [] : asthmaTracker.questions.map((q) => ({ questionId: q.id, value: '' }))

  const fullResponses = (s: DayState, feeling: string): TrackerAnswer[] => {
    const r: TrackerAnswer[] = []
    const add = (questionId: string, value: string) => r.push({ questionId, value })
    // spirometry step: usually blank (real portal column is empty), sometimes a session ID
    if (s.session && rng.chance(0.3)) add(Q.spirometry.id, s.session.id)
    else if (rng.chance(0.5)) add(Q.spirometry.id, '')
    add(Q.feeling.id, feeling)
    add(Q.symptoms.id, JSON.stringify(s.symptoms.length ? s.symptoms : [NONE]))
    add(Q.nightWaking.id, s.nightWaking ? 'Yes' : 'No')
    add(Q.rescueUsed.id, s.rescueUsed ? 'Yes' : 'No')
    if (s.rescueUsed) add(Q.rescuePuffs.id, rng.chance(0.75) ? String(s.rescuePuffs) : '')
    else if (rng.chance(0.3)) add(Q.rescuePuffs.id, '0')
    else if (rng.chance(0.4)) add(Q.rescuePuffs.id, '')
    add(Q.missedSchool.id, s.missedSchool ? 'Yes' : 'No')
    if (rng.chance(0.5)) add(Q.activityLimit.id, s.risk > 0.65 ? 'A lot' : s.symptomatic && s.risk > 0.3 ? 'A little' : 'Not at all')
    else if (rng.chance(0.3)) add(Q.activityLimit.id, '')
    if (s.symptomatic && rng.chance(0.4)) {
      const opts = Q.triggers.options!.map((o) => o.value)
      const picked = [rng.pick(opts)]
      if (rng.chance(0.3)) {
        const second = rng.pick(opts)
        if (!picked.includes(second)) picked.push(second)
      }
      add(Q.triggers.id, JSON.stringify(picked))
    }
    if (rng.chance(0.45)) add(Q.breathingScore.id, String(clamp(Math.round(1 + s.risk * 9 + rng.normal()), 1, 10)))
    return r
  }

  const submissions: TrackerResponse[][] = Array.from({ length: N_DAYS }, () => [])
  for (let d = 0; d < N_DAYS; d++) {
    if (!logged[d]) continue
    const s = states[d]
    const sub = (minutes: number, responses: TrackerAnswer[], zone?: Zone): TrackerResponse => ({
      id: rng.uuid(),
      trackerId: ASTHMA_TRACKER_ID,
      submittedAt: localIso(d, minutes),
      ...(zone && responses.length && responses.some((r) => r.value !== '') ? { actionPlanZone: zone } : {}),
      responses,
    })

    if (d === cfg.burstDay) {
      // Six entries in ~1 hour, "Bad" then "Great" 4 minutes later (mirrors brief, Apr 28 2025)
      const t0 = 13 * 60 + 29
      const badZone: Zone = s.zone === 'green' ? 'yellow' : s.zone // app re-scores zone per entry
      submissions[d].push(
        sub(t0, fullResponses(s, 'Bad'), badZone),
        sub(t0 + 21, fullResponses(s, 'Bad'), badZone),
        sub(t0 + 22, blankResponses()),
        sub(t0 + 25, fullResponses(s, 'Great'), s.zone),
        sub(t0 + 26, fullResponses(s, 'Great'), s.zone),
        sub(t0 + 56, blankResponses()),
      )
      continue
    }

    const morning = rng.chance(0.25)
    const t = morning ? rng.range(6 * 60 + 45, 8 * 60 + 15) : rng.range(15 * 60, 22 * 60 + 40)
    if (rng.chance(0.04)) {
      // Only a blank submission that day (started and abandoned)
      submissions[d].push(sub(t, blankResponses()))
      continue
    }
    submissions[d].push(sub(t, fullResponses(s, s.feeling), s.zone))
    const extras = rng.chance(0.03) ? 2 : rng.chance(0.12) ? 1 : 0
    let tt = t
    for (let e = 0; e < extras; e++) {
      tt += rng.range(2, 95)
      if (rng.chance(0.5)) submissions[d].push(sub(tt, blankResponses()))
      else {
        const shifted = FEELINGS[clamp(FEELINGS.indexOf(s.feeling) + rng.pick([-1, 1]), 0, 4)]
        submissions[d].push(sub(tt, fullResponses(s, shifted), s.zone))
      }
    }
  }

  // --- Assemble daily logs (only days with any activity)
  const dailyLogs: DailyLog[] = []
  for (let d = 0; d < N_DAYS; d++) {
    if (!submissions[d].length && !doses[d].length) continue
    const anyController = doses[d].some((x) => x.medicationId !== rescue.id)
    dailyLogs.push({
      id: rng.uuid(),
      day: dayStr(d),
      // Unreliable flag, like the real export: true before an "app update" on day 40, false after
      allMedicationsAdministered: d < 40 ? anyController : false,
      trackerResponses: submissions[d],
      medicationAdministrations: doses[d],
    })
  }

  // --- Device (with junk fields)
  const serial = `Z${rng.int(100000, 999999)}`
  const firstSessionDay = states.findIndex((s) => s.session)
  const device: MedicalDevice = {
    id: rng.uuid(),
    protocol: '9',
    address: rng.uuid().toUpperCase(),
    bootId: 'SM',
    serialNumber: serial,
    deviceType: 0,
    atsStandard: 0,
    name: 'Spirobank Smart',
    advertisedName: `SM-009-${serial}`,
    baselineReadingDate: dayStr(firstSessionDay),
    baselineReadings: readings,
  }

  // --- Badges
  const earnedTrackerBadges: EarnedBadge[] = []
  const earnedMedicationBadges: EarnedBadge[] = []
  let totalLogged = 0
  let medStreak = 0
  const trackerMilestones = [5, 10, 25, 50, 75]
  const medMilestones = [3, 7, 14, 30, 60]
  for (let d = 0; d < N_DAYS; d++) {
    const realSub = submissions[d].find((x) => x.responses.some((r) => r.value !== ''))
    if (realSub) {
      totalLogged++
      if (trackerMilestones.includes(totalLogged))
        earnedTrackerBadges.push({ badgeName: `TrackerBadge${totalLogged}`, date: realSub.submittedAt })
    }
    medStreak = doseFrac[d] === 1 ? medStreak + 1 : 0
    if (medMilestones.includes(medStreak) && !earnedMedicationBadges.some((b) => b.badgeName === `MedicationBadge${medStreak}`)) {
      const last = doses[d].filter((x) => x.medicationId !== rescue.id).at(-1)!
      earnedMedicationBadges.push({ badgeName: `MedicationBadge${medStreak}`, date: last.administeredAt })
    }
  }

  return {
    id: rng.uuid(),
    patientId: cfg.patientId,
    firstName: cfg.firstName,
    lastName: cfg.lastName,
    dob: cfg.dob,
    age: cfg.age,
    sex: cfg.sex,
    enrolledDate: cfg.enrolledDate,
    assignedTrackerIds: [ASTHMA_TRACKER_ID],
    dailyLogs,
    medications,
    reminders,
    medicalDevices: [device],
    asthmaTreatmentPlan: {
      ...cfg.plan,
      personalBestPef,
      predictedFev1: cfg.predictedFev1,
      zoneThresholds: { greenMinPctPersonalBest: 80, yellowMinPctPersonalBest: 50 },
    },
    earnedMedicationBadges,
    earnedTrackerBadges,
  }
}

// ---------------------------------------------------------------- Patient D: migraine tracker
// Proves the clinician view is driven by the tracker definition. Story: frequent headaches,
// preventive (topiramate) dose increased on day 40 (old entry archived, same name), headache
// days and pain fall over the following weeks. No spirometer, no asthma action plan.

function generateMigraine(): PatientDocument {
  const rng = new Rng(4004)
  const M = {
    headache: questionByKey(migraineTracker, 'headacheToday'),
    pain: questionByKey(migraineTracker, 'painScore'),
    symptoms: questionByKey(migraineTracker, 'symptoms'),
    hours: questionByKey(migraineTracker, 'hoursLasted'),
    school: questionByKey(migraineTracker, 'missedSchool'),
  }
  const DOSE_CHANGE = 40
  const preventive: Medication = {
    id: rng.uuid(),
    name: 'Topiramate',
    genericName: 'topiramate',
    dosage: { amount: 1, unit: 'tablet', strength: '50 mg' },
    howOften: 'Daily',
    timesPerDay: 1,
    icon: 'Pill',
    relatedCondition: 'Migraine',
    isController: true,
    archived: false,
    index: 1,
    startDate: dayStr(DOSE_CHANGE),
  }
  const oldPreventive: Medication = {
    ...preventive,
    id: rng.uuid(),
    dosage: { amount: 1, unit: 'tablet', strength: '25 mg' },
    archived: true,
    index: 0,
    startDate: '2026-06-20',
  }
  const rescue: Medication = {
    id: rng.uuid(),
    name: 'Sumatriptan',
    genericName: 'sumatriptan succinate',
    dosage: { amount: 1, unit: 'tablet', strength: '25 mg' },
    howOften: 'As Needed',
    timesPerDay: null,
    icon: 'Pill',
    relatedCondition: 'Migraine',
    isController: false,
    archived: false,
    index: 2,
    startDate: '2026-06-20',
  }
  const reminders: Reminder[] = [
    { id: rng.uuid(), medicationId: oldPreventive.id, time: '21:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], enabled: false },
    { id: rng.uuid(), medicationId: preventive.id, time: '21:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], enabled: true },
  ]

  const dailyLogs: DailyLog[] = []
  const earnedTrackerBadges: EarnedBadge[] = []
  let loggedCount = 0
  let yesterday = false
  const SYMPTOMS = ['Nausea', 'Light Sensitivity', 'Sound Sensitivity', 'Aura'] as const
  for (let d = 0; d < N_DAYS; d++) {
    // Benefit of the higher dose builds over ~2 weeks after the change
    const effect = d < DOSE_CHANGE ? 0 : Math.min(1, (d - DOSE_CHANGE) / 14)
    const risk = clamp(0.47 - 0.27 * effect + (yesterday ? 0.12 : 0) + rng.normal() * 0.04, 0.05, 0.9)
    const headache = rng.chance(risk)
    yesterday = headache
    const pain = headache ? clamp(Math.round(6.6 - 2.2 * effect + rng.normal() * 1.4), 2, 10) : 0
    const hours = headache ? clamp(Math.round(pain * 0.9 + rng.normal() * 1.6), 1, 24) : 0
    const symptoms = headache ? SYMPTOMS.filter(() => rng.chance(0.25 + pain * 0.04)) : []
    const missedSchool = headache && !isWeekend(d) && pain >= 8 && rng.chance(0.75)

    const doses: MedicationAdministration[] = []
    if (rng.chance(0.9)) {
      const med = d < DOSE_CHANGE ? oldPreventive : preventive
      doses.push({ id: rng.uuid(), medicationId: med.id, administeredAt: localIso(d, 21 * 60 + rng.normal() * 30), value: '1' })
    }
    if (headache && pain >= 6 && rng.chance(0.75)) {
      doses.push({ id: rng.uuid(), medicationId: rescue.id, administeredAt: localIso(d, rng.range(9 * 60, 19 * 60)), value: '1' })
    }
    doses.sort((a, b) => a.administeredAt.localeCompare(b.administeredAt))

    const submissions: TrackerResponse[] = []
    const logged = d === N_DAYS - 2 || rng.chance(headache ? 0.92 : 0.8)
    if (logged && d < N_DAYS - 1) {
      const answers = (p: number): TrackerAnswer[] => {
        const r: TrackerAnswer[] = [{ questionId: M.headache.id, value: headache ? 'Yes' : 'No' }]
        if (headache) {
          r.push({ questionId: M.pain.id, value: String(p) })
          r.push({ questionId: M.symptoms.id, value: JSON.stringify(symptoms.length ? symptoms : [M.symptoms.noneValue]) })
          r.push({ questionId: M.hours.id, value: rng.chance(0.8) ? String(hours) : '' })
        } else if (rng.chance(0.4)) {
          r.push({ questionId: M.pain.id, value: '' })
        }
        r.push({ questionId: M.school.id, value: missedSchool ? 'Yes' : 'No' })
        return r
      }
      const t = rng.range(16 * 60, 22 * 60)
      const sub = (minutes: number, responses: TrackerAnswer[]): TrackerResponse => ({
        id: rng.uuid(),
        trackerId: MIGRAINE_TRACKER_ID,
        submittedAt: localIso(d, minutes),
        responses,
      })
      if (rng.chance(0.04)) submissions.push(sub(t, []))
      else {
        submissions.push(sub(t, answers(pain)))
        // Second check-in later the same day, pain re-rated
        if (headache && rng.chance(0.12)) submissions.push(sub(t + rng.range(20, 120), answers(clamp(pain + rng.pick([-2, 1]), 1, 10))))
        else if (rng.chance(0.05)) submissions.push(sub(t + rng.range(2, 10), migraineTracker.questions.map((q) => ({ questionId: q.id, value: '' }))))
        loggedCount++
        if ([5, 10, 25, 50].includes(loggedCount))
          earnedTrackerBadges.push({ badgeName: `TrackerBadge${loggedCount}`, date: localIso(d, t) })
      }
    }
    if (!submissions.length && !doses.length) continue
    dailyLogs.push({
      id: rng.uuid(),
      day: dayStr(d),
      allMedicationsAdministered: false,
      trackerResponses: submissions,
      medicationAdministrations: doses,
    })
  }

  return {
    id: rng.uuid(),
    patientId: 'SH-1071',
    firstName: 'Priya',
    lastName: 'Nair',
    dob: '2010-04-02',
    age: 16,
    sex: 'F',
    enrolledDate: '2026-06-20',
    assignedTrackerIds: [MIGRAINE_TRACKER_ID],
    dailyLogs,
    medications: [oldPreventive, preventive, rescue],
    reminders,
    medicalDevices: [],
    earnedMedicationBadges: [],
    earnedTrackerBadges,
  }
}

// ---------------------------------------------------------------- Main

mkdirSync(OUT_DIR, { recursive: true })
for (const cfg of patientConfigs) {
  const doc = generatePatient(cfg)
  writeFileSync(join(OUT_DIR, cfg.file), JSON.stringify(doc, null, 2) + '\n')
  console.log(`wrote src/data/patients/${cfg.file}  (${doc.firstName} ${doc.lastName}, ${doc.dailyLogs.length} daily logs)`)
}
{
  const doc = generateMigraine()
  writeFileSync(join(OUT_DIR, 'patient-d.json'), JSON.stringify(doc, null, 2) + '\n')
  console.log(`wrote src/data/patients/patient-d.json  (${doc.firstName} ${doc.lastName}, ${doc.dailyLogs.length} daily logs)`)
}
