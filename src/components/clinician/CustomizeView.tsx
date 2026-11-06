import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Panel, ViewConfig } from './views'

export interface PickItem {
  key: string
  label: string
  hint?: string
  group?: string
}

/** Ordered selection: chosen items in order (move, remove), then everything else to add. */
function OrderedPicker({
  items,
  selected,
  onChange,
  firstLabel,
}: {
  items: PickItem[]
  selected: string[]
  onChange: (keys: string[]) => void
  firstLabel?: string
}) {
  const chosen = selected.map((k) => items.find((i) => i.key === k)).filter((i): i is PickItem => !!i)
  const rest = items.filter((i) => !selected.includes(i.key))
  const move = (idx: number, by: number) => {
    const next = chosen.map((c) => c.key)
    const [x] = next.splice(idx, 1)
    next.splice(idx + by, 0, x)
    onChange(next)
  }
  const groups = [...new Set(rest.map((r) => r.group ?? ''))]
  return (
    <div className="space-y-3">
      <ol className="divide-y rounded-md border">
        {chosen.map((c, i) => (
          <li key={c.key} className="flex items-center gap-1 py-1 pr-1 pl-2 text-sm">
            <span className="text-muted-foreground w-5 text-xs">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate" title={c.hint}>
              {c.label}
              {i === 0 && firstLabel && <span className="text-primary ml-1.5 text-xs font-medium">{firstLabel}</span>}
            </span>
            <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.label} up`}>
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={i === chosen.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Move ${c.label} down`}
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onChange(chosen.filter((x) => x.key !== c.key).map((x) => x.key))}
              aria-label={`Hide ${c.label}`}
            >
              <X />
            </Button>
          </li>
        ))}
        {!chosen.length && <li className="text-muted-foreground px-3 py-2 text-sm">Nothing selected.</li>}
      </ol>
      {rest.length > 0 && (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g}>
              {g && <p className="text-muted-foreground mb-1 text-xs font-medium">{g}</p>}
              <div className="flex flex-wrap gap-1.5">
                {rest
                  .filter((r) => (r.group ?? '') === g)
                  .map((r) => (
                    <button
                      key={r.key}
                      title={r.hint}
                      onClick={() => onChange([...selected.filter((k) => items.some((i) => i.key === k)), r.key])}
                      className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs outline-none focus-visible:ring-2"
                    >
                      <Plus className="size-3" aria-hidden />
                      {r.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const PANEL_LABEL: Record<Panel, string> = {
  lung: 'Lung function chart',
  meds: 'Daily medication chart',
  checkins: 'Daily check-in rows',
}

interface Props {
  draft: ViewConfig
  base: ViewConfig
  modified: boolean
  measures: PickItem[]
  columns: PickItem[]
  panels: Panel[]
  patientFirstName: string
  patientId: string
  onChange: (v: ViewConfig) => void
  onSave: () => void
  onSaveAsNew: () => void
  onReset: () => void
  onDelete: () => void
  onClose: () => void
}

export function CustomizeView(p: Props) {
  const { draft } = p
  const isPreset = p.base.ownerId === 'preset'
  const set = (patch: Partial<ViewConfig>) => p.onChange({ ...draft, ...patch })
  const section = 'space-y-2 border-b px-4 py-4'
  return (
    <aside
      aria-label="Customize view"
      className="bg-card fixed top-0 right-0 z-40 flex h-full w-[380px] flex-col border-l shadow-lg"
    >
      <div className="flex items-start justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Customize your view</h2>
          <p className="text-muted-foreground text-xs">Changes show on the dashboard as you make them.</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={p.onClose} aria-label="Close customize panel">
          <X />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className={section}>
          <Label htmlFor="view-name">View name</Label>
          <Input id="view-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          <label className="flex items-center gap-2 pt-1 text-sm">
            <Checkbox
              checked={draft.patientId === p.patientId}
              onCheckedChange={(c) => set({ patientId: c ? p.patientId : undefined })}
            />
            Use this view for {p.patientFirstName} only
          </label>
        </div>

        <div className={section}>
          <h3 className="text-sm font-semibold">Summary measures</h3>
          <p className="text-muted-foreground text-xs">What you want to see first, in order.</p>
          <OrderedPicker
            items={p.measures}
            selected={draft.measures}
            onChange={(measures) => set({ measures })}
            firstLabel="shown first"
          />
        </div>

        <div className={section}>
          <h3 className="text-sm font-semibold">Charts</h3>
          <OrderedPicker
            items={p.panels.map((k) => ({ key: k, label: PANEL_LABEL[k] }))}
            selected={draft.panels}
            onChange={(panels) => set({ panels: panels as Panel[] })}
          />
        </div>

        <div className={section}>
          <h3 className="text-sm font-semibold">Day-by-day columns</h3>
          <OrderedPicker items={p.columns} selected={draft.columns} onChange={(columns) => set({ columns })} />
        </div>

        <p className="text-muted-foreground px-4 py-3 text-xs">
          Hidden is not deleted. Everything stays in <span className="font-medium">All data</span> at the bottom of the page.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <Button size="sm" onClick={p.onSave} disabled={!draft.name.trim()}>
          {isPreset ? 'Save as my view' : 'Save changes'}
        </Button>
        {!isPreset && (
          <Button size="sm" variant="outline" onClick={p.onSaveAsNew} disabled={!draft.name.trim()}>
            Save as new
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={p.onReset} disabled={!p.modified}>
          Undo changes
        </Button>
        {!isPreset && (
          <Button size="sm" variant="ghost" className={cn('text-destructive ml-auto')} onClick={p.onDelete}>
            Delete
          </Button>
        )}
      </div>
    </aside>
  )
}
