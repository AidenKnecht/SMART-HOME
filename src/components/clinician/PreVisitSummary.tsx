import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DayRule } from '@/lib/derive'
import { buildSummaryInput, getSummary, type SummaryResult } from '@/lib/summary'
import type { Model, RangeKey } from './model'

const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function PreVisitSummary({ model, range, dayRule }: { model: Model; range: RangeKey; dayRule: DayRule }) {
  const input = useMemo(() => buildSummaryInput(model, range), [model, range])
  const [result, setResult] = useState<SummaryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    getSummary(input, dayRule, { force: nonce > 0, signal: ctrl.signal }).then((r) => {
      if (ctrl.signal.aborted) return
      setResult(r)
      setLoading(false)
    })
    return () => ctrl.abort()
  }, [input, dayRule, nonce])

  const ai = result && result.source !== 'fallback'
  const label = loading
    ? 'Writing a draft…'
    : ai
      ? `AI draft, check against the data · ${result.model}${result.generatedAt ? ` · ${timeFmt.format(new Date(result.generatedAt))}` : ''}`
      : 'From the numbers on this page (AI unavailable)'

  return (
    <section aria-labelledby="pvs-h" aria-busy={loading} className="bg-card rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="pvs-h" className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="text-primary size-4" aria-hidden /> Pre-visit summary
        </h2>
        <span className="text-muted-foreground text-xs" title={result?.reason}>
          {label}
        </span>
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || !result}
            onClick={() => {
              if (!result) return
              navigator.clipboard?.writeText(result.text).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" size="sm" disabled={loading} onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw /> Regenerate
          </Button>
        </div>
      </div>
      <p className={loading && !result ? 'text-muted-foreground mt-2 text-sm' : 'mt-2 max-w-[110ch] text-sm leading-relaxed'}>
        {result?.text ?? 'Reading the numbers on this page…'}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        Built only from the numbers and flags shown on this page. Doses are self-reported. Not a clinical decision tool.
      </p>
    </section>
  )
}
