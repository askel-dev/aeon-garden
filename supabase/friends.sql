-- Friends for Nobody's Meadow: who you are (an anonymous Supabase user), your friends, whether they're about, and
-- invites. Paste into the Supabase SQL editor once (it can run again safely). Playing together itself still goes
-- browser to browser (net.js); this only finds the others.
--
-- Nobody reads another player's row directly: friends() hands out a friend's name, when they were last seen and the
-- room they're in, and only to accepted friends. A friend code is the one thing a stranger can use, and it only asks.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 24),
  code text not null unique,                                    -- what a friend types to add you
  last_seen timestamptz not null default now(),                 -- here() ticks it every 30 s while the game's in view
  room text not null default '' check (char_length(room) <= 40) -- the meadow being played together ('' alone)
);
-- A small picture of your meadow (a JPEG as a data URL), sent with a beat every few minutes, and when.
alter table public.profiles add column if not exists snap text not null default '' check (char_length(snap) <= 60000);
alter table public.profiles add column if not exists snap_at timestamptz;

create table if not exists public.friendships (
  a uuid not null references public.profiles on delete cascade, -- who asked
  b uuid not null references public.profiles on delete cascade, -- who was asked
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);

-- 'invite': come to my meadow (room). 'knock': can I come to yours? Kept until the one asked answers,
-- or goes when stale (friends.js INVITE_FRESH, 10 min: a reload inside that brings it back).
create table if not exists public.invites (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.profiles on delete cascade,
  to_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('invite', 'knock')),
  room text not null default '' check (char_length(room) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists invites_to on public.invites (to_id);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.invites enable row level security;

-- A code of 6 letters and digits that can't be misread (no 0/O, 1/I/L).
create or replace function public.new_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6)
$$;

create or replace function public.are_friends(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships
    where accepted and ((a = x and b = y) or (a = y and b = x)))
$$;

-- profiles: your own row only. The code is made here, never by the client.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid());
revoke insert, update on public.profiles from anon, authenticated;
grant update (name, last_seen, room) on public.profiles to authenticated;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- friendships: see your own, drop your own (unfriend, decline, take back). Asking and accepting go through add_friend.
drop policy if exists "own friendships" on public.friendships;
create policy "own friendships" on public.friendships for select using (auth.uid() in (a, b));
drop policy if exists "drop friendship" on public.friendships;
create policy "drop friendship" on public.friendships for delete using (auth.uid() in (a, b));
revoke insert, update on public.friendships from anon, authenticated;

-- invites: send only to a friend, as yourself; read and clear the ones to you.
drop policy if exists "send invite" on public.invites;
create policy "send invite" on public.invites for insert
  with check (from_id = auth.uid() and public.are_friends(from_id, to_id));
drop policy if exists "read invites" on public.invites;
create policy "read invites" on public.invites for select using (to_id = auth.uid() or from_id = auth.uid());
drop policy if exists "clear invites" on public.invites;
create policy "clear invites" on public.invites for delete using (to_id = auth.uid() or from_id = auth.uid());

-- The first call after signing in: makes your row (with a code) if there isn't one, and returns it.
create or replace function public.me(new_name text default '') returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from profiles where id = auth.uid();
  if found then return p; end if;
  loop
    begin
      insert into profiles (id, name, code) values (auth.uid(), left(coalesce(new_name, ''), 24), new_code())
        returning * into p;
      return p;
    exception when unique_violation then
      if exists (select 1 from profiles where id = auth.uid()) then
        select * into p from profiles where id = auth.uid(); return p;
      end if;   -- else the code was taken: try another
    end;
  end loop;
end $$;

-- Add a friend by code. If they'd already asked you, that's a yes and you're friends.
-- Returns 'asked', 'friends', 'self' or 'unknown'.
create or replace function public.add_friend(friend_code text) returns text
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into other from profiles where code = upper(regexp_replace(friend_code, '[^A-Za-z0-9]', '', 'g'));
  if other is null then return 'unknown'; end if;
  if other = auth.uid() then return 'self'; end if;
  if exists (select 1 from friendships where a = other and b = auth.uid()) then
    update friendships set accepted = true where a = other and b = auth.uid();
    return 'friends';
  end if;
  if exists (select 1 from friendships where a = auth.uid() and b = other and accepted) then return 'friends'; end if;
  insert into friendships (a, b) values (auth.uid(), other) on conflict do nothing;
  return 'asked';
end $$;

-- Say yes to someone who asked.
create or replace function public.accept_friend(other uuid) returns void
language sql security definer set search_path = public as $$
  update friendships set accepted = true where a = other and b = auth.uid()
$$;

-- Everyone you're tied to: friends with whether they're about (seen in the last 75 s, by the server's clock), the
-- room they're in and when their meadow's picture was taken, and asks both ways (name only).
drop function if exists public.here(text, text);
drop function if exists public.here(text, text, text);
drop function if exists public.friends();
create or replace function public.friends()
returns table (id uuid, name text, state text, online boolean, room text, snap_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.name,
    case when f.accepted then 'friend' when f.a = auth.uid() then 'asked' else 'asking' end,
    f.accepted and p.last_seen > now() - interval '75 seconds',
    case when f.accepted then p.room else '' end,
    case when f.accepted and p.snap <> '' then p.snap_at end
  from friendships f join profiles p on p.id = case when f.a = auth.uid() then f.b else f.a end
  where auth.uid() in (f.a, f.b)
  order by f.accepted desc, p.last_seen desc
$$;

-- The game's beat while it's in view: I'm here, by this name, in this room ('' alone), and now and then a new picture
-- of my meadow (null: the one before stays). Returns friends().
create or replace function public.here(new_name text default '', new_room text default '', new_snap text default null)
returns table (id uuid, name text, state text, online boolean, room text, snap_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_seen = now(), name = left(coalesce(new_name, ''), 24), room = left(coalesce(new_room, ''), 40)
    where profiles.id = auth.uid();
  if new_snap is not null and char_length(new_snap) <= 60000 and new_snap ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$' then
    update profiles set snap = new_snap, snap_at = now() where profiles.id = auth.uid();
  end if;
  return query select * from public.friends();
end $$;

-- Friends' meadow pictures, fetched only when one is new (friends() says when each was taken). Friends only.
create or replace function public.friend_snaps(ids uuid[]) returns table (id uuid, snap text)
language sql stable security definer set search_path = public as $$
  select p.id, p.snap from profiles p where p.id = any(ids) and public.are_friends(auth.uid(), p.id)
$$;

revoke execute on function public.me(text), public.add_friend(text), public.accept_friend(uuid), public.friends(),
  public.here(text, text, text), public.friend_snaps(uuid[]) from public, anon;
grant execute on function public.me(text), public.add_friend(text), public.accept_friend(uuid), public.friends(),
  public.here(text, text, text), public.friend_snaps(uuid[]) to authenticated;
revoke execute on function public.new_code() from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;   -- (the invite policy runs it as you)

-- Invites arrive at once over Realtime (it keeps to the policies above).
do $$ begin
  alter publication supabase_realtime add table public.invites;
exception when duplicate_object then null; end $$;
