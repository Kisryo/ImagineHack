# AdvisorFlow AI - Design And Architecture

> Companion docs: `README.md`, `draft.md`, `problem-statement.md`, `plan.md`, `task.md`.

## 1. Design Principle

AdvisorFlow AI should look and feel like a modern advisory command centre.

The design should communicate:

- Trust
- Speed
- Governance
- Business impact
- Advisor usefulness

It should not feel like a marketing website. The first screen must be the product.

## 2. Current System Architecture

```text
                   AdvisorFlow AI web app
                         React + Vite
                              |
         ------------------------------------------------
         |                                              |
     Advisor view                                   Admin view
         |                                              |
  Morning brief                                Business impact
  Priority clients                             Referral pipeline
  Client intelligence                          Compliance queue
  Action composer                              Expense review
  Partner radar                                Consent requests
  CPD recommendations                          Audit trail
         |                                              |
         -------------------- Shared --------------------
                              |
                     Seeded demo data
                              |
                    Rule-based engines
                              |
             Local browser prototype runtime
```

## 3. Current Tech Choices

| Concern | Choice | Reason |
|---------|--------|--------|
| Front end | React + Vite | Fast prototype, simple local demo |
| Styling | Plain CSS | Full visual control without heavy framework |
| Data | Seeded JavaScript | Reliable offline demo with no setup risk |
| AI behavior | Deterministic engines | Safe, explainable, no external API key needed |
| State | Local React state | Enough for hackathon interaction |
| Deployment path | Vercel or Firebase Hosting | Easy public demo later |

## 4. Core Data Model In Prototype

The prototype uses seeded objects instead of a database.

```text
advisors
clients
meetings
tasks
demoEvents
overnightSignals
advisorKpis
businessImpact
referralStages
referralOutcomes
complianceQueue
adminReviewItems
cpdCourses
partners
expensesSeed
auditLogsSeed
```

The important relationship is:

```text
client -> tasks
client -> meetings
client -> signals
client -> referrals
client -> expenses
client -> compliance queue
client -> audit logs
```

## 5. Engine Layer

The engine layer converts seeded data into AI-style outputs:

| Function | Purpose |
|----------|---------|
| `scoreClient` | Calculates client priority score |
| `getPriorityClients` | Sorts clients by action priority |
| `buildClientBrief` | Creates advisor-ready client summary |
| `recommendActions` | Generates next-best actions |
| `generateDraft` | Creates follow-up, referral, or compliance draft |
| `matchPartners` | Matches client need to partner desk |
| `scoreCompliance` | Scores risk and explains guardrails |
| `summarizeBusinessImpact` | Turns metrics into business summary |
| `buildMorningBrief` | Generates advisor start-of-day briefing |
| `buildAdminSummary` | Generates admin operating summary |

## 6. Interface Layout

### Advisor View

```text
Top bar
  - Product name
  - Demo role switch
  - Impact summary

Hero command area
  - Morning brief
  - Demo story rail
  - Priority client strip

Main workspace
  - Advisor AI Copilot
  - Action Composer
  - Compliance Guardrail
  - Client Memory
  - Follow-up Manager
  - Partner Radar
  - CPD Panel
  - Meetings Panel
  - Referral and Expense Panel
```

### Admin View

```text
Admin command area
  - Business impact stats
  - Managed premium
  - Compliance health
  - Referral value

Admin workspace
  - Referral pipeline
  - Compliance queue
  - Consent requests
  - Flagged expenses
  - Admin review board
  - Advisor coaching
  - Audit log
```

## 7. Visual Direction

Use:

- Clean professional dashboard styling
- Clear section hierarchy
- Modern neutral base
- Limited accent colors for state and urgency
- Status chips for risk, consent, referral stage, and task state
- Strong spacing and readable typography
- Responsive layout that stacks cleanly on smaller screens

Avoid:

- Decorative landing-page hero sections
- Generic stock-style visuals
- Overly playful colors
- Nested cards inside cards
- Long instructional text in the app
- Hidden compliance controls

## 8. Key Interaction Rules

### Consent-Locked Client

When a client is not verified:

- Mask private details.
- Block referral creation.
- Block normal follow-up actions.
- Show consent refresh action.
- Log blocked action in audit trail.

### Advisor Drafts

Drafts should be:

- Advisor-approved
- Explainable
- Context-aware
- Compliance-aware
- Not automatically sent

### Partner Referrals

Partner recommendations should show:

- Partner name
- Specialty
- Match score
- Reason
- SLA or expected response
- Evidence requirement

### Admin Controls

Admin should be able to understand:

- What needs review
- Who owns it
- Why it is high risk
- Which client or advisor it relates to
- What audit signal was created

## 9. Production Architecture Target

```text
React front end
        |
Authentication
        |
API layer / server functions
        |
Database
        |
Recommendation and AI services
        |
Audit and compliance logging
```

Suggested production collections:

- `users`
- `clients`
- `meetings`
- `tasks`
- `signals`
- `partners`
- `referrals`
- `expenses`
- `learningModules`
- `cpdProgress`
- `consentRequests`
- `complianceQueue`
- `adminReviewItems`
- `auditLogs`

## 10. Design Success Criteria

The design is successful if:

- Judges understand the value in 30 seconds.
- Advisor workflow feels realistic.
- Admin view feels useful, not decorative.
- Compliance is clearly embedded.
- Partner growth opportunity is obvious.
- The app still reads well on a laptop projector.

