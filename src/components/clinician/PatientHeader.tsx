import { Download, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { trackerDefinitions } from '@/data/trackerDefinition'
import type { PatientDocument } from '@/data/types'
import { fmtDay, type DayRule } from '@/lib/derive'
import type { Model, RangeKey } from './model'

export type ViewKey = 'clinician' | 'portal'

interface Props {
  patients: PatientDocument[]
  model: Model
  onPatient: (id: string) => void
  range: RangeKey
  onRange: (r: RangeKey) => void
  dayRule: DayRule
  onDayRule: (r: DayRule) => void
  view: ViewKey
  onView: (v: ViewKey) => void
  onExport: () => void
}

export function PatientHeader(p: Props) {
  const { doc, last, from, to, lastVisit } = p.model
  const tracker = trackerDefinitions[doc.assignedTrackerIds[0]]
  return (
    <header className="bg-card border-b">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-primary text-sm font-bold">SMART@Home</span>
          <Select value={doc.id} onValueChange={p.onPatient}>
            <SelectTrigger className="h-8 w-[200px]" aria-label="Patient">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {p.patients.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.firstName} {x.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm">
          <span className="font-semibold">
            {doc.firstName} {doc.lastName}
          </span>
          <span className="text-muted-foreground">
            , {doc.age} y, {doc.sex === 'F' ? 'female' : 'male'}, {doc.patientId}, {tracker?.name}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="decoration-muted-foreground/50 text-sm underline decoration-dotted underline-offset-4">
              Last activity <span className="font-semibold">{fmtDay(last.overall)}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Symptom check-in: {fmtDay(last.tracker)}</p>
            <p>Medication dose: {fmtDay(last.dose)}</p>
            <p>Spirometry: {fmtDay(last.spirometry)}</p>
          </TooltipContent>
        </Tooltip>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={p.range}
            onValueChange={(v) => v && p.onRange(v as RangeKey)}
            aria-label="Date range"
          >
            <ToggleGroupItem value="visit" className="px-3">
              Since last visit{lastVisit ? ` (${fmtDay(lastVisit)})` : ''}
            </ToggleGroupItem>
            <ToggleGroupItem value="14" className="px-3">14 days</ToggleGroupItem>
            <ToggleGroupItem value="30" className="px-3">30 days</ToggleGroupItem>
            <ToggleGroupItem value="90" className="px-3">90 days</ToggleGroupItem>
          </ToggleGroup>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Settings">
                <Settings2 /> Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 text-sm">
              <p className="font-semibold">When a day has several check-ins</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Teens sometimes submit several times a day and change answers. Choose which answer counts.
              </p>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                className="mt-2"
                value={p.dayRule}
                onValueChange={(v) => v && p.onDayRule(v as DayRule)}
              >
                <ToggleGroupItem value="worst" className="px-3">Worst of day</ToggleGroupItem>
                <ToggleGroupItem value="latest" className="px-3">Latest entry</ToggleGroupItem>
              </ToggleGroup>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={p.onExport}>
            <Download /> Export CSV
          </Button>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={p.view}
            onValueChange={(v) => v && p.onView(v as ViewKey)}
            aria-label="View"
          >
            <ToggleGroupItem value="clinician" className="px-3">Clinician view</ToggleGroupItem>
            <ToggleGroupItem value="portal" className="px-3">Portal today</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="text-muted-foreground mx-auto max-w-[1600px] px-6 pb-2 text-xs">
        Showing {fmtDay(from)} to {fmtDay(to)}. Synthetic data, not a real patient.
      </div>
    </header>
  )
}
