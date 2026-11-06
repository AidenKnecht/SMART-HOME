// Reads the generated patient JSON back and parses values by question type through the
// tracker definition (the same way the UI will), then prints per-patient stats and a
// quirk checklist so the stories can be checked.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getQuestion, parseValue, trackerDefinitions } from '../src/data/trackerDefinition.ts'
import type { PatientDocument, TrackerResponse, Zone } from '../src/data/types.ts'

const DIR = join(import.meta.dirname, '..', 'src', 'data', 'patients')
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
const ZONE_RANK: Record<Zone, number> = { green: 0, yellow: 1, red: 2 }

/** Parse one submission into { key: parsedValue }, skipping empty answers. */
function parseSubmission(sub: TrackerResponse): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const r of sub.responses) {
    const q = getQuestion(sub.trackerId, r.questionId)
    if (!q) continue
    const v = parseValue(q, r.value)
    if (v !== null) out[q.key] = v
  }
  return out
}
const isBlank = (sub: TrackerResponse) => sub.responses.every((r) => r.value.trim() === '')
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a')
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
/** ISO UTC -> local (Cincinnati) calendar day. DST ends 2026-11-01 06:00Z. */
const dateOnly = (iso: string) => {
  if (!iso) return ''
  const offsetH = iso >= '2026-11-01T06:00:00Z' ? 5 : 4
  return new Date(Date.parse(iso) - offsetH * 3_600_000).toISOString().slice(0, 10)
}

const checks = {
  burst: false,
  badToGreat: false,
  blank: false,
  allStrings: true,
  jsonLists: false,
  duplicateMed: false,
  rejectedBlows: false,
  twoMessageBlow: false,
  decimals: false,
  deviceJunk: false,
  lastDayGap: false,
}

