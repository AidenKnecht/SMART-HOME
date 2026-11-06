# 3-minute demo outline (+1 min Q&A)

Timekeeper shows a card at 1:15 left. Rehearse twice with a timer. One person talks, one drives.

**Live demo:** https://smart-home-kit.vercel.app (patient Jordan Whitfield is the default story).
For 0:00–0:25, use the **Portal today** toggle instead of a screenshot: same patient, raw grid,
"Last day logged Nov 2". Flip to **Clinician view** for the payoff. Patient mode is **Show patient**.
Sam Delgado is the "taking it but not working" case if Q&A asks.

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:25 | **Problem.** "Dr. ___ sees 20 patients today and has 60 seconds before this teen walks in. Here's what SMART@Home shows her now." | The current grid screenshot from the brief |
| 0:25–0:40 | **What clinicians told us.** "They might all say here's our top 3 things, but they put different value on it." "It's noise until it's not." | Quote on a slide or overlay |
| 0:40–1:40 | **The 30-second view.** Control status, adherence, symptom days, FEV1 trend, zone days, "what changed." Tell the story: adherence dropped → symptoms rose → FEV1 dipped. | Summary strip + timeline |
| 1:40–2:10 | **Every clinician gets their own view.** Switch "Viewing as" from Dr. Okafor to Dr. Lin: same Jordan, different measures first. Open **Customize**, tick Night waking, move it first, save. "Hidden is never deleted": open **All data**. Switch to Priya (migraine): the same panel offers headache days and pain, built from the tracker. | Viewing as, Customize, All data, migraine patient |
| 2:10–2:35 | **In the visit.** Patient mode: "Here's what she shows the teen." (+ AI summary if built) | Patient mode |
| 2:35–3:00 | **Why it's feasible.** Built on SMART@Home's real data shape; handles duplicate entries, text-encoded values, med ID linking; honest about self-reported doses. Close with impact. | Short "data quirks handled" list |

## Q&A answers to have ready
- **Self-reported doses?** "We label it 'doses logged,' not 'taken.' Pharmacy refill data would be the next signal."
- **Epic integration?** "Prototype is standalone; it mirrors the real Cosmos DB document shape, so it could render inside the existing SMART@Home Epic tab."
- **Other trackers?** "Summary cards are driven by the tracker definition (question types), not hard-coded to asthma."
- **Won't clinicians hide something important?** "Hide, never delete. All data is one click down, because it's noise until it's not."
- **Who maintains the views?** "The clinician, in about 20 seconds, no developer. Presets give a starting point per specialty."
- **Where are views stored?** "In the browser for the prototype. In production they'd live with the clinician's portal account."
- **Something we don't know:** say so plainly. It's scored.
