-- 회원 목록(profiles)에 분석 횟수 · 접속한 날 수 (Supabase에 적용됨 — 기록용)
--   analysis_count / last_analysis_at : user_usage에 한 줄 생길 때마다 트리거가 올린다
--   visit_days / last_visit_date      : user_visits에 그날 첫 접속이 들어올 때 트리거가 올린다
-- 접속은 하루(한국 시간) 한 번만 센다 — 로그인 회원이 사이트를 열면 js/auth.js가 기록한다.

alter table public.profiles
    add column if not exists analysis_count   integer not null default 0,
    add column if not exists last_analysis_at timestamptz,
    add column if not exists visit_days       integer not null default 0,
    add column if not exists last_visit_date  date;

create table if not exists public.user_visits (
    user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    visit_date  date not null default ((now() at time zone 'Asia/Seoul')::date),
    created_at  timestamptz not null default now(),
    primary key (user_id, visit_date)
);
alter table public.user_visits enable row level security;
drop policy if exists "user_visits insert own" on public.user_visits;
create policy "user_visits insert own" on public.user_visits
    for insert to authenticated with check (auth.uid() = user_id);
-- "이미 있으면 무시"(on conflict do nothing) 저장은 읽기 권한도 있어야 한다 — 본인 행만
drop policy if exists "user_visits select own" on public.user_visits;
create policy "user_visits select own" on public.user_visits
    for select to authenticated using (auth.uid() = user_id);

create or replace function public.bump_profile_analysis()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    update public.profiles
       set analysis_count = analysis_count + 1, last_analysis_at = new.created_at
     where id = new.user_id;
    return new;
end; $$;

create or replace function public.bump_profile_visit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    update public.profiles
       set visit_days = visit_days + 1, last_visit_date = new.visit_date
     where id = new.user_id;
    return new;
end; $$;

revoke execute on function public.bump_profile_analysis() from public, anon, authenticated;
revoke execute on function public.bump_profile_visit() from public, anon, authenticated;

drop trigger if exists on_user_usage_bump_profile on public.user_usage;
create trigger on_user_usage_bump_profile after insert on public.user_usage
    for each row execute function public.bump_profile_analysis();

drop trigger if exists on_user_visit_bump_profile on public.user_visits;
create trigger on_user_visit_bump_profile after insert on public.user_visits
    for each row execute function public.bump_profile_visit();

-- 이미 쌓인 분석 기록으로 채우기 · 분석한 날은 접속한 날로도 친다
insert into public.user_visits (user_id, visit_date, created_at)
select distinct user_id, (created_at at time zone 'Asia/Seoul')::date, min(created_at) over (partition by user_id, (created_at at time zone 'Asia/Seoul')::date)
from public.user_usage
on conflict do nothing;
update public.profiles p set
    analysis_count   = coalesce((select count(*) from public.user_usage u where u.user_id = p.id), 0),
    last_analysis_at = (select max(created_at) from public.user_usage u where u.user_id = p.id),
    visit_days       = coalesce((select count(*) from public.user_visits v where v.user_id = p.id), 0),
    last_visit_date  = (select max(visit_date) from public.user_visits v where v.user_id = p.id);

-- 대시보드용 목록
drop view if exists public.profiles_with_usage;
create view public.profiles_with_usage with (security_invoker = true) as
select created_at as 가입일, name as 이름, email as 이메일, phone as 휴대폰,
       analysis_count as 분석횟수, visit_days as 접속일수,
       last_analysis_at as 마지막분석, last_visit_date as 마지막접속
from public.profiles
order by created_at desc;

-- ── 메일 인증 (2026-10-26) ──
-- profiles.email_confirmed_at: 가입 확인 링크를 누르면 auth.users에서 옮겨 적는다.
-- 대시보드 목록(profiles_with_usage)은 인증을 마친 회원만 보여 준다 — 더미 가입은 빠진다.
alter table public.profiles add column if not exists email_confirmed_at timestamptz;
create or replace function public.sync_profile_email_confirmed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    update public.profiles set email_confirmed_at = new.email_confirmed_at where id = new.id;
    return new;
end; $$;
revoke execute on function public.sync_profile_email_confirmed() from public, anon, authenticated;
drop trigger if exists on_auth_user_confirmed_profile on auth.users;
create trigger on_auth_user_confirmed_profile
    after update of email_confirmed_at on auth.users
    for each row when (old.email_confirmed_at is distinct from new.email_confirmed_at)
    execute function public.sync_profile_email_confirmed();
-- (handle_new_user_profile도 email_confirmed_at을 함께 적도록 바꿨고, 뷰에 where email_confirmed_at is not null을 걸었다)
