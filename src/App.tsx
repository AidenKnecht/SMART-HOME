import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AllData } from '@/components/clinician/AllData'
import { ChangeFlags } from '@/components/clinician/ChangeFlags'
import { CustomizeView } from '@/components/clinician/CustomizeView'
import { columnsFor, DailyTimeline } from '@/components/clinician/DailyTimeline'
import { MeasureDetail } from '@/components/clinician/MeasureDetail'
import { buildModel, type RangeKey } from '@/components/clinician/model'
import { PatientHeader, type ViewKey } from '@/components/clinician/PatientHeader'
import { PatientMode } from '@/components/clinician/PatientMode'
import { PortalGrid } from '@/components/clinician/PortalGrid'
import { PreVisitSummary } from '@/components/clinician/PreVisitSummary'
import { SummaryStrip } from '@/components/clinician/SummaryStrip'
import { measuresFor } from '@/components/clinician/tiles'
import { TrendPanels } from '@/components/clinician/TrendPanels'
import {
  deleteUserView,
  loadUserViews,
  newViewId,
  resetAllViews,
  resolveView,
  sameView,
  saveUserView,
  setActiveId,
  viewsFor,
  type Panel,
  type ViewConfig,
} from '@/components/clinician/views'
import { clinicians } from '@/data/clinicians'
import { demoPatient, patients } from '@/data'
import { daysToCsv, type DayRule } from '@/lib/derive'
import { buildSummaryInput, prefetchSummaries } from '@/lib/summary'
import { cn } from '@/lib/utils'

