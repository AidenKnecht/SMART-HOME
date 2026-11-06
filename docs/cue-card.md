# Cue card: 3:00 demo + 1:00 Q&A

**Setup (driver, before 2:30):** open `https://smart-home-kit.vercel.app/?demo`, wait 10 s for summaries to load,
F11, zoom ~115%. The page opens on **Portal today** (Jordan, Dr. Okafor). Keys **1–6** jump to each beat.
Don't click into Settings. If Wi-Fi fails: `npm run dev`, open `localhost:5173/?demo`. The summary then says
"AI unavailable" and uses the rule-based text, which is fine. Last resort: `docs/demo-backup/` screenshots.

**Talker:** face the judges, not the screen. Driver: click, don't talk. Aim to finish at 2:45.

| Time | KEY | SAY |
|---|---|---|
| 0:00 | **1** | "Dr. Smith has 60 seconds before a teen with asthma walks in. This is what SMART@Home shows her today: a grid of every submission. It says the last day logged was Nov 2, and that's wrong. Nothing here says whether he's taking his medicine." |
| 0:25 | stay | "This morning we interviewed clinicians. One said: *'90% of it is noise until it's not.'* Another: *'They put different value on it.'* So we built: few things first, everything one click down." |
| 0:40 | **2** | "Same patient, Jordan. Read the summary: *(first sentence)*. It's labelled an AI draft, and every number is on the widgets below it. Three need attention: control, rescue use, zone days. Controller doses fell on Sep 25, symptoms rose, lung function dipped." |
| 1:10 | **3** | "One click on FEV1 gives the evidence: every blow, including the rejected ones. Simple first, evidence one click down." *(Esc, then click the doses flag in 'What to discuss today' if time)* |
| 1:40 | **4** | "Dr. Lin is primary care. Same Jordan, different measures first, and the summary rewrites in her order. Clinicians can customize and save their own." |
| 1:55 | **5** | "Priya, migraine, not asthma. Her topiramate went up Sep 17. Headache days fell from about 3 to 2 a week, pain from 7 to 5, and doses logged stayed above 90%. She's taking it and it's working." |
| 2:15 | **6** | "And in the visit, the teen sees this. Dots, not graphs. About 3 headache days a week before, about 2 since. Health literacy matters: 53% of these families are on Medicaid." |
| 2:35 | stay | "It's built on SMART@Home's real data shape. It handles duplicate entries, values stored as text, and med IDs. It's honest: doses are *logged*, not *taken*. One screen a clinician reads in a minute and turns toward the teen." |

**Timekeeper card at 1:15 left and you haven't reached Priya?** Skip 5 and 6 and go straight to the closing line.

## Q&A (1–2 sentences, then stop)
- **Self-reported doses?** "We call it 'doses logged.' Pharmacy refill data would be the next signal."
- **Epic?** "Standalone prototype, but it mirrors the real Cosmos DB document, so it could render in the Epic tab."
- **What does the AI see?** "Only the computed numbers on screen, a first name, never raw entries. It never recommends treatment, and if it's down a rule-based summary takes over."
- **Other conditions?** "Tiles are driven by the tracker definition. Priya's migraine tracker runs on the same code."
- **Did the drug work?** "It's before and after, not proof. Doses logged is always shown beside it."
- **Hide something important?** "Hide, never delete. All data is one click down."
- **Don't know?** Say so plainly. It's scored.

Tommy: tech, data, AI. Aiden: clinicians, impact, patient mode. (Swap if you prefer, but decide before 2:30.)
