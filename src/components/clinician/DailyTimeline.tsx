import { Fragment, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, MessageSquareWarning } from 'lucide-react'
import type { Question } from '@/data/types'
import { fmtDay, fmtWeekday, type DayRule, type DaySummary, type ParsedEntry } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Model } from './model'
import { ZonePill } from './Zone'

const yn = (v: unknown) => (v === undefined ? '' : v ? 'Yes' : 'No')

function Chips({ items, q }: { items: string[]; q: Question }) {
  if (!items.length) return <span className="text-muted-foreground">None</span>
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span key={s} className="bg-secondary rounded-sm px-1.5 py-px text-xs">
          {q.options?.find((o) => o.value === s)?.label ?? s}
        </span>
      ))}
    </span>
  )
}

/** Render one question's value by its type. */
function answerCell(q: Question, v: unknown): ReactNode {
  if (v === undefined) return null
  switch (q.type) {
    case 'yesNo':
      return yn(v)
    case 'number':
    case 'scale1to10':
      return (
        <span className="whitespace-nowrap">
          {String(v)}
          <span className="text-muted-foreground text-xs"> {q.type === 'scale1to10' ? '/10' : q.unit}</span>
        </span>
      )
    case 'checkbox':
    case 'icon': {
      const list = (v as string[]).filter((x) => !(q.noneValue && x.trim() === q.noneValue.trim()))
      return <Chips items={list} q={q} />
    }
    default:
      return q.options?.find((o) => o.value === v)?.label ?? String(v)
  }
}

export interface ColumnDef {
  key: string
  label: string
  /** Question columns share the "No check-in" placeholder on days without answers */
  question?: boolean
  available: (m: Model) => boolean
  cell: (d: DaySummary, m: Model) => ReactNode
  entryCell?: (e: ParsedEntry) => ReactNode
}

function DoseDots({ d, perDay }: { d: DaySummary; perDay: number }) {
  return (
    <span className="flex items-center gap-1" title={d.controllerTimes.length ? `Logged at ${d.controllerTimes.join(', ')}` : 'No doses logged'}>
      {Array.from({ length: perDay }, (_, i) => (
        <span
          key={i}
          className={cn('size-2.5 rounded-full border', i < d.controllerDoses ? 'bg-primary border-primary' : 'border-muted-foreground/60')}
          aria-hidden
        />
      ))}
      <span className="text-muted-foreground ml-1 text-xs">
        {d.controllerDoses}/{perDay}
      </span>
    </span>
  )
}

const BUILT_IN_COLUMNS: ColumnDef[] = [
  {
    key: 'zone',
    label: 'Zone',
    available: (m) => !!m.doc.asthmaTreatmentPlan,
    cell: (d) => (d.status === 'logged' ? <ZonePill zone={d.zone} /> : null),
    entryCell: (e) => (e.blank ? null : <ZonePill zone={e.zone} />),
  },
  {
    key: 'rescue',
    label: 'Rescue',
    available: (m) => m.ctx.rescueIds.size > 0,
    cell: (d) => (
      <span className="whitespace-nowrap">
        {d.status === 'logged' || d.rescueDoses ? (d.rescueAny ? 'Yes' : 'No') : ''}
        {d.rescueDoses > 0 && (
          <span className="text-muted-foreground text-xs">
            {' '}
            ({d.rescueDoses} {d.rescueDoses === 1 ? 'dose' : 'doses'} logged)
          </span>
        )}
      </span>
    ),
    entryCell: (e) => yn(e.answers.rescueUsed),
  },
  {
    key: 'controller',
    label: 'Daily doses',
    available: (m) => m.ctx.controllerIds.size > 0,
    cell: (d, m) => <DoseDots d={d} perDay={m.ctx.dosesPerDay} />,
  },
  {
    key: 'fev1',
    label: 'FEV1',
    available: (m) => m.doc.medicalDevices.length > 0,
    cell: (d) => {
      const s = d.spirometry
      if (!s) return null
      return (
        <span className="whitespace-nowrap">
          {s.fev1 !== undefined ? (
            <span title={s.coaching.length ? `Coaching: ${s.coaching.join('; ')}` : undefined}>
              {s.fev1.toFixed(2)} L <span className="text-muted-foreground text-xs">({s.pctPredicted}%)</span>
            </span>
          ) : (
            <span className="text-xs">No accepted blow</span>
          )}
          {s.rejected > 0 && (
            <div className="text-muted-foreground text-xs" title={s.coaching.join('; ')}>
              {s.rejected} rejected: {s.coaching[0]?.toLowerCase()}
              {s.coaching.length > 1 ? ` +${s.coaching.length - 1}` : ''}
            </div>
          )}
        </span>
      )
    },
  },
]

