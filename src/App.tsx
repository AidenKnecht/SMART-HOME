import { useMemo, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChangeFlags } from '@/components/clinician/ChangeFlags'
import { buildModel, type RangeKey } from '@/components/clinician/model'
import { PatientHeader, type ViewKey } from '@/components/clinician/PatientHeader'
import { SummaryStrip } from '@/components/clinician/SummaryStrip'
import { tilesFor } from '@/components/clinician/tiles'
import { demoPatient, patients } from '@/data'
import { daysToCsv, type DayRule } from '@/lib/derive'

export default function App() {
  const [patientId, setPatientId] = useState(demoPatient.id)
  const [range, setRange] = useState<RangeKey>('visit')
  const [dayRule, setDayRule] = useState<DayRule>('worst')
  const [view, setView] = useState<ViewKey>('clinician')
  const doc = patients.find((p) => p.id === patientId) ?? demoPatient
  const model = useMemo(() => buildModel(doc, range, dayRule), [doc, range, dayRule])
  const tiles = tilesFor('pulm')

  const exportCsv = () => {
    const blob = new Blob([daysToCsv(model.days)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc.patientId}_${model.from}_${model.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <TooltipProvider delayDuration={150}>
      <PatientHeader
        patients={patients}
        model={model}
        onPatient={setPatientId}
        range={range}
        onRange={setRange}
        dayRule={dayRule}
        onDayRule={setDayRule}
        view={view}
        onView={setView}
        onExport={exportCsv}
      />
      <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-4">
        {view === 'clinician' ? (
          <>
            <SummaryStrip model={model} tiles={tiles} />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="bg-card text-muted-foreground rounded-lg border p-4 text-sm">Trend chart (next step)</div>
              <ChangeFlags flags={model.flags} />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">Portal grid (next step)</div>
        )}
      </main>
    </TooltipProvider>
  )
}
