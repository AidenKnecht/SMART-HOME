import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquareWarning } from 'lucide-react'
import { asthmaTracker } from '@/data/trackerDefinition'
import { fmtDay, fmtWeekday, type DayRule, type DaySummary, type ParsedEntry } from '@/lib/derive'
import { cn } from '@/lib/utils'
import type { Model } from './model'
import { ZonePill } from './Zone'

const symptomLabel = (v: string) => asthmaTracker.questions.find((q) => q.key === 'symptoms')?.options?.find((o) => o.value === v)?.label ?? v
const yn = (v: boolean | undefined) => (v === undefined ? '' : v ? 'Yes' : 'No')

function Chips({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted-foreground">None</span>
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span key={s} className="bg-secondary rounded-sm px-1.5 py-px text-xs">
          {symptomLabel(s)}
        </span>
      ))}
    </span>
  )
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

function EntryRow({ e }: { e: ParsedEntry }) {
  const a = e.answers
  return (
    <tr className="bg-muted/50 text-xs">
      <td className="py-1 pr-2 pl-10 text-right">{e.time}</td>
      <td className="py-1 pr-2">{e.blank ? null : <ZonePill zone={e.zone} />}</td>
      {e.blank ? (
        <td colSpan={8} className="text-muted-foreground py-1 pr-2 italic">
          Started, no answers
        </td>
      ) : (
        <>
          <td className="py-1 pr-2">{(a.feeling as string) ?? ''}</td>
          <td className="py-1 pr-2">
            <Chips items={((a.symptoms as string[]) ?? []).filter((s) => s.trim() !== 'None of these')} />
          </td>
          <td className="py-1 pr-2">{yn(a.nightWaking as boolean | undefined)}</td>
          <td className="py-1 pr-2">{yn(a.rescueUsed as boolean | undefined)}</td>
          <td colSpan={2} />
          <td className="py-1 pr-2">{yn(a.missedSchool as boolean | undefined)}</td>
        </>
      )}
    </tr>
  )
}

export function DailyTimeline({ model, dayRule }: { model: Model; dayRule: DayRule }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (day: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(day)) n.delete(day)
      else n.add(day)
      return n
    })
  const rows = [...model.days].reverse()
  const perDay = model.ctx.dosesPerDay
  const th = 'bg-card sticky top-0 z-10 border-b py-2 pr-2 text-left text-xs font-medium text-muted-foreground'

  return (
    <section aria-labelledby="timeline-h" className="bg-card rounded-lg border">
      <div className="flex items-baseline gap-2 border-b px-4 py-2">
        <h2 id="timeline-h" className="text-sm font-semibold">
          Day by day
        </h2>
        <span className="text-muted-foreground text-xs">
          One row per day, newest first. Several check-ins on one day are combined ({dayRule === 'worst' ? 'worst answer counts' : 'latest answer counts'}).
        </span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(th, 'pl-4')}>Date</th>
              <th className={th}>Zone</th>
              <th className={th}>Feeling</th>
              <th className={th}>Symptoms</th>
              <th className={th}>Night waking</th>
              <th className={th}>Rescue</th>
              <th className={th}>Controller doses</th>
              <th className={th}>FEV1</th>
              <th className={th}>Missed school</th>
              <th className={cn(th, 'pr-4')}>Check-ins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const s = d.spirometry
              const multi = d.entryCount > 1
              const isOpen = open.has(d.day)
              return (
                <Fragment key={d.day}>
                  <tr className={cn('border-b align-top', d.status === 'none' && 'text-muted-foreground')}>
                    <td className="py-1.5 pr-2 pl-4 whitespace-nowrap">
                      <span className="text-muted-foreground inline-block w-8">{fmtWeekday(d.day)}</span>
                      <span className="font-medium">{fmtDay(d.day)}</span>
                    </td>
                    <td className="py-1.5 pr-2">{d.status === 'logged' ? <ZonePill zone={d.zone} /> : null}</td>
                    {d.status === 'logged' ? (
                      <>
                        <td className="py-1.5 pr-2">
                          {d.feeling}
                          {d.changedAnswer && <div className="text-muted-foreground text-xs">Changed: {d.changedAnswer}</div>}
                        </td>
                        <td className="py-1.5 pr-2">
                          <Chips items={d.symptoms} />
                          {d.conflict && (
                            <div className="text-zone-yellow mt-0.5 flex items-center gap-1 text-xs">
                              <MessageSquareWarning className="size-3.5" aria-hidden />
                              {d.conflict}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">{yn(d.nightWaking)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="py-1.5 pr-2 italic">
                        {d.status === 'blank-only' ? 'Started, no answers' : 'No check-in'}
                      </td>
                    )}
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {d.status === 'logged' || d.rescueDoses ? (d.rescueAny ? 'Yes' : 'No') : ''}
                      {d.rescueDoses > 0 && (
                        <span className="text-muted-foreground text-xs">
                          {' '}
                          ({d.rescueDoses} {d.rescueDoses === 1 ? 'dose' : 'doses'} logged)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <DoseDots d={d} perDay={perDay} />
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {s?.fev1 !== undefined ? (
                        <span title={s.coaching.length ? `Coaching: ${s.coaching.join('; ')}` : undefined}>
                          {s.fev1.toFixed(2)} L <span className="text-muted-foreground text-xs">({s.pctPredicted}%)</span>
                        </span>
                      ) : s ? (
                        <span className="text-xs">No accepted blow</span>
                      ) : null}
                      {s && s.rejected > 0 && (
                        <div className="text-muted-foreground text-xs" title={s.coaching.join('; ')}>
                          {s.rejected} rejected: {s.coaching[0]?.toLowerCase()}
                          {s.coaching.length > 1 ? ` +${s.coaching.length - 1}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">{d.status === 'logged' ? yn(d.missedSchool) : ''}</td>
                    <td className="py-1.5 pr-4 whitespace-nowrap">
                      {multi ? (
                        <button
                          onClick={() => toggle(d.day)}
                          aria-expanded={isOpen}
                          className="text-primary flex items-center gap-0.5 text-xs font-medium hover:underline"
                        >
                          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          {d.entryCount} check-ins, {dayRule === 'worst' ? 'worst' : 'latest'} shown
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">{d.entryCount === 1 ? d.entries[0].time : ''}</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && d.entries.map((e) => <EntryRow key={e.id} e={e} />)}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
