-- AdvisorFlow AI - Supabase verification script
-- Run this after:
-- 1. supabase/schema.sql
-- 2. Creating the Auth users in Supabase Authentication
-- 3. supabase/seed.sql

select
  'profiles linked to auth users' as check_name,
  count(*) filter (where auth_user_id is not null) as passed,
  count(*) as total
from profiles;

select
  id,
  email,
  role,
  case
    when auth_user_id is null then 'NOT LINKED - create Auth user, then rerun seed.sql'
    else 'LINKED'
  end as auth_status
from profiles
order by role, full_name;

select 'organizations' as table_name, count(*) as rows from organizations
union all select 'profiles', count(*) from profiles
union all select 'clients', count(*) from clients
union all select 'partners', count(*) from partners
union all select 'tasks', count(*) from tasks
union all select 'referrals', count(*) from referrals
union all select 'expenses', count(*) from expenses
union all select 'cpd_courses', count(*) from cpd_courses
union all select 'meetings', count(*) from meetings
union all select 'overnight_signals', count(*) from overnight_signals
union all select 'business_impact_items', count(*) from business_impact_items
union all select 'admin_review_items', count(*) from admin_review_items
union all select 'consent_requests', count(*) from consent_requests
union all select 'compliance_items', count(*) from compliance_items
union all select 'audit_logs', count(*) from audit_logs
order by table_name;

select
  'clients with relationship intelligence fields' as check_name,
  count(*) filter (
    where policy_value is not null
      and opportunity_value is not null
      and preferred_channel is not null
      and preferred_tone is not null
      and relationship_notes is not null
  ) as passed,
  count(*) as total
from clients;

select
  c.id as client_id,
  c.name as client_name,
  p.full_name as assigned_advisor,
  c.consent_status,
  c.annual_premium,
  c.estimated_coverage_gap,
  c.preferred_channel,
  c.preferred_tone,
  c.life_event
from clients c
left join profiles p on p.id = c.advisor_id
order by c.created_at;

with client_scores as (
  select
    id,
    name,
    round(
      least((policy_value / 5000) * 1.2, 24)
      + least(opportunity_value / 20000, 22)
      + least((referral_potential / 100.0) * 14, 14)
      + least((engagement_urgency / 100.0) * 14, 14)
      + least((care_urgency / 100.0) * 12, 12)
      + least((relationship_importance / 100.0) * 14, 14)
    ) as client_value_score
  from clients
  where consent_status = 'Verified'
)
select
  id,
  name,
  client_value_score,
  case
    when client_value_score >= 85 then 'VIP'
    when client_value_score >= 70 then 'Gold'
    when client_value_score >= 50 then 'Silver'
    else 'Bronze'
  end as calculated_tier
from client_scores
order by client_value_score desc;

select
  'mr tan vip birthday golf coffee scenario' as check_name,
  name,
  birthday,
  interests,
  preferred_channel,
  preferred_tone,
  life_event
from clients
where id = 'client-tan';

select
  'care moments due today' as check_name,
  count(*) filter (
    where consent_status <> 'Verified'
      or to_char(birthday, 'MM-DD') = '06-20'
      or exists (
        select 1
        from tasks t
        where t.client_id = clients.id
          and t.status = 'Overdue'
      )
      or exists (
        select 1
        from overnight_signals s
        where s.client_id = clients.id
          and s.signal ilike any (array['%missed premium%','%birthday%','%liquidity%'])
      )
  ) as relationship_care_moments
from clients;

select
  'gift guardrail summary' as check_name,
  count(*) filter (
    where calculated_tier in ('VIP', 'Gold')
      and consent_status = 'Verified'
      and not has_missed_premium
  ) as allowed_vip_gold_guardrails,
  count(*) filter (
    where calculated_tier not in ('VIP', 'Gold')
      or consent_status <> 'Verified'
      or has_missed_premium
  ) as blocked_or_note_only
from (
  select
    clients.*,
    exists (
      select 1 from overnight_signals s where s.client_id = clients.id and s.signal ilike '%missed premium%'
    ) as has_missed_premium,
    case
      when round(
        least((policy_value / 5000) * 1.2, 24)
        + least(opportunity_value / 20000, 22)
        + least((referral_potential / 100.0) * 14, 14)
        + least((engagement_urgency / 100.0) * 14, 14)
        + least((care_urgency / 100.0) * 12, 12)
        + least((relationship_importance / 100.0) * 14, 14)
      ) >= 85 then 'VIP'
      when round(
        least((policy_value / 5000) * 1.2, 24)
        + least(opportunity_value / 20000, 22)
        + least((referral_potential / 100.0) * 14, 14)
        + least((engagement_urgency / 100.0) * 14, 14)
        + least((care_urgency / 100.0) * 12, 12)
        + least((relationship_importance / 100.0) * 14, 14)
      ) >= 70 then 'Gold'
      when round(
        least((policy_value / 5000) * 1.2, 24)
        + least(opportunity_value / 20000, 22)
        + least((referral_potential / 100.0) * 14, 14)
        + least((engagement_urgency / 100.0) * 14, 14)
        + least((care_urgency / 100.0) * 12, 12)
        + least((relationship_importance / 100.0) * 14, 14)
      ) >= 50 then 'Silver'
      else 'Bronze'
    end as calculated_tier
  from clients
) scored_clients;

select
  r.id as referral_id,
  c.name as client_name,
  r.partner_name,
  r.stage,
  r.status,
  r.expected_value,
  r.probability
from referrals r
join clients c on c.id = r.client_id
order by r.created_at desc;
