-- Optional local/dev reset. This deletes all AdvisorFlow data.
-- Do not run this in production.

drop view if exists daily_action_suggestions;
drop view if exists client_priority_queue;

drop table if exists audit_log;
drop table if exists cpd_log;
drop table if exists learning_content;
drop table if exists generated_messages;
drop table if exists tasks;
drop table if exists client_events;
drop table if exists policies;
drop table if exists clients;
drop table if exists advisors;

drop function if exists touch_updated_at();
