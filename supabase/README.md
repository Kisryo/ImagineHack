# Supabase Setup

This folder defines the backend data model for the simplified AdvisorFlow AI
MVP:

> Existing client data -> priority signals -> suggested actions/messages -> CPD
> and admin oversight.

## Run Order

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Run `schema.sql`.
4. Run `seed.sql`.
5. Test the automation views:

```sql
select *
from client_priority_queue
order by priority_score desc;
```

```sql
select *
from daily_action_suggestions
order by priority_score desc, event_date asc;
```

## Core Tables

- `advisors` - agents, admins, team leads
- `clients` - existing client records and safe relationship preferences
- `policies` - plan value, renewal dates, premium due dates, status
- `client_events` - birthdays, renewals, payment risks, consent reviews, follow-ups
- `tasks` - advisor follow-ups and commitments
- `generated_messages` - WhatsApp/email/call-script drafts
- `learning_content` - existing training videos or micro-lessons
- `cpd_log` - completed CPD records
- `audit_log` - action and compliance trail

## Automation Views

### `client_priority_queue`

Ranks clients using:

- premium/business impact
- high-value plans
- renewal or premium due soon
- payment/lapse risk
- birthday touchpoints
- overdue follow-ups
- consent/compliance issues
- relationship touchpoint overdue

This is the query your Advisor Dashboard can use for "who should I focus on
first today?"

### `daily_action_suggestions`

Turns open client events into:

- suggested action
- message type
- draft message
- priority reason

This is the query your Message Assistant can use for birthday messages, renewal
reminders, payment/lapse reminders, document requests, and consent-safe blocks.

## Frontend Mapping

- Advisor Today: `client_priority_queue`
- Smart Message Assistant: `daily_action_suggestions`
- Follow-Up Manager: `tasks`
- Learning: `learning_content` + `cpd_log`
- Admin: `audit_log`, `tasks`, `client_events`, `generated_messages`

## Important Product Wording

Do not pitch this as "prioritise rich clients only."

Pitch it as:

> AdvisorFlow prioritises clients based on urgency, service risk, relationship
> moments, compliance needs, and business impact.
