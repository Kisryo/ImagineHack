# Compass — The Idea, In Depth

> *Transfer the relationship, not just the records.*

This document explains what Compass actually does, why it matters, and which
features will make the demo **spark** rather than fizzle. It's written to be
quotable — copy lines straight into your pitch deck.

---

## Part 1 — The lightbulb (read this first)

Every advisory firm has two kinds of knowledge it relies on every day, and it
doesn't actually own either of them.

The first is **what each advisor knows about each client.** Mr Wong's
preferred meeting time. Mrs Tan's deep distrust of structured products after
2018. The Menon family's quiet rule that the wife signs everything but the
husband decides everything. None of that is in the CRM. It lives inside the
advisor's head — and walks out the door when they resign.

The second is **what each advisor still needs to learn.** Knowledge gaps
silently widen until they surface in front of a client. Regulators mandate
CPD hours to fight this, but the system is broken: advisors self-assess their
own gaps (which is the one thing they're worst at), pick generic courses, and
log compliance at year-end like it's a tax return.

**Compass is the layer that captures both — quietly, in the background, as a
side-effect of work the advisor was already doing.**

The advisor types or speaks a note after a client meeting. Behind the scenes,
Compass turns that note into structured organisational memory. It pulls out
not just the facts but the **behavioural signals** — *how the client thinks,
what lights them up, what to never bring up again.* That layer becomes the
firm's asset. It's queryable, transferrable, and auditable.

And because that same layer reveals what topics the advisor keeps wrestling
with, Compass can detect their knowledge gaps from real work — not from a
self-assessment quiz — and serve a matching micro-lesson at the exact moment
of need. Completing it auto-logs the CPD compliance hour.

When an advisor eventually leaves, the firm clicks one button and Compass
generates a **handover pack** for the successor. Not a data dump. A
relationship briefing. *"Mr Wong's daughter just started university — bring
that up. Never bring up the 2022 trust recommendation. He texts in short
bursts late evening; don't expect long replies. He defers to his wife on
lifestyle and decides on investment."*

The client doesn't feel the reset. They stay. The firm keeps the revenue.
The advisor's departure stops being a loss event.

That's the lightbulb. **Three painkillers, one memory graph, one product.**

---

## Part 2 — What Compass actually does (the long version)

### 2.1 It captures the layer no CRM has ever captured

A CRM is built around **records**: account numbers, holdings, transaction
history, pipeline stages. It was designed in the 1990s for sales teams
tracking deals through a funnel. It does that well.

What it has never been designed for — and what every advisor in every
advisory firm in Southeast Asia compensates for daily — is the **relational
layer**. The soft, human, behavioural context that makes a client
relationship actually work.

Compass captures this layer as **structured, firm-owned data**:

- **Tone** — *He's warm on family topics. He's brisk on regulatory ones.*
- **Triggers** — *Mention his late father and the room shifts. Mention 2022
  and he changes the subject.*
- **Preferences** — *Afternoon meetings. Numbers over narrative. WhatsApp
  over email.*
- **Trust state** — *Confidence in our firm is high. Confidence in the
  industry is shaken since the 2023 mis-selling stories.*
- **Communication style** — *Short replies. Asks the same question three
  ways before he believes the answer.*

These are not opinions or speculation. They're explicit signals the advisor
has *already observed* and *already remembered*, just never written down in a
structured way. Compass extracts them from natural-language notes with an
LLM, stores them as JSON in a Postgres column called `relational`, and
indexes them with vector embeddings so they're semantically searchable.

**The asset isn't the note. The asset is the relational layer inside the
note.**

### 2.2 It turns that layer into firm property, not advisor property

This sounds subtle but it's the whole business model.

Right now, when an advisor takes a leave or resigns, the firm loses
everything that wasn't filed in a structured tool. The advisor's notebooks,
their WhatsApp screenshots, the mental shorthand they built up over five
years with each client — gone. The firm has the **accounts** (which the CRM
holds) but not the **relationship** (which only existed in one person's head).

Compass inverts this. By design, the relational layer is written to
firm-controlled storage at the moment of capture. The advisor *doesn't own*
the data they entered any more than a Salesforce sales rep owns the contact
records they typed in. The data is the firm's, secured by role-based access
and audit trails. The advisor still uses it daily — but if they walk, the
firm keeps the relationship.

This is also why we deliberately **don't store regulated identity data**
(IC numbers, account numbers, anything that triggers banking-secrecy laws).
That's the CRM's job. We sit *next to* the CRM, holding the layer the
regulators don't restrict but the firm desperately needs.

### 2.3 It uses that same memory to upskill the advisor

Here's the architectural unlock: once you have the relational layer for every
client across every advisor, **you can detect each advisor's blind spots**
without ever asking them to self-assess.

Concretely: if Aisyah's last 10 client notes all show estate-planning
conversations stalling out, or repeatedly mention ESG without confident
follow-through, Compass embeds those signals and matches them against a
library of micro-lessons. The next lesson she sees in her **Learning** tab is
the one her real work shows she needs:

> *Estate planning conversations with reluctant clients · 84% match*

She does the 15-minute lesson. Compass writes a `cpd_log` row. Her CPD
dashboard goes from 14h to 15.5h. No spreadsheet, no portal, no year-end
scramble, no guesswork about which course to pick.

This is the part of Compass that feels almost free — because the gap-detection
logic runs on the same vector index we already built for client memory.
**One database, two pain-killers.**

### 2.4 It makes the handover moment cinematic

The original problem statement was "memory walks out the door." The whole
product is built backwards from this scene: **the day an advisor resigns.**

In a typical firm today, this day means:

- The departing advisor sits with the successor for a few hours and tries to
  "download" what they know. Most of it doesn't come out.
- The CRM gets reassigned. Account ownership transfers. The successor reads
  the file and feels like they're starting from zero on the *person*.
- The first meeting with each inherited client is high-stakes and clumsy.
  The client feels the reset. Some leave.

In a firm using Compass, this day means:

- The successor opens each inherited client and clicks **Generate handover
  pack**.
- They read a one-page relationship briefing that reads like a coach took
  them aside. Not a data dump. *"Here's how to actually work with this
  person."*
- They walk into the first meeting prepared. The client doesn't feel the
  reset because the new advisor already knows their language.

This is the demo moment. This is the slide judges remember.

### 2.5 It compounds with every single note

Most software gets worse as you put more data in. Spreadsheets break.
Notebooks lose pages. WhatsApp groups become noise.

Compass gets **sharper** with every note. Every new interaction enriches the
relational layer, refines the gap-detection signal, and improves the
handover pack. The memory graph isn't a passive store — it's a compounding
asset. Year three of using Compass is worth more than year one, and a firm
that's been on Compass for five years has a competitive moat that a
spreadsheet-based competitor literally cannot replicate.

That's the long-term defensibility. **The product gets more valuable the
longer you use it.**

---

## Part 3 — Why this hasn't existed yet

Three things had to be true for Compass to be possible *now* and not in 2018:

1. **LLMs make extraction cheap.** Turning *"Met Mr Wong, lit up on insurance,
   shut down on estate"* into clean structured JSON used to be an NLP research
   project. It's now one API call. Cost: fractions of a cent per note.

2. **Vector databases became commodity.** pgvector is a Postgres extension you
   install in 30 seconds. Five years ago, semantic search meant standing up
   Elasticsearch + a separate ML pipeline. Now it's a single SQL function.

3. **The market got tired of waiting.** SEA advisory firms have watched
   Salesforce, Wealthbox, Practifi roll out enterprise-grade tools they
   couldn't afford for a decade. They're ready for something built for them.

This is the right window. The technology became affordable, the regulatory
pressure (CPD compliance) sharpened, and the incumbent tools stayed too
expensive for the underserved segment.

---

## Part 4 — The features that will spark the demo

You have a working product. But "working" and "striking" are different
things. Below are the specific features that turn the pitch from *"that's
useful"* into *"holy cow, I need that."*

Ranked by how much they will visibly land in a 5-minute demo.

---

### 🔥 SPARK FEATURE #1 — The Traffic-Light Meeting Coach

**The line that sells it:**
> *"Compass doesn't just remember your clients. It tells you what to say —
> and what to avoid — before you walk into every meeting."*

**What it is:**
A card at the top of the pre-meeting briefing showing three columns:

- 🟢 **SAFE today** — topics that consistently engage this client
- 🔴 **AVOID today** — sensitivities, sore points, recent friction
- 🟡 **EXPLORE** — open commitments, recently raised topics, things they
  haven't closed on

**Why it sparks:**
- It's the most visceral, screenshot-able view in the product.
- It turns the relational layer from *abstract* (chips on a timeline) into
  *actionable* (a cheat sheet you'd actually use 60 seconds before a meeting).
- It makes the value of Compass legible to someone who has never been an
  advisor. A judge sees the green/red/yellow columns and *instantly gets it.*
- The data is already there — we extract `relational`, `sensitivities`, and
  `commitments` on every note. This is pure presentation.

**Effort:** 30 minutes. Backend: aggregate from existing extracted fields.
Frontend: a three-column card.

**This is the feature I would ship first. Above all others.**

---

### 🔥 SPARK FEATURE #2 — Successor Mode (the 30-Day Inheritance Plan)

**The line that sells it:**
> *"Most handover docs are a PDF you read once and forget. Compass gives the
> new advisor a 30-day plan: who to call first, what to bring up by week two,
> what to never say in the first month."*

**What it is:**
The handover pack stops being a static page. It becomes an active timeline:

- **Day 1:** *"Meet the wife first. She signs everything. Lead with daughter's
  education."*
- **Day 7:** *"Bring up ESG — Mr Wong raised it twice last quarter. Concrete
  numbers, not concepts."*
- **Day 14:** *"Loop in Lim & Co (his accountant) — he's been asking for
  tighter tax coordination."*
- **Day 30:** *"Trust check-in. If he's gone quiet on WhatsApp, that's a
  signal. He texts short bursts when he's engaged."*

**Why it sparks:**
- Turns Compass from a *memory* product into a *coaching* product. Coaching
  is worth more.
- Reframes the handover from "reading a document" to "following a recipe."
  The successor feels guided, not abandoned.
- Demo moment: you click resign, and the inheriting advisor opens to a Day-1
  playbook ready to go.

**Effort:** 1 hour. Backend: LLM call over handover data with a "30-day plan"
system prompt. Frontend: a vertical timeline component.

---

### 🔥 SPARK FEATURE #3 — Churn Risk Score

**The line that sells it:**
> *"Compass tells the firm owner which clients are about to leave — before
> they leave."*

**What it is:**
A per-client risk score, surfaced on the Admin dashboard:

- 🟢 **Safe** — recent interactions, warm signals, open dialogue
- 🟡 **Watch** — frequency dropping, shorter notes, fewer relational signals
- 🔴 **At-risk** — long silence, recent sensitivity flags, missed commitments

**Why it sparks:**
- Turns memory into **prediction**. Memory is a feature. Prediction is a
  budget line.
- This is the **slide that makes the firm owner pay.** Advisors love
  Compass. Firm owners *buy* Compass. The churn-risk dashboard is the buy
  signal.
- It's the screenshot that makes your pitch deck look like a real product,
  not a demo.

**Effort:** 1 hour. Backend: a scoring function over recent interaction
frequency + sensitivity count + length trend. Frontend: badges on client
list and admin view.

---

### ⚡ SPARK FEATURE #4 — "Fake Resign" Button

**The line that sells it:**
> *"Watch what happens the moment an advisor leaves."*

**What it is:**
A button in the admin view labelled **"Simulate advisor departure."** Click
it during the live demo. A modal pops up: *"Aisyah Rahman has resigned.
Generating handover packs for 12 clients…"* with a loading bar.

When it finishes, all of Aisyah's clients now have handover packs ready, and
the admin dashboard shows them being picked up by Daniel.

**Why it sparks:**
- Pure showmanship — but showmanship is what wins pitches.
- Makes the headline use case visually undeniable in 10 seconds.
- Gives the judges a *kinetic* moment, not a static one.

**Effort:** 30 minutes. Frontend mostly — backend just triggers existing
`generateHandover` for each client.

---

### ⚡ SPARK FEATURE #5 — Bahasa + Mandarin Note Capture

**The line that sells it:**
> *"An advisor in Penang can speak Bahasa into Compass and get back English
> structured signals. No Western tool does this."*

**What it is:**
The LLM extraction system prompt accepts notes in Bahasa Melayu, Mandarin
(simplified), or Singlish, and produces English structured output. Voice
capture switches languages with a dropdown.

**Why it sparks:**
- **Defensible geographic moat.** Salesforce won't build this for SEA. We
  can ship it in 30 minutes.
- Concrete proof that Compass is *for SEA*, not a Western tool with a
  language toggle.
- Judges in this region instantly recognise this as a real differentiator.

**Effort:** 30 minutes. Add language hint to extraction prompt. Add language
attribute to voice input.

---

### ⚡ SPARK FEATURE #6 — Compliance Flagger

**The line that sells it:**
> *"Compass quietly catches the language regulators care about, before it
> ever leaves the firm."*

**What it is:**
The extractor scans notes for risky phrases — *"guaranteed returns,"*
*"definitely will outperform,"* *"this is risk-free"* — and flags them on
the Admin compliance feed.

**Why it sparks:**
- This is the slide for **the regulator**, **the compliance officer**, and
  **the firm owner's lawyer.** All three are buying signals.
- Reinforces Compass's Gap 4 credibility — *"we're SME-grade but
  enterprise-credible on compliance."*
- Costs nothing extra — the LLM is already reading every note.

**Effort:** 45 minutes. Backend: add a `compliance_flags` field to
extraction. Frontend: an Admin section.

---

## Part 5 — Putting it all together

If you ship just **Spark Feature #1 (Traffic-Light Coach)**, the demo goes
from "interesting" to **"I'd buy that today."** Everything else is upside.

If you ship #1, #2, and #3, you have a *flagship-grade* demo:

> *"In one note, Compass captures the relational layer no CRM has ever held.
> Before every meeting, it tells the advisor what to say and what to avoid.
> When the advisor eventually resigns, it generates a 30-day playbook for
> the successor. And throughout, it tells the firm owner which clients are
> about to leave — before they leave."*

That's the pitch. That's the product. That's the company.

---

## Part 6 — The one-line versions (for your slides)

For when you have **8 seconds**:
> *Compass: transfer the relationship, not just the records.*

For when you have **20 seconds**:
> *A CRM tells you Mr Wong owns Plan X. Compass tells you Mr Wong lights up
> when you mention his daughter and to never bring up the 2022 trust again.*

For when you have **45 seconds**:
> *When an advisor resigns, the firm loses the relationship — even though
> it kept the records. Compass captures the behavioural layer a CRM never
> holds, uses it to detect knowledge gaps and auto-log CPD compliance, and
> turns the handover into a relationship briefing the successor can actually
> use. One platform. Three pain-killers. Built for the Southeast Asian
> advisory firms no one else serves.*

For when you have **2 minutes**:
> Use the demo script in [PROJECT.md §9](PROJECT.md#9-demo-script-the-5-minute-story).

---

## Where to go next

- **Master reference:** [PROJECT.md](PROJECT.md)
- **Work breakdown:** [TASKS.md](TASKS.md)
- **Deploy runbook:** [DEPLOY.md](DEPLOY.md)
- **Original brief:** [CLAUDE.md](CLAUDE.md)
