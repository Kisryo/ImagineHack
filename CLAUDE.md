# CLAUDE.md - AdvisorFlow AI

Project instructions for AI coding agents and team members working on this repo.
Read this file before writing code or changing the product direction.

Companion docs:

- `README.md` - project overview and run instructions
- `draft.md` - clear product and pitch draft
- `problem-statement.md` - problem framing
- `plan.md` - build workflow and roadmap
- `design.md` - interface and system design
- `task.md` - delivery checklist

## 1. What We Are Building

AdvisorFlow AI is a hackathon prototype for AAG x ASG ImagineHack 2026 Track 1.

It is an advisor productivity and governance command centre. It helps advisors decide:

- Which client should I focus on first?
- What changed for this client?
- What action should I take?
- What message can I send?
- Which partner desk should be involved?
- What compliance or consent issue must be checked?

It also helps admins see:

- Business impact
- Referral pipeline
- Expense risk
- Compliance queue
- Consent requests
- Advisor productivity
- Audit trail

## 2. Product North Star

> Turn scattered advisory signals into governed action.

AdvisorFlow AI should feel like the system an advisor opens every morning before contacting clients. It is not a landing page and not only a CRM. It is a daily decision layer.

## 3. Current Technical Stack

- Framework: React with Vite
- Styling: plain CSS in `src/styles.css`
- Runtime data: seeded JavaScript objects in `src/data.js`
- Logic: deterministic engine functions in `src/engines.js`
- State: local React state
- External APIs: none
- Production backend: not yet implemented

Commands:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
```

## 4. Current Architecture

```text
React/Vite web app
        |
        |-- Advisor role
        |     |-- Morning brief
        |     |-- Priority clients
        |     |-- Client memory
        |     |-- AI-style copilot
        |     |-- Action composer
        |     |-- Partner radar
        |     |-- CPD and meetings
        |
        |-- Admin role
              |-- Business impact
              |-- Referral pipeline
              |-- Compliance queue
              |-- Expenses
              |-- Consent requests
              |-- Admin review board
              |-- Audit trail

Seeded data -> rule engines -> React UI
```

## 5. Main Files

- `src/App.jsx`
  - Main application shell
  - Advisor and Admin views
  - User interactions such as referral creation, task completion, consent handling, and expense creation

- `src/data.js`
  - Advisors
  - Clients
  - Meetings
  - Tasks
  - Demo events
  - Business impact
  - Referral outcomes
  - Compliance queue
  - CPD courses
  - Partners
  - Expenses
  - Audit logs

- `src/engines.js`
  - Client scoring
  - Priority ranking
  - Client brief generation
  - Next-best action recommendation
  - Draft message generation
  - Partner matching
  - Compliance scoring
  - Business impact summary
  - Admin summary

- `src/styles.css`
  - Layout
  - Component styling
  - Responsive behavior
  - Modern dashboard visual system

## 6. Product Rules

- Keep the demo focused on Track 1: advisor productivity, client service, business growth, and governance.
- Keep the first screen as the real dashboard, not a marketing page.
- Preserve Advisor and Admin role switching.
- Preserve consent masking and blocked action behavior.
- Do not add real client data.
- Do not claim live AI behavior unless a real model is connected.
- Keep recommendations explainable with evidence or reasons.
- Keep compliance and consent visible beside action generation.

## 7. UX Rules

- Interface should be clean, modern, and work-focused.
- Use dense but readable dashboard sections.
- Avoid decorative filler.
- Use short labels and clear status chips.
- Make the demo path obvious: priority client -> brief -> action -> partner -> compliance -> admin view.
- Text must fit on desktop and mobile.
- Keep cards purposeful. Do not create nested card clutter.

## 8. Future Production Rules

Before production use:

- Add authentication.
- Add server-side authorization.
- Add Firestore or Supabase persistence.
- Enforce advisor-owned records.
- Persist audit logs.
- Implement consent workflow securely.
- Move recommendation logic to backend functions.
- Add AI model calls only with prompt controls, logging, human approval, and data protection review.

## 9. Demo Discipline

The prototype should support one strong story:

1. Advisor starts the day.
2. System ranks client priorities.
3. Advisor opens a high-value client.
4. System explains the opportunity and evidence.
5. System suggests next-best action.
6. Advisor creates a governed follow-up or referral.
7. Consent-locked client proves safety controls.
8. Admin sees impact, risk, and auditability.

If a feature does not support this story, treat it as stretch.

