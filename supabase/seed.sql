insert into organizations (id, name, region) values
  ('org-aag-asg', 'AAG x ASG Advisor Network', 'Malaysia')
on conflict (id) do update set name = excluded.name, region = excluded.region;

insert into profiles (
  id, organization_id, email, full_name, role, region, license_status, cpd_hours,
  cpd_target, risk_profile, focus_segments, languages, book_premium, retention_rate, referrals_won
) values
  ('adv-alex', 'org-aag-asg', 'alex.lim@advisorflow.local', 'Alex Lim', 'Advisor', 'Klang Valley', 'Active', 18, 30, 'normal', array['HNW Family Office','SME Owner','Professional'], array['English','Bahasa Malaysia','Mandarin'], 162000, 94, 7),
  ('adv-maya', 'org-aag-asg', 'maya.singh@advisorflow.local', 'Maya Singh', 'Advisor', 'Penang', 'Active', 26, 30, 'normal', array['Young Family','Professional'], array['English','Bahasa Malaysia','Tamil'], 98000, 91, 4),
  ('admin-nadia', 'org-aag-asg', 'nadia.wong@advisorflow.local', 'Nadia Wong', 'Admin', 'Malaysia', 'Admin', 0, 0, 'oversight', array['Governance','Operations'], array['English','Bahasa Malaysia','Mandarin'], 0, 0, 0)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  region = excluded.region,
  license_status = excluded.license_status,
  cpd_hours = excluded.cpd_hours,
  cpd_target = excluded.cpd_target,
  focus_segments = excluded.focus_segments,
  languages = excluded.languages,
  book_premium = excluded.book_premium,
  retention_rate = excluded.retention_rate,
  referrals_won = excluded.referrals_won;