for (const file of files) {
  const doc = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as PatientDocument
  const logs = [...doc.dailyLogs].sort((a, b) => a.day.localeCompare(b.day))
  const lastDay = '2026-11-05'
  const firstDay = new Date(Date.parse(`${lastDay}T00:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10)
  const midDay = new Date(Date.parse(`${firstDay}T00:00:00Z`) + 45 * 86_400_000).toISOString().slice(0, 10)
  const last30 = new Date(Date.parse(`${lastDay}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10)
  const buckets = (day: string) => [day < midDay ? 0 : 1, ...(day >= last30 ? [2] : [])]

  const controllerIds = new Set(doc.medications.filter((m) => m.isController).map((m) => m.id))
  const rescueIds = new Set(doc.medications.filter((m) => !m.isController).map((m) => m.id))

  let submissions = 0
  let blanks = 0
  let maxPerDay = { n: 0, day: '' }
  const s = [0, 1, 2].map(() => ({
    trackedDays: 0,
    symptomDays: 0,
    rescueDays: 0,
    nightDays: 0,
    school: 0,
    controllerDoses: 0,
    rescueDoses: 0,
    zones: { green: 0, yellow: 0, red: 0 } as Record<Zone, number>,
  }))
  let lastTracker = ''
  let lastDose = ''

  for (const log of logs) {
    const hs = buckets(log.day).map((i) => s[i])
    for (const m of log.medicationAdministrations) {
      for (const h of hs) {
        if (controllerIds.has(m.medicationId)) h.controllerDoses++
        if (rescueIds.has(m.medicationId)) h.rescueDoses++
      }
      if (m.administeredAt > lastDose) lastDose = m.administeredAt
    }
    const subs = log.trackerResponses
    submissions += subs.length
    if (subs.length > maxPerDay.n) maxPerDay = { n: subs.length, day: log.day }
    const real = subs.filter((x) => !isBlank(x))
    blanks += subs.length - real.length
    if (subs.length) lastTracker = subs.map((x) => x.submittedAt).sort().at(-1)! > lastTracker ? subs.map((x) => x.submittedAt).sort().at(-1)! : lastTracker
    for (const sub of subs) {
      for (const r of sub.responses) {
        if (typeof r.value !== 'string') checks.allStrings = false
        if (r.value.startsWith('[')) checks.jsonLists = true
      }
    }
    if (subs.length >= 6) {
      const times = subs.map((x) => Date.parse(x.submittedAt)).sort()
      if (times.at(-1)! - times[0] <= 60 * 60_000) checks.burst = true
      const feelings = [...subs]
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map((x) => parseSubmission(x).feeling)
        .filter(Boolean)
      const iBad = feelings.lastIndexOf('Bad')
      if (iBad >= 0 && feelings.slice(iBad + 1).includes('Great')) checks.badToGreat = true
    }
    if (!real.length) continue

    // Aggregate to one day: worst-of-day for every signal
    for (const h of hs) h.trackedDays++
    const parsed = real.map(parseSubmission)
    const symptomatic = parsed.some((p) => {
      const list = p.symptoms as string[] | undefined
      return !!list?.some((x) => x.trim() !== 'None of these')
    })
    if (symptomatic) for (const h of hs) h.symptomDays++
    if (parsed.some((p) => p.rescueUsed === true)) for (const h of hs) h.rescueDays++
    if (parsed.some((p) => p.nightWaking === true)) for (const h of hs) h.nightDays++
    if (parsed.some((p) => p.missedSchool === true)) for (const h of hs) h.school++
    const zones = real.map((x) => x.actionPlanZone).filter((z): z is Zone => !!z)
    if (zones.length) {
      const worst = zones.reduce((a, b) => (ZONE_RANK[b] > ZONE_RANK[a] ? b : a))
      for (const h of hs) h.zones[worst]++
    }
  }
  checks.blank ||= blanks > 0

  // Spirometry
  const device = doc.medicalDevices[0]
  const blows = device.baselineReadings
  const accepted = blows.filter((b) => b.accepted)
  const lastSpiro = blows.map((b) => b.readingDate).sort().at(-1) ?? ''
  const fevWindow = (from: string, to: string) =>
    mean(accepted.filter((b) => dateOnly(b.readingDate) >= from && dateOnly(b.readingDate) <= to).map((b) => b.fev1))
  const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  const fevFirst = fevWindow(firstDay, addDays(firstDay, 13))
  const fevLast = fevWindow(addDays(lastDay, -13), lastDay)
  const sessions = new Set(blows.map((b) => b.sessionId)).size

  checks.rejectedBlows ||= blows.some((b) => !b.accepted)
  checks.twoMessageBlow ||= blows.some((b) => b.qualityReport.qualityIndications.length >= 2)
  checks.decimals ||= blows.some((b) => (String(b.fev1).split('.')[1]?.length ?? 0) >= 5)
  checks.deviceJunk ||= !!device.bootId && !!device.address
  const names = doc.medications.map((m) => m.name)
  checks.duplicateMed ||= names.some((n, i) => names.indexOf(n) !== i) && doc.medications.some((m) => m.archived)
  const gap = dateOnly(lastDose) > dateOnly(lastTracker) && dateOnly(lastSpiro) > dateOnly(lastTracker)
  checks.lastDayGap ||= gap

  const scheduledPerHalf = [45, 45, 30].map((days) => days * 2)
  const wk = (n: number, days: number) => ((n / days) * 7).toFixed(1)
  const plan = doc.asthmaTreatmentPlan

  console.log(`\n=== ${doc.firstName} ${doc.lastName} (${doc.patientId}, ${doc.age}${doc.sex})  [${file}] ===`)
  console.log(`  Tracker: ${trackerDefinitions[doc.assignedTrackerIds[0]].name}`)
  console.log(`  Submissions: ${submissions} total, ${blanks} blank, max ${maxPerDay.n} on ${maxPerDay.day}`)
  console.log(`  Days with a real tracker entry: ${s[0].trackedDays + s[1].trackedDays} / 90`)
  console.log('                          days 1-45      days 46-90     last 30 days')
  const row = (label: string, f: (h: (typeof s)[0], i: number) => string) =>
    console.log(`  ${label.padEnd(24)}${f(s[0], 0).padEnd(15)}${f(s[1], 1).padEnd(15)}${f(s[2], 2)}`)
  row('Controller adherence', (h, i) => `${pct(h.controllerDoses, scheduledPerHalf[i])} logged`)
  row('Symptom days', (h, i) => `${h.symptomDays} (${wk(h.symptomDays, i === 2 ? 30 : 45)}/wk)`)
  row('Rescue-use days', (h, i) => `${h.rescueDays} (${wk(h.rescueDays, i === 2 ? 30 : 45)}/wk)`)
  row('Albuterol doses logged', (h) => `${h.rescueDoses}`)
  row('Night-waking days', (h) => `${h.nightDays}`)
  row('School days missed', (h) => `${h.school}`)
  row('Zones G/Y/R', (h) => `${h.zones.green}/${h.zones.yellow}/${h.zones.red}`)
  console.log(
    `  FEV1 (accepted blows): first 14 d ${fevFirst.toFixed(2)} L -> last 14 d ${fevLast.toFixed(2)} L ` +
      `(${(((fevLast - fevFirst) / fevFirst) * 100).toFixed(1)}%), predicted ${plan.predictedFev1} L ` +
      `(${Math.round((fevLast / plan.predictedFev1) * 100)}% predicted now)`,
  )
  console.log(`  Spirometry: ${sessions} sessions, ${blows.length} blows, ${blows.length - accepted.length} rejected`)
  console.log(`  Last tracker entry: ${dateOnly(lastTracker)} | last dose: ${dateOnly(lastDose)} | last spirometry: ${dateOnly(lastSpiro)}`)
  console.log(`  Plan: ${plan.status}, expires ${plan.expirationDate}, retest ${plan.retestTime}`)
  console.log(`  Meds: ${doc.medications.map((m) => `${m.name} ${m.dosage.strength}${m.archived ? ' [archived]' : ''}`).join(', ')}`)
  console.log(`  Badges: ${doc.earnedTrackerBadges.length} tracker, ${doc.earnedMedicationBadges.length} medication`)
}

const label: Record<keyof typeof checks, string> = {
  burst: '>=6 submissions within 1 hour on one day',
  badToGreat: '"Bad" then "Great" in that burst',
  blank: 'Blank submissions',
  allStrings: 'Every response value is a string',
  jsonLists: 'JSON-list strings for checkbox/icon answers',
  duplicateMed: 'Duplicate med name (archived + active)',
  rejectedBlows: 'Rejected spirometry blows',
  twoMessageBlow: 'Blow with two coaching messages',
  decimals: 'Device values with 5-6 decimals',
  deviceJunk: 'Device junk fields (bootId, BT address)',
  lastDayGap: 'Latest dose/spirometry after latest tracker entry',
}
console.log('\n=== Data quirks ===')
for (const [k, ok] of Object.entries(checks)) console.log(`  ${ok ? '✓' : '✗'} ${label[k as keyof typeof checks]}`)
