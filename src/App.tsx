import { useMemo, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChangeFlags } from '@/components/clinician/ChangeFlags'
import { buildModel, type Lens, type RangeKey } from '@/components/clinician/model'
import { LENSES } from '@/components/clinician/lenses'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PatientHeader, type ViewKey } from '@/components/clinician/PatientHeader'
import { SummaryStrip } from '@/components/clinician/SummaryStrip'
import { tilesFor } from '@/components/clinician/tiles'
import { TrendPanels } from '@/components/clinician/TrendPanels'
import { DailyTimeline } from '@/components/clinician/DailyTimeline'
import { PortalGrid } from '@/components/clinician/PortalGrid'
import { PatientMode } from '@/components/clinician/PatientMode'
import { demoPatient, patients } from '@/data'
import { daysToCsv, type DayRule } from '@/lib/derive'

export default function App() {
  const [patientId, setPatientId] = useState(demoPatient.id)
  const [range, setRange] = useState<RangeKey>('visit')
  const [dayRule, setDayRule] = useState<DayRule>('worst')
  const [view, setView] = useState<ViewKey>('clinician')
  const doc = patients.find((p) => p.id === patientId) ?? demoPatient
  const model = useMemo(() => buildModel(doc, range, dayRule), [doc, range, dayRule])
  const [lens, setLens] = useState<Lens>('pulm')
  const lensDef = LENSES.find((l) => l.key === lens)!
  const tiles = tilesFor(lens)

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
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">View as</span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={lens}
                onValueChange={(v) => v && setLens(v as Lens)}
                aria-label="Specialty view"
              >
                {LENSES.map((l) => (
                  <ToggleGroupItem key={l.key} value={l.key} className="px-3">
                    {l.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <span className="text-muted-foreground text-xs">{lensDef.description}</span>
            </div>
            <SummaryStrip model={model} tiles={tiles} />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <TrendPanels model={model} panels={lensDef.panels} />
              <ChangeFlags flags={model.flags} />
            </div>
            <DailyTimeline model={model} dayRule={dayRule} />
          </>
        ) : view === 'patient' ? (
          <PatientMode model={model} />
        ) : (
          <PortalGrid doc={doc} />
        )}
      </main>
    </TooltipProvider>
  )
}