insert into clients (
  id, organization_id, advisor_id, name, segment, age, occupation, location, priority_signals,
  needs, assets, annual_premium, last_contact, next_meeting, consent_status, household,
  propensity, estimated_coverage_gap, next_best_offer, policy_value, opportunity_value,
  referral_potential, engagement_urgency, care_urgency, relationship_importance, personality,
  interests, preferred_channel, preferred_tone, birthday, life_event, relationship_notes, memory, timeline
) values
  (
    'client-tan', 'org-aag-asg', 'adv-alex', 'Mr. Tan Chee Wei', 'HNW Family Office', 58,
    'Manufacturing Founder', 'Petaling Jaya',
    array['Policy review overdue','Recent liquidity event','Estate planning gap'],
    array['legacy','key-person','medical','tax'], 'RM 8.2m', 86000, '2026-06-11',
    '2026-06-20 10:30:00+08', 'Verified', 'Spouse and two adult children', 92, 1800000,
    'Estate liquidity bridge with key-person continuity review',
    128000, 480000, 96, 88, 96, 98,
    'Decisive founder who prefers concise options and practical next steps',
    array['golf','single-origin coffee','succession planning','family travel'],
    'WhatsApp', 'Concise and warm', '1968-06-20',
    'Birthday today and daughter starts university in Australia in July',
    'Strong VIP relationship; open with birthday care, coffee and golf, then keep the estate review to a one-page decision path.',
    '["Prefers concise WhatsApp summaries before calls.","Daughter starts university in Australia in July.","Enjoys Saturday golf at Saujana and asks for coffee recommendations.","Asked about succession planning after factory expansion.","Sensitive to long product decks; wants one-page options."]',
    '[{"date":"2026-06-20","type":"Meeting","note":"Annual portfolio and estate review scheduled."},{"date":"2026-06-12","type":"Signal","note":"Sold minority stake in Tan Precision Components."},{"date":"2026-05-28","type":"Service","note":"Updated beneficiary nomination for medical plan."},{"date":"2026-04-19","type":"Referral","note":"Introduced to ASG tax desk for holding structure review."}]'
  ),
  (
    'client-aisha', 'org-aag-asg', 'adv-alex', 'Dr. Aisha Rahman', 'Professional', 41,
    'Cardiologist', 'Subang Jaya',
    array['New clinic partnership','Protection shortfall','High income volatility'],
    array['medical','income','business'], 'RM 1.7m', 34000, '2026-06-17',
    '2026-06-20 14:00:00+08', 'Verified', 'Single, supports parents', 84, 950000,
    'Specialist income protection and clinic buy-in continuity plan',
    54000, 180000, 72, 74, 62, 82,
    'Analytical specialist who likes evidence, benchmarks and clear assumptions',
    array['medical innovation','parent care','data dashboards'],
    'Email', 'Evidence-led', '1985-09-14',
    'Considering buying into a private clinic group',
    'Keep messages structured with benchmarks and clear personal-versus-clinic separation.',
    '["Values data-led comparisons and peer benchmarks.","Considering buying into a private clinic group.","Prefers email follow-ups after 8pm.","Wants scenarios that separate personal cover from clinic liabilities."]',
    '[{"date":"2026-06-20","type":"Meeting","note":"Clinic partnership protection discussion."},{"date":"2026-06-14","type":"Note","note":"Asked for disability income scenarios."},{"date":"2026-05-08","type":"CPD","note":"Advisor completed medical specialist planning module."},{"date":"2026-04-22","type":"Claim","note":"Asked about specialist panel access for parents."}]'
  ),
  (
    'client-lee', 'org-aag-asg', 'adv-alex', 'Consent-locked client', 'Consent Hold', null,
    'Masked', 'Masked', array['Consent review due','Private signals masked'],
    array['consent-review'], 'Masked', 0, '2026-06-05', '2026-06-21 11:30:00+08',
    'Review due', 'Masked', 0, 0, 'Refresh PDPA consent before any recommendation',
    0, 0, 0, 0, 0, 0,
    'Masked',
    array[]::text[],
    'Masked', 'Consent-safe', null,
    'Masked',
    'Private relationship intelligence remains masked until consent refresh.',
    '["Private record masked until consent refresh.","Advisor must verify consent before reviewing notes."]',
    '[{"date":"2026-06-21","type":"Compliance","note":"Consent refresh pending."},{"date":"2026-06-07","type":"Task","note":"Consent refresh requested."}]'
  ),
  (
    'client-kumar', 'org-aag-asg', 'adv-alex', 'Mr. Kumar Nair', 'SME Owner', 49,
    'Logistics Director', 'Shah Alam',
    array['Missed premium','Fleet expansion loan','Key-person concentration'],
    array['key-person','debt','medical'], 'RM 2.9m', 42000, '2026-05-30', null,
    'Verified', 'Spouse, three children, family-owned logistics firm', 78, 1250000,
    'Debt protection reset tied to fleet financing facility',
    68000, 220000, 64, 91, 86, 74,
    'Direct operator who values practical, low-admin fixes',
    array['logistics tech','early breakfast meetings','football'],
    'Phone', 'Direct and practical', '1977-11-03',
    'Fleet expansion loan has increased guarantor exposure',
    'Lead with service recovery before any relationship gesture because a missed premium signal is active.',
    '["Prefers calls before 9am.","Concerned about loan covenant exposure.","Wants practical, low-admin solutions.","Responds well to risk maps by vehicle, route and guarantor."]',
    '[{"date":"2026-06-18","type":"Alert","note":"Premium reminder generated after missed payment."},{"date":"2026-06-03","type":"Signal","note":"New fleet financing facility announced."},{"date":"2026-05-18","type":"Service","note":"Group medical claims analysis completed."},{"date":"2026-04-02","type":"Referral","note":"Introduced to SME Risk Solutions for debt cover design."}]'
  ),
  (
    'client-nurul', 'org-aag-asg', 'adv-maya', 'Ms. Nurul Iman', 'Young Family', 34,
    'Product Manager', 'Cyberjaya',
    array['Newborn added','Mortgage approved','Education goal opened'],
    array['family','education','medical'], 'RM 620k', 18500, '2026-06-16',
    '2026-06-22 09:00:00+08', 'Verified', 'Married with newborn', 73, 620000,
    'Family protection starter plan with education funding pathway',
    28500, 95000, 58, 69, 78, 80,
    'Busy product leader who wants transparent, staged decisions',
    array['newborn care','education planning','productivity apps'],
    'In-app message', 'Friendly and clear', '1992-02-18',
    'Newborn added and first family mortgage approved',
    'Offer flexible options and make space for spouse alignment before any product recommendation.',
    '["Prefers app messages during work hours.","Asked for joint affordability view with spouse.","Wants transparent fees and flexible premium options."]',
    '[{"date":"2026-06-19","type":"Signal","note":"Mortgage approval imported from planning checklist."},{"date":"2026-06-15","type":"Life event","note":"Newborn dependent added to household profile."},{"date":"2026-05-30","type":"Goal","note":"Education funding goal created."}]'
  ),
  (
    'client-sofia', 'org-aag-asg', 'adv-alex', 'Ms. Sofia Chong', 'Tech Entrepreneur', 37,
    'SaaS Founder', 'Bangsar',
    array['Series A term sheet','Key-person dependency','US expansion planning'],
    array['business','key-person','income','tax'], 'RM 3.6m', 52000, '2026-06-13', null,
    'Verified', 'Married, no children, co-founder equity concentration', 81, 1120000,
    'Founder continuity and cross-border income protection review',
    78000, 260000, 88, 82, 72, 86,
    'Fast-moving founder who values sharp options and founder peer examples',
    array['trail running','specialty tea','startup mentoring'],
    'WhatsApp', 'Sharp and encouraging', '1989-06-26',
    'Series A term sheet expected by end of June',
    'Keep suggestions compact and tie them to founder runway, equity concentration and hiring risk.',
    '["Prefers two options with trade-offs, not long comparisons.","Mentors first-time founders on Friday afternoons.","Asked whether US expansion changes protection design."]',
    '[{"date":"2026-06-18","type":"Signal","note":"Investor diligence checklist requested continuity evidence."},{"date":"2026-06-13","type":"Note","note":"Discussed co-founder dependency and hiring runway."},{"date":"2026-05-21","type":"Referral","note":"Introduced to tax desk for US entity planning."}]'
  ),
  (
    'client-farid', 'org-aag-asg', 'adv-maya', 'Encik Farid Ismail', 'Retirement Planning', 62,
    'Semi-retired Engineer', 'Ipoh',
    array['Retirement income review','Grandchild education promise'],
    array['retirement','education','medical'], 'RM 980k', 14600, '2026-06-01', null,
    'Verified', 'Married, supports one grandchild education goal', 59, 360000,
    'Retirement income and medical reserve check',
    21000, 52000, 34, 58, 67, 64,
    'Patient and detail-oriented; prefers calm explanations',
    array['gardening','grandchild education','community volunteering'],
    'Phone', 'Calm and respectful', '1964-07-02',
    'Grandchild education pledge was added to retirement plan',
    'Use plain language and avoid rushing; focus on reassurance and income stability.',
    '["Prefers phone calls after lunch.","Asked to include spouse in retirement decisions.","Values conservative assumptions and written summaries."]',
    '[{"date":"2026-06-11","type":"Goal","note":"Grandchild education pledge added."},{"date":"2026-06-01","type":"Review","note":"Medical reserve concern discussed."},{"date":"2026-05-02","type":"Service","note":"Updated nominee contact details."}]'
  )
