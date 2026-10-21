-- CodeQuest database schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create extension if not exists "pgcrypto";

-- ───────────────────────── Enums ─────────────────────────
do $$ begin
  create type user_role as enum ('student', 'instructor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type question_type as enum ('multiple_choice', 'true_false', 'code_output');
exception when duplicate_object then null; end $$;

do $$ begin
  create type game_status as enum ('lobby', 'question', 'reveal', 'finished');
exception when duplicate_object then null; end $$;

-- ───────────────────────── Tables ─────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null,
  role          user_role not null default 'student',
  avatar        text not null default '🦊',
  total_points  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.quiz_sets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text not null default '',
  topic        text not null default '',
  grade_level  text not null default '',
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_set_id    uuid not null references public.quiz_sets (id) on delete cascade,
  position       integer not null,
  type           question_type not null default 'multiple_choice',
  prompt         text not null,
  code_snippet   text,
  code_language  text,
  choices        jsonb not null,          -- array of strings
  correct_index  integer not null,
  time_limit     integer not null default 20 check (time_limit between 5 and 120),
  points         integer not null default 1000 check (points between 0 and 2000),
  image_url      text
);
create index if not exists questions_quiz_set_idx on public.questions (quiz_set_id, position);

create table if not exists public.games (
  id                   uuid primary key default gen_random_uuid(),
  pin                  text not null unique,
  quiz_set_id          uuid not null references public.quiz_sets (id) on delete cascade,
  host_id              uuid not null references public.profiles (id) on delete cascade,
  status               game_status not null default 'lobby',
  current_index        integer not null default -1,
  question_started_at  timestamptz,
  created_at           timestamptz not null default now(),
  ended_at             timestamptz
);

create table if not exists public.game_players (
  id                 uuid primary key default gen_random_uuid(),
  game_id            uuid not null references public.games (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  nickname           text not null,
  avatar             text not null default '🦊',
  score              integer not null default 0,
  streak             integer not null default 0,
  powerups_used      text[] not null default '{}',
  active_powerup     text,
  active_powerup_q   integer,
  joined_at          timestamptz not null default now(),
  unique (game_id, user_id)
);

create table if not exists public.answers (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games (id) on delete cascade,
  player_id       uuid not null references public.game_players (id) on delete cascade,
  question_id     uuid not null references public.questions (id) on delete cascade,
  choice_index    integer not null,
  is_correct      boolean not null,
  points_awarded  integer not null default 0,
  response_ms     integer not null,
  created_at      timestamptz not null default now(),
  unique (player_id, question_id)
);

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Atomically add a finished game's scores to each player's lifetime total.
create or replace function public.award_game_points(p_game_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles p
     set total_points = p.total_points + gp.score
    from public.game_players gp
   where gp.game_id = p_game_id and gp.user_id = p.id;
$$;
revoke execute on function public.award_game_points(uuid) from public, anon, authenticated;

-- ───────────────────────── Row-level security ─────────────────────────
-- Browser clients only READ through RLS. Every write goes through the Next.js
-- API routes, which validate the request and use the service-role key.
alter table public.profiles      enable row level security;
alter table public.quiz_sets     enable row level security;
alter table public.questions     enable row level security;
alter table public.games         enable row level security;
alter table public.game_players  enable row level security;
alter table public.answers       enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "quiz sets visible to owner, staff, or if public" on public.quiz_sets;
create policy "quiz sets visible to owner, staff, or if public" on public.quiz_sets
  for select to authenticated
  using (owner_id = auth.uid() or is_public or public.current_role() = 'admin');

-- Questions contain answers, so students never read them directly; the game
-- API serves sanitized questions instead.
drop policy if exists "questions visible to quiz owner and admins" on public.questions;
create policy "questions visible to quiz owner and admins" on public.questions
  for select to authenticated
  using (exists (
    select 1 from public.quiz_sets q
     where q.id = quiz_set_id
       and (q.owner_id = auth.uid() or public.current_role() = 'admin'
            or (q.is_public and public.current_role() = 'instructor'))
  ));

-- Games and players are readable so clients can subscribe to realtime updates.
drop policy if exists "games readable by signed-in users" on public.games;
create policy "games readable by signed-in users" on public.games
  for select to authenticated using (true);

drop policy if exists "players readable by signed-in users" on public.game_players;
create policy "players readable by signed-in users" on public.game_players
  for select to authenticated using (true);

drop policy if exists "answers readable by owner or host" on public.answers;
create policy "answers readable by owner or host" on public.answers
  for select to authenticated
  using (
    exists (select 1 from public.game_players gp where gp.id = player_id and gp.user_id = auth.uid())
    or exists (select 1 from public.games g where g.id = game_id and g.host_id = auth.uid())
    or public.current_role() = 'admin'
  );

-- ───────────────────────── Realtime ─────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.game_players;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.answers;
exception when duplicate_object then null; end $$;
