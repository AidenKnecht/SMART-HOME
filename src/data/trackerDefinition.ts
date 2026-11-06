// Tracker definitions. Question wording and types live here; patient records only hold
// question IDs and string values (like the real SMART@Home system). Any tracker
// (asthma, migraine, IBD...) uses the same structure, so the clinician view can be
// driven by question types instead of hard-coded asthma logic.

import type { Question, TrackerDefinition } from './types.ts'

export const ASTHMA_TRACKER_ID = 'b3f1c2d4-7a8e-4f61-9c2b-5e0a1d7f3c88'
export const MIGRAINE_TRACKER_ID = 'e8a24f10-3b6c-4d9e-a1f7-62c0b9d84e15'

export const asthmaTracker: TrackerDefinition = {
  id: ASTHMA_TRACKER_ID,
  name: 'Asthma Tracker',
  condition: 'Asthma',
  version: 3,
  questions: [
    {
      id: '4f2a9c1e-0b7d-4e38-a5c6-91d3e7f20b4a',
      key: 'spirometry',
      text: 'Please complete your spirometer reading',
      shortLabel: 'Spirometry',
      type: 'spirometry',
      required: false,
    },
    {
      id: '9d61b8e3-25fa-4c07-8e4b-3a7f0c19d652',
      key: 'feeling',
      text: 'How are you feeling today?',
      shortLabel: 'Feeling',
      type: 'faceScale',
      required: true,
      options: [
        { value: 'Great', label: 'Great', severity: 0 },
        { value: 'Good', label: 'Good', severity: 1 },
        { value: 'Okay', label: 'Okay', severity: 2 },
        { value: 'Bad', label: 'Bad', severity: 3 },
        { value: 'Awful', label: 'Awful', severity: 4 },
      ],
    },
    {
      id: 'c27e4a90-6d13-4b5f-b8a2-0f9e6c3d7a1b',
      key: 'symptoms',
      text: 'Please select the following symptoms that you are currently experiencing',
      shortLabel: 'Symptoms',
      type: 'checkbox',
      required: true,
      // The real export has a trailing space on "None of these ". Kept on purpose.
      noneValue: 'None of these ',
      options: [
        { value: 'Coughing', label: 'Coughing' },
        { value: 'Wheezing', label: 'Wheezing' },
        { value: 'Tight Chest', label: 'Tight chest' },
        { value: 'Shortness Of Breath', label: 'Shortness of breath' },
        { value: 'Activity limitations', label: 'Activity limitations' },
        { value: 'None of these ', label: 'None' },
      ],
    },
    {
      id: '1a8f3d72-c94b-4e06-92d1-7b5e0a6f4c3d',
      key: 'nightWaking',
      text: 'Did you wake up during the night because of your asthma?',
      shortLabel: 'Night waking',
      type: 'yesNo',
      required: true,
    },
    {
      id: '6e0b5c48-1f27-4a9d-bc63-d8a4e2f19075',
      key: 'rescueUsed',
      text: 'Did you use your rescue inhaler (albuterol) today?',
      shortLabel: 'Rescue inhaler used',
      type: 'yesNo',
      required: true,
    },
    {
      id: 'f53c7e19-8a0d-4b62-a47e-2c91b6d0e8f3',
      key: 'rescuePuffs',
      text: 'How many puffs of your rescue inhaler did you take today?',
      shortLabel: 'Rescue puffs',
      type: 'number',
      required: false,
      unit: 'puffs',
      min: 0,
      max: 20,
    },
    {
      id: '0d94a6b2-37e8-4c1f-9a05-e6b3f8c27d41',
      key: 'missedSchool',
      text: 'Did you miss school today because of your asthma?',
      shortLabel: 'Missed school',
      type: 'yesNo',
      required: true,
    },
    {
      id: '8b27f0d5-4c96-4e3a-b1d8-5f0e9a7c6b24',
      key: 'activityLimit',
      text: 'How much did your asthma limit your activities today?',
      shortLabel: 'Activity limitation',
      type: 'singleChoice',
      required: false,
      options: [
        { value: 'Not at all', label: 'Not at all', severity: 0 },
        { value: 'A little', label: 'A little', severity: 1 },
        { value: 'A lot', label: 'A lot', severity: 2 },
      ],
    },
    {
      id: '3c5e8a17-b2f4-4d90-86e1-a9c0d4b7f562',
      key: 'triggers',
      text: 'Tap anything that might have set off your asthma today',
      shortLabel: 'Possible triggers',
      type: 'icon',
      required: false,
      options: [
        { value: 'Exercise', label: 'Exercise' },
        { value: 'Cold Air', label: 'Cold air' },
        { value: 'Pollen', label: 'Pollen' },
        { value: 'Smoke', label: 'Smoke' },
        { value: 'Pets', label: 'Pets' },
        { value: 'Cold Or Flu', label: 'Cold or flu' },
      ],
    },
    {
      id: 'a71d2e94-5f08-4b3c-9e67-c0f4b8a3d215',
      key: 'breathingScore',
      text: 'On a scale of 1 to 10, how hard was it to breathe today?',
      shortLabel: 'Breathing difficulty',
      type: 'scale1to10',
      required: false,
      min: 1,
      max: 10,
    },
  ],
}