on conflict (id) do update set
  advisor_id = excluded.advisor_id,
  name = excluded.name,
  segment = excluded.segment,
  age = excluded.age,
  occupation = excluded.occupation,
  location = excluded.location,
  consent_status = excluded.consent_status,
  priority_signals = excluded.priority_signals,
  needs = excluded.needs,
  assets = excluded.assets,
  annual_premium = excluded.annual_premium,
  last_contact = excluded.last_contact,
  next_meeting = excluded.next_meeting,
  household = excluded.household,
  propensity = excluded.propensity,
  estimated_coverage_gap = excluded.estimated_coverage_gap,
  next_best_offer = excluded.next_best_offer,
  policy_value = excluded.policy_value,
  opportunity_value = excluded.opportunity_value,
  referral_potential = excluded.referral_potential,
  engagement_urgency = excluded.engagement_urgency,
  care_urgency = excluded.care_urgency,
  relationship_importance = excluded.relationship_importance,
  personality = excluded.personality,
  interests = excluded.interests,
  preferred_channel = excluded.preferred_channel,
  preferred_tone = excluded.preferred_tone,
  birthday = excluded.birthday,
  life_event = excluded.life_event,
  relationship_notes = excluded.relationship_notes,
  memory = excluded.memory,
  timeline = excluded.timeline;

