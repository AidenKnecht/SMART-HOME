# SMART@Home Clinician View — Hackathon Project

Cincinnati Children's x Cintrifuse Digital Health Hackathon, Fri Nov 6 2026, Union Hall.
Team: Aiden + Tommy. Full brief: `docs/SMART@Home hackathon brief.pdf` (read it if anything here is unclear).

## The challenge (one screen, not the platform)
SMART@Home is a Cincinnati Children's app where adolescents with asthma log symptoms, medication
doses, and home spirometry. The patient app works. The **clinician view** is the problem: today it
is a raw grid of every submission. We are building a **self-contained prototype** of a clinician
view a busy clinician can understand in **1–2 minutes before a visit** and **use with the patient
during the visit**. No integration with live systems. **Made-up data only, never real patient data.**

## Questions the view must answer (from clinician interviews)
1. How is the disease going? (control status, trend)
2. Is the patient taking the controller medication? (tell "not working" from "not being taken")
3. How often are symptoms happening, and how often is rescue treatment used?
4. Is lung function changing? (FEV1 / peak flow trend)
5. Is the patient following the action plan? (green / yellow / red zone days)
6. School days missed.
Also: compare over time, specialty-specific views of the same data (pulm, GI, neuro, PCP, nurse),
works for trackers other than asthma, export/download.

Consider organizing control around the GINA asthma-control questions (daytime symptoms >2x/wk,
night waking, reliever use >2x/wk, activity limitation) — confirm with clinicians first.

## Target layout (draft, adjust after clinician interviews)
- **30-second summary strip** (top): control status, controller adherence %, symptom days, rescue use,
  FEV1 trend sparkline, zone days, "what changed since last visit" flags.
- **Timeline**: one row per DAY (not per submission), symptoms + doses + spirometry + zone aligned.
- **Specialty lens toggle**: same data, different emphasis per specialist.
- **Patient mode**: big, friendly, shareable view to turn the screen toward a teen during the visit.
- **AI pre-visit summary** (optional): plain-language 3–4 sentence summary generated from the data.
- Date-range filter (last 2 wks / 30 days / since last visit), export CSV.

## Data model (mirror the real shape, see brief §3)
One nested JSON document per patient (real system: Azure Cosmos DB for MongoDB):
- `dailyLogs[]` — one per day, each with `trackerResponses[]` and `medicationAdministrations[]`
- `trackerResponses[].responses[]` — `{ questionId, value }`
- `medications[]`, `reminders[]`, `medicalDevices[]` (with `baselineReadings[]` and quality reports)
- `asthmaTreatmentPlan` (status, expiration, retest time)
- `earnedMedicationBadges[]`, `earnedTrackerBadges[]`
- Question wording lives in a separate **tracker definition**, not the patient record.

### Data quirks the prototype must handle (and show it handles — these are pitch points)
- Multiple submissions per day at irregular times (e.g. 6 entries in an hour, "Bad" then "Great"
  4 min later) → aggregate to one day; decide worst-of-day vs latest (ask clinicians).
- Many optional fields empty; blank submissions exist.
- `value` is ALWAYS a string: numbers, JSON-list strings like `'["Coughing","Tight Chest"]'`,
  or device readings. Parse by question type (yesNo, number, faceScale, icon, checkbox,
  singleChoice, scale1to10).
- Meds linked to doses by long random IDs; duplicate med names (one archived, one active).
- Doses are self-reported ("marked as taken"), not verified — label adherence honestly.
- Spirometry: FEV1 (L), FVC (L), FEV1/FVC ratio, peak flow (L/s or L/min). Each blow has
  accepted true/false + ATS/ERS quality grade + coaching messages in PascalCase
  (`KeepGoingUntilCompletelyEmpty`) → humanize. One blow may have 2 coaching messages.
- Round values sensibly (raw data has 5–6 decimals). Hide device junk (Boot Id, BT address).
- "Last day logged" must be computed from ALL data (the real portal gets this wrong).

Synthetic data: generate `src/data/` with 2–3 fictional patients over ~60–90 days, with a realistic
story (e.g. adherence drops → symptoms rise → FEV1 dips → yellow zone), plus the quirks above.

## Stack
- React + Vite + TypeScript, Tailwind, shadcn/ui, Recharts (shadcn charts).
- No backend except optionally one serverless function for the AI summary (key in env var,
  NEVER in client code or git). Always have a cached fallback summary so the demo can't fail.
- Deploy: Vercel (or Netlify) for a live demo link.

## Design principles
- Clinical tool, not a marketing site: calm, dense, scannable, high contrast, no gratuitous animation.
- Color carries meaning only (zones green/yellow/red, flags) and never alone — pair with text/icons.
- Plain clinical language, units on every number, accessible (WCAG AA).
- Use the installed skills: `frontend-design` for direction, `shadcn` for components,
  `impeccable` for audit/polish passes. Use the Context7 MCP for current library docs (Tailwind v4, shadcn, Recharts) and the Playwright MCP to screenshot and check the UI
  after each meaningful change.

## Working rules
- Plan first (plan mode) for anything non-trivial; build one section at a time.
- `git commit` after every working step so we can roll back.
- Keep the app runnable at all times — the demo matters more than any single feature.
- Timebox: demoable build by 1:00 PM, polish after. Judging from 2:30; 3-min demo + 1-min Q&A.

## Judging criteria (optimize for these)
Problem understanding & impact · Novelty (extends CCHMC tech) · Technical feasibility & depth ·
Prototype quality (working build) · Pitch clarity · Execution & judgment (scoping, use of clinician
input) · Honest Q&A · Demo effectiveness.

## Clinician notes
(Fill in during 8:40–10:30 interviews in Homeroom, 4th floor. Exact quotes are gold for the pitch.)
-
