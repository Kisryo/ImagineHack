# AdvisorFlow AI - Prototype Plan And Workflow

> Companion docs: `README.md`, `draft.md`, `problem-statement.md`, `design.md`, `task.md`.

## 1. North Star

AdvisorFlow AI should become the morning command centre for an advisor.

Success means the demo clearly shows:

- A client signal arrives.
- The system ranks priority.
- The advisor understands why.
- The advisor gets next-best actions.
- The right partner desk is matched.
- Compliance and consent are checked.
- Admin can see the business outcome.

## 2. Current Scope

### In Scope For The Hackathon Prototype

- Advisor and Admin demo roles
- Priority client ranking
- AI-style client brief
- Evidence-backed next-best actions
- Follow-up draft composer
- Compliance draft mode
- Partner referral matching
- Consent-lock masking
- CPD recommendation panel
- Task and expense interactions
- Admin business impact dashboard
- Referral pipeline
- Compliance queue
- Admin review board
- Audit trail
- Local seeded data
- Offline deterministic logic

### Out Of Scope For Current Prototype

- Real authentication
- Real database persistence
- Live AI model calls
- Real client records
- Real email or WhatsApp sending
- Real partner desk routing
- Payment or billing
- Multi-tenant production deployment

## 3. Demo Flow To Rehearse

Use one clear story instead of showing every feature randomly.

1. Advisor Alex opens the app.
2. The morning brief explains the day.
3. Priority clients are ranked.
4. Mr. Tan is selected as the high-opportunity client.
5. Advisor AI Copilot explains the liquidity event, evidence, risk, and opportunity.
6. Action Composer drafts a follow-up.
7. Partner Radar recommends ASG Tax Advisory Desk or AAG Estate Concierge.
8. Mr. Kumar shows service-risk handling for premium lapse and debt exposure.
9. Consent-locked client shows privacy and compliance guardrails.
10. Admin view shows business impact, referrals, compliance, expenses, and audit logs.

## 4. Build Phases

### Phase 0 - Foundation

Status: complete

- React/Vite project created.
- App runs locally.
- Build command works.
- Base visual direction established.

### Phase 1 - Data Layer

Status: complete

- Advisors seeded.
- Clients seeded.
- Meetings seeded.
- Tasks seeded.
- Demo events seeded.
- Partners seeded.
- CPD modules seeded.
- Compliance, expense, referral, and audit data seeded.

### Phase 2 - Engine Layer

Status: complete

- Priority score calculation.
- Client brief generation.
- Next-best action recommendation.
- Draft message generation.
- Partner matching.
- Compliance scoring.
- Business impact summary.
- Morning brief and admin summary.

### Phase 3 - Advisor Experience

Status: complete

- Morning brief.
- Priority client strip.
- Advisor AI Copilot.
- Client memory.
- Action Composer.
- Compliance Guardrail.
- Partner Radar.
- CPD panel.
- Meetings and task panels.

### Phase 4 - Admin Experience

Status: complete

- Business impact view.
- Referral pipeline.
- Compliance queue.
- Consent requests.
- Expense review.
- Admin review board.
- Advisor coaching.
- Audit log.

### Phase 5 - Documentation And Pitch Clarity

Status: in progress

- README improved.
- Problem statement improved.
- Design document improved.
- Plan improved.
- Checklist improved.
- Product draft added.

### Phase 6 - Production Path

Status: future

- Add authentication.
- Add database persistence.
- Add secure advisor/admin permissions.
- Add server-side audit logging.
- Add real AI integration.
- Add exportable reports.
- Deploy to public URL.

## 5. Critical Path

```text
Polish docs -> rehearse demo -> verify build -> prepare screenshots -> deploy or record backup -> present
```

For the competition, polish and rehearsal may matter more than adding another feature.

## 6. Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Judges do not understand the value quickly | Start with the one-line story and show the priority client flow first |
| Prototype looks like a normal CRM | Emphasize AI-style brief, next-best action, partner match, and compliance guardrail |
| No live AI model | Be transparent: deterministic offline prototype now, production AI path documented |
| Too many features shown | Use one rehearsed demo story |
| Consent or compliance feels bolted on | Always show consent-locked client and admin audit view |
| Local demo fails | Prepare screenshots and backup video |

## 7. Final Presentation Target

By the end of the demo, judges should remember:

AdvisorFlow AI helps advisors know who to call, what to say, which partner to involve, and how to stay compliant, while giving admin a live view of productivity and risk.

