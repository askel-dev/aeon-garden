-- A role that can only read Umami's tables, for supabase/functions/tally. Paste into the SQL editor of Umami's own Supabase
-- project (not the game's) once, with a long password of your own in place of the one below. Its connection string, the
-- transaction pooler's (port 6543) with the user as meadow_tally.<project ref>, goes in the game project's secret UMAMI_DB.

create role meadow_tally login password 'change me to something long';
grant usage on schema public to meadow_tally;
grant select on website_event, event_data, session to meadow_tally;

-- The function asks by event name and time; Umami's own indexes cover the time, this one the name (optional, for when
-- there are millions of events).
create index if not exists website_event_name_idx on website_event (website_id, event_name, created_at);
