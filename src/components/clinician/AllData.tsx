import { ChevronRight } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Question } from '@/data/types'
import { fmtDay, humanizeCode, localDay, localTime, isControllerMed } from '@/lib/derive'
import type { Model } from './model'

const fmtValue = (q: Question, v: unknown): string => {
  if (v === undefined) return ''
  if (Array.isArray(v)) return v.map((x) => q.options?.find((o) => o.value === x)?.label ?? x).join(', ')
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return q.options?.find((o) => o.value === v)?.label ?? String(v)
}

const th = 'bg-card sticky top-0 border-b px-2 py-1.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
const td = 'border-b px-2 py-1 align-top'

export function AllData({ model }: { model: Model }) {
  const { days, doc, tracker, from, to, ctx } = model
  const questions = tracker.questions.filter((q) => q.type !== 'spirometry')
  const entries = [...days].reverse().flatMap((d) => d.entries.map((e) => ({ day: d.day, e })))
  const blows = doc.medicalDevices
    .flatMap((dev) => dev.baselineReadings)
    .filter((b) => localDay(b.readingDate) >= from && localDay(b.readingDate) <= to)
    .sort((a, b) => b.readingDate.localeCompare(a.readingDate))
  const dosesByMed = new Map<string, number>()
  for (const l of doc.dailyLogs)
    if (l.day >= from && l.day <= to)
      for (const m of l.medicationAdministrations) dosesByMed.set(m.medicationId, (dosesByMed.get(m.medicationId) ?? 0) + 1)
  const badges = [...doc.earnedTrackerBadges, ...doc.earnedMedicationBadges].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <details className="bg-card group rounded-lg border">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 px-4 py-2.5">
        <ChevronRight className="size-4 self-center transition-transform group-open:rotate-90" aria-hidden />
        <h2 className="text-sm font-semibold">All data</h2>
        <span className="text-muted-foreground text-xs">
          Nothing hidden: every check-in, blow, medication and badge for {fmtDay(from)} to {fmtDay(to)}.
        </span>
      </summary>
      <Tabs defaultValue="answers" className="px-4 pb-4">
        <TabsList>
          <TabsTrigger value="answers">Check-in answers ({entries.length})</TabsTrigger>
          {doc.medicalDevices.length > 0 && <TabsTrigger value="blows">Spirometry blows ({blows.length})</TabsTrigger>}
          <TabsTrigger value="meds">Medications ({doc.medications.length})</TabsTrigger>
          <TabsTrigger value="badges">Badges ({badges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="answers">
          <div className="max-h-[480px] overflow-auto rounded-md border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={th}>Submitted</th>
                  {questions.map((q) => (
                    <th key={q.id} className={th} title={q.text}>
                      {q.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(({ day, e }) => (
                  <tr key={e.id}>
                    <td className={`${td} whitespace-nowrap`}>
                      {fmtDay(day)}, {e.time}
                    </td>
                    {e.blank ? (
                      <td colSpan={questions.length} className={`${td} text-muted-foreground italic`}>
                        Started, no answers
                      </td>
                    ) : (
                      questions.map((q) => (
                        <td key={q.id} className={td}>
                          {fmtValue(q, e.answers[q.key])}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {doc.medicalDevices.length > 0 && (
          <TabsContent value="blows">
            <p className="text-muted-foreground mb-2 text-xs">
              {doc.medicalDevices.map((d) => `${d.name}, serial ${d.serialNumber}`).join('; ')}. Device internals (Bluetooth
              address, boot ID, protocol) are left out on purpose.
            </p>
            <div className="max-h-[480px] overflow-auto rounded-md border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {['Time', 'Accepted', 'Quality grade', 'FEV1', 'FVC', 'FEV1/FVC', 'Peak flow', 'Coaching'].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blows.map((b) => (
                    <tr key={b.id} className={b.accepted ? '' : 'text-muted-foreground'}>
                      <td className={`${td} whitespace-nowrap`}>
                        {fmtDay(localDay(b.readingDate))}, {localTime(b.readingDate)}
                      </td>
                      <td className={td}>{b.accepted ? 'Yes' : 'No'}</td>
                      <td className={td}>{b.qualityReport.grade}</td>
                      <td className={td}>{b.fev1.toFixed(2)} L</td>
                      <td className={td}>{b.fvc.toFixed(2)} L</td>
                      <td className={td}>{Math.round(b.fev1FvcRatio * 100)}%</td>
                      <td className={td}>{Math.round(b.pef)} L/min</td>
                      <td className={td}>{b.qualityReport.qualityIndications.map((q) => humanizeCode(q.code)).join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}

        <TabsContent value="meds">
          <div className="overflow-auto rounded-md border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {['Medication', 'Strength', 'Schedule', 'Type', 'Status', 'Started', 'Doses logged in range'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.medications.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>
                      {m.name} <span className="text-muted-foreground">({m.genericName})</span>
                    </td>
                    <td className={td}>
                      {m.dosage.amount} {m.dosage.unit}, {m.dosage.strength}
                    </td>
                    <td className={td}>{m.howOften === 'Daily' ? `${m.timesPerDay ?? 1}× daily` : 'As needed'}</td>
                    <td className={td}>{isControllerMed(m) ? 'Daily (controller/preventive)' : 'Rescue'}</td>
                    <td className={td}>{m.archived ? 'Archived (older entry, same name)' : 'Active'}</td>
                    <td className={td}>{fmtDay(m.startDate)}</td>
                    <td className={td}>{dosesByMed.get(m.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Doses are matched to medications by ID, so the archived duplicate&rsquo;s doses count toward the same daily
            schedule. {ctx.controllerIds.size} daily and {ctx.rescueIds.size} as-needed medication records.
          </p>
        </TabsContent>

        <TabsContent value="badges">
          <ul className="text-sm">
            {badges.map((b) => (
              <li key={b.badgeName + b.date} className="border-b py-1">
                {b.badgeName.replace(/([a-z])([A-Z0-9])/g, '$1 $2')}{' '}
                <span className="text-muted-foreground text-xs">{fmtDay(localDay(b.date))}</span>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </details>
  )
}