/** Second tracker: proves the structure is condition-agnostic. No patient data uses it yet. */
export const migraineTracker: TrackerDefinition = {
  id: MIGRAINE_TRACKER_ID,
  name: 'Migraine Tracker',
  condition: 'Migraine',
  version: 1,
  questions: [
    {
      id: '5b9e1c06-d4a7-4f28-8c3e-71a0f6b2d9e4',
      key: 'headacheToday',
      text: 'Did you have a headache today?',
      shortLabel: 'Headache',
      type: 'yesNo',
      required: true,
    },
    {
      id: 'd2f86a3b-09c1-4e75-a6d4-8e3b1c0f7a59',
      key: 'painScore',
      text: 'On a scale of 1 to 10, how bad was the pain at its worst?',
      shortLabel: 'Pain (worst)',
      type: 'scale1to10',
      required: false,
      min: 1,
      max: 10,
    },
    {
      id: '7e40c9d1-6a2b-4f83-b05e-c4d9a1e86f37',
      key: 'symptoms',
      text: 'Which of these did you have with your headache?',
      shortLabel: 'Associated symptoms',
      type: 'checkbox',
      required: false,
      noneValue: 'None of these',
      options: [
        { value: 'Nausea', label: 'Nausea' },
        { value: 'Light Sensitivity', label: 'Light sensitivity' },
        { value: 'Sound Sensitivity', label: 'Sound sensitivity' },
        { value: 'Aura', label: 'Aura' },
        { value: 'None of these', label: 'None' },
      ],
    },
    {
      id: 'b18a5f27-e3c0-4d96-9f12-0a7d6e4c8b53',
      key: 'hoursLasted',
      text: 'How many hours did the headache last?',
      shortLabel: 'Duration',
      type: 'number',
      required: false,
      unit: 'hours',
      min: 0,
      max: 72,
    },
    {
      id: '2c63e8f0-a95d-4b17-83c4-f6b0d2a9e715',
      key: 'missedSchool',
      text: 'Did you miss school today because of a headache?',
      shortLabel: 'Missed school',
      type: 'yesNo',
      required: true,
    },
  ],
}

export const trackerDefinitions: Record<string, TrackerDefinition> = {
  [asthmaTracker.id]: asthmaTracker,
  [migraineTracker.id]: migraineTracker,
}

export function getQuestion(trackerId: string, questionId: string): Question | undefined {
  return trackerDefinitions[trackerId]?.questions.find((q) => q.id === questionId)
}

export function questionByKey(tracker: TrackerDefinition, key: string): Question {
  const q = tracker.questions.find((x) => x.key === key)
  if (!q) throw new Error(`No question "${key}" in tracker ${tracker.name}`)
  return q
}

/** Parse a raw string value according to its question type. */
export function parseValue(q: Question, raw: string): string | number | boolean | string[] | null {
  const v = raw.trim()
  if (v === '') return null
  switch (q.type) {
    case 'yesNo':
      return /^(yes|true|1)$/i.test(v)
    case 'number':
    case 'scale1to10': {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    case 'checkbox':
    case 'icon': {
      try {
        const arr: unknown = JSON.parse(raw)
        return Array.isArray(arr) ? arr.map(String) : [String(arr)]
      } catch {
        return [raw]
      }
    }
    default:
      return raw
  }
}
