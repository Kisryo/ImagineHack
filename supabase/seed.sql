-- AdvisorFlow AI seed data
-- Run after supabase/schema.sql.

insert into advisors (id, name, email, role, region, cpd_hours, cpd_target)
values
  ('00000000-0000-0000-0000-000000000001', 'Alex Lim', 'alex@example.com', 'advisor', 'Klang Valley', 18, 30),
  ('00000000-0000-0000-0000-000000000002', 'Maya Singh', 'maya@example.com', 'advisor', 'Penang', 26, 30),
  ('00000000-0000-0000-0000-000000000003', 'Nadia Wong', 'nadia@example.com', 'admin', 'Malaysia', 0, 0)
on conflict (email) do nothing;

insert into clients (
  id,
  advisor_id,
  name,
  phone,
  email,
  birthday,
  segment,
  occupation,
  status,
  consent_status,
  preferred_channel,
  preferred_language,
  relationship_notes,
  last_contacted_at,
  created_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Mr. Tan Chee Wei',
    '+6012-000-1001',
    'tan@example.com',
    current_date,
    'HNW Family Office',
    'Manufacturing Founder',
    'active',
    'verified',
    'whatsapp',
    'English',
    'Prefers concise WhatsApp summaries and one-page options. Sensitive to long product decks.',
    current_date - interval '9 days',
    now() - interval '4 years'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Dr. Aisha Rahman',
    '+6012-000-1002',
    'aisha@example.com',
    date '1985-09-14',
    'Professional',
    'Cardiologist',
    'active',
    'verified',
    'email',
    'English',
    'Values data-led comparisons and peer benchmarks. Prefers email follow-ups after 8pm.',
    current_date - interval '3 days',
    now() - interval '18 months'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Consent-locked client',
    null,
    null,
    null,
    'Consent Hold',
    'Masked',
    'active',
    'review_due',
    'whatsapp',
    'English',
    'Private record masked until consent refresh.',
    current_date - interval '15 days',
    now() - interval '2 years'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Mr. Kumar Nair',
    '+6012-000-1004',
    'kumar@example.com',
    date '1977-01-22',
    'SME Owner',
    'Logistics Director',
    'active',
    'verified',
    'call',
    'English',
    'Prefers calls before 9am. Wants practical, low-admin solutions.',
    current_date - interval '70 days',
    now() - interval '5 years'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000002',
    'Ms. Nurul Iman',
    '+6012-000-1005',
    'nurul@example.com',
    date '1992-12-03',
    'Young Family',
    'Product Manager',
    'active',
    'verified',
    'whatsapp',
    'Bahasa Malaysia',
    'Prefers app messages during work hours. Wants transparent fees and flexible premium options.',
    current_date - interval '4 days',
    now() - interval '8 months'
  )
on conflict (id) do nothing;

insert into policies (client_id, policy_type, policy_name, premium_amount, coverage_amount, start_date, renewal_date, premium_due_date, status, plan_tier)
values
  ('10000000-0000-0000-0000-000000000001', 'life', 'Estate Liquidity Bridge', 56000, 1800000, current_date - interval '4 years', current_date + interval '24 days', current_date + interval '7 days', 'active', 'high_value'),
  ('10000000-0000-0000-0000-000000000001', 'medical', 'Family Medical Plus', 30000, 500000, current_date - interval '3 years', current_date + interval '80 days', current_date + interval '80 days', 'active', 'premium'),
  ('10000000-0000-0000-0000-000000000002', 'income', 'Specialist Income Protection', 24000, 950000, current_date - interval '1 year', current_date + interval '42 days', current_date + interval '12 days', 'active', 'premium'),
  ('10000000-0000-0000-0000-000000000002', 'medical', 'Professional Medical Elite', 10000, 300000, current_date - interval '1 year', current_date + interval '120 days', current_date + interval '120 days', 'active', 'standard'),
  ('10000000-0000-0000-0000-000000000004', 'business', 'SME Key Person Cover', 28000, 900000, current_date - interval '5 years', current_date + interval '18 days', current_date - interval '2 days', 'due_soon', 'premium'),
  ('10000000-0000-0000-0000-000000000004', 'medical', 'Group Medical Starter', 14000, 350000, current_date - interval '2 years', current_date + interval '210 days', current_date + interval '30 days', 'active', 'standard'),
  ('10000000-0000-0000-0000-000000000005', 'family', 'Young Family Protection', 13500, 420000, current_date - interval '6 months', current_date + interval '180 days', current_date + interval '30 days', 'active', 'standard'),
  ('10000000-0000-0000-0000-000000000005', 'education', 'Education Saver', 5000, 120000, current_date - interval '6 months', current_date + interval '365 days', current_date + interval '45 days', 'active', 'basic');

