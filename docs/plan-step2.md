# Plan: Step 2: Data layer + core clinician view (summary strip, trend chart, daily timeline)

> **For the Claude Code session building this:** read `CLAUDE.md` first, then this file, then
> `src/data/types.ts`, `src/data/trackerDefinition.ts`, `scripts/generate.ts` and `scripts/summarize.ts`.
> Build Step 2 one piece at a time and commit after each working piece. If the "Clinician notes" in
> `CLAUDE.md` have answers (worst vs latest, thresholds), use them as the defaults.

## Context
Step 1 is done (commit `1ec9326`): app scaffold, tracker definitions, 3 seeded patients, and
`scripts/summarize.ts` proving the stories. The next step is to make the data *visible*: the
"understand it in 1–2 minutes" screen that answers the brief's core questions. This is the heart of
the 1:00 PM demo (demo-outline beat 0:40–1:40: "adherence dropped → symptoms rose → FEV1 dipped").

Clinician interviews are running now (8:40–10:30), so decisions they may change are **settings,
not hard-coded**: worst-of-day vs latest entry, the adherence threshold, flag thresholds. When
Tommy's notes arrive, we change defaults only.

## Roadmap (only Step 2 is detailed below)
| Step | What | Target |
|---|---|---|
| **2** | Derivation layer + core view: header, summary strip, "what changed" flags, trend chart, daily timeline | ~11:15 |
| 3 | Specialty lens toggle (Pulm / PCP / Nurse / GI / Neuro), which reorders and filters the same tiles | ~11:45 |
| 4 | Patient mode: big, friendly "your month" view for the teen | ~12:30 |
| 5 | CSV export, deploy to Vercel, **demoable build by 1:00** | 1:00 |
| 6 | AI pre-visit summary (serverless + cached fallback), `impeccable` polish pass, apply clinician quotes | after 1:00 |

## 2a. Derivation layer: `src/lib/derive.ts` (pure TS, no React, no `@/` alias)
Keeping it alias-free lets `scripts/summarize.ts` import it too, so the script becomes a free
regression test of the exact logic the UI uses. Logic to move out of `scripts/summarize.ts`:
`dateOnly` (local-day), the blank check, and the per-submission parsing.

- `localDay(iso)`: Cincinnati calendar day (DST-aware, as in summarize).
- `buildDays(doc, opts: { dayRule: 'worst' | 'latest' }) → DaySummary[]` has one entry per calendar
  day in the window, **including days with no data** (`status: 'none' | 'blank-only' | 'logged'`):
  - `entries` (raw submissions, parsed through `getQuestion`/`parseValue` from `src/data/trackerDefinition.ts`), `entryCount`
  - Aggregated per `dayRule`: `feeling`, `symptoms[]`, `nightWaking`, `rescueUsed`, `activityLimit`, `missedSchool`, `zone`
  - `controllerDoses` (0–2, linked by `medicationId` → `isController`, which **covers the archived duplicate**), `rescueDoses`
  - `spirometry`: best *accepted* FEV1 / FVC / ratio / PEF (rounded to 2 dp; PEF to integer L/min), `% predicted`, `% personal best`,
    accepted/rejected counts, humanized coaching messages
  - `conflicts`: e.g. `"Felt Great but reported Wheezing"`, `"Changed answer within the day (Bad → Great)"`
- `summarizeRange(days, from, to) → RangeStats`: controller adherence %, symptom days/wk, rescue
  days/wk, night-waking days, school days missed, zone counts, FEV1 latest / mean / slope,
  days logged vs days in range.
- `ginaControl(days, last 28 days)`: the 4 GINA questions (daytime symptoms >2/wk, any night waking,
  reliever >2/wk, any activity limitation) → *Well / Partly / Not well controlled*, labelled
  "GINA-style, from home data", with the 4 criteria listed so it's transparent.
- `whatChanged(days, current range, previous equal range, plan) → Flag[]` with thresholds kept in one
  `THRESHOLDS` object: adherence drop ≥20 points, FEV1 drop ≥10%, rescue use up ≥2 days/wk, any red day,
  plan retest overdue or plan expiring <30 days, tracker silent while other data continues.
- `lastActivity(doc)`: the latest of tracker / dose / spirometry, each also shown separately. Fixes the portal bug.
- `humanizeCode('KeepGoingUntilCompletelyEmpty') → 'Keep going until completely empty'`.
- Small mock `src/data/visits.ts` holds each patient's last clinic visit date (stands in for Epic scheduling), used for the "Since last visit" range.

## 2b. UI (load the `frontend-design` + `dataviz` skills first; add shadcn: tabs, toggle-group, select, badge, tooltip, table, separator, popover)
Visual direction: calm clinical tool, light theme, dense and scannable, tabular numerals, units on
every number. Zone colors are added as tokens in `src/index.css` (`--zone-green/yellow/red`) and
**always paired with a text label or icon**.

Files: `src/App.tsx` (state: patient, range, dayRule), `src/components/clinician/` holding:
- `PatientHeader.tsx`: patient picker (B default), name / age / ID / tracker, **"Last activity Nov 5"**
  with a hover breakdown (tracker Nov 2 · doses Nov 5 · spirometry Nov 5), range toggle
  (14 d / 30 d / 90 d / Since last visit), and a settings popover for "Daily answer: Worst of day | Latest entry".
- `SummaryStrip.tsx`: 7 compact tiles, each showing a value, a unit, the change vs the previous period, and a plain-language line:
  Control (GINA-style) · Controller doses **logged** % ("self-reported") · Symptom days/wk · Rescue days/wk ·
  FEV1 (latest best, % predicted, sparkline) · Zone days (G/Y/R stacked bar with counts) · School days missed.
- `ChangeFlags.tsx`: a row of flags from `whatChanged` (icon + text, severity order).
- `TrendChart.tsx`: one Recharts chart over a shared x-axis, which is the demo money shot: FEV1 best per session (line,
  dotted 80%-predicted reference) on top, daily controller doses (0/1/2 bars) below, and zone band behind.
  Tooltip shows the day's values with units.
- `DailyTimeline.tsx`: one row per day, newest first, scrollable. Columns: Date · Zone · Feeling ·
  Symptoms (chips, not JSON) · Night · Rescue (answer + doses) · Controller AM/PM dots · FEV1 · School ·
  Entries. A row with several entries shows "6 entries · worst shown" and expands to the raw entries with
  times. Blank-only days show "Started, no answers"; days with no data show "No entry", which is **not treated as "fine"**.

## 2c. Wiring
- `scripts/summarize.ts` is refactored to import from `src/lib/derive.ts` (its output stays the same).
- Commit after each working piece: derive layer → header + strip → chart → timeline.

## Verification
1. `npm run gen:data` prints the same story numbers as before (the derivation refactor didn't change results).
2. `npm run build` + `npx oxlint src scripts` are clean.
3. `npm run dev`, then use Playwright MCP to screenshot at 1440×900 for each patient:
   - B: adherence tile 92%→~35% with a down flag, FEV1 about −18%, yellow/red counts, flags list the drop; the chart shows doses falling before FEV1.
   - A: everything green and calm, no alarming flags.
   - C: adherence ~95% **and** "Not well controlled", which shows treatment not working.
   - Switching worst↔latest changes Oct 19 (B) from yellow to green in the timeline and zone counts.
   - "Last activity" shows Nov 5 for B, not Nov 2.
4. Check the console for errors via Playwright.
