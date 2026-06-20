# Compass — design.md (Architecture)

> Companion docs: `plan.md` (plan + workflow) · `task.md` (checklist) · `CLAUDE.md` (spec)

---

## 1. System architecture

```
              Advisor app (Next.js — mobile + web)
                          │
   ┌──────────────┬───────────────┬──────────────────┐
   │ Client       │ Learning      │ Partner          │
   │ memory       │ loop          │ ecosystem (stretch)
   └──────────────┴───────────────┴──────────────────┘
                          │
                  AI layer (LLM API)
        summarise · extract signals · query · detect gaps
                          │
            Institutional Memory Graph
   (clients · interactions · learning · partners · cpd)
                          │
        Supabase: Postgres + pgvector (semantic search)
                          │
   Security layer: role-based access + audit log (wraps all)
```

**Design principle:** the DB + AI layer (ingestion + retrieval) is the **spine**. The three modules are thin layers that read/write the same graph.

---

## 2. Tech stack

| Concern | Choice | Why |
|--------|--------|-----|
| Framework | **Next.js (React)** | One codebase: UI + API routes. |
| DB / auth / vectors | **Supabase** (Postgres + pgvector + Auth) | Saves the most time; RLS for access control. |
| AI | **LLM API** (chat for extraction/Q&A/gaps + embeddings model) | Summarise, extract relational signals, answer, match lessons. |
| Deploy | **Vercel** | Mobile-responsive live demo URL. |

One repo. Simplicity over completeness for the hackathon.

---

## 3. Data model (core tables)

The "graph" = relationships between these tables + vector columns on `interactions` and `learning_content`.

```sql
-- advisors
id            uuid pk
name          text
role          text  -- 'advisor' | 'team_lead' | 'admin'

-- clients
id                uuid pk
name              text
owning_advisor_id uuid fk -> advisors.id
profile           jsonb   -- segment, goals, household, etc.

-- interactions  (the heart of the graph)
id              uuid pk
client_id       uuid fk -> clients.id
advisor_id      uuid fk -> advisors.id
raw_note        text
summary         text
commitments     jsonb   -- [{ text, due, status }]
sensitivities   jsonb   -- topics to handle with care
relational      jsonb   -- ⭐ behavioural signals: tone, triggers,
                        --    preferences, trust state, communication style
partner_mentions jsonb  -- [{ name, context }]
topics          jsonb   -- ['insurance', 'estate planning', ...] for gap detection
embedding       vector(N)
created_at      timestamptz

-- learning_content
id          uuid pk
title       text
topic       text
body        text
cpd_hours   numeric
embedding   vector(N)

-- cpd_log
id                  uuid pk
advisor_id          uuid fk -> advisors.id
learning_content_id uuid fk -> learning_content.id
hours               numeric
completed_at        timestamptz

-- partners  (stretch)
id        uuid pk
name      text
specialty text
contact   text

-- audit_log
id          uuid pk
advisor_id  uuid fk -> advisors.id
client_id   uuid fk -> clients.id
action      text   -- 'view' | 'handover_generated' | ...
created_at  timestamptz
```

**Key refinement vs. a CRM:** the `relational` (and `sensitivities`) columns are what a CRM never captures. They are the asset Compass transfers on handover — *"this client warms up on insurance, shuts down on estate planning, call after lunch, still sore about a 2022 recommendation."*

---

## 4. Core flows

### 4.1 Ingestion
```
note text
  → LLM extraction prompt → JSON { summary, commitments,
      sensitivities, relational, partner_mentions, topics }
  → validate JSON (retry on failure)
  → insert into interactions
  → embeddings model on (summary + relational) → store embedding
```

### 4.2 Retrieval (client memory)
```
question
  → embed question
  → vector search interactions WHERE client_id = ? ORDER BY similarity
  → LLM answers using ONLY retrieved notes, citing the source note
```
Powers "brief me on <client>" and the timeline.

### 4.3 Learning loop (Gap 1)
```
scan recent interactions for an advisor
  → LLM identifies a recurring / struggle topic
  → embed topic → vector search learning_content → best lesson
  → recommend lesson in UI
  → on complete → insert cpd_log → update CPD dashboard (hours vs target)
```

### 4.4 Handover pack (Gap 3)
```
aggregate ALL interactions for a client
  → LLM composes a structured one-pager:
      • relationship summary (who they are, how they think)
      • how to work with them (relational signals + sensitivities)  ⭐
      • past advice + reasoning
      • open commitments
      • partner contacts
  → render on screen (stretch: export PDF)
  → write audit_log action='handover_generated'
```

### 4.5 Security
```
login (Supabase Auth)
  → every client query filters by owning_advisor_id (enforced in query, not just UI)
  → on any client-record view → insert audit_log action='view'
```

---

## 5. AI layer details

**Extraction prompt (ingestion).** System prompt instructs the model to return *strict JSON only* with fixed keys (`summary`, `commitments[]`, `sensitivities[]`, `relational{}`, `partner_mentions[]`, `topics[]`). Validate against a schema; on parse failure, retry once with a "return valid JSON only" reminder, then fall back to storing `raw_note` with empty structured fields so ingestion never hard-fails.

**Retrieval prompt (Q&A).** "Answer ONLY from the provided notes. Cite the note id(s) you used. If the notes don't contain the answer, say so." Prevents hallucination and gives the cited-source UX.

**Gap detection prompt.** Given recent notes, "identify ONE recurring topic the advisor seems to need support on; return the topic string." Keep it to one clear topic so the demo match is obvious.

**Embeddings.** Same embedding model for interactions, questions, lesson content, and gap topics so all vector comparisons share one space. Store dimension `N` consistently in the `vector(N)` columns.

---

## 6. API routes (Next.js)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/interactions` | POST | Ingest a note (extract → embed → save). |
| `/api/clients/[id]/query` | POST | Natural-language Q&A over a client's notes. |
| `/api/clients/[id]/timeline` | GET | Interaction timeline (writes audit_log view). |
| `/api/learning/recommend` | GET | Detect gap + return matched lesson. |
| `/api/learning/complete` | POST | Mark lesson done → write cpd_log. |
| `/api/cpd/summary` | GET | CPD hours vs target for dashboard. |
| `/api/clients/[id]/handover` | POST | Generate handover pack (writes audit_log). |
| `/api/partners` | GET | (stretch) Partner directory. |

All routes resolve the current advisor from the session and enforce ownership.

---

## 7. Security model

- **AuthN:** Supabase Auth (email/password is enough for the demo).
- **AuthZ:** role on `advisors` (`advisor` | `team_lead` | `admin`). Advisors see only `clients.owning_advisor_id = me`. Team leads/admins can see more (handover target). Enforce in every query; optionally back with Supabase RLS.
- **Audit:** every client-record view and handover generation writes `audit_log`. Admin viewer is stretch.
- **Data stance:** we store behavioural/relational data by design and avoid regulated identity data (no IC numbers) — call this out in the pitch as a deliberate, privacy-aware choice.

---

## 8. Pages (front end)

- **Login**
- **Dashboard / home** — my clients, CPD progress, recommended lesson.
- **Client profile** — header + interaction timeline + NL query box + "Generate handover pack".
- **Note entry** — text in, structured extraction shown back.
- **Lesson view** — recommended micro-lesson + mark complete.
- **Handover pack** — the relationship one-pager.
- App shell: navigation, mobile-responsive, loading + empty states.
