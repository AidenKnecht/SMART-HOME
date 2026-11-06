# Handoff: state of the build at 11:40 AM, Nov 6

Read `CLAUDE.md` first (brief, data quirks, clinician quotes). This file holds what you can't get from
the code or the git log. Live: https://smart-home-kit.vercel.app (Vercel project `smart-home-kit`;
deploy with `vercel --prod --yes` from the repo root; deploys are manual, so redeploy after merging).

Update 12:05: the AI pre-visit summary is live (see Next steps 1).

**Two Claude sessions have been committing to `main` in parallel** (one built views/customize, the
other built widgets/detail panel). Always `git pull` first and check `git log` before planning.

## What exists (all on main and pushed; verified in Playwright at 1440×900)
- **Data**: 4 synthetic patients in `src/data/patients/`, regenerated deterministically by
  `npm run gen:data` (`scripts/generate.ts`). A/B/C are asthma; D (Priya Nair, SH-1071) is the
  migraine tracker. B = Jordan Whitfield is the demo story (controller doses fall Sep 25 → symptoms,
  rescue, night waking rise → FEV1 −17.6%, 2 red days, retest overdue). C = Sam Delgado is "taking it
  (94%) but not controlled". A = Maya Robinson is the calm control. D's story: topiramate 25→50 mg on
  Sep 17 (archived + active entries, same name) → headache days 3.1→1.9/wk, pain 7.1→4.9.
