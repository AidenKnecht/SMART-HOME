# 3-minute demo outline (+1 min Q&A)

Timekeeper shows a card at 1:15 left. Rehearse twice with a timer. One person talks, one drives.

**Live demo:** https://smart-home-kit.vercel.app (patient Jordan Whitfield is the default story).
For 0:00–0:25, use the **Portal today** toggle instead of a screenshot: same patient, raw grid,
"Last day logged Nov 2". Flip to **Clinician view** for the payoff. Patient mode is **Show patient**.
Sam Delgado is the "taking it but not working" case if Q&A asks.

**Before each rehearsal and the real demo:** Settings, then **Reset all saved views**, so Dr. Okafor
and Dr. Lin start on their presets. Views are stored per browser, so do the demo on the laptop you rehearsed on.
Priya Nair is the migraine patient (Headache clinic preset; her story is a dose increase that worked).

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:25 | **Problem.** "Dr. ___ sees 20 patients today and has 60 seconds before this teen walks in. Here's what SMART@Home shows her now." | Portal today toggle (press 1) |
| 0:25–0:40 | **What clinicians told us.** "They might all say here's our top 3 things, but they put different value on it." "It's noise until it's not." | Spoken, no slide |
| 0:40–1:40 | **The 30-second view.** Read the first sentence of the **Pre-visit summary** aloud and point to its "AI draft, check against the data" label. Then: "Three need attention." Red widgets are control, rescue and zones. FEV1 and doses are yellow, and each has its own sparkline. Read the charts below: controller doses fell Sep 25, symptoms rose, FEV1 dipped. **Click the FEV1 widget**: the detail panel shows the big chart, every blow including rejected ones, and only the FEV1 days. Close it. **Click the doses flag** in "What to discuss today": same panel, for adherence, with the archived duplicate Advair record. "Simple first, the evidence one click down." | Widget grid, detail panel, flags |
| 1:40–2:10 | **Every clinician gets their own view.** Switch "Viewing as" from Dr. Okafor to Dr. Lin: same Jordan, different measures first, and the summary rewrites itself in Dr. Lin's priority order. Switch to **Priya** (migraine) and scroll to **"Did the treatment change help?"**: "Her topiramate went up Sep 17. Headache days fell from about 3 to 2 a week, pain from 7.1 to 5.2, and doses logged stayed above 90%. She's taking it, and it's working." One sentence on Jordan if time: his chart shows the opposite, the dose went up but doses fell Sep 25. (Customize is still there for Q&A.) | Viewing as, Priya's treatment-change card |
| 2:10–2:35 | **In the visit.** Patient mode on Priya: "Same change, the way Priya sees it: about 3 headache days a week before, about 2 since. Dots, not graphs, because health literacy matters for half these families." | Patient mode |
| 2:35–3:00 | **Why it's feasible.** Built on SMART@Home's real data shape; handles duplicate entries, text-encoded values, med ID linking; honest about self-reported doses. Close with impact. | Short "data quirks handled" list |

## Q&A answers to have ready
- **Self-reported doses?** "We label it 'doses logged,' not 'taken.' Pharmacy refill data would be the next signal."
- **Epic integration?** "Prototype is standalone; it mirrors the real Cosmos DB document shape, so it could render inside the existing SMART@Home Epic tab."
- **Other trackers?** "Summary cards are driven by the tracker definition (question types), not hard-coded to asthma."
- **Won't clinicians hide something important?** "Hide, never delete. All data is one click down, because it's noise until it's not."
- **Who maintains the views?** "The clinician, in about 20 seconds, no developer. Presets give a starting point per specialty."
- **Where are views stored?** "In the browser for the prototype. In production they'd live with the clinician's portal account."
- **Why not just red and green?** "Color never works alone here: every widget pairs it with an icon and a word, for color-blind readers and printouts. Grey means not enough data, which is different from fine."
- **Why not reorder widgets by urgency?** "Clinicians told us each one weighs things differently, so their saved order stays. The count line says how many need attention."
- **What does the AI see?** "Only the computed numbers and flags already on this screen, never raw entries or any identifier beyond a first name. It's told to use only those numbers, say 'doses logged', and never recommend treatment. It's labelled a draft."
- **What if the AI is down or wrong?** "It falls back to a summary built by rules from the same numbers, and says so. Every number in the draft is on the widgets below it, so it's checkable in seconds."
- **Does the chart prove the drug worked?** "No, it's before and after, and it says so on the card. That's why doses logged is always one of the panels, and why thin data is labelled, like Jordan's 14 days before his change."
- **Why separate panels, not one chart?** "Pain, FEV1 and doses have different units. Stacking them on one shared timeline with the change line avoids comparing lines that aren't comparable."
- **Something we don't know:** say so plainly. It's scored.
