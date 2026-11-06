# Revised Step 2 plan: derivation layer + core clinician view

## Context
`docs/plan-step2.md` (commit c7cfb01) is a good plan: a pure derivation layer, settings instead of
hard-coded clinical decisions, GINA-style control, honest "doses logged" wording, and the
"last activity" fix. I read it against the brief, the generator, the data summary numbers, and the
demo outline. It is 10:00 on hackathon day; the demoable build is due at 1:00. The plan's main risk
is **scope for the clock**, and it misses three cheap pitch wins. Below: what I'd change and why,
then the revised build order.

## What I would change (and why)

### Cut or defer (time)
1. **Defer the `scripts/summarize.ts` refactor** to after 1:00. It is a regression test judges never
   see. The derive layer gets a 10-line smoke test instead (see Verification).
2. **Drop the FEV1 sparkline inside the tile.** The big chart is 200 px below it. Tile shows value,
   % predicted, and delta arrow with text.
3. **Conflicts: ship only "Felt Great but reported Wheezing."** The "Bad → Great within the day"
   case is already visible when the row expands to show the 6 entries. One sentence of code, not a rule.

### Add (cheap, high pitch value)
4. **"Raw grid" toggle.** A table that renders the same patient exactly as the portal does today:
   one row per submission, newest first, JSON strings, blank rows, "Last day logged Nov 2". One
   toggle flips to our view. This turns demo beat 0:00–0:25 into a live before/after on the same
   data, instead of a screenshot. ~30 lines.
5. **Mark the adherence drop on the chart.** The generator has a 5–12 day lag between the dose
   drop (~Sep 20, day 45) and symptoms/FEV1. A `ReferenceLine` labelled "Controller doses fell"
   at the first week where logged doses drop below the threshold makes the causal story readable
   without narration. Detect it in `whatChanged`, don't hard-code the date.
6. **Honest denominators everywhere.** Symptom and rescue rates must say "15 of 26 logged days"
   and the GINA tile must say "based on 26 of 28 days logged". Un-logged days are not "fine";
   the plan says so for the timeline but the tiles need it too. This is the Q&A honesty point.
7. **Rescue use = union of two signals.** Tracker answer "used rescue inhaler" OR an albuterol dose
   logged. The generator plants rescue doses on days with no tracker entry (and 15% of uses never
   get a dose). Count a rescue day if either says yes; the tile footnote says "from answers + logged doses".
8. **Deploy to Vercel right after the strip renders**, not at Step 5. Proving the deploy pipeline
   at ~11:00 removes the biggest 1:00 PM failure mode. Every later `git push` redeploys.

### Correct (robustness, Q&A defensibility)
9. **Derive "controller" from `howOften === 'Daily'`, with `isController` as an override.** The brief's
   screenshot 1 shows the real medications table has How Often / Archived / Index but **no**
   `isController` field; we invented it. Using the real schema's field is a feasibility point.