- **Derivation layer** `src/lib/derive.ts` (pure TS, relative imports): `patientContext`, `buildDays`
  (one `DaySummary` per calendar day incl. empty days; `answers` aggregates every question by type and
  day rule), `summarizeRange`, `halves`, `ginaControl`, `questionStats`, `whatChanged` (flags with
  `measure` link; thresholds in `THRESHOLDS`), `rollingAdherence`, `adherenceDropDay`, `lastActivity`
  (fixes the portal's wrong "last day logged"), `rawRows`/`portalHeader` (the "before" grid),
  `daysToCsv`. `scripts/check-derive.ts` prints the key numbers; `scripts/summarize.ts` is an
  independent implementation used as the regression check. Run both after any derive change.
- **UI** `src/components/clinician/`:
  - `PatientHeader`: "Viewing as" clinician picker, patient picker, Last activity with breakdown,
    range toggle, Settings popover (worst/latest day rule; Reset all saved views), Export CSV,
    screen toggle Clinician view / Show patient / Portal today.
  - `SummaryStrip` + `tiles.tsx` + `Sparkline.tsx`: widget grid. Each measure has a tone bar, value,
    "was/now" change, sparkline or day dots (`viz`), note. A count line says how many need attention.
    Measure library = built-ins with `available()` guards + one auto tile per uncovered tracker question
    (`questionTile`, rendered by question type). Clicking a widget opens the detail panel.
  - `MeasureDetail`: side sheet per measure. Big chart, measure-specific evidence (blows incl.
    rejected, medication records incl. archived duplicate, top symptoms, plan dates, value chart for
    numeric questions), day-by-day filtered to that measure's columns, link to All data.
  - `ChangeFlags`: "What to discuss today", top 6 + show more; flags with a `measure` open the detail.
  - `TrendPanels`: FEV1 line (80% predicted ref), rolling adherence area (drop marker + dose-change
    marker), check-in dot rows generated from the tracker's yes/no questions, zone strip; synced by
    `syncId`. Lung/zone parts guard on device + plan.
  - `DailyTimeline` (column-driven via `columnsFor`; collapsed `<details>` by default in App),
    `AllData` (collapsed; every answer / blow / med / badge, tabs), `CustomizeView` (fixed aside, live
    preview, ordered pickers), `PatientMode` (teen-facing calendar; zones for asthma, main yes/no
    symptom + scale for other trackers; story sentence for adherence drop or dose change),
    `PortalGrid` (recreates today's portal), `Zone.tsx` (pill + fills).
- **Views** `views.ts`: `ViewConfig { measures[], panels[], columns[], trackerId, patientId? }`.
  6 presets (pulm, pcp, nurse, gi, neuro, headache). Saved views in `localStorage['smarthome.views.v1']`,
  active choice in `smarthome.active.v1`. Resolution: patient-pinned → clinician's chosen view for the
  tracker → clinician's default preset (`src/data/clinicians.ts`: Okafor pulm, Lin pcp, Reyes nurse).
  `App.tsx` holds draft state so the dashboard updates live while customizing.

## Decisions already made (don't relitigate without new clinician input)
- Default day rule = worst of day; "latest" is a setting. Clinicians were not asked this directly.
- Controller = `isController ?? howOften === 'Daily'` (the real schema has no controller flag).
- Rescue day = tracker answer OR a logged rescue dose. Rates always state the logged-day denominator.
- Default range = Since last visit (`src/data/visits.ts`; B and D = Aug 7, i.e. 90 days).
- "Doses logged", never "taken". FEV1 from accepted blows only. Device junk fields never shown.
- Colour never alone: every tone has an icon and a word. Grey = not enough data, not "fine".
- Widgets keep the clinician's saved order; they are not re-sorted by urgency (clinicians weigh
  things differently). The attention count line covers urgency.
- Symptom-day red tone (>2 days/wk) is GINA's and applies to asthma only.
- `asthmaTreatmentPlan` is optional on the document; every lung/zone feature guards on it.
- Public Sans, cool-neutral palette, zone tokens in `src/index.css`.

## Known gaps / rough edges
- Views live in the browser. Demo on the rehearsed laptop; Settings → Reset all saved views first.
- Presets are our guesses; no clinician has validated them.
- `CustomizeView` is a fixed-position aside, not the shadcn Sheet (installed, unused there).
- No automated tests beyond `check-derive.ts`. Lint warnings are only shadcn fast-refresh notices.
- Bundle ~1 MB (Recharts); Vite warns, harmless for the demo.
- Patient-mode story sentence covers two cases only (adherence drop; dose change with archived
  duplicate). Other patients show none.
- Deploys are manual and not tied to pushes. The live site matched `main` at 11:40; after you push,
  run `vercel --prod --yes` yourself.

## Next steps (planned order; the 1:00 PM demoable build is already met)
1. **AI pre-visit summary: DONE and live (12:05).** `api/summary.ts` (Vercel Function, web handler)
   calls the OpenAI Responses API, model `gpt-6.1-terra` (override with env `OPENAI_MODEL`), key in
   Vercel env `OPENAI_API_KEY` (Production + Preview only, so it does not run under `vite dev`).
   Input = `SummaryInput` (`src/lib/summaryTypes.ts`): on-screen measure values in the clinician's
   view order, GINA criteria, flags, range counts, first name. Client logic in `src/lib/summary.ts`:
   localStorage cache (bump `SUMMARY_VERSION` after changing the instructions), rule-based
   `fallbackSummary` when the call fails (local dev always shows it), prefetch of all four patients
   for Dr. Okafor on load. UI: `PreVisitSummary.tsx` above the widget grid. Tested live: 405 on GET,
   413 over 40 KB, ~3 s per call, drafts checked for all four patients.
2. **Polish pass: DONE (12:15).** 1280 px checked, no breakage. Customize aside hides while a detail
   sheet is open. Day-by-day inside the sheet no longer has its own scroll box (the blow table keeps
   its 480 px cap on purpose). Add-measure chips have a focus ring; Enter adds. Print = landscape,
   controls hidden, colors kept, cards unbroken. No AI calls under `vite dev`, so local console is clean.
3. **Pitch support**: regenerate screenshots (`.playwright-mcp/` is gitignored), final Q&A list in
   `docs/demo-outline.md`. Tommy owns the outline; read it before editing, other sessions edit it too.
4. Optional: drag-and-drop in Customize (`@dnd-kit`); "Save as team preset" (needs a shared store).

## How to verify after any change
`npx tsc -b && npm run build && node scripts/check-derive.ts`, then Playwright at 1440×900:
B shows adherence 92%→36%, FEV1 −17.6%, "Not well controlled" 4 of 4, "Controller doses fell, Sep 25"
marker; clicking the FEV1 widget opens the detail with rejected blows listed; D shows headache-first
widgets, no lung panel, no zone strip; Customize → add a measure → save → reload keeps it; switching
"Viewing as" to Dr. Lin changes the order; console has zero errors. Then `vercel --prod --yes`.
