# AdvisorFlow AI

AI assistant for insurance agents in the AAG x ASG ImagineHack 2026 Track 1 challenge.

> Turn existing client data into daily priorities and ready-to-send actions.

Companion docs:

- `draft.md` - clear product and pitch draft
- `problem-statement.md` - competition problem framing
- `CLAUDE.md` - project instructions for AI coding agents and teammates
- `plan.md` - build workflow and roadmap
- `design.md` - interface and system design
- `task.md` - demo and delivery checklist

## 1. What This Project Is

AdvisorFlow AI is a demo-ready agent assistant for insurance and advisory teams. It helps agents answer four daily questions:

1. Which client needs attention first?
2. Why is this client important right now?
3. What should I do or say next?
4. What consent or compliance guardrail must be checked before action?

The prototype is built as a local React/Vite web app with seeded data and deterministic rule-based logic. It does not call a live AI API, does not use secret credentials, and does not contain real client records.

## 2. Track 1 Alignment

The Track 1 opportunity is advisor productivity, client service quality, and sustainable growth. AdvisorFlow AI targets that opportunity by combining:

- Client prioritization
- Ready-to-send WhatsApp/email style prompts
- Client context and relationship notes
- Follow-up/task visibility
- Just-in-time CPD recommendations
- Consent-aware governance

The key positioning is simple:

Agents do not only need another CRM screen. They need an affordable AI assistant that tells them who to contact, why, and what to say.

## 3. Skeleton Status

This repo currently contains a polished hackathon prototype:

- React/Vite dashboard shell
- Agent assistant workspace
- Seeded advisor, client, meeting, task, event, compliance, CPD, and audit data
- Rule-based engine functions for scoring, briefs, recommendations, draft generation, and compliance risk
- Responsive modern interface
- Local-only runtime with no external API dependency

## 4. Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local Vite URL shown in the terminal. Usually:

```text
http://127.0.0.1:5173/
```

Build verification:

```powershell
npm.cmd run build
```

Use `npm.cmd` on Windows PowerShell if direct `npm` execution is blocked.

## 4.1 Connect Supabase

The app still works with seeded frontend data if Supabase is not configured.
To connect the Advisor Today screen to your Supabase tables:

1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Run `supabase/seed.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Fill in your Supabase project URL and anon public key:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

5. Restart `npm.cmd run dev`.

The Advisor Today page will show a **Backend Connection** panel. If connected,
it reads:

- `client_priority_queue`
- `daily_action_suggestions`

If env vars are missing or Supabase fails, the app falls back to seeded demo
data.

## 5. Current Demo Flow

Recommended 3 to 5 minute flow:

1. Open AdvisorFlow AI as Agent Alex.
2. Show Today: top clients, priority reasons, and ready-to-send action cards.
3. Use Mr. Tan to show birthday/renewal/follow-up automation from existing client data.
4. Open Client Assistant to show context, evidence, and next-best action.
5. Use Follow-Ups to create or complete a task.
6. Open the consent-locked client to show masking and consent-safe blocking.
7. Open Learning to show just-in-time CPD recommendations.
8. Close with the business story: agents save time, clients receive more timely personal attention, and risky actions are blocked.

## 6. Shipped Prototype Features

- Agent assistant workspace
- Today assistant brief
- Priority client ranking
- Client context panel
- Client assistant brief
- Evidence-backed next-best actions
- Ready-to-send action cards
- Follow-up and compliance message assistant
- Consent-lock masking
- CPD recommendation panel
- Task creation and completion
- Supabase-backed priority queue and daily action suggestions
- Local deterministic engines with no external API calls

## 7. Data And Logic Map

- `src/data.js` contains seeded demo data.
- `src/engines.js` contains deterministic scoring and recommendation logic.
- `src/App.jsx` contains the main agent assistant experience.
- `src/styles.css` contains the interface styling and responsive layout.

Important engine outputs include:

- `scoreClient`
- `getPriorityClients`
- `buildClientBrief`
- `recommendActions`
- `generateDraft`
- `scoreCompliance`
- `summarizeBusinessImpact`
- `buildMorningBrief`

## 8. AI Tool Attribution

This prototype was upgraded with AI-assisted coding in Codex. AI support was used to expand the seeded data, structure the demo workflow, write deterministic AI-style engine logic, improve the interface, and create competition documentation.

The runtime app itself does not call an AI model or external API. Its recommendations are generated from local seeded data and rule-based logic.

## 9. Production Path

To turn this into a real system:

1. Add Firebase Authentication or Supabase Auth.
2. Add persistent database collections for users, clients, policies, events, tasks, generated messages, learning content, consent requests, and audit logs.
3. Enforce advisor-owned data queries on the server.
4. Move recommendation logic to secure backend functions.
5. Add real audit persistence.
6. Connect approved integrations for CRM imports, email, WhatsApp draft handoff, and PDF/CSV reporting.
7. Add a real AI model only behind strict consent, logging, prompt controls, and human advisor approval.

## 10. Security Note

This is a local hackathon prototype. Do not deploy it publicly with real client data until authentication, authorization, database security rules, audit persistence, and server-side access checks are implemented.