10. **`localDay` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })`**, not a
    hard-coded DST date. Same result on this data, defensible on real data.
11. **Default range = "Since last visit"** with `visits.ts` set so B's last visit is 2026-08-07
    (90 days, whole story visible), A and C ~2026-09-07 (60 d). Tiles compare the range against
    the equal preceding period; when there is no preceding data show "no prior period" rather than
    a misleading delta. (With 30 d default, B's "before" period straddles the drop and the delta
    looks mild.)

### Restructure the chart (simpler and tells the story better)
12. **Three synced small panels + a zone strip, not one ComposedChart.** Recharts `syncId` keeps
    tooltips aligned. Top: FEV1 best accepted per session (line, dotted 80%-predicted reference).
    Middle: controller adherence as 7-day rolling % (area) — daily 0/1/2 bars over 90 days are noise;
    the rolling line shows the cliff. Bottom: symptom days and rescue days as dot rows. Under the
    x-axis: a plain flex row of per-day cells coloured by zone **with a G/Y/R text legend**, no
    Recharts. That zone strip is reused as-is in Patient mode (Step 4), so it's not extra work.

### Prepare for Step 3 now (zero cost)
13. **Tiles are data, not JSX.** `SummaryStrip` renders from a `tiles: TileDef[]` array where each
    tile has `lenses: Lens[]` and an `order`. Step 3 (lens toggle) becomes a filter + sort. Define
    `Lens = 'pulm' | 'pcp' | 'nurse' | 'gi' | 'neuro'` now; only `pulm` is wired in Step 2.

### Keep as written
Derive layer shape, `buildDays` with `status: 'none' | 'blank-only' | 'logged'`, worst/latest as a
setting, `THRESHOLDS` object, `lastActivity` breakdown, `humanizeCode`, timeline columns and
expand-to-entries, zone colour tokens always paired with text, shadcn component list.

## Revised roadmap
| Step | What | Target |
|---|---|---|
| 0 | Update `docs/plan-step2.md` with the changes above, commit | 10:10 |
| 2a | `src/lib/derive.ts` + `src/data/visits.ts` + smoke test | 10:40 |
| 2b | Header + summary strip + flags; **deploy to Vercel** | 11:10 |
| 2c | Trend panels + zone strip | 11:40 |
| 2d | Daily timeline + raw-grid toggle | 12:05 |
| 3 | Lens toggle (filter/sort the tile array, chart panel order) | 12:25 |
| 4 | Patient mode (zone strip + 3 big numbers + streaks/badges) | 12:50 |
| 5 | CSV export, final push, **demoable by 1:00** | 1:00 |
| 6 | AI pre-visit summary with cached fallback, `impeccable` pass, clinician quotes, summarize.ts refactor | after 1:00 |

Commit after each sub-step. If 2c runs past 11:50, ship the FEV1 panel alone and move on.

## Step 2 build detail

### 2a. `src/lib/derive.ts` (pure TS, relative imports only, no React)
Reuses `getQuestion`, `parseValue`, `trackerDefinitions` from `src/data/trackerDefinition.ts`
and the blank/parse logic currently in `scripts/summarize.ts` (`parseSubmission`, `isBlank`).

- `localDay(iso)` via Intl America/New_York.
- `isControllerMed(m)`: `m.isController ?? m.howOften === 'Daily'`.
- `buildDays(doc, { from, to, dayRule })` → `DaySummary[]`, one per calendar day incl. empty days:
  `status`, `entries[]` (time + parsed answers + zone), `feeling`, `symptoms[]`, `nightWaking`,
  `rescueAnswer`, `rescueDoses`, `rescueAny`, `activityLimit`, `missedSchool`, `zone`,
  `controllerDoses` (0–2, via `isControllerMed`, covers archived duplicate), `spirometry`
  (best accepted blow per day: fev1/fvc/ratio 2 dp, pef integer L/min, pctPredicted, pctPersonalBest,
  acceptedCount, rejectedCount, coaching messages humanized), `conflict?: string`.
- `summarizeRange(days)` → counts and rates with `loggedDays`, `daysInRange`; adherence
  `loggedDoses / (2 × daysInRange)`; rescue days from `rescueAny`; FEV1 first-week vs last-week mean.
- `ginaControl(days)` over the last 28 days: 4 criteria, each `{ met, text, evidence }`, level
  `well | partly | not`, plus `basedOnDays`.
- `whatChanged(current, previous, doc)` → `Flag[]` from `THRESHOLDS`; includes
  `adherenceDropDay` for the chart annotation, plan retest overdue, tracker silent while doses continue.
- `lastActivity(doc)` → `{ overall, tracker, dose, spirometry }`.
- `rollingAdherence(days, 7)` for the chart.
- `rawRows(doc)` → portal-style rows for the raw grid (submission time, each question's raw string).
- `humanizeCode`.
- `src/data/visits.ts`: `{ [patientId]: lastVisitDate }`.
- Smoke test: `scripts/check-derive.ts` prints B's adherence by half, FEV1 delta, zone counts;
  must match today's `summarize.ts` output (92%/36%, −17.7%, 13/16/2).

### 2b. Header, strip, flags
shadcn add: `tabs toggle-group select badge tooltip table separator popover`. Load `frontend-design`
and `dataviz` skills first; add `--zone-green/yellow/red` tokens to `src/index.css`.
- `PatientHeader.tsx`: picker (B default), name/age/ID/tracker, "Last activity" with breakdown
  tooltip, range toggle (Since last visit / 30 d / 14 d / 90 d), settings popover (worst | latest),
  **Clinician view | Raw grid** toggle.
- `SummaryStrip.tsx` driven by `tiles.ts` (`TileDef[]` with `lenses`). Tiles: Control (GINA-style,
  criteria listed on hover) · Controller doses logged % ("self-reported") · Symptom days
  ("15 of 26 logged days") · Rescue days (answers + doses) · FEV1 (best, % predicted, delta) ·
  Zone days (G/Y/R counts + text) · School days missed. Each tile: value, unit, delta vs prior
  period or "no prior period", one plain-language line.
- `ChangeFlags.tsx`: severity-ordered, icon + text.
- Deploy: `vercel --prod` (or `vercel link` then push); note the URL in `docs/demo-outline.md`.

### 2c. `TrendPanels.tsx`
Three Recharts charts with `syncId="days"` and identical x domain; `ReferenceLine` at
`adherenceDropDay`; `ZoneStrip.tsx` as a flex row of day cells (title attribute = date + zone,
legend with text). Tooltips show units.

### 2d. `DailyTimeline.tsx` + `RawGrid.tsx`
Timeline: one row per day newest first, columns as in the original plan, "6 entries · worst shown"
expands to raw entries with times; "Started, no answers" and "No entry" states.
Raw grid: `rawRows(doc)` in a plain table with the portal's two header numbers, including the
wrong "last day logged" so the contrast is honest.

## Verification
1. `node scripts/check-derive.ts` matches the summarize.ts numbers above.
2. `npm run build` and `npx oxlint src scripts` clean.
3. Playwright at 1440×900 per patient:
   - B: Control "Not well controlled (4 of 4)", adherence ~35% with down flag and "was 92%",
     FEV1 ~2.6 L (72% predicted) with −18% delta, zone 5/13/2, chart annotation near Sep 20,
     "Last activity Nov 5 (tracker Nov 2)".
   - A: "Well controlled", no red flags, "no prior period" never shows for 90 d.
   - C: adherence ~93% **and** "Not well controlled" with plan expiring Nov 20 flag.
   - Worst↔latest toggles Oct 19 (B) zone; raw grid shows 6 rows on Oct 19 with JSON strings.
4. Console clean; live Vercel URL loads.
