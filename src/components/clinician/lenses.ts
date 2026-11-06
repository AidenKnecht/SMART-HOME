import type { Lens } from './model'
import type { Panel } from './TrendPanels'

export interface LensDef {
  key: Lens
  label: string
  description: string
  panels: Panel[]
}

/** Same data, different emphasis. Draft: confirm with clinicians what each specialty looks for. */
export const LENSES: LensDef[] = [
  {
    key: 'pulm',
    label: 'Pulmonology',
    description: 'Lung function first, then whether the controller is being taken.',
    panels: ['lung', 'meds', 'checkins'],
  },
  {
    key: 'pcp',
    label: 'Primary care',
    description: 'Control and controller use first, lung function as supporting evidence.',
    panels: ['meds', 'lung', 'checkins'],
  },
  {
    key: 'nurse',
    label: 'Nurse',
    description: 'Doses, action plan zones and day-by-day check-ins, for coaching and follow-up calls.',
    panels: ['meds', 'checkins'],
  },
  {
    key: 'gi',
    label: 'GI',
    description: 'Asthma at a glance for a visit about something else: control, controller use, school impact.',
    panels: ['meds', 'checkins'],
  },
  {
    key: 'neuro',
    label: 'Neurology',
    description: 'Asthma at a glance for a visit about something else: control, controller use, school impact.',
    panels: ['meds', 'checkins'],
  },
]
