# AdvisorFlow AI

AI-assisted advisor command centre for the AAG x ASG ImagineHack 2026 Track 1 challenge.

> Turn one client signal into a compliant advisor action, partner referral, and admin-visible business outcome.

Companion docs:

- `draft.md` - clear product and pitch draft
- `problem-statement.md` - competition problem framing
- `CLAUDE.md` - project instructions for AI coding agents and teammates
- `plan.md` - build workflow and roadmap
- `design.md` - interface and system design
- `task.md` - demo and delivery checklist

## 1. What This Project Is

AdvisorFlow AI is a demo-ready advisory operations dashboard for insurance and financial advisory teams. It helps advisors answer four daily questions:

1. Which client needs attention first?
2. Why is this client important right now?
3. What should I do or say next?
4. What compliance, consent, partner, or admin step must be handled before action?

The prototype is built as a local React/Vite web app with seeded data and deterministic rule-based logic. It does not call a live AI API, does not use secret credentials, and does not contain real client records.

## 2. Track 1 Alignment

The Track 1 opportunity is advisor productivity, client service quality, and business growth. AdvisorFlow AI targets that opportunity by combining:

- Client prioritization
- Advisor next-best actions
- AI-style client briefing
- Compliant draft message generation
- Partner referral matching
- CPD and coaching recommendations
- Expense and task visibility
- Admin review queue
- Consent-aware governance
- Audit trail signals

The key positioning is simple:

Advisors do not only need another CRM screen. They need a morning operating layer that turns scattered signals into governed action.

## 3. Skeleton Status

This repo currently contains a polished hackathon prototype:

- React/Vite dashboard shell
- Advisor and Admin demo roles
- Seeded advisor, client, meeting, task, event, referral, expense, compliance, CPD, and audit data
- Rule-based engine functions for scoring, briefs, recommendations, draft generation, partner matching, compliance risk, and admin summaries
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

## 5. Current Demo Flow

Recommended 3 to 5 minute flow:

1. Open AdvisorFlow AI as Advisor Alex.
2. Show the morning brief and priority client strip.
3. Select Mr. Tan to show how a liquidity event becomes estate, tax, and key-person planning actions.
4. Show the Advisor AI Copilot: summary, evidence, risk, and next-best actions.
5. Use Action Composer to show a compliant draft follow-up.
6. Show Partner Radar and explain ASG Tax Advisory Desk or AAG Estate Concierge matching.
7. Select Mr. Kumar to show service-risk handling for missed premium and debt exposure.
8. Select the consent-locked client to show masking, blocked actions, and consent refresh controls.
9. Switch to Admin and show managed premium, referral pipeline, compliance queue, expenses, review board, and audit logs.
10. Close with the business story: AdvisorFlow AI saves advisor time, improves prioritization, creates partner growth, and protects governance.

## 6. Shipped Prototype Features

- Advisor and Admin role switcher
- Morning brief and demo event rail
- Priority client ranking
- Client memory panel
- AI-style client brief
- Evidence-backed next-best actions
- Follow-up and compliance draft composer
- Consent-lock masking
- Partner recommendation and referral creation
- CPD recommendation panel
- Task creation and completion
- Expense creation and flagged expense view
- Admin business impact dashboard
- Referral pipeline
- Compliance queue
- Admin review board
- Audit trail
- Local deterministic engines with no external API calls

## 7. Data And Logic Map

- `src/data.js` contains seeded demo data.
- `src/engines.js` contains deterministic scoring and recommendation logic.
- `src/App.jsx` contains the main Advisor and Admin experiences.
- `src/styles.css` contains the interface styling and responsive layout.

Important engine outputs include:

- `scoreClient`
- `getPriorityClients`
- `buildClientBrief`
- `recommendActions`
- `generateDraft`
- `matchPartners`
- `scoreCompliance`
- `summarizeBusinessImpact`
- `buildMorningBrief`
- `buildAdminSummary`

## 8. AI Tool Attribution

This prototype was upgraded with AI-assisted coding in Codex. AI support was used to expand the seeded data, structure the demo workflow, write deterministic AI-style engine logic, improve the interface, and create competition documentation.

The runtime app itself does not call an AI model or external API. Its recommendations are generated from local seeded data and rule-based logic.

## 9. Production Path

To turn this into a real system:

1. Add Firebase Authentication or Supabase Auth.
2. Add persistent database collections for users, clients, tasks, referrals, expenses, compliance queue, consent requests, and audit logs.
3. Enforce advisor-owned data queries and admin-only controls on the server.
4. Move recommendation logic to secure backend functions.
5. Add real audit persistence.
6. Connect approved integrations for calendar, email, WhatsApp draft handoff, partner desk routing, and PDF/CSV admin reporting.
7. Add a real AI model only behind strict consent, logging, prompt controls, and human advisor approval.

## 10. Security Note

This is a local hackathon prototype. Do not deploy it publicly with real client data until authentication, authorization, database security rules, audit persistence, and server-side access checks are implemented.