insert into partners (id, organization_id, name, specialty, tags, sla, quality_score, availability, evidence_required, commercial_model) values
  ('partner-tax', 'org-aag-asg', 'ASG Tax Advisory Desk', 'Holding structures and tax planning', array['tax','legacy','business'], '1 business day', 94, '2 senior advisors available today', array['Liquidity event note','Entity structure','Client consent'], 'Referral fee eligible'),
  ('partner-estate', 'org-aag-asg', 'AAG Estate Concierge', 'Will, trust and beneficiary coordination', array['legacy','education','family'], '2 business days', 91, 'Next slot Monday morning', array['Beneficiary list','Asset snapshot','Family objective'], 'Client-paid advisory package'),
  ('partner-health', 'org-aag-asg', 'Premier Medical Underwriting', 'Complex medical underwriting', array['medical','income'], '4 hours', 89, 'Underwriter on call', array['Medical declaration','Occupation profile','Income range'], 'Panel service'),
  ('partner-sme', 'org-aag-asg', 'SME Risk Solutions', 'Debt, fleet and key-person risk', array['key-person','debt','business'], '1 business day', 87, 'Risk analyst available after 3pm', array['Loan amount','Guarantor list','Business continuity concern'], 'Referral fee eligible'),
  ('partner-education', 'org-aag-asg', 'AAG Education Funding Desk', 'Education savings and overseas tuition planning', array['education','family','legacy'], '2 business days', 86, 'Two planning slots this week', array['Child age','Target country','Monthly affordability'], 'Planning support')
on conflict (id) do update set name = excluded.name, specialty = excluded.specialty, tags = excluded.tags;

insert into tasks (id, client_id, title, due_date, status, severity) values
  ('task-1', 'client-tan', 'Prepare one-page legacy planning options', '2026-06-20', 'Open', 'high'),
  ('task-2', 'client-kumar', 'Resolve missed premium and debt cover gap', '2026-06-18', 'Overdue', 'high'),
  ('task-3', 'client-lee', 'Refresh PDPA consent before recommendation', '2026-06-19', 'Overdue', 'medium'),
  ('task-4', 'client-aisha', 'Send disability income benchmark scenarios', '2026-06-20', 'Open', 'medium'),
  ('task-5', 'client-nurul', 'Build joint affordability view for family protection', '2026-06-21', 'Open', 'medium'),
  ('task-6', 'client-tan', 'Confirm tax desk availability before meeting', '2026-06-20', 'Open', 'medium'),
  ('task-7', 'client-sofia', 'Prepare founder continuity options before Series A term sheet', '2026-06-21', 'Open', 'high'),
  ('task-8', 'client-farid', 'Call after lunch about retirement income and medical reserve', '2026-06-18', 'Overdue', 'medium')
on conflict (id) do update set status = excluded.status, severity = excluded.severity;

insert into referrals (id, client_id, partner_id, partner_name, status, note, stage, expected_value, probability) values
  ('ref-seed-1', 'client-tan', 'partner-tax', 'ASG Tax Advisory Desk', 'In progress', 'Tax and estate sequencing after liquidity event.', 'Partner matched', 42000, 82),
  ('ref-seed-2', 'client-kumar', 'partner-sme', 'SME Risk Solutions', 'Advisor review', 'Debt cover reset tied to fleet loan covenant.', 'Qualified', 21000, 67),
  ('ref-seed-3', 'client-aisha', 'partner-health', 'Premier Medical Underwriting', 'Needs scenario', 'Specialist underwriting and income protection benchmark.', 'Detected', 11000, 58)
