// Shapes mirror the real SMART@Home Cosmos DB patient document (brief §3).
// All data in this repo is synthetic. Never put real patient data here.

// ---------- Tracker definitions (question wording lives here, not in patient records) ----------

export type QuestionType =
  | 'yesNo'
  | 'number'
  | 'faceScale'
  | 'icon'
  | 'checkbox'
  | 'singleChoice'
  | 'scale1to10'
  | 'spirometry'

export interface QuestionOption {
  value: string // exact string stored in responses[].value
  label: string // display label
  /** Optional ordinal for ranking answers (higher = worse), e.g. face scale */
  severity?: number
}

export interface Question {
  id: string // opaque ID, as stored in patient records
  key: string // readable code name used by the app
  text: string // full wording shown to the patient
  shortLabel: string // compact clinician-facing label
  type: QuestionType
  required: boolean
  options?: QuestionOption[]
  unit?: string
  min?: number
  max?: number
  /** Option value meaning "none" for checkbox questions */
  noneValue?: string
}

export interface TrackerDefinition {
  id: string
  name: string
  condition: string
  version: number
  questions: Question[]
}

// ---------- Patient document ----------

export type Zone = 'green' | 'yellow' | 'red'

export interface TrackerAnswer {
  questionId: string
  value: string // ALWAYS a string: numbers, JSON lists, "Yes"/"No", ""
}

export interface TrackerResponse {
  id: string
  trackerId: string
  submittedAt: string // ISO UTC
  /** App-computed action-plan zone at submission time (absent on blank submissions) */
  actionPlanZone?: Zone
  responses: TrackerAnswer[]
}

export interface MedicationAdministration {
  id: string
  medicationId: string // long random ID linking to medications[].id
  administeredAt: string // ISO UTC, self-reported "marked as taken"
  value: string // "1"
}

export interface DailyLog {
  id: string
  day: string // YYYY-MM-DD (local)
  /** Ambiguous flag copied from the real export; not a reliable adherence signal */
  allMedicationsAdministered: boolean
  trackerResponses: TrackerResponse[]
  medicationAdministrations: MedicationAdministration[]
}

export interface Medication {
  id: string
  name: string
  genericName: string
  dosage: { amount: number; unit: string; strength: string }
  howOften: 'Daily' | 'As Needed'
  timesPerDay: number | null
  icon: string
  relatedCondition: string
  isController: boolean
  archived: boolean
  index: number
  startDate: string
}

export interface Reminder {
  id: string
  medicationId: string
  time: string // HH:mm local
  daysOfWeek: number[] // 0=Sun
  enabled: boolean
}

export interface QualityIndication {
  code: string // PascalCase coaching message, e.g. KeepGoingUntilCompletelyEmpty
}

export interface QualityReport {
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  status: string // device status string, e.g. "NotAcceptable" (unreliable, quirk)
  qualityIndications: QualityIndication[]
}

export interface BaselineReading {
  id: string
  sessionId: string
  readingDate: string // ISO UTC
  accepted: boolean
  fev1: number // L
  fvc: number // L
  fev1FvcRatio: number // 0-1
  pef: number // L/min
  fef2575: number // L/s
  fet: number // s, forced expiratory time
  qualityReport: QualityReport
}

export interface MedicalDevice {
  id: string
  protocol: string
  address: string // Bluetooth address (junk for clinicians)
  bootId: string
  serialNumber: string
  deviceType: number
  atsStandard: number
  name: string
  advertisedName: string
  baselineReadingDate: string
  baselineReadings: BaselineReading[]
}

export interface AsthmaTreatmentPlan {
  status: 'Active' | 'Expired' | 'Draft'
  createdDate: string
  expirationDate: string
  retestTime: string // ISO date when spirometry retest / plan review is due
  personalBestPef: number // L/min
  predictedFev1: number // L
  zoneThresholds: { greenMinPctPersonalBest: number; yellowMinPctPersonalBest: number }
}

export interface EarnedBadge {
  badgeName: string
  date: string // ISO UTC
}

export interface PatientDocument {
  id: string
  patientId: string
  firstName: string
  lastName: string
  dob: string
  age: number
  sex: 'F' | 'M'
  enrolledDate: string
  assignedTrackerIds: string[]
  dailyLogs: DailyLog[]
  medications: Medication[]
  reminders: Reminder[]
  medicalDevices: MedicalDevice[]
  asthmaTreatmentPlan: AsthmaTreatmentPlan
  earnedMedicationBadges: EarnedBadge[]
  earnedTrackerBadges: EarnedBadge[]
}
