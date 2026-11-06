// Smoke test for src/lib/derive.ts: prints the numbers the UI will show so they can be
// compared with scripts/summarize.ts. Run: node scripts/check-derive.ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  addDays,
  buildDays,
  ginaControl,
  halves,
  lastActivity,
  patientContext,
  portalHeader,
  summarizeRange,
  whatChanged,
  adherenceDropDay,
} from '../src/lib/derive.ts'
import type { PatientDocument } from '../src/data/types.ts'

const DIR = join(import.meta.dirname, '..', 'src', 'data', 'patients')
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const doc = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as PatientDocument
  const ctx = patientContext(doc)
  const to = ctx.asOf
  const days = buildDays(ctx, addDays(to, -89), to, 'worst')
  const [a, b] = halves(days)
  const sa = summarizeRange(a, ctx)
  const sb = summarizeRange(b, ctx)
  const all = summarizeRange(days, ctx)
  const l30 = summarizeRange(days.slice(-30), ctx)
  const gina = doc.asthmaTreatmentPlan ? ginaControl(ctx, to, 'worst') : null
  console.log(`\n=== ${doc.firstName} ${doc.lastName} (${doc.patientId}) as of ${to} ===`)
  console.log(`  adherence halves ${sa.adherencePct}% -> ${sb.adherencePct}%, last 30 ${l30.adherencePct}%`)
  console.log(`  symptom days ${sa.symptomDays}/${sb.symptomDays}, rescue days (any signal) ${sa.rescueDays}/${sb.rescueDays}`)
  console.log(`  zones 2nd half G/Y/R ${sb.zones.green}/${sb.zones.yellow}/${sb.zones.red}; last 30 ${l30.zones.green}/${l30.zones.yellow}/${l30.zones.red}`)
  console.log(`  FEV1 ${all.fev1Start?.toFixed(2)} -> ${all.fev1End?.toFixed(2)} L (${all.fev1ChangePct}%), latest ${all.fev1Latest} L ${all.fev1LatestPctPredicted}% pred`)
  if (gina) console.log(`  GINA: ${gina.label} (${gina.metCount}/4, ${gina.basedOnDays}/28 days logged)`)
  for (const c of gina?.criteria ?? []) console.log(`    ${c.met ? 'x' : ' '} ${c.text}: ${c.evidence}`)
  console.log(`  last activity`, lastActivity(doc), 'portal says', portalHeader(doc))
  console.log(`  adherence drop day: ${adherenceDropDay(days, ctx)}`)
  for (const f of whatChanged(ctx, days, gina)) console.log(`  [${f.severity}] ${f.text}`)
  const burst = days.find((d) => d.entryCount >= 6)
  if (burst) {
    const latest = buildDays(ctx, burst.day, burst.day, 'latest')[0]
    console.log(`  burst ${burst.day}: ${burst.entryCount} entries, worst zone ${burst.zone} feeling ${burst.feeling}; latest zone ${latest.zone} feeling ${latest.feeling}; changed ${burst.changedAnswer}`)
  }
}