function questionColumn(q: Question): ColumnDef {
  return {
    key: `q:${q.key}`,
    label: q.shortLabel,
    question: true,
    available: () => true,
    cell: (d) => (
      <>
        {answerCell(q, d.answers[q.key])}
        {q.key === 'feeling' && d.changedAnswer && (
          <div className="text-muted-foreground text-xs">Changed: {d.changedAnswer}</div>
        )}
        {q.key === 'symptoms' && d.conflict && (
          <div className="text-zone-yellow mt-0.5 flex items-center gap-1 text-xs">
            <MessageSquareWarning className="size-3.5" aria-hidden />
            {d.conflict}
          </div>
        )}
      </>
    ),
    entryCell: (e) => answerCell(q, e.answers[q.key]),
  }
}

const ENTRIES_KEY = 'entries'

/** Every column this patient's data supports. */
export function columnsFor(m: Model): ColumnDef[] {
  const questions = m.tracker.questions.filter((q) => q.type !== 'spirometry').map(questionColumn)
  return [
    ...BUILT_IN_COLUMNS.filter((c) => c.available(m)),
    ...questions,
    { key: ENTRIES_KEY, label: 'Check-ins', available: () => true, cell: () => null },
  ]
}

export function DailyTimeline({ model, dayRule, columns }: { model: Model; dayRule: DayRule; columns: string[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (day: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(day)) n.delete(day)
      else n.add(day)
      return n
    })
  const all = columnsFor(model)
  const cols = columns.map((k) => all.find((c) => c.key === k)).filter((c): c is ColumnDef => !!c)
  const firstQuestion = cols.findIndex((c) => c.question)
  const rows = [...model.days].reverse()
  const th = 'bg-card sticky top-0 z-10 border-b py-2 pr-2 text-left text-xs font-medium text-muted-foreground'

  return (
    <section aria-labelledby="timeline-h" className="bg-card rounded-lg border">
      <div className="flex items-baseline gap-2 border-b px-4 py-2">
        <h2 id="timeline-h" className="text-sm font-semibold">
          Day by day
        </h2>
        <span className="text-muted-foreground text-xs">
          One row per day, newest first. Several check-ins on one day are combined (
          {dayRule === 'worst' ? 'worst answer counts' : 'latest answer counts'}).
        </span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(th, 'pl-4')}>Date</th>
              {cols.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const isOpen = open.has(d.day)
              return (
                <Fragment key={d.day}>
                  <tr className={cn('border-b align-top', d.status === 'none' && 'text-muted-foreground')}>
                    <td className="py-1.5 pr-2 pl-4 whitespace-nowrap">
                      <span className="text-muted-foreground inline-block w-8">{fmtWeekday(d.day)}</span>
                      <span className="font-medium">{fmtDay(d.day)}</span>
                    </td>
                    {cols.map((c, i) => {
                      let content: ReactNode
                      if (c.key === ENTRIES_KEY) {
                        content =
                          d.entryCount > 1 ? (
                            <button
                              onClick={() => toggle(d.day)}
                              aria-expanded={isOpen}
                              className="text-primary flex items-center gap-0.5 text-xs font-medium whitespace-nowrap hover:underline"
                            >
                              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                              {d.entryCount} check-ins, {dayRule === 'worst' ? 'worst' : 'latest'} shown
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">{d.entryCount === 1 ? d.entries[0].time : ''}</span>
                          )
                      } else if (c.question && d.status !== 'logged') {
                        content =
                          i === firstQuestion ? (
                            <span className="italic whitespace-nowrap">
                              {d.status === 'blank-only' ? 'Started, no answers' : 'No check-in'}
                            </span>
                          ) : null
                      } else content = c.cell(d, model)
                      return (
                        <td key={c.key} className="py-1.5 pr-2">
                          {content}
                        </td>
                      )
                    })}
                  </tr>
                  {isOpen &&
                    d.entries.map((e) => (
                      <tr key={e.id} className="bg-muted/50 text-xs">
                        <td className="py-1 pr-2 pl-10 text-right">{e.time}</td>
                        {cols.map((c, i) => (
                          <td key={c.key} className="py-1 pr-2">
                            {e.blank ? (
                              i === Math.max(0, firstQuestion) ? (
                                <span className="text-muted-foreground italic">Started, no answers</span>
                              ) : null
                            ) : (
                              c.entryCell?.(e)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