insert into client_events (client_id, event_type, title, description, event_date, source, status)
values
  ('10000000-0000-0000-0000-000000000001', 'birthday', 'Birthday touchpoint', 'Send warm birthday WhatsApp. Keep it relationship-first, not salesy.', current_date, 'crm', 'open'),
  ('10000000-0000-0000-0000-000000000001', 'renewal_due', 'Estate plan review due soon', 'High-value policy renewal is within 30 days.', current_date + interval '24 days', 'policy', 'open'),
  ('10000000-0000-0000-0000-000000000001', 'follow_up_due', 'Send one-page legacy planning options', 'Advisor promised a concise one-page options summary.', current_date, 'manual', 'open'),
  ('10000000-0000-0000-0000-000000000002', 'document_needed', 'Request clinic partnership documents', 'Prepare income protection review for private clinic partnership.', current_date + interval '2 days', 'manual', 'open'),
  ('10000000-0000-0000-0000-000000000002', 'life_event', 'New clinic partnership', 'Career change creates income and business continuity planning need.', current_date, 'manual', 'open'),
  ('10000000-0000-0000-0000-000000000003', 'consent_review', 'PDPA consent refresh required', 'Private data and recommendations must remain masked until consent is refreshed.', current_date, 'system', 'open'),
  ('10000000-0000-0000-0000-000000000004', 'missed_payment', 'Premium payment missed', 'Coverage continuity may be at risk if not resolved.', current_date - interval '2 days', 'policy', 'open'),
  ('10000000-0000-0000-0000-000000000004', 'policy_lapse_risk', 'Lapse prevention needed', 'Missed payment plus SME debt exposure makes this urgent.', current_date, 'system', 'open'),
  ('10000000-0000-0000-0000-000000000005', 'new_client', 'Young family onboarding', 'Newborn and mortgage approval create family protection planning window.', current_date + interval '1 day', 'crm', 'open'),
  ('10000000-0000-0000-0000-000000000005', 'premium_due', 'Starter plan premium due', 'Upcoming premium due date should be handled with light reminder.', current_date + interval '30 days', 'policy', 'open');

insert into tasks (client_id, advisor_id, title, description, due_date, priority, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Prepare one-page legacy planning options', 'Use concise format; avoid long product deck.', current_date, 'high', 'open'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Confirm tax desk availability', 'Needed before estate/tax review.', current_date, 'medium', 'open'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Send disability income benchmark scenarios', 'Use data-led comparison.', current_date, 'medium', 'open'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Refresh PDPA consent before recommendation', 'Private workflows must stay masked.', current_date - interval '1 day', 'medium', 'overdue'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Resolve missed premium and debt cover gap', 'Service-first call before any new recommendation.', current_date - interval '2 days', 'high', 'overdue'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Build joint affordability view', 'Young family protection review.', current_date + interval '1 day', 'medium', 'open');

insert into learning_content (title, topic, description, cpd_hours, tags, duration_minutes, content_url)
values
  ('Estate Liquidity Conversation Refresher', 'estate planning', 'How to discuss estate liquidity without sounding product-led.', 0.5, array['legacy','estate','tax'], 8, null),
  ('SME Key-Person and Debt Protection', 'sme risk', 'Map debt, guarantor, and key-person exposure into a practical advice note.', 0.75, array['sme','key-person','debt'], 10, null),
  ('Professional Income Protection Basics', 'income protection', 'Prepare income continuity scenarios for professionals and clinic owners.', 0.5, array['income','medical','professional'], 7, null),
  ('Consent And Audit Hygiene', 'compliance', 'Apply consent masking, disclosure, and audit controls before action.', 0.5, array['consent','audit','compliance'], 6, null),
  ('Young Family Protection Starter', 'family protection', 'Turn newborn, mortgage, and education signals into staged recommendations.', 0.5, array['family','education','medical'], 8, null);

insert into generated_messages (client_id, advisor_id, message_type, channel, body, compliance_disclaimer, status)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'birthday',
    'whatsapp',
    'Hi Mr. Tan Chee Wei, happy birthday. Wishing you a wonderful year ahead.',
    'Relationship touchpoint only; no recommendation included.',
    'draft'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'payment_reminder',
    'whatsapp',
    'Hi Mr. Kumar Nair, I noticed there may be a payment or policy continuity item to resolve. I can help review the next step so your coverage stays protected.',
    'Service reminder only; final advice depends on updated suitability checks.',
    'draft'
  );

insert into audit_log (actor_id, client_id, action, risk_level, metadata)
values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Generated birthday draft', 'low', '{"source":"seed"}'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Blocked private action until consent refresh', 'high', '{"control":"consent"}'),
  ('00000000-0000-0000-0000-000000000003', null, 'Reviewed daily advisor priority queue', 'low', '{"source":"seed"}');
