-- Run once in the Supabase project's SQL Editor. Safe to rerun.
begin;
create table if not exists public.snake_runs (
  id uuid primary key default gen_random_uuid(),
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  difficulty integer not null check (difficulty between 1 and 9),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  score integer,
  improved boolean
);
create index if not exists snake_runs_player_time on public.snake_runs(player_hash, started_at);
create table if not exists public.snake_best (
  player_hash text not null,
  difficulty integer not null check (difficulty between 1 and 9),
  nickname text not null check (char_length(nickname) between 1 and 24),
  score integer not null check (score between 0 and 1000000),
  duration numeric not null check (duration between 0 and 86400),
  achieved_at timestamptz not null default clock_timestamp(),
  primary key (player_hash, difficulty)
);
create index if not exists snake_best_ranking on public.snake_best(difficulty, score desc, achieved_at);
alter table public.snake_runs enable row level security;
alter table public.snake_best enable row level security;
-- Browser clients cannot read/write these tables directly. Only the Edge Function can.
revoke all on public.snake_runs, public.snake_best from public, anon, authenticated;
grant select, insert, update, delete on public.snake_runs, public.snake_best to service_role;

create or replace function public.snake_start(p_player text, p_difficulty integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  if p_player !~ '^[a-f0-9]{64}$' or p_difficulty not between 1 and 9 then
    raise exception 'Invalid player or difficulty';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_player, 0));
  if (select count(*) from public.snake_runs where player_hash = p_player
      and started_at > clock_timestamp() - interval '1 hour') >= 120 then
    raise exception 'Too many games; try again later';
  end if;
  -- Keep recent session receipts for retries; prevent indefinite session-table growth.
  delete from public.snake_runs where started_at < clock_timestamp() - interval '2 days';
  insert into public.snake_runs(player_hash, difficulty) values (p_player, p_difficulty)
    returning id into result;
  return result;
end $$;

create or replace function public.snake_finish(
  p_player text, p_run uuid, p_nickname text, p_score integer, p_duration numeric
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  session public.snake_runs%rowtype;
  elapsed numeric;
  fps integer;
  changed integer;
  was_improved boolean;
begin
  if p_player !~ '^[a-f0-9]{64}$' or p_score not between 0 and 1000000
     or p_duration not between 0 and 86400 or char_length(trim(p_nickname)) not between 1 and 24 then
    raise exception 'Invalid score data';
  end if;
  select * into session from public.snake_runs where id = p_run and player_hash = p_player for update;
  if not found then raise exception 'Game session not found'; end if;
  -- Same receipt can be retried if the first response was lost, without changing the score.
  if session.finished_at is not null then return session.improved; end if;
  elapsed := extract(epoch from (clock_timestamp() - session.started_at));
  if elapsed > 86400 then raise exception 'Game session expired'; end if;
  fps := (array[1,3,5,8,10,12,15,22,30])[session.difficulty];
  -- A generous plausibility bound, not proof of fair play. Allows network/startup jitter.
  if p_duration > elapsed + 30 or p_score > (ceil((elapsed + 5) * fps) + 2) * 6 then
    raise exception 'Score or duration is inconsistent with this session';
  end if;
  insert into public.snake_best as existing_best(player_hash, difficulty, nickname, score, duration)
    values(p_player, session.difficulty, trim(p_nickname), p_score, p_duration)
    on conflict (player_hash, difficulty) do update
      set nickname = excluded.nickname, score = excluded.score,
          duration = excluded.duration, achieved_at = clock_timestamp()
      where excluded.score > existing_best.score;
  get diagnostics changed = row_count;
  was_improved := changed > 0;
  update public.snake_runs set finished_at = clock_timestamp(), score = p_score,
    improved = was_improved where id = p_run;
  return was_improved;
end $$;
revoke all on function public.snake_start(text, integer) from public, anon, authenticated;
revoke all on function public.snake_finish(text, uuid, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.snake_start(text, integer) to service_role;
grant execute on function public.snake_finish(text, uuid, text, integer, numeric) to service_role;
commit;