on conflict (id) do update set status = excluded.status, stage = excluded.stage, expected_value = excluded.expected_value;

insert into expenses (id, advisor_id, client_id, category, amount, status, expense_date) values
  ('exp-1', 'adv-alex', 'client-tan', 'Client meeting', 128, 'Approved', '2026-06-11'),
  ('exp-2', 'adv-alex', 'client-aisha', 'Parking', 16, 'Pending', '2026-06-17'),
  ('exp-3', 'adv-alex', 'client-lee', 'Claim masked', null, 'Masked', '2026-06-05'),
  ('exp-4', 'adv-alex', 'client-kumar', 'SME site visit', 142, 'Flagged', '2026-06-18')
on conflict (id) do update set amount = excluded.amount, status = excluded.status;

insert into cpd_courses (id, title, category, hours, fit_tags, status, format, outcome) values
  ('cpd-legacy', 'Estate Liquidity and Legacy Conversations', 'Wealth Continuity', 3, array['legacy','tax'], 'Recommended', 'Scenario lab', 'Document suitability rationale for liquidity-triggered estate reviews.'),
  ('cpd-sme', 'SME Key-Person and Debt Protection', 'Business Protection', 2, array['key-person','business','debt'], 'Recommended', 'Case clinic', 'Map debt, guarantor and key-person exposure into an advice note.'),
  ('cpd-medical', 'Medical Specialist Planning Playbook', 'Professional Segment', 2, array['medical','income'], 'Completed', 'Microlearning', 'Benchmark specialist income and disability scenarios.'),
  ('cpd-compliance', 'Suitability, Consent and Audit Hygiene', 'Compliance', 1, array['consent','audit'], 'Required', 'Assessment', 'Apply PDPA masking, disclosure and audit-log controls.'),
  ('cpd-family', 'Young Family Needs Discovery', 'Protection Planning', 2, array['family','education','medical'], 'Recommended', 'Guided roleplay', 'Turn life-event signals into affordable staged recommendations.')
on conflict (id) do update set title = excluded.title, status = excluded.status;

insert into meetings (id, client_id, time_label, topic, channel, sort_order) values
  ('mtg-1', 'client-tan', '10:30', 'Estate and liquidity review', 'Office', 1),
  ('mtg-2', 'client-aisha', '14:00', 'Clinic partnership protection', 'Teams', 2),
  ('mtg-3', 'client-lee', 'Tomorrow 11:30', 'Consent refresh pending', 'Masked', 3),
  ('mtg-4', 'client-nurul', 'Monday 09:00', 'Young family protection review', 'Video', 4),
  ('mtg-5', 'client-sofia', 'Tuesday 16:30', 'Founder continuity planning', 'WhatsApp', 5)
on conflict (id) do update set
  time_label = excluded.time_label,
  topic = excluded.topic,
  channel = excluded.channel,
  sort_order = excluded.sort_order;

insert into overnight_signals (id, source, client_id, signal, confidence, action) values
  ('sig-1', 'CRM', 'client-tan', 'Liquidity event', 96, 'Prepare legacy options'),
  ('sig-2', 'Billing', 'client-kumar', 'Missed premium', 99, 'Prevent lapse'),
  ('sig-3', 'Consent ledger', 'client-lee', 'Consent expired', 100, 'Mask private data'),
  ('sig-4', 'Advisor note', 'client-aisha', 'Clinic buy-in', 88, 'Draft income scenarios'),
  ('sig-5', 'Life event checklist', 'client-nurul', 'Newborn and mortgage', 91, 'Recommend family review'),
  ('sig-6', 'CRM', 'client-sofia', 'Series A diligence', 93, 'Prepare founder continuity brief'),
  ('sig-7', 'Advisor note', 'client-tan', 'Birthday golf coffee moment', 97, 'Send relationship care note')
on conflict (id) do update set
  signal = excluded.signal,
  confidence = excluded.confidence,
  action = excluded.action;

