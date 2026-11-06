import { trackerDefinitions } from '@/data/trackerDefinition'
import type { PatientDocument } from '@/data/types'
import { fmtDay, lastActivity, portalHeader, rawRows } from '@/lib/derive'

const stamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Recreates today's portal grid from the same document, for the before/after. */
export function PortalGrid({ doc }: { doc: PatientDocument }) {
  const tracker = trackerDefinitions[doc.assignedTrackerIds[0]]
  const rows = rawRows(doc)
  const head = portalHeader(doc)
  const last = lastActivity(doc)
  return (
    <div className="space-y-3">
      <div className="bg-zone-yellow-bg text-foreground rounded-lg border px-4 py-2 text-sm">
        This is the same patient as the current SMART@Home portal shows them: one row per submission, raw values, no
        medications or spirometry. It says the last day logged was {fmtDay(head.lastDayLogged)}, but doses and spirometry
        continue to {fmtDay(last.overall)}.
      </div>
      <div className="rounded-lg border bg-white p-4 font-[Segoe_UI,sans-serif]">
        <p className="text-base">{tracker.name}</p>
        <div className="mt-2 flex gap-24 text-[11px] text-gray-500">
          <div>
            <div>TOTAL DAYS TRACKED</div>
            <div className="text-sm text-gray-900">{head.totalDaysTracked}</div>
          </div>
          <div>
            <div>LAST DAY LOGGED</div>
            <div className="text-sm text-gray-900">{fmtDay(head.lastDayLogged)}, 2026</div>
          </div>
        </div>
        <p className="mt-4 text-sm">Patient Tracker Information</p>
        <div className="mt-2 max-h-[620px] overflow-auto">
          <table className="table-fixed border-collapse text-xs">
            <thead>
              <tr className="text-[10px] text-gray-500">
                <th className="w-32 truncate px-2 py-1 text-left font-normal">DATE &amp; TIME</th>
                {tracker.questions.map((q) => (
                  <th key={q.id} className="w-40 max-w-40 truncate px-2 py-1 text-left font-normal" title={q.text}>
                    {q.text.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className={i % 2 ? '' : 'bg-gray-100'}>
                  <td className="px-2 py-1 whitespace-nowrap text-amber-800">{stamp.format(new Date(r.submittedAt))}</td>
                  {tracker.questions.map((q) => (
                    <td key={q.id} className="w-40 max-w-40 truncate px-2 py-1">
                      {r.values[q.id] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
