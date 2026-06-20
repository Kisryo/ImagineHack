# CLAUDE.md — Compass

Project instructions for AI coding agents and team members working on this repo.
Read this file first before writing code.

Companion docs: `problem-statement.md` (pitch framing) · `plan.md` (plan +
workflow) · `design.md` (architecture) · `task.md` (implementation checklist).

---

## 1. What we are building

**Compass** is an organisational memory-and-growth layer for small and mid-size
advisory firms (the AAG / ASG profile, Southeast Asia focus).

**The core idea (read this first):** when an advisor leaves, the firm does not
leave the client hanging — it assigns a successor. The **hard data** (IC,
policies, contacts, account history) already transfers fine; a CRM holds that.
What does **not** transfer is the **relational knowledge** — the soft,
behavioural context that actually makes the relationship work: *how this client
thinks, what they respond to, what to avoid* (e.g. "lights up on insurance,
shuts down on estate planning; call after lunch; still sore about a 2022
recommendation"). That lives only in the departing advisor's head, so the
successor inherits the file but starts cold on the person — and the client feels
the reset. **The real problem isn't lost records; it's lost relationships.**

It is **one platform** built on a shared **Institutional Memory Graph**. Three
modules read from and write to that graph:

1. **Client memory** — captures every client interaction as firm-owned data,
   extracting the **behavioural/relational signals** a CRM never holds, answers
   natural-language questions, and generates handover packs when an advisor
   leaves.
2. **Learning loop** — detects an advisor's knowledge gaps from their real work,
   serves a relevant micro-lesson, and auto-logs CPD hours.
3. **Partner ecosystem** (stretch) — surfaces the right partner at the right
   moment and tracks referrals.

Tagline: *Transfer the relationship, not just the records. Compass turns a
firm's scattered, in-the-head client knowledge into secure organisational memory
that survives staff turnover — and upskills advisors from their real work.*

**Data stance:** we deliberately target behavioural/relational context, **not**
regulated identity data (no IC numbers). This is both the differentiator and a
privacy-aware design choice — call it out in the pitch.

---

## 2. Problem statement

Advisory firms run on two forms of knowledge they do not actually own:
what each advisor knows about each client, and what each advisor still needs to
learn. Today both live in individual heads and disconnected tools.

**Headline problem = Gap 3 (relational continuity).** Lead the pitch with this
one. Gap 1 (learning/CPD) is the *compounding bonus* that falls out of the same
memory graph for free; Gap 4 (built for SMEs) is the *positioning/wedge* — the
"why existing tools don't work, why us" — not a separate problem. One problem,
one underserved market, all three gaps still closed. (See `problem-statement.md`
for the full pitch framing.)

This creates three real, evidenced problems (the three gaps we are closing):

- **Gap 1 — The learning blind spot.** Professional-development (CPD) hours are
  usually mandatory, but learning is generic and disconnected from real work.
  Advisors waste required hours, knowledge gaps surface in front of clients, and
  compliance becomes a year-end scramble. Existing tools rely on the advisor
  *manually* self-assessing their own gaps.

- **Gap 3 — Memory walks out the door (HEADLINE).** When an advisor resigns,
  retires, or a client is reassigned, the firm assigns a successor — but the
  **relational knowledge** never transfers. The hard data is in the CRM; the
  behavioural context (how the client thinks, what they respond to, what to
  avoid), the reasoning behind past advice, partner relationships, and open
  commitments only lived in the departing advisor's head. The successor inherits
  the file but starts cold on the person, and the client feels the reset and
  churns.

- **Gap 4 — Built for giants, not the rest.** CRMs store *records*, not
  *relationships* — they were never built to capture soft behavioural context.
  The tools that come closest target large Western wealth firms with enterprise
  budgets and integration teams. Small/mid-size firms in markets like Malaysia
  cannot afford or integrate a five-vendor stack and are left with spreadsheets
  and memory.

**How Compass solves them**

- Gap 1: because the memory graph already holds the advisor's real notes, an AI
  pass detects recurring/struggle topics, matches a micro-lesson by meaning,
  serves it at the moment of need, and auto-logs the CPD credit. This removes the
  broken manual self-assessment step.
- Gap 3: interactions are captured as structured, **firm-owned** data (not the
  advisor's private notes), with the **behavioural/relational signals** extracted
  — not just the facts. A one-click handover pack regenerates the relationship
  for any authorised successor and reads like *"here's how to actually work with
  this person."* The knowledge becomes an organisational asset, so a departure
  stops being a loss event.
- Gap 4: one affordable, unified, mobile-first, secure platform deployable
  without an enterprise integration team. This is a packaging/access fix, not a
  technical breakthrough — be honest about that.

---

## 3. Architecture

```
Advisor app (mobile + web)
        |
  [ Client memory ] [ Learning loop ] [ Partner ecosystem ]
        \              |              /
                  AI layer
        (summarise, query, detect gaps)
                     |
        Institutional memory graph
     (clients, notes, learning, partners)
                     |
        Database (Postgres + vector search)

Security layer (role-based access + audit log) wraps all of the above.
```

**Build the spine first.** The database + AI layer (ingestion and retrieval) is
the spine. Once notes flow in and can be queried, the three modules are thin
layers on top. If time runs short, a strong spine + one module demos better than
three half-built modules.

---

## 4. Tech stack

- **Framework:** Next.js (React) — one codebase for front end and API routes.
- **Database / auth / vectors:** Supabase (Postgres + pgvector + auth) — chosen
  to save the most time. Plain managed Postgres + pgvector is an alternative.
- **AI:** an LLM API for summarisation, Q&A, gap detection, and library search.
- **Deploy:** Vercel, mobile-responsive.

Keep it one repo. Prefer simplicity over completeness for the hackathon.

---

## 5. Data model (core tables)

- `advisors` — id, name, role (advisor | team_lead | admin)
- `clients` — id, name, owning_advisor_id, profile fields
- `interactions` — id, client_id, advisor_id, raw_note, summary, commitments
  (json), sensitivities (json), **relational (json)**, **topics (json)**,
  partner_mentions (json), embedding (vector), created_at
  - ⭐ `relational` = the behavioural signals a CRM never holds (tone, triggers,
    preferences, trust state, communication style). This is the asset Compass
    transfers on handover. `topics` powers gap detection.
- `learning_content` — id, title, topic, body, cpd_hours, embedding (vector)
- `cpd_log` — id, advisor_id, learning_content_id, hours, completed_at
- `partners` — id, name, specialty, contact (stretch)
- `audit_log` — id, advisor_id, client_id, action, created_at

The "graph" is the relationships between these tables, plus vector columns on
`interactions` and `learning_content` for semantic search.

---

## 6. Core flows to implement

- **Ingestion:** note text -> LLM extracts summary + commitments + sensitivities
  + **relational signals** + topics + partner mentions as JSON -> save to
  `interactions` -> compute embedding on (summary + relational).
- **Retrieval:** question -> embed -> vector-search that client's interactions ->
  LLM answers using only those notes, citing the source note. Powers briefings
  and "brief me on <client>".
- **Learning loop:** scan recent interactions -> LLM identifies recurring/struggle
  topic -> match `learning_content` by vector similarity -> recommend lesson ->
  on complete, write `cpd_log` and update the CPD dashboard.
- **Handover pack:** aggregate ALL of a client's history -> structured
  relationship one-pager: relationship summary (who they are, how they think) +
  **how to work with them (relational signals + sensitivities)** + past advice +
  reasoning + open commitments + partner contacts. Should read like a relationship
  briefing, not a data dump.
- **Security:** login; advisors see only their own clients; write `audit_log` on
  every client-record view.

---

## 7. Task list

Tags: **[MVP]** = needed for a working demo. **[Stretch]** = only if time allows.

### Foundation & setup
- [ ] [MVP] Create repo, set up Next.js
- [ ] [MVP] Provision Supabase / Postgres with pgvector
- [ ] [MVP] Configure env vars + LLM API key
- [ ] [MVP] Set up Vercel deployment (live demo URL)
- [ ] [MVP] Agree roles model: advisor / team_lead / admin

### Data layer (memory graph)
- [ ] [MVP] Design schema (section 5)
- [ ] [MVP] Create tables + relationships
- [ ] [MVP] Add vector columns to interactions + learning_content
- [ ] [MVP] Seed demo data: "Wong family" client with 5–6 notes, 8–10 lessons,
      a few partners

### Ingestion pipeline
- [ ] [MVP] Note-entry screen (text)
- [ ] [MVP] LLM extraction prompt -> JSON
- [ ] [MVP] Save structured interaction + embedding
- [ ] [Stretch] Voice-to-text note capture
- [ ] [Stretch] Error handling / retry

### Retrieval — client memory
- [ ] [MVP] Natural-language query box
- [ ] [MVP] Embed -> vector search -> cited LLM answer
- [ ] [MVP] Client profile / interaction timeline
- [ ] [Stretch] Auto morning briefing across today's meetings

### Learning loop (Gap 1)
- [ ] [MVP] Gap-detection logic (LLM identifies topic from recent notes)
- [ ] [MVP] Match topic -> micro-lesson by vector similarity
- [ ] [MVP] Lesson recommendation UI
- [ ] [MVP] Mark-complete -> write cpd_log
- [ ] [MVP] CPD dashboard (hours vs required target)
- [ ] [Stretch] Post-lesson knowledge-check quiz

### Handover pack (Gap 3)
- [ ] [MVP] "Generate handover pack" button on a client
- [ ] [MVP] Aggregate client history -> structured one-pager
- [ ] [Stretch] Export pack as PDF

### Partner ecosystem (Stretch)
- [ ] [Stretch] Partner directory + tagging
- [ ] [Stretch] Detect client need -> suggest partner
- [ ] [Stretch] Track referral status (introduced -> engaged -> closed)

### Security & access (Gap 4 credibility)
- [ ] [MVP] Login / authentication
- [ ] [MVP] Role-based access (advisor sees only own clients)
- [ ] [MVP] Write audit_log on client view
- [ ] [Stretch] Admin view of audit trail

### Front-end & UX
- [ ] [MVP] App shell, navigation, mobile-responsive
- [ ] [MVP] Home / dashboard
- [ ] [MVP] Loading + empty states
- [ ] [Stretch] Visual polish, branding, dark mode

### Pitch & demo
- [ ] [MVP] Problem statement + pitch narrative (section 2)
- [ ] [MVP] Slide deck
- [ ] [MVP] Demo script + rehearsal
- [ ] [MVP] Success-metrics slide

### Testing & buffer
- [ ] [MVP] End-to-end test of the demo flow
- [ ] [MVP] Bug-fix buffer
- [ ] [MVP] Record backup demo video

**Critical path:** foundation -> schema + seed -> ingestion -> retrieval ->
learning loop -> handover -> login/audit -> rehearse.

---

## 8. Demo flow (the story to rehearse)

Pre-seed the "Wong family" client and the lessons so the system looks mature.
Live, only add ONE new note and let the system react:

1. Advisor logs a new client note.
2. Memory graph updates; client timeline shows it, with the extracted
   **relational signals**.
3. Learning loop detects a knowledge gap -> serves a micro-lesson.
4. Completing the lesson auto-logs CPD on the dashboard.
5. "Advisor resigns" -> one click generates a handover pack for the successor
   that reads like *"here's how to actually work with this client."*

This single flow visibly hits continuity (Gap 3), learning + compliance (Gap 1),
and the unified affordable platform (Gap 4).

---

## 9. Success metrics (final slide)

- Admin time saved per advisor per week
- % of CPD hours auto-logged vs manual
- Gap-to-lesson completion rate
- Client retention through advisor transitions
- Time-to-productivity for an inheriting advisor

---

## 10. Conventions

- Keep the spine (DB + ingestion + retrieval) stable before adding modules.
- Prefer one clear demo flow over many shallow features.
- All client data access must write an audit_log entry.
- Advisors must never see clients they do not own (enforce in queries, not just UI).
- Update the task checkboxes in section 7 as work completes.

<!-- Add build/run commands here once the project is scaffolded, e.g.:
## Commands
- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run lint` — lint
-->
