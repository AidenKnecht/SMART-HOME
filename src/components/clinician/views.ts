// Saved views: what a clinician sees first, in what order. Presets are starting points; clinicians
// customize and save their own, per tracker, optionally pinned to one patient. Stored in
// localStorage for the prototype (would live with the portal account in production).
import { ASTHMA_TRACKER_ID, MIGRAINE_TRACKER_ID } from '@/data/trackerDefinition'
import type { Clinician } from '@/data/clinicians'

export type Panel = 'lung' | 'meds' | 'checkins'

export interface ViewConfig {
  id: string
  name: string
  /** Clinician id, or 'preset' for built-in starting points */
  ownerId: string
  description?: string
  trackerId: string
  /** Set when the view is pinned to one patient */
  patientId?: string
  /** Ordered measure keys for the summary band; the first is shown first */
  measures: string[]
  /** Ordered trend panels */
  panels: Panel[]
  /** Day-by-day table columns, in order */
  columns: string[]
}

const ASTHMA_COLUMNS = ['zone', 'q:feeling', 'q:symptoms', 'q:nightWaking', 'rescue', 'controller', 'fev1', 'q:missedSchool', 'entries']

const preset = (v: Omit<ViewConfig, 'ownerId'>): ViewConfig => ({ ...v, ownerId: 'preset' })

export const PRESETS: ViewConfig[] = [
  preset({
    id: 'preset:pulm',
    name: 'Pulmonology',
    description: 'Lung function first, then whether the controller is being taken.',
    trackerId: ASTHMA_TRACKER_ID,
    measures: ['control', 'fev1', 'adherence', 'rescue', 'zones', 'symptoms', 'school'],
    panels: ['lung', 'meds', 'checkins'],
    columns: ASTHMA_COLUMNS,
  }),
  preset({
    id: 'preset:pcp',
    name: 'Primary care',
    description: 'Control and controller use first, lung function as supporting evidence.',
    trackerId: ASTHMA_TRACKER_ID,
    measures: ['control', 'adherence', 'symptoms', 'rescue', 'school', 'fev1', 'zones'],
    panels: ['meds', 'lung', 'checkins'],
    columns: ASTHMA_COLUMNS,
  }),
  preset({
    id: 'preset:nurse',
    name: 'Nurse',
    description: 'Doses, action plan zones and day-by-day check-ins, for coaching and follow-up calls.',
    trackerId: ASTHMA_TRACKER_ID,
    measures: ['adherence', 'zones', 'control', 'rescue', 'q:nightWaking', 'school'],
    panels: ['meds', 'checkins'],
    columns: ['zone', 'q:symptoms', 'rescue', 'controller', 'q:missedSchool', 'entries'],
  }),
  preset({
    id: 'preset:gi',
    name: 'GI',
    description: 'Asthma at a glance for a visit about something else: control, controller use, school.',
    trackerId: ASTHMA_TRACKER_ID,
    measures: ['control', 'adherence', 'symptoms', 'school'],
    panels: ['meds', 'checkins'],
    columns: ['zone', 'q:symptoms', 'controller', 'q:missedSchool'],
  }),
  preset({
    id: 'preset:neuro',
    name: 'Neurology',
    description: 'Asthma at a glance for a visit about something else: control, controller use, school.',
    trackerId: ASTHMA_TRACKER_ID,
    measures: ['control', 'adherence', 'school', 'symptoms'],
    panels: ['meds', 'checkins'],
    columns: ['zone', 'q:symptoms', 'controller', 'q:missedSchool'],
  }),
  preset({
    id: 'preset:headache',
    name: 'Headache clinic',
    description: 'Headache frequency, pain and school impact first, then preventive use.',
    trackerId: MIGRAINE_TRACKER_ID,
    measures: ['q:headacheToday', 'q:painScore', 'school', 'adherence', 'rescue', 'q:hoursLasted', 'symptoms'],
    panels: ['meds', 'checkins'],
    columns: ['q:headacheToday', 'q:painScore', 'q:hoursLasted', 'q:symptoms', 'rescue', 'controller', 'q:missedSchool', 'entries'],
  }),
]

// ---------------------------------------------------------------- Storage

const VIEWS_KEY = 'smarthome.views.v1'
const ACTIVE_KEY = 'smarthome.active.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

export const loadUserViews = (): ViewConfig[] => read<ViewConfig[]>(VIEWS_KEY, [])

export function saveUserView(v: ViewConfig): ViewConfig[] {
  const all = loadUserViews().filter((x) => x.id !== v.id)
  // Only one pinned view per clinician + patient
  const cleaned = v.patientId ? all.filter((x) => !(x.ownerId === v.ownerId && x.patientId === v.patientId)) : all
  const next = [...cleaned, v]
  write(VIEWS_KEY, next)
  return next
}

export function deleteUserView(id: string): ViewConfig[] {
  const next = loadUserViews().filter((x) => x.id !== id)
  write(VIEWS_KEY, next)
  return next
}

const activeKey = (ownerId: string, trackerId: string) => `${ownerId}|${trackerId}`
export const getActiveId = (ownerId: string, trackerId: string): string | undefined =>
  read<Record<string, string>>(ACTIVE_KEY, {})[activeKey(ownerId, trackerId)]
export function setActiveId(ownerId: string, trackerId: string, id: string) {
  write(ACTIVE_KEY, { ...read<Record<string, string>>(ACTIVE_KEY, {}), [activeKey(ownerId, trackerId)]: id })
}

export function resetAllViews() {
  localStorage.removeItem(VIEWS_KEY)
  localStorage.removeItem(ACTIVE_KEY)
}

// ---------------------------------------------------------------- Resolution

/** Views a clinician can pick for this patient: presets for the tracker, then their own views. */
export function viewsFor(userViews: ViewConfig[], me: Clinician, trackerId: string, patientId: string) {
  const presets = PRESETS.filter((p) => p.trackerId === trackerId)
  const mine = userViews.filter(
    (v) => v.ownerId === me.id && v.trackerId === trackerId && (!v.patientId || v.patientId === patientId),
  )
  return { presets, mine }
}

/** Patient-pinned view, then the clinician's chosen view for this tracker, then their default preset. */
export function resolveView(userViews: ViewConfig[], me: Clinician, trackerId: string, patientId: string): ViewConfig {
  const { presets, mine } = viewsFor(userViews, me, trackerId, patientId)
  const pinned = mine.find((v) => v.patientId === patientId)
  if (pinned) return pinned
  const activeId = getActiveId(me.id, trackerId)
  const all = [...presets, ...mine.filter((v) => !v.patientId)]
  return (
    all.find((v) => v.id === activeId) ??
    presets.find((p) => p.id === me.defaultPreset[trackerId]) ??
    presets[0] ??
    PRESETS[0]
  )
}

export const sameView = (a: ViewConfig, b: ViewConfig) =>
  JSON.stringify({ ...a, id: '' }) === JSON.stringify({ ...b, id: '' })

export const newViewId = () => `view:${Date.now().toString(36)}`
