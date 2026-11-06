// Shared between the client and api/summary.ts. Keep this file free of imports so the Vercel
// Function's type check does not pull in the app's path aliases.

/** What the AI pre-visit summary is allowed to see: exactly what is on the clinician's screen. */
export interface SummaryInput {
  patient: { firstName: string; age: number; sex: string; condition: string; tracker: string }
  range: { from: string; to: string; days: number; loggedDays: number; label: string }
  lastVisit?: string
  lastActivity: { overall: string; checkIn: string; dose: string; spirometry: string }
  /** One per measure the patient's data supports */
  measures: { label: string; value: string; unit?: string; tone: string; change?: string; note: string }[]
  control?: {
    label: string
    basedOnDays: number
    windowDays: number
    criteria: { text: string; met: boolean; evidence: string }[]
  }
  flags: { severity: string; text: string }[]
}

export interface SummaryResponse {
  text: string
  model: string
  generatedAt: string
}
