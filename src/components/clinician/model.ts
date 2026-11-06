import { lastVisitByPatientId } from '@/data/visits'
import type { PatientDocument } from '@/data/types'
import {
  addDays,
  adherenceDropDay,
  buildDays,
  ginaControl,
  halves,
  lastActivity,
  patientContext,
  summarizeRange,
  whatChanged,
  type DayRule,
} from '@/lib/derive'

export type RangeKey = 'visit' | '14' | '30' | '90'
export type Lens = 'pulm' | 'pcp' | 'nurse' | 'gi' | 'neuro'

export function rangeBounds(doc: PatientDocument, range: RangeKey, asOf: string, firstDay: string) {
  let from: string
  if (range === 'visit') {
    const v = lastVisitByPatientId[doc.patientId]
    from = v ? addDays(v, 1) : addDays(asOf, -29)
  } else from = addDays(asOf, -(Number(range) - 1))
  if (firstDay && from < firstDay) from = firstDay
  return { from, to: asOf }
}

export function buildModel(doc: PatientDocument, range: RangeKey, dayRule: DayRule) {
  const ctx = patientContext(doc)
  const { from, to } = rangeBounds(doc, range, ctx.asOf, ctx.firstDay)
  const days = buildDays(ctx, from, to, dayRule)
  const [firstHalf, secondHalf] = halves(days)
  const stats = summarizeRange(days, ctx)
  const first = summarizeRange(firstHalf, ctx)
  const second = summarizeRange(secondHalf, ctx)
  const gina = ginaControl(ctx, to, dayRule)
  const flags = whatChanged(ctx, days, gina)
  return {
    doc,
    ctx,
    from,
    to,
    days,
    stats,
    first,
    second,
    gina,
    flags,
    last: lastActivity(doc),
    lastVisit: lastVisitByPatientId[doc.patientId],
    dropDay: adherenceDropDay(days, ctx),
  }
}

export type Model = ReturnType<typeof buildModel>
