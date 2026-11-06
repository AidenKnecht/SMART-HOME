// Mock clinicians (stand-ins for portal accounts). Fictional people.
import { ASTHMA_TRACKER_ID, MIGRAINE_TRACKER_ID } from './trackerDefinition.ts'

export interface Clinician {
  id: string
  name: string
  role: string
  /** Preset view id to start from, per tracker */
  defaultPreset: Record<string, string>
}

export const clinicians: Clinician[] = [
  {
    id: 'c-okafor',
    name: 'Dr. Okafor',
    role: 'Pulmonology',
    defaultPreset: { [ASTHMA_TRACKER_ID]: 'preset:pulm', [MIGRAINE_TRACKER_ID]: 'preset:headache' },
  },
  {
    id: 'c-lin',
    name: 'Dr. Lin',
    role: 'Primary care',
    defaultPreset: { [ASTHMA_TRACKER_ID]: 'preset:pcp', [MIGRAINE_TRACKER_ID]: 'preset:headache' },
  },
  {
    id: 'c-reyes',
    name: 'Nurse Reyes',
    role: 'Nurse care manager',
    defaultPreset: { [ASTHMA_TRACKER_ID]: 'preset:nurse', [MIGRAINE_TRACKER_ID]: 'preset:headache' },
  },
]
