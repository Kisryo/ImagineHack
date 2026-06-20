# Compass

Organisational memory + growth layer for SEA advisory firms.

> Transfer the relationship, not just the records.

See `CLAUDE.md` for the full project brief, `plan.md` for workflow, `design.md` for architecture, and `task.md` for the checklist.

## Skeleton status

This repo currently contains the **walking skeleton**: Next.js app router shell, route stubs for the demo flow, an in-memory seeded data layer, the Supabase SQL schema (pgvector), and LLM extraction/retrieval stubs.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — all demo data is seeded in `lib/data.ts`, no DB required.

## Wire the real backend

1. Create a Supabase project, run `supabase/schema.sql`.
2. Fill `.env.local` with Supabase + LLM keys.
3. Replace the stubbed functions in `lib/data.ts` with Supabase queries.
4. Implement `lib/ai.ts` (extraction + embeddings + RAG).

## Demo flow

`Login → Dashboard → New note (with voice) → Client timeline → Ask → Learning loop → CPD → Handover pack (Export PDF) → Audit trail`

See [DEPLOY.md](DEPLOY.md) for one-click Vercel + Supabase setup.

## Shipped

- AI extraction (Anthropic) + embeddings (OpenAI) with offline fallbacks
- Supabase-backed data layer (auto-activates when env is set)
- Supabase auth login (demo bypass when not configured)
- Voice note capture (Web Speech API)
- One-click PDF export for handover packs
- Partner directory, audit trail, mobile bottom nav
- Briefing API: `GET /api/brief/:clientId`
- Extraction API: `POST /api/extract`
- pgvector similarity for lesson matching + RAG Q&A (`supabase/functions.sql`)
- Calendar-driven morning briefings (`/clients/:id/brief`)
- Team-lead admin overview (`/admin`)
- Auth middleware — every page gated behind `/login`
- Vercel deploy config (Singapore region) + embeddings backfill script
- Commitments inbox (`/commitments`) — every promise auto-extracted
- Referral tracker on partners (introduced → engaged → closed)
- Speaker-deck pitch route at [`/pitch`](http://localhost:3000/pitch) (print-friendly)
- One-click demo reset in the header — re-run the pitch cleanly