export default function App() {
  const [patientId, setPatientId] = useState(demoPatient.id)
  const [clinicianId, setClinicianId] = useState(clinicians[0].id)
  const [range, setRange] = useState<RangeKey>('visit')
  const [dayRule, setDayRule] = useState<DayRule>('worst')
  const [screen, setScreen] = useState<ViewKey>('clinician')
  const [userViews, setUserViews] = useState<ViewConfig[]>(loadUserViews)
  /** View picked in this session; wins over a patient-pinned view until the patient changes */
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ViewConfig | null>(null)
  const [customizing, setCustomizing] = useState(false)
  /** Measure open in the detail panel */
  const [detailKey, setDetailKey] = useState<string | null>(null)

  const doc = patients.find((p) => p.id === patientId) ?? demoPatient
  const me = clinicians.find((c) => c.id === clinicianId) ?? clinicians[0]
  const model = useMemo(() => buildModel(doc, range, dayRule), [doc, range, dayRule])
  const trackerId = model.ctx.trackerId

  // Warm the AI summary cache for every patient at the default range, so the demo never waits
  useEffect(() => {
    const t = setTimeout(() => {
      const views = loadUserViews()
      prefetchSummaries(
        patients.map((p) => {
          const m = buildModel(p, 'visit', 'worst')
          const v = resolveView(views, clinicians[0], m.ctx.trackerId, p.patientId)
          return { input: buildSummaryInput(m, 'visit', v.measures), dayRule: 'worst' }
        }),
      )
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  const { presets, mine } = viewsFor(userViews, me, trackerId, doc.patientId)
  const pickable = [...presets, ...mine]
  const base = pickable.find((v) => v.id === pickedId) ?? resolveView(userViews, me, trackerId, doc.patientId)
  const view = draft ?? base
  const modified = !!draft && !sameView(draft, base)

  const allMeasures = measuresFor(model)
  const tiles = view.measures.map((k) => allMeasures.find((t) => t.key === k)).filter((t) => !!t)
  const allColumns = columnsFor(model)
  const availablePanels: Panel[] = [
    ...(model.doc.medicalDevices.length && model.doc.asthmaTreatmentPlan ? (['lung'] as Panel[]) : []),
    ...(model.ctx.controllerIds.size ? (['meds'] as Panel[]) : []),
    'checkins',
  ]

  const leaveDraft = () => {
    setDraft(null)
    setCustomizing(false)
  }
  const choosePatient = (id: string) => {
    setPatientId(id)
    setDetailKey(null)
    setPickedId(null)
    leaveDraft()
  }
  const chooseClinician = (id: string) => {
    setClinicianId(id)
    setPickedId(null)
    leaveDraft()
  }
  const chooseView = (id: string) => {
    const v = pickable.find((x) => x.id === id)
    if (v && !v.patientId) setActiveId(me.id, trackerId, id)
    setPickedId(id)
    setDraft(customizing && v ? structuredClone(v) : null)
  }
  const persist = (v: ViewConfig) => {
    setUserViews(saveUserView(v))
    if (!v.patientId) setActiveId(me.id, trackerId, v.id)
    setPickedId(v.id)
    setDraft(structuredClone(v))
  }
  const save = () => {
    if (!draft) return
    if (base.ownerId === 'preset') {
      const name =
        draft.name === base.name ? `${me.name.replace(/^(Dr\.|Nurse) /, '')}'s ${base.name.toLowerCase()} view` : draft.name
      persist({ ...draft, id: newViewId(), ownerId: me.id, name, description: undefined })
    } else persist(draft)
  }
  const saveAsNew = () => {
    if (!draft) return
    persist({ ...draft, id: newViewId(), ownerId: me.id, name: draft.name === base.name ? `${draft.name} (copy)` : draft.name })
  }
  const remove = () => {
    setUserViews(deleteUserView(base.id))
    setPickedId(null)
    leaveDraft()
  }

  const exportCsv = () => {
    const blob = new Blob([daysToCsv(model.days)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc.patientId}_${model.from}_${model.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const openAllData = () => {
    setDetailKey(null)
    const el = document.getElementById('all-data') as HTMLDetailsElement | null
    if (!el) return
    el.open = true
    // Let the sheet close before scrolling
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
  }
  const detailTile = detailKey ? allMeasures.find((t) => t.key === detailKey) : undefined

  const viewLabel = (v: ViewConfig) => (v.patientId ? `${v.name} (${doc.firstName} only)` : v.name)
  // Hidden while a measure's detail panel is open (both sit on the right)
  const showPanel = customizing && screen === 'clinician' && !!draft && !detailKey

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn(showPanel && 'pr-[380px]')}>
        <PatientHeader
          patients={patients}
          model={model}
          onPatient={choosePatient}
          range={range}
          onRange={setRange}
          dayRule={dayRule}
          onDayRule={setDayRule}
          view={screen}
          onView={(v) => {
            setScreen(v)
            if (v !== 'clinician') setCustomizing(false)
          }}
          onExport={exportCsv}
          clinicians={clinicians}
          clinicianId={me.id}
          onClinician={chooseClinician}
          onResetViews={() => {
            resetAllViews()
            setUserViews([])
            setPickedId(null)
            leaveDraft()
          }}
        />
        <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-4">
          {screen === 'clinician' ? (
            <>
              <div className="flex flex-wrap items-center gap-3 print:hidden">
                <span className="text-sm font-medium">View</span>
                <Select value={base.id} onValueChange={chooseView}>
                  <SelectTrigger className="h-8 w-[260px]" aria-label="Saved view">
                    <SelectValue>{viewLabel(base)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Starting points</SelectLabel>
                      {presets.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {mine.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>{me.name}&rsquo;s views</SelectLabel>
                        {mine.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {viewLabel(v)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                {modified && <Badge variant="secondary">Unsaved changes</Badge>}
                <Button
                  variant={showPanel ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (showPanel) setCustomizing(false)
                    else {
                      setDraft(draft ?? structuredClone(base))
                      setCustomizing(true)
                    }
                  }}
                >
                  <SlidersHorizontal /> Customize
                </Button>
                <span className="text-muted-foreground text-xs">
                  {base.ownerId === 'preset' ? base.description : `Saved by ${me.name}.`}
                </span>
              </div>
              <PreVisitSummary model={model} range={range} dayRule={dayRule} order={view.measures} />
              {tiles.length > 0 && <SummaryStrip model={model} tiles={tiles} onOpen={setDetailKey} />}
              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <TrendPanels model={model} panels={view.panels} />
                <ChangeFlags
                  flags={model.flags.map((f) =>
                    f.measure && allMeasures.some((t) => t.key === f.measure) ? f : { ...f, measure: undefined },
                  )}
                  onOpen={setDetailKey}
                />
              </div>
              {view.columns.length > 0 && (
                <details id="day-by-day" className="group/day print:hidden">
                  <summary className="bg-card flex cursor-pointer list-none items-baseline gap-2 rounded-lg border px-4 py-2.5 group-open/day:rounded-b-none group-open/day:border-b-0">
                    <ChevronRight className="size-4 self-center transition-transform group-open/day:rotate-90" aria-hidden />
                    <span className="text-sm font-semibold">Day by day</span>
                    <span className="text-muted-foreground text-xs">
                      One row per day, {model.days.length} days. Open to see every day&rsquo;s answers, doses and spirometry.
                    </span>
                  </summary>
                  <DailyTimeline model={model} dayRule={dayRule} columns={view.columns} />
                </details>
              )}
              <div className="print:hidden">
                <AllData model={model} />
              </div>
              <MeasureDetail
                model={model}
                tile={detailTile}
                dayRule={dayRule}
                onClose={() => setDetailKey(null)}
                onAllData={openAllData}
              />
            </>
          ) : screen === 'patient' ? (
            <PatientMode model={model} />
          ) : (
            <PortalGrid doc={doc} />
          )}
        </main>
      </div>
      {showPanel && draft && (
        <CustomizeView
          draft={draft}
          base={base}
          modified={modified}
          measures={allMeasures.map((t) => ({ key: t.key, label: t.label, hint: t.hint, group: t.group }))}
          columns={allColumns.map((c) => ({ key: c.key, label: c.label }))}
          panels={availablePanels}
          patientFirstName={doc.firstName}
          patientId={doc.patientId}
          onChange={setDraft}
          onSave={save}
          onSaveAsNew={saveAsNew}
          onReset={() => setDraft(structuredClone(base))}
          onDelete={remove}
          onClose={() => {
            setCustomizing(false)
            if (!modified) setDraft(null)
          }}
        />
      )}
    </TooltipProvider>
  )
}
