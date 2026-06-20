create extension if not exists "pgcrypto";

create table if not exists organizations (
  id text primary key,
  name text not null,
  region text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('Admin', 'Advisor')),
  region text not null,
  license_status text not null,
  cpd_hours integer not null default 0,
  cpd_target integer not null default 30,
  risk_profile text not null default 'normal',
  focus_segments text[] not null default '{}',
  languages text[] not null default '{}',
  book_premium numeric not null default 0,
  retention_rate numeric not null default 0,
  referrals_won integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  advisor_id text references profiles(id) on delete set null,
  name text not null,
  segment text not null,
  age integer,
  occupation text not null,
  location text not null,
  priority_signals text[] not null default '{}',
  needs text[] not null default '{}',
  assets text not null,
  annual_premium numeric not null default 0,
  last_contact date not null,
  next_meeting timestamptz,
  consent_status text not null,
  household text not null,
  propensity integer not null default 0,
  estimated_coverage_gap numeric not null default 0,
  next_best_offer text not null,
  policy_value numeric not null default 0,
  opportunity_value numeric not null default 0,
  referral_potential integer not null default 0 check (referral_potential between 0 and 100),
  engagement_urgency integer not null default 0 check (engagement_urgency between 0 and 100),
  care_urgency integer not null default 0 check (care_urgency between 0 and 100),
  relationship_importance integer not null default 0 check (relationship_importance between 0 and 100),
  personality text not null default '',
  interests text[] not null default '{}',
  preferred_channel text not null default 'WhatsApp',
  preferred_tone text not null default 'Warm',
  birthday date,
  life_event text not null default '',
  relationship_notes text not null default '',
  memory jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists partners (
  id text primary key,
  organization_id text references organizations(id) on delete cascade,
  name text not null,
  specialty text not null,
  tags text[] not null default '{}',
  sla text not null,
  quality_score integer not null,
  availability text not null,
  evidence_required text[] not null default '{}',
  commercial_model text not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  title text not null,
  due_date date not null,
  status text not null check (status in ('Open', 'Overdue', 'Done')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  partner_id text references partners(id) on delete set null,
  partner_name text not null,
  status text not null,
  note text not null,
  stage text not null,
  expected_value numeric not null default 0,
  probability integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id text primary key,
  advisor_id text references profiles(id) on delete set null,
  client_id text references clients(id) on delete cascade,
  category text not null,
  amount numeric,
  status text not null check (status in ('Approved', 'Pending', 'Flagged', 'Masked')),
  expense_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists cpd_courses (
  id text primary key,
  organization_id text references organizations(id) on delete cascade default 'org-aag-asg',
  title text not null,
  category text not null,
  hours integer not null,
  fit_tags text[] not null default '{}',
  status text not null,
  format text not null,
  outcome text not null,
  created_at timestamptz not null default now()
);

create table if not exists meetings (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  time_label text not null,
  topic text not null,
  channel text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists overnight_signals (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  source text not null,
  signal text not null,
  confidence integer not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists business_impact_items (
  id text primary key,
  organization_id text references organizations(id) on delete cascade default 'org-aag-asg',
  label text not null,
  value numeric not null,
  unit text not null,
  narrative text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists admin_review_items (
  id text primary key,
  organization_id text references organizations(id) on delete cascade default 'org-aag-asg',
  client_id text references clients(id) on delete set null,
  title text not null,
  owner text not null,
  queue text not null,
  priority text not null check (priority in ('Low', 'Medium', 'High')),
  eta text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists consent_requests (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  status text not null check (status in ('Pending consent refresh', 'Closed')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists compliance_items (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  owner text not null,
  issue text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  status text not null,
  due_date date not null,
  control text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  organization_id text references organizations(id) on delete cascade default 'org-aag-asg',
  actor text not null,
  action text not null,
  risk text not null check (risk in ('Low', 'Medium', 'High')),
  time_label text,
  logged_at timestamptz not null default now()
);

alter table cpd_courses add column if not exists organization_id text references organizations(id) on delete cascade default 'org-aag-asg';
alter table audit_logs add column if not exists organization_id text references organizations(id) on delete cascade default 'org-aag-asg';
alter table clients add column if not exists policy_value numeric not null default 0;
alter table clients add column if not exists opportunity_value numeric not null default 0;
alter table clients add column if not exists referral_potential integer not null default 0;
alter table clients add column if not exists engagement_urgency integer not null default 0;
alter table clients add column if not exists care_urgency integer not null default 0;
alter table clients add column if not exists relationship_importance integer not null default 0;
alter table clients add column if not exists personality text not null default '';
alter table clients add column if not exists interests text[] not null default '{}';
alter table clients add column if not exists preferred_channel text not null default 'WhatsApp';
alter table clients add column if not exists preferred_tone text not null default 'Warm';
alter table clients add column if not exists birthday date;
alter table clients add column if not exists life_event text not null default '';
alter table clients add column if not exists relationship_notes text not null default '';

alter table clients drop constraint if exists clients_referral_potential_range;
alter table clients add constraint clients_referral_potential_range check (referral_potential between 0 and 100);
alter table clients drop constraint if exists clients_engagement_urgency_range;
alter table clients add constraint clients_engagement_urgency_range check (engagement_urgency between 0 and 100);
alter table clients drop constraint if exists clients_care_urgency_range;
alter table clients add constraint clients_care_urgency_range check (care_urgency between 0 and 100);
alter table clients drop constraint if exists clients_relationship_importance_range;
alter table clients add constraint clients_relationship_importance_range check (relationship_importance between 0 and 100);

update consent_requests
set status = 'Pending consent refresh'
where status = 'Pending admin review';

update consent_requests
set status = 'Closed'
where status in ('Approved', 'Rejected');

alter table consent_requests drop constraint if exists consent_requests_status_check;
alter table consent_requests add constraint consent_requests_status_check
  check (status in ('Pending consent refresh', 'Closed'));

create or replace function current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function current_org_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_profile_role() = 'Admin'
$$;

create or replace function owns_client(target_client_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clients
    where id = target_client_id
      and organization_id = current_org_id()
      and advisor_id = current_profile_id()
  )
$$;

create or replace function client_in_current_org(target_client_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clients
    where id = target_client_id
      and organization_id = current_org_id()
  )
$$;

create or replace function owns_verified_client(target_client_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clients
    where id = target_client_id
      and organization_id = current_org_id()
      and advisor_id = current_profile_id()
      and consent_status = 'Verified'
  )
$$;

drop function if exists get_scoped_clients();
create function get_scoped_clients()
returns table (
  id text,
  organization_id text,
  advisor_id text,
  name text,
  segment text,
  age integer,
  occupation text,
  location text,
  priority_signals text[],
  needs text[],
  assets text,
  annual_premium numeric,
  last_contact date,
  next_meeting timestamptz,
  consent_status text,
  household text,
  propensity integer,
  estimated_coverage_gap numeric,
  next_best_offer text,
  policy_value numeric,
  opportunity_value numeric,
  referral_potential integer,
  engagement_urgency integer,
  care_urgency integer,
  relationship_importance integer,
  personality text,
  interests text[],
  preferred_channel text,
  preferred_tone text,
  birthday date,
  life_event text,
  relationship_notes text,
  memory jsonb,
  timeline jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.organization_id,
    c.advisor_id,
    case when c.consent_status = 'Verified' then c.name else 'Consent-locked client' end,
    case when c.consent_status = 'Verified' then c.segment else 'Consent Hold' end,
    case when c.consent_status = 'Verified' then c.age else null::integer end,
    case when c.consent_status = 'Verified' then c.occupation else 'Masked' end,
    case when c.consent_status = 'Verified' then c.location else 'Masked' end,
    case when c.consent_status = 'Verified' then c.priority_signals else array['Consent review due','Private signals masked']::text[] end,
    case when c.consent_status = 'Verified' then c.needs else array['consent-review']::text[] end,
    case when c.consent_status = 'Verified' then c.assets else 'Masked' end,
    case when c.consent_status = 'Verified' then c.annual_premium else 0::numeric end,
    case when c.consent_status = 'Verified' then c.last_contact else current_date end,
    case when c.consent_status = 'Verified' then c.next_meeting else null::timestamptz end,
    c.consent_status,
    case when c.consent_status = 'Verified' then c.household else 'Masked' end,
    case when c.consent_status = 'Verified' then c.propensity else 0 end,
    case when c.consent_status = 'Verified' then c.estimated_coverage_gap else 0::numeric end,
    case when c.consent_status = 'Verified' then c.next_best_offer else 'Refresh PDPA consent before any recommendation' end,
    case when c.consent_status = 'Verified' then c.policy_value else 0::numeric end,
    case when c.consent_status = 'Verified' then c.opportunity_value else 0::numeric end,
    case when c.consent_status = 'Verified' then c.referral_potential else 0 end,
    case when c.consent_status = 'Verified' then c.engagement_urgency else 0 end,
    case when c.consent_status = 'Verified' then c.care_urgency else 0 end,
    case when c.consent_status = 'Verified' then c.relationship_importance else 0 end,
    case when c.consent_status = 'Verified' then c.personality else 'Masked' end,
    case when c.consent_status = 'Verified' then c.interests else array[]::text[] end,
    case when c.consent_status = 'Verified' then c.preferred_channel else 'Consent refresh' end,
    case when c.consent_status = 'Verified' then c.preferred_tone else 'Consent-safe' end,
    case when c.consent_status = 'Verified' then c.birthday else null::date end,
    case when c.consent_status = 'Verified' then c.life_event else 'Masked' end,
    case when c.consent_status = 'Verified' then c.relationship_notes else 'Private relationship intelligence remains masked until consent refresh.' end,
    case
      when c.consent_status = 'Verified' then c.memory
      else '["Private record masked until consent refresh.","Advisor must verify consent before reviewing notes."]'::jsonb
    end,
    case
      when c.consent_status = 'Verified' then c.timeline
      else '[{"date":"2026-06-20","type":"Compliance","note":"Consent refresh pending."}]'::jsonb
    end,
    c.created_at
  from clients c
  where c.organization_id = current_org_id()
    and (is_admin() or c.advisor_id = current_profile_id())
  order by c.created_at;
$$;

revoke all on function get_scoped_clients() from public;
grant execute on function get_scoped_clients() to authenticated;

create or replace function set_audit_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_org text;
begin
  profile_org := current_org_id();
  if profile_org is not null then
    new.organization_id := profile_org;
  end if;
  select full_name into profile_name from profiles where id = current_profile_id();
  if profile_name is not null then
    new.actor := profile_name;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_identity_before_insert on audit_logs;
create trigger audit_identity_before_insert
before insert on audit_logs
for each row
execute function set_audit_identity();

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table partners enable row level security;
alter table tasks enable row level security;
alter table referrals enable row level security;
alter table expenses enable row level security;
alter table cpd_courses enable row level security;
alter table meetings enable row level security;
alter table overnight_signals enable row level security;
alter table business_impact_items enable row level security;
alter table admin_review_items enable row level security;
alter table consent_requests enable row level security;
alter table compliance_items enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "Authenticated users can read organizations" on organizations;
drop policy if exists "Authenticated users can read profiles" on profiles;
drop policy if exists "Authenticated users can read clients" on clients;
drop policy if exists "Authenticated users can read partners" on partners;
drop policy if exists "Authenticated users can read tasks" on tasks;
drop policy if exists "Authenticated users can read referrals" on referrals;
drop policy if exists "Authenticated users can read expenses" on expenses;
drop policy if exists "Authenticated users can read cpd_courses" on cpd_courses;
drop policy if exists "Authenticated users can read consent_requests" on consent_requests;
drop policy if exists "Authenticated users can read compliance_items" on compliance_items;
drop policy if exists "Authenticated users can read audit_logs" on audit_logs;
drop policy if exists "Authenticated users can write tasks" on tasks;
drop policy if exists "Authenticated users can write referrals" on referrals;
drop policy if exists "Authenticated users can write expenses" on expenses;
drop policy if exists "Authenticated users can write consent_requests" on consent_requests;
drop policy if exists "Authenticated users can write audit_logs" on audit_logs;
drop policy if exists "Authenticated users can update clients" on clients;

drop policy if exists "Organization members can read organization" on organizations;
drop policy if exists "Users can read own or admin profiles" on profiles;
drop policy if exists "Admins can write profiles" on profiles;
drop policy if exists "Users can read scoped clients" on clients;
drop policy if exists "Admins can update clients" on clients;
drop policy if exists "Users can read scoped partners" on partners;
drop policy if exists "Admins can write partners" on partners;
drop policy if exists "Users can read scoped tasks" on tasks;
drop policy if exists "Advisors can insert scoped tasks" on tasks;
drop policy if exists "Advisors can update scoped tasks" on tasks;
drop policy if exists "Users can read scoped referrals" on referrals;
drop policy if exists "Advisors can insert scoped referrals" on referrals;
drop policy if exists "Users can read scoped expenses" on expenses;
drop policy if exists "Advisors can insert scoped expenses" on expenses;
drop policy if exists "Admins can update scoped expenses" on expenses;
drop policy if exists "Users can read scoped cpd courses" on cpd_courses;
drop policy if exists "Users can read scoped meetings" on meetings;
drop policy if exists "Users can read scoped overnight signals" on overnight_signals;
drop policy if exists "Users can read scoped business impact" on business_impact_items;
drop policy if exists "Admins can read review items" on admin_review_items;
drop policy if exists "Users can read scoped consent requests" on consent_requests;
drop policy if exists "Advisors can insert scoped consent requests" on consent_requests;
drop policy if exists "Admins can update scoped consent requests" on consent_requests;
drop policy if exists "Users can read scoped compliance items" on compliance_items;
drop policy if exists "Users can read scoped audit logs" on audit_logs;
drop policy if exists "Users can insert scoped audit logs" on audit_logs;

create policy "Organization members can read organization"
  on organizations for select to authenticated
  using (id = current_org_id());

create policy "Users can read own or admin profiles"
  on profiles for select to authenticated
  using (auth_user_id = auth.uid() or (is_admin() and organization_id = current_org_id()));

create policy "Users can read scoped partners"
  on partners for select to authenticated
  using (organization_id = current_org_id());

create policy "Users can read scoped tasks"
  on tasks for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Advisors can insert scoped tasks"
  on tasks for insert to authenticated
  with check (owns_verified_client(client_id));

create policy "Advisors can update scoped tasks"
  on tasks for update to authenticated
  using (owns_verified_client(client_id))
  with check (owns_verified_client(client_id));

create policy "Users can read scoped referrals"
  on referrals for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Advisors can insert scoped referrals"
  on referrals for insert to authenticated
  with check (owns_verified_client(client_id));

create policy "Users can read scoped expenses"
  on expenses for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Advisors can insert scoped expenses"
  on expenses for insert to authenticated
  with check (owns_verified_client(client_id) and advisor_id = current_profile_id());

create policy "Users can read scoped cpd courses"
  on cpd_courses for select to authenticated
  using (organization_id = current_org_id());

create policy "Users can read scoped meetings"
  on meetings for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Users can read scoped overnight signals"
  on overnight_signals for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Users can read scoped business impact"
  on business_impact_items for select to authenticated
  using (organization_id = current_org_id());

create policy "Admins can read review items"
  on admin_review_items for select to authenticated
  using (organization_id = current_org_id() and is_admin());

create policy "Users can read scoped consent requests"
  on consent_requests for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Advisors can insert scoped consent requests"
  on consent_requests for insert to authenticated
  with check (owns_client(client_id) and status = 'Pending consent refresh');

create policy "Users can read scoped compliance items"
  on compliance_items for select to authenticated
  using (client_in_current_org(client_id) and (is_admin() or owns_client(client_id)));

create policy "Users can read scoped audit logs"
  on audit_logs for select to authenticated
  using (organization_id = current_org_id());

create policy "Users can insert scoped audit logs"
  on audit_logs for insert to authenticated
  with check (organization_id = current_org_id());
