-- AdvisorFlow AI Supabase schema
-- Run this first in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists advisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text not null check (role in ('advisor', 'admin', 'team_lead')),
  region text,
  cpd_hours numeric not null default 0,
  cpd_target numeric not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors(id) on delete restrict,
  name text not null,
  phone text,
  email text,
  birthday date,
  segment text,
  occupation text,
  status text not null default 'active' check (status in ('active', 'inactive', 'prospect')),
  consent_status text not null default 'verified' check (consent_status in ('verified', 'review_due', 'missing')),
  preferred_channel text default 'whatsapp' check (preferred_channel in ('whatsapp', 'call', 'email')),
  preferred_language text default 'English',
  relationship_notes text,
  last_contacted_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  policy_type text not null,
  policy_name text not null,
  premium_amount numeric not null default 0,
  coverage_amount numeric not null default 0,
  start_date date,
  renewal_date date,
  premium_due_date date,
  status text not null default 'active' check (status in ('active', 'due_soon', 'lapsed', 'cancelled')),
  plan_tier text not null default 'standard' check (plan_tier in ('basic', 'standard', 'premium', 'high_value')),
  created_at timestamptz not null default now()
);

create table if not exists client_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'birthday',
      'renewal_due',
      'premium_due',
      'missed_payment',
      'policy_lapse_risk',
      'follow_up_due',
      'new_client',
      'life_event',
      'document_needed',
      'consent_review'
    )
  ),
  title text not null,
  description text,
  event_date date not null,
  source text not null default 'manual' check (source in ('crm', 'manual', 'policy', 'system')),
  status text not null default 'open' check (status in ('open', 'handled', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  advisor_id uuid not null references advisors(id) on delete restrict,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'done', 'overdue')),
  source_event_id uuid references client_events(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists generated_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  advisor_id uuid not null references advisors(id) on delete restrict,
  event_id uuid references client_events(id) on delete set null,
  message_type text not null check (
    message_type in ('birthday', 'renewal', 'follow_up', 'payment_reminder', 'meeting_prep', 'document_request')
  ),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email', 'call_script')),
  body text not null,
  compliance_disclaimer text,
  status text not null default 'draft' check (status in ('draft', 'copied', 'sent', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists learning_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null,
  description text,
  cpd_hours numeric not null default 0,
  tags text[] not null default '{}',
  duration_minutes integer not null default 5,
  content_url text,
  created_at timestamptz not null default now()
);

create table if not exists cpd_log (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references advisors(id) on delete cascade,
  learning_content_id uuid not null references learning_content(id) on delete restrict,
  client_id uuid references clients(id) on delete set null,
  reason text,
  hours numeric not null,
  completed_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references advisors(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  action text not null,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clients_advisor_idx on clients(advisor_id);
create index if not exists policies_client_idx on policies(client_id);
create index if not exists events_client_status_idx on client_events(client_id, status);
create index if not exists events_date_idx on client_events(event_date);
create index if not exists tasks_client_status_idx on tasks(client_id, status);
create index if not exists tasks_advisor_status_idx on tasks(advisor_id, status);
create index if not exists generated_messages_client_idx on generated_messages(client_id);
create index if not exists audit_log_client_idx on audit_log(client_id);
create index if not exists audit_log_created_idx on audit_log(created_at desc);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on clients;
create trigger clients_touch_updated_at
before update on clients
for each row
execute function touch_updated_at();

-- Priority automation: converts client data, policies, events, and tasks into a daily ranked queue.
create or replace view client_priority_queue as
with policy_rollup as (
  select
    client_id,
    coalesce(sum(premium_amount), 0) as total_premium,
    coalesce(sum(coverage_amount), 0) as total_coverage,
    bool_or(plan_tier in ('premium', 'high_value')) as has_high_value_plan,
    min(renewal_date) filter (where renewal_date >= current_date) as next_renewal_date,
    min(premium_due_date) filter (where premium_due_date >= current_date) as next_premium_due_date,
    count(*) filter (where status = 'lapsed') as lapsed_policy_count
  from policies
  group by client_id
),
event_rollup as (
  select
    client_id,
    count(*) filter (where status = 'open') as open_event_count,
    bool_or(event_type = 'birthday' and event_date = current_date and status = 'open') as birthday_today,
    bool_or(event_type in ('renewal_due', 'premium_due') and event_date <= current_date + interval '30 days' and status = 'open') as due_within_30_days,
    bool_or(event_type in ('missed_payment', 'policy_lapse_risk') and status = 'open') as lapse_or_payment_risk,
    bool_or(event_type = 'consent_review' and status = 'open') as consent_event_open,
    string_agg(title, ' | ' order by event_date) filter (where status = 'open') as event_reasons
  from client_events
  group by client_id
),
task_rollup as (
  select
    client_id,
    count(*) filter (where status in ('open', 'overdue')) as open_task_count,
    count(*) filter (where status = 'overdue' or due_date < current_date) as overdue_task_count,
    string_agg(title, ' | ' order by due_date) filter (where status in ('open', 'overdue')) as task_reasons
  from tasks
  group by client_id
)
select
  c.id as client_id,
  c.advisor_id,
  c.name,
  c.segment,
  c.preferred_channel,
  c.consent_status,
  coalesce(p.total_premium, 0) as total_premium,
  coalesce(p.total_coverage, 0) as total_coverage,
  coalesce(e.open_event_count, 0) as open_event_count,
  coalesce(t.open_task_count, 0) as open_task_count,
  (
    case when coalesce(p.total_premium, 0) >= 80000 then 25
         when coalesce(p.total_premium, 0) >= 30000 then 15
         when coalesce(p.total_premium, 0) >= 10000 then 8
         else 0 end
    + case when coalesce(p.has_high_value_plan, false) then 15 else 0 end
    + case when c.created_at <= now() - interval '3 years' then 15 else 0 end
    + case when coalesce(e.due_within_30_days, false) then 25 else 0 end
    + case when p.next_premium_due_date between current_date and current_date + interval '7 days' then 20 else 0 end
    + case when coalesce(e.lapse_or_payment_risk, false) or coalesce(p.lapsed_policy_count, 0) > 0 then 40 else 0 end
    + case when coalesce(e.birthday_today, false) then 10 else 0 end
    + case when coalesce(t.overdue_task_count, 0) > 0 then 25 else 0 end
    + case when c.consent_status <> 'verified' or coalesce(e.consent_event_open, false) then 30 else 0 end
    + case when c.last_contacted_at is null or c.last_contacted_at <= current_date - interval '60 days' then 15 else 0 end
    + case when c.status = 'prospect' then 15 else 0 end
  )::integer as priority_score,
  concat_ws(
    '; ',
    case when coalesce(p.total_premium, 0) >= 30000 then 'business impact from premium base' end,
    case when coalesce(p.has_high_value_plan, false) then 'premium/high-value plan' end,
    case when coalesce(e.due_within_30_days, false) then 'renewal or premium due soon' end,
    case when coalesce(e.lapse_or_payment_risk, false) or coalesce(p.lapsed_policy_count, 0) > 0 then 'payment or lapse risk' end,
    case when coalesce(e.birthday_today, false) then 'birthday touchpoint today' end,
    case when coalesce(t.overdue_task_count, 0) > 0 then 'overdue follow-up' end,
    case when c.consent_status <> 'verified' or coalesce(e.consent_event_open, false) then 'consent/compliance attention needed' end,
    case when c.last_contacted_at is null or c.last_contacted_at <= current_date - interval '60 days' then 'relationship touchpoint overdue' end,
    e.event_reasons,
    t.task_reasons
  ) as priority_reason
from clients c
left join policy_rollup p on p.client_id = c.id
left join event_rollup e on e.client_id = c.id
left join task_rollup t on t.client_id = c.id;

-- Action automation: one row per open event with a suggested message/action.
create or replace view daily_action_suggestions as
select
  e.id as event_id,
  e.client_id,
  c.advisor_id,
  c.name as client_name,
  e.event_type,
  e.title,
  e.event_date,
  q.priority_score,
  q.priority_reason,
  case
    when c.consent_status <> 'verified' then 'Refresh consent before using private client details.'
    when e.event_type = 'birthday' then 'Send a warm birthday WhatsApp and mark touchpoint complete.'
    when e.event_type in ('renewal_due', 'premium_due') then 'Send a renewal/payment reminder and prepare review options.'
    when e.event_type in ('missed_payment', 'policy_lapse_risk') then 'Contact client with service-first lapse prevention language.'
    when e.event_type = 'follow_up_due' then 'Complete the promised follow-up.'
    when e.event_type = 'document_needed' then 'Request missing document with clear next step.'
    when e.event_type = 'new_client' then 'Prepare first discovery and needs review.'
    else 'Review client context and choose next best action.'
  end as suggested_action,
  case
    when c.consent_status <> 'verified' then 'compliance'
    when e.event_type = 'birthday' then 'birthday'
    when e.event_type in ('renewal_due', 'premium_due') then 'renewal'
    when e.event_type in ('missed_payment', 'policy_lapse_risk') then 'payment_reminder'
    when e.event_type in ('follow_up_due', 'document_needed') then 'follow_up'
    else 'follow_up'
  end as message_type,
  case
    when c.consent_status <> 'verified' then 'Private details are masked until consent is refreshed.'
    when e.event_type = 'birthday' then 'Hi ' || c.name || ', happy birthday. Wishing you a wonderful year ahead.'
    when e.event_type = 'renewal_due' then 'Hi ' || c.name || ', I wanted to remind you that your policy review is coming up. I can prepare a short options summary for your review.'
    when e.event_type = 'premium_due' then 'Hi ' || c.name || ', a quick reminder that your premium due date is coming up. Let me know if you would like me to walk through the payment options.'
    when e.event_type in ('missed_payment', 'policy_lapse_risk') then 'Hi ' || c.name || ', I noticed there may be a payment or policy continuity item to resolve. I can help review the next step so your coverage stays protected.'
    when e.event_type = 'document_needed' then 'Hi ' || c.name || ', could you please share the pending document when convenient? I will use it to prepare the next review step.'
    else 'Hi ' || c.name || ', following up on our previous discussion. I will prepare the next step and keep it concise.'
  end as draft_message
from client_events e
join clients c on c.id = e.client_id
left join client_priority_queue q on q.client_id = c.id
where e.status = 'open';
