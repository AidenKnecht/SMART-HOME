# 3-minute demo outline (+1 min Q&A)

Timekeeper shows a card at 1:15 left. Rehearse twice with a timer. One person talks, one drives.

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:25 | **Problem.** "Dr. ___ sees 20 patients today and has 60 seconds before this teen walks in. Here's what SMART@Home shows her now." | The current grid screenshot from the brief |
| 0:25–0:40 | **What clinicians told us.** One or two exact quotes from this morning's interviews. | Quote on a slide or overlay |
| 0:40–1:40 | **The 30-second view.** Control status, adherence, symptom days, FEV1 trend, zone days, "what changed." Tell the story: adherence dropped → symptoms rose → FEV1 dipped. | Summary strip + timeline |
| 1:40–2:10 | **Same data, different specialist.** Flip the lens toggle. "Works for any tracker, not just asthma." | Lens toggle |
| 2:10–2:35 | **In the visit.** Patient mode: "Here's what she shows the teen." (+ AI summary if built) | Patient mode |
| 2:35–3:00 | **Why it's feasible.** Built on SMART@Home's real data shape; handles duplicate entries, text-encoded values, med ID linking; honest about self-reported doses. Close with impact. | Short "data quirks handled" list |

## Q&A answers to have ready
- **Self-reported doses?** "We label it 'doses logged,' not 'taken.' Pharmacy refill data would be the next signal."
- **Epic integration?** "Prototype is standalone; it mirrors the real Cosmos DB document shape, so it could render inside the existing SMART@Home Epic tab."
- **Other trackers?** "Summary cards are driven by the tracker definition (question types), not hard-coded to asthma."
- **Something we don't know:** say so plainly. It's scored.
