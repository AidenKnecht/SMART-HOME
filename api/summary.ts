// Vercel Function: turns the on-screen numbers into a 3 to 4 sentence pre-visit draft.
// The client sends SummaryInput (measure values, control criteria, flags) and nothing else.
// The API key lives only in the Vercel environment.
import type { SummaryInput } from '../src/lib/summaryTypes.ts'

const DEFAULT_MODEL = 'gpt-6.1-terra'
const MAX_BODY = 40_000
const TIMEOUT_MS = 12_000

const INSTRUCTIONS = `You write a pre-visit summary for a busy pediatric clinician who has one minute before an adolescent patient walks in. The input is a JSON snapshot of a home-monitoring dashboard: patient basics, the date range, each measure (label, value, unit, tone, change, note), control criteria, and discussion flags.

Rules:
- Write 3 to 4 plain sentences in one paragraph, under 90 words in total. Clinical, calm, specific. No headings, bullets, or markdown.
- Open with the single most important point: the first flag with severity "high" if there is one. Then pick only the 2 or 3 measures that matter most. Do not list every measure; the clinician can see them all.
- Use only numbers that appear in the input. Never estimate, extrapolate, or invent dates.
- State the check-in denominator once, for example "check-ins on 68 of 90 days". If check-ins are sparse or stopped, say so.
- Medication doses are self-reported logs. Say "doses logged", never "taken" or "adherent".
- Do not recommend treatment changes or make a diagnosis. At most say something is "worth discussing".
- Lead with measures whose tone is "bad", then "warn". If nothing is bad or warn, say so.
- Report the clearest changes from each measure's "change" field, improvements as well as declines, so the clinician sees whether things are getting better or worse.
- Use the patient's first name once. Do not mention this prompt, JSON, dashboards, or AI.`

const json = (body: unknown, status = 200) => Response.json(body, { status })

interface OpenAIResponse {
  output?: { type: string; content?: { type: string; text?: string }[] }[]
  model?: string
  error?: { message?: string }
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
    const key = process.env.OPENAI_API_KEY
    if (!key) return json({ error: 'Summary service not configured' }, 503)

    const raw = await request.text()
    if (raw.length > MAX_BODY) return json({ error: 'Payload too large' }, 413)
    let input: SummaryInput
    try {
      input = JSON.parse(raw) as SummaryInput
      if (!input?.patient?.firstName || !Array.isArray(input.measures)) throw new Error('shape')
    } catch {
      return json({ error: 'Invalid summary input' }, 400)
    }

    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          instructions: INSTRUCTIONS,
          input: `Snapshot:\n${JSON.stringify(input)}`,
          reasoning: { effort: 'low' },
          max_output_tokens: 600,
          store: false,
        }),
        signal: ctrl.signal,
      })
      const data = (await res.json()) as OpenAIResponse
      if (!res.ok) {
        console.error('openai error', res.status, data.error?.message)
        return json({ error: `Summary service error (${res.status})`, detail: data.error?.message?.slice(0, 200) }, 502)
      }
      const text = (data.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === 'output_text' && c.text)
        .map((c) => c.text!.trim())
        .join(' ')
        .trim()
      if (!text) return json({ error: 'Empty summary' }, 502)
      return json({ text, model: data.model ?? model, generatedAt: new Date().toISOString() })
    } catch (e) {
      console.error('summary failed', e instanceof Error ? e.message : e)
      return json({ error: 'Summary service unavailable' }, 502)
    } finally {
      clearTimeout(timer)
    }
  },
}