insert into business_impact_items (id, organization_id, label, value, unit, narrative, sort_order) values
  ('impact-1', 'org-aag-asg', 'Premium protected', 128000, 'RM', 'At-risk premium surfaced before lapse or review delay.', 1),
  ('impact-2', 'org-aag-asg', 'Estimated coverage gap found', 4620000, 'RM', 'Needs-based gaps identified across verified clients.', 2),
  ('impact-3', 'org-aag-asg', 'Advisor admin time saved', 9.5, 'hours/week', 'Briefing, matching, CPD and audit summaries automated from system data.', 3),
  ('impact-4', 'org-aag-asg', 'Referral revenue pipeline', 74000, 'RM', 'Partner-ready opportunities routed to AAG x ASG specialists.', 4),
  ('impact-5', 'org-aag-asg', 'Compliance blocks enforced', 3, 'cases', 'Consent and disclosure issues stopped before action.', 5)
on conflict (id) do update set
  value = excluded.value,
  narrative = excluded.narrative,
  sort_order = excluded.sort_order;

insert into admin_review_items (id, organization_id, title, owner, client_id, queue, priority, eta, sort_order) values
  ('review-1', 'org-aag-asg', 'Consent refresh evidence pending', 'Nadia Wong', 'client-lee', 'Compliance', 'High', 'Today', 1),
  ('review-2', 'org-aag-asg', 'Flagged client follow-up claim visible', 'Nadia Wong', 'client-tan', 'Expenses', 'Medium', '1 day', 2),
  ('review-3', 'org-aag-asg', 'Partner referral evidence pack visible', 'Nadia Wong', 'client-tan', 'Referral', 'Medium', '2 days', 3),
  ('review-4', 'org-aag-asg', 'Monitor CPD shortfall for Advisor Alex', 'Nadia Wong', null, 'Training', 'Low', 'This week', 4)
on conflict (id) do update set
  title = excluded.title,
  priority = excluded.priority,
  eta = excluded.eta,
  sort_order = excluded.sort_order;

insert into consent_requests (id, client_id, status, reason) values
  ('consent-1', 'client-lee', 'Pending consent refresh', 'Advisor attempted to open a masked profile before PDPA refresh.')
on conflict (id) do update set status = excluded.status, reason = excluded.reason;

insert into compliance_items (id, client_id, owner, issue, severity, status, due_date, control) values
  ('comp-1', 'client-lee', 'Nadia Wong', 'Consent refresh required before private data access', 'High', 'Open', '2026-06-20', 'Mask profile, block referrals and block expenses.'),
  ('comp-2', 'client-kumar', 'Alex Lim', 'Missed premium communication must include lapse disclosure', 'Medium', 'Review', '2026-06-20', 'Draft message must include service-first language.'),
  ('comp-3', 'client-tan', 'Alex Lim', 'Legacy proposal requires suitability rationale', 'Medium', 'Ready', '2026-06-21', 'Attach needs, liquidity event and beneficiary context.'),
  ('comp-4', 'client-aisha', 'Nadia Wong', 'Medical scenario comparisons require balanced wording', 'Low', 'Ready', '2026-06-22', 'Avoid guaranteed-outcome language.')
on conflict (id) do update set status = excluded.status, control = excluded.control;

insert into audit_logs (id, time_label, actor, action, risk) values
  ('audit-1', '08:05', 'Alex Lim', 'Viewed Mr. Tan client memory', 'Low'),
  ('audit-2', '08:12', 'AdvisorFlow AI', 'Generated morning priority brief', 'Low'),
  ('audit-3', '08:18', 'Alex Lim', 'Created ASG Tax Advisory referral', 'Medium'),
  ('audit-4', '08:21', 'System', 'Blocked export until consent refresh for consent-locked client', 'High'),
  ('audit-5', '08:24', 'AdvisorFlow AI', 'Scored compliance queue and highlighted lapse disclosure risk', 'Medium'),
  ('audit-6', '08:31', 'Nadia Wong', 'Reviewed partner referral evidence checklist', 'Low')
on conflict (id) do update set action = excluded.action, risk = excluded.risk;

update profiles
set auth_user_id = auth_users.id
from auth.users as auth_users
where lower(auth_users.email) = lower(profiles.email);
