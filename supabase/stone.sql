-- The old stone's daily limits (supabase/functions/stone): how many times each address, and everyone together, may ask
-- it a day, so the free LLM's quota can't be run down by one player. Paste into the Supabase SQL editor once.
-- Only the function (with the service_role key) touches it: no rules let the page in.

create table if not exists stone_calls (
  who  text not null,
  day  date not null default current_date,
  n    int  not null default 0,
  primary key (who, day)
);
alter table stone_calls enable row level security;

-- Counts one ask for p_who (and for '*', everyone); true if both are still under their limits.
create or replace function stone_tick(p_who text, most int, all_most int) returns boolean
language plpgsql security definer set search_path = public as $$
declare mine int; everyone int;
begin
  delete from stone_calls where day < current_date - 2;
  insert into stone_calls (who, day, n) values (p_who, current_date, 1)
    on conflict (who, day) do update set n = stone_calls.n + 1 returning n into mine;
  insert into stone_calls (who, day, n) values ('*', current_date, 1)
    on conflict (who, day) do update set n = stone_calls.n + 1 returning n into everyone;
  return mine <= most and everyone <= all_most;
end $$;
revoke all on function stone_tick(text, int, int) from public, anon, authenticated;
