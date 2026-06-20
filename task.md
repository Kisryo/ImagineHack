# Compass — task.md (Implementation Checklist)

> Companion docs: `plan.md` (plan + workflow) · `design.md` (architecture) · `CLAUDE.md` (spec)
> Tags: **[MVP]** = needed for the demo · **[Stretch]** = only if time.
> Build order follows the critical path. Tick boxes as you go.

---

## Phase 0 — Foundation
- [ ] [MVP] Create repo + scaffold Next.js (App Router)
- [ ] [MVP] Provision Supabase project; enable `pgvector` extension
- [ ] [MVP] Configure env vars (Supabase URL/keys, LLM API key)
- [ ] [MVP] Add LLM client helper (chat + embeddings) in `/lib`
- [ ] [MVP] Deploy skeleton to Vercel → confirm live URL
- [ ] [MVP] Agree roles model: advisor / team_lead / admin

## Phase 1 — Data layer (memory graph)
- [ ] [MVP] Create tables: advisors, clients, interactions, learning_content, cpd_log, audit_log (+ partners stretch)
- [ ] [MVP] Add `vector(N)` columns to interactions + learning_content (consistent N)
- [ ] [MVP] Add `relational` + `sensitivities` + `topics` JSON columns to interactions ⭐
- [ ] [MVP] Create vector similarity index / RPC for nearest-neighbour search
- [ ] [MVP] Seed: "Wong family" client + 5–6 notes (with rich relational signals)
- [ ] [MVP] Seed: 8–10 micro-lessons across common topics (insurance, estate, tax…)
- [ ] [MVP] Seed: 2 advisors (so handover has a real successor) + a few partners

## Phase 2 — Ingestion pipeline (spine pt.1)
- [ ] [MVP] Note-entry screen (text input)
- [ ] [MVP] LLM extraction prompt → strict JSON {summary, commitments, sensitivities, relational, partner_mentions, topics}
- [ ] [MVP] JSON validation + retry + safe fallback (never hard-fail ingestion)
- [ ] [MVP] Compute embedding on (summary + relational) and save interaction
- [ ] [MVP] Show extracted structure back to the advisor after save
- [ ] [Stretch] Voice-to-text capture
- [ ] [Stretch] Robust error handling / retry UX

## Phase 3 — Retrieval — client memory (spine pt.2)
- [ ] [MVP] Natural-language query box on client profile
- [ ] [MVP] Embed question → vector search that client's interactions
- [ ] [MVP] LLM answers from retrieved notes only + cites source note
- [ ] [MVP] Client profile + interaction timeline view
- [ ] [Stretch] Auto morning briefing across today's meetings

## Phase 4 — Learning loop (Gap 1)
- [ ] [MVP] Gap-detection: LLM identifies one recurring/struggle topic from recent notes
- [ ] [MVP] Match topic → micro-lesson by vector similarity
- [ ] [MVP] Lesson recommendation UI
- [ ] [MVP] Mark-complete → write cpd_log
- [ ] [MVP] CPD dashboard (hours logged vs required target)
- [ ] [Stretch] Post-lesson knowledge-check quiz

## Phase 5 — Handover pack (Gap 3)
- [ ] [MVP] "Generate handover pack" button on client profile
- [ ] [MVP] Aggregate ALL client history → structured relationship one-pager
- [ ] [MVP] Pack sections: relationship summary · how to work with them (relational + sensitivities) ⭐ · past advice + reasoning · open commitments · partner contacts
- [ ] [MVP] Write audit_log action='handover_generated'
- [ ] [Stretch] Export pack as PDF

## Phase 6 — Security & access (Gap 4 credibility)
- [ ] [MVP] Login / authentication (Supabase Auth)
- [ ] [MVP] Role-based access — advisor sees only own clients (enforce in queries)
- [ ] [MVP] Write audit_log on every client-record view
- [ ] [Stretch] Optional Supabase RLS policies backing the query-level checks
- [ ] [Stretch] Admin view of audit trail

## Phase 7 — Front end & UX
- [ ] [MVP] App shell, navigation, mobile-responsive
- [ ] [MVP] Home / dashboard (my clients + CPD + recommended lesson)
- [ ] [MVP] Loading + empty states
- [ ] [Stretch] Visual polish, branding, dark mode

## Phase 8 — Partner ecosystem (Stretch)
- [ ] [Stretch] Partner directory + tagging
- [ ] [Stretch] Detect client need → suggest partner
- [ ] [Stretch] Track referral status (introduced → engaged → closed)

## Phase 9 — Pitch & demo
- [ ] [MVP] Problem statement + pitch narrative (see problem-statement.md)
- [ ] [MVP] Slide deck
- [ ] [MVP] Demo script + rehearsal
- [ ] [MVP] Success-metrics slide
- [ ] [MVP] Record backup demo video

## Phase 10 — Testing & buffer
- [ ] [MVP] End-to-end test of the full demo flow (Phase order)
- [ ] [MVP] Confirm advisor-isolation (cannot see another's clients)
- [ ] [MVP] Bug-fix buffer

---

## Definition of done (demo-ready)
Type a new note on the Wong family → timeline + relational signals update → a gap is detected → a lesson is served → completing it logs CPD on the dashboard → one click generates a relationship handover pack — all on the live URL, with login + advisor isolation working, and a backup video recorded.
