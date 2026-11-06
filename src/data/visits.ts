// Mock clinic schedule (stands in for Epic scheduling). Synthetic data only.
// Today's visit is 2026-11-06 for every demo patient.
export const TODAY = '2026-11-06'

export const lastVisitByPatientId: Record<string, string> = {
  'SH-1042': '2026-09-07', // Maya Robinson
  'SH-1057': '2026-08-07', // Jordan Whitfield (90 days: whole story visible)
  'SH-1063': '2026-09-07', // Sam Delgado
}
