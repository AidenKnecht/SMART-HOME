// Drill-down for one measure: the widget's headline, a bigger chart, the evidence behind it, and
// only the day-by-day columns that matter for this measure. Opens from a widget or a flag.
import { ArrowDown } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fmtDay, questionStats, type DayRule } from '@/lib/derive'
import { cn } from '@/lib/utils'
import { BlowsTable, MedsTable } from './AllData'
import { columnsFor, DailyTimeline } from './DailyTimeline'
import type { Model } from './model'
import { ChangeLine, toneIcon } from './SummaryStrip'
import type { TileDef } from './tiles'
import { Sparkline } from './Sparkline'
import { TrendPanels } from './TrendPanels'
import type { Panel } from './views'

interface Spec {
  panels: Panel[]
  columns: string[]
}

const SPECS: Record<string, Spec> = {
  control: { panels: ['checkins'], columns: ['zone', 'q:feeling', 'q:symptoms', 'q:nightWaking', 'q:activityLimit', 'rescue', 'entries'] },
  adherence: { panels: ['meds'], columns: ['controller', 'zone', 'q:symptoms', 'entries'] },
  fev1: { panels: ['lung'], columns: ['fev1', 'zone', 'q:symptoms'] },
  symptoms: { panels: ['checkins'], columns: ['q:symptoms', 'q:feeling', 'zone', 'rescue', 'entries'] },
  rescue: { panels: ['checkins'], columns: ['rescue', 'q:rescuePuffs', 'q:symptoms', 'zone', 'controller'] },
  zones: { panels: ['checkins'], columns: ['zone', 'q:symptoms', 'rescue', 'fev1', 'entries'] },
  school: { panels: [], columns: ['q:missedSchool', 'zone', 'q:symptoms', 'q:headacheToday', 'q:painScore'] },
}

function specFor(key: string): Spec {
  return SPECS[key] ?? { panels: ['checkins'], columns: [key, 'zone', 'q:symptoms', 'entries'] }
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <span className="text-muted-foreground text-xs">{note}</span>}
      </div>
      {children}
    </section>
  )
}

function Extra({ k, model }: { k: string; model: Model }) {
  const { doc, days, tracker } = model
  const q = tracker.questions.find((x) => `q:${x.key}` === k)
  if (q && (q.type === 'number' || q.type === 'scale1to10')) {
    const vals = days.map((d) => (d.answers[q.key] === undefined ? undefined : Number(d.answers[q.key])))
    const nums = vals.filter((v): v is number => v !== undefined)
    const scale = q.type === 'scale1to10'
    const lo = scale ? 0 : Math.min(...nums)
    const hi = scale ? 10 : Math.max(...nums)
    const unit = scale ? 'of 10' : (q.unit ?? '')
    return (
      <Section title={`${q.shortLabel}, day by day`} note={`${q.text} Days without an answer are skipped.`}>
        <div className="bg-card rounded-lg border px-4 py-3">
          <div className="flex gap-3">
            <div className="text-muted-foreground flex w-14 shrink-0 flex-col justify-between text-right text-xs">
              <span>{hi} {unit}</span>
              <span>{lo} {unit}</span>
            </div>
            <Sparkline values={vals} min={lo} max={hi} className="h-40" />
          </div>
          <div className="text-muted-foreground mt-1 flex justify-between pl-[4.25rem] text-xs">
            <span>{fmtDay(model.from)}</span>
            <span>{fmtDay(model.to)}</span>
          </div>
        </div>
      </Section>
    )
  }
  if (k === 'adherence')
    return (
      <Section title="Medication records" note="Doses are self-reported as taken, not verified.">
        <MedsTable model={model} />
      </Section>
    )
  if (k === 'fev1') {
    const rejected = days.reduce((n, d) => n + (d.spirometry?.rejected ?? 0), 0)
    return (
      <Section
        title="Every blow in range"
        note={`${rejected} rejected by the device quality check. Rejected blows are greyed and not used in the chart.`}
      >
        <BlowsTable model={model} />
      </Section>
    )
  }
  if (k === 'symptoms') {
    const q = tracker.questions.find((x) => x.key === 'symptoms')
    const top = q ? questionStats(days, q).topItems ?? [] : []
    if (!top.length) return null
    return (
      <Section title="Most reported symptoms" note="Days each was ticked">
        <div className="flex flex-wrap gap-1.5">
          {top.map((t) => (
            <span key={t.label} className="bg-card rounded-md border px-2 py-1 text-sm">
              {t.label} <span className="text-muted-foreground font-semibold">{t.count}</span>
            </span>
          ))}
        </div>
      </Section>
    )
  }
  if (k === 'zones' && doc.asthmaTreatmentPlan) {
    const p = doc.asthmaTreatmentPlan
    return (
      <Section title="Action plan">
        <p className="text-sm">
          Plan expires {fmtDay(p.expirationDate.slice(0, 10))}. Retest due {fmtDay(p.retestTime.slice(0, 10))}.
        </p>
      </Section>
    )
  }
  return null
}

interface Props {
  model: Model
  tile: TileDef | undefined
  dayRule: DayRule
  onClose: () => void
  onAllData: () => void
}

export function MeasureDetail({ model, tile, dayRule, onClose, onAllData }: Props) {
  const v = tile?.view(model)
  const label = tile ? (tile.labelFor?.(model) ?? tile.label) : ''
  const tone = v ? toneIcon[v.tone] : null
  const spec = tile ? specFor(tile.key) : null
  const available = new Set(columnsFor(model).map((c) => c.key))
  const columns = spec?.columns.filter((c) => available.has(c)) ?? []
  // Generic measures with no matching column still get the raw check-ins
  if (tile && !columns.length) columns.push('entries')

  return (
    <Sheet open={!!tile} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-[820px]">
        {tile && v && spec && (
          <>
            <SheetHeader className="bg-card border-b px-6 py-4">
              <SheetTitle className="text-muted-foreground text-sm font-medium">{label}</SheetTitle>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{v.value}</span>
                  {v.unit && <span className="text-muted-foreground">{v.unit}</span>}
                </p>
                {tone && (
                  <span className={cn('flex items-center gap-1 text-sm font-medium', tone.cls)}>
                    <tone.Icon className="size-4" aria-hidden /> {tone.label}
                  </span>
                )}
              </div>
              {v.change && <ChangeLine change={v.change} />}
              <SheetDescription className="text-xs">
                {v.note} Showing {fmtDay(model.from)} to {fmtDay(model.to)}.
              </SheetDescription>
              {v.detail && <div className="text-sm">{v.detail}</div>}
            </SheetHeader>

            <div className="space-y-5 px-6 py-5">
              {spec.panels.length > 0 && <TrendPanels model={model} panels={spec.panels} tall />}
              <Extra k={tile.key} model={model} />
              <DailyTimeline model={model} dayRule={dayRule} columns={columns} />
              <button
                type="button"
                onClick={onAllData}
                className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
              >
                <ArrowDown className="size-4" aria-hidden /> See everything in All data
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
