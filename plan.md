# Compass — plan.md (Prototype Plan & Workflow)

> Companion docs: `design.md` (architecture) · `task.md` (implementation checklist) · `problem-statement.md` (pitch framing) · `CLAUDE.md` (project spec)

---

## 1. North star

**Transfer the relationship, not just the records.** When an advisor leaves, the firm assigns a successor — but the relational knowledge (how a client thinks, what they respond to, what to avoid) never transfers because it only lived in the departing advisor's head. Compass captures it as firm-owned memory and hands it over in one click.

For the prototype, success = **one rehearsed end-to-end demo flow that visibly closes all three gaps**, on a live URL.

---

## 2. Scope

### In scope (MVP — must work in the demo)
- Auth + roles (advisor / team_lead / admin), advisor sees only own clients.
- Pre-seeded "Wong family" client with 5–6 notes, 8–10 micro-lessons, a few partners.
- **Ingestion:** type a note → LLM extracts summary + commitments + sensitivities + **behavioural/relational signals** + partner mentions → save + embed.
- **Retrieval:** natural-language query → vector search that client's notes → cited answer.
- **Learning loop:** detect a recurring/struggle topic → match a micro-lesson → mark complete → auto-log CPD → dashboard.
- **Handover pack:** one click → structured one-pager that reads like a *relationship briefing*.
- **Audit log** written on every client-record view.

### Out of scope (stretch — only if time)
- Partner ecosystem beyond a static directory + simple tagging.
- Voice-to-text capture, morning briefing, post-lesson quiz, PDF export, dark mode, admin audit viewer.

### Explicit non-goals
- No real KYC/IC handling — we deliberately target *behavioural/relational* data, not regulated identity data.
- No multi-firm tenancy, billing, or production hardening.

---

## 3. The demo flow (the thing we rehearse)

Pre-seed everything; live, add only ONE new note and let the system react.

1. Advisor logs in → sees only their own clients.
2. Logs a **new note** on the Wong family.
3. Memory graph updates → client timeline shows the new note + extracted relational signals.
4. Learning loop detects a **knowledge gap** → serves a matching micro-lesson.
5. Advisor completes the lesson → **CPD auto-logged** on the dashboard.
6. "Advisor resigns" → one click generates a **handover pack** for the successor that reads like *"here's how to actually work with this client."*

This single flow hits continuity (Gap 3), learning + compliance (Gap 1), and the unified affordable platform (Gap 4).

---

## 4. Build workflow (phases)

Build the **spine** first; modules are thin layers on top. If time runs short, a strong spine + handover demos better than three half-built modules.

**Phase 0 — Foundation**
Repo + Next.js, Supabase with pgvector, env vars + LLM key, Vercel live URL, roles model agreed.

**Phase 1 — Data layer (memory graph)**
Schema (see `design.md`), tables + relationships, vector columns, seed the Wong family + lessons + partners.

**Phase 2 — Ingestion pipeline (spine pt.1)**
Note-entry screen → LLM extraction prompt → structured JSON → save interaction + embedding.

**Phase 3 — Retrieval (spine pt.2)**
Query box → embed → vector search → cited LLM answer + client timeline/profile.

**Phase 4 — Learning loop (Gap 1)**
Gap detection → lesson match by similarity → recommendation UI → mark-complete → cpd_log → CPD dashboard.

**Phase 5 — Handover pack (Gap 3)**
"Generate handover pack" → aggregate client history → structured relationship one-pager.

**Phase 6 — Security & access (Gap 4 credibility)**
Login, role-based access enforced in queries, audit_log on client view.

**Phase 7 — UX + polish**
App shell, navigation, mobile-responsive, loading/empty states.

**Phase 8 — Pitch & demo**
Slide deck, demo script, rehearsal, success-metrics slide, backup demo video.

**Phase 9 — Testing & buffer**
End-to-end test of the demo flow, bug-fix buffer.

---

## 5. Critical path

`Foundation → schema + seed → ingestion → retrieval → learning loop → handover → login/audit → rehearse`

Everything else (partner module, polish, exports) hangs off this and is droppable.

---

## 6. Milestones / checkpoints

| Checkpoint | "Done" looks like |
|-----------|-------------------|
| M1 — Spine alive | Type a note, it's stored + embedded, and a query returns a cited answer. |
| M2 — Learning loop closes | A gap is detected, a lesson served, completion logs CPD on the dashboard. |
| M3 — Handover works | One click produces a readable relationship one-pager from all of a client's history. |
| M4 — Secure + scoped | Login works; an advisor cannot see another's clients; views write audit_log. |
| M5 — Demo-ready | Full flow runs on the live URL without manual DB pokes; deck + script rehearsed; backup video recorded. |

---

## 7. Risks & mitigations

- **Scope creep across 3 modules** → enforce the critical path; partner module stays stretch.
- **LLM extraction returns malformed JSON** → strict prompt + schema validation + retry/fallback (see `design.md`).
- **Demo depends on live LLM calls** → pre-seed data and record a backup video (M5).
- **Vector search returns weak matches on tiny seed data** → curate seed notes/lessons so similarity is obvious in the demo.
- **Auth/RLS eats time** → keep roles simple; enforce ownership in queries even if RLS isn't fully configured.

---

## 8. Working agreements

- Keep the spine stable before adding modules.
- Prefer one clear demo flow over many shallow features.
- All client-data access writes an audit_log entry.
- Advisors never see clients they don't own — enforce in queries, not just UI.
- Tick boxes in `task.md` as work completes.
