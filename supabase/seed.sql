-- Compass demo seed. Run after schema.sql.

insert into advisors (id, name, email, role) values
  ('11111111-1111-1111-1111-111111111111', 'Aisyah Rahman', 'aisyah@compass.demo', 'advisor'),
  ('22222222-2222-2222-2222-222222222222', 'Daniel Lim',    'daniel@compass.demo',  'team_lead')
on conflict (id) do nothing;

insert into clients (id, name, owning_advisor_id, profile) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Wong Family',  '11111111-1111-1111-1111-111111111111',
    '{"location":"KL","since":"2019","notes":"multi-generational household"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tan Li Hua',   '11111111-1111-1111-1111-111111111111',
    '{"location":"Penang","since":"2021","notes":"SME owner, cautious"}'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rajesh Menon', '11111111-1111-1111-1111-111111111111',
    '{"location":"KL","since":"2018","notes":"pre-retiree"}')
on conflict (id) do nothing;

insert into interactions (client_id, advisor_id, raw_note, summary, relational, sensitivities, commitments, topics) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
    'Coffee with Mr Wong. Lit up on daughter education insurance. Shut down on estate planning, still sore about 2022 trust.',
    'Discussed daughter education insurance. Engaged warmly; pulled back on estate planning.',
    '["Lights up on family/insurance topics","Shuts down on estate planning","Prefers afternoon meetings"]'::jsonb,
    '["2022 trust recommendation still a sore point — do not re-pitch the same structure"]'::jsonb,
    '["Send education plan options by Friday"]'::jsonb,
    '["insurance","estate planning"]'::jsonb),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
    'WhatsApp check-in. Asked about sustainable funds. First ESG mention.',
    'Portfolio check-in; client raised ESG for the first time.',
    '["Texts in short bursts late evening","Responds best to concrete numbers, not concepts"]'::jsonb,
    '[]'::jsonb,
    '["Share two ESG fund factsheets"]'::jsonb,
    '["ESG","portfolio"]'::jsonb);

insert into learning_content (title, topic, body, cpd_hours) values
  ('Estate planning conversations with reluctant clients', 'estate planning',
    'Reframe estate planning around protection and family continuity.', 1.5),
  ('ESG fund basics for SEA portfolios', 'ESG',
    'Practical ESG framing for Malaysian advisory clients.', 1.0),
  ('Coordinating with external accountants', 'tax',
    'Clean handoffs with partner accountants.', 0.5);
