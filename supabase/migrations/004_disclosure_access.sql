-- 자동고지AI 이용 권한: 로그인 회원만, 승인 회원은 무제한, 그 외 회원은 평생 3회(초기화 없음).
-- 횟수는 서버(Edge Function disclosure-extract)가 서비스 키로만 센다. 브라우저에서는 본인 기록을 읽을 수만 있다.
-- (적용 완료 — Supabase에 반영됨)

create table if not exists public.disclosure_approved (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  note        text,                                  -- 누구인지 알아보기 쉽게 적는 메모(이름 등)
  approved_at timestamptz not null default now()
);

create table if not exists public.disclosure_usage (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  run_id     text not null,            -- 정리 1번(원문 1건)마다 브라우저가 붙이는 ID. 나눠 보낸 요청·재요청은 1회로 센다
  calls      int  not null default 1,  -- 그 정리에서 AI를 부른 횟수(같은 ID로 계속 부르는 남용 상한용)
  created_at timestamptz not null default now(),
  unique (user_id, run_id)
);
create index if not exists disclosure_usage_user_idx on public.disclosure_usage (user_id, created_at desc);

alter table public.disclosure_approved enable row level security;
alter table public.disclosure_usage enable row level security;

drop policy if exists disclosure_approved_select_own on public.disclosure_approved;
create policy disclosure_approved_select_own on public.disclosure_approved
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists disclosure_usage_select_own on public.disclosure_usage;
create policy disclosure_usage_select_own on public.disclosure_usage
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.disclosure_status(p_user uuid)
returns table (approved boolean, used int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.disclosure_approved a where a.user_id = p_user),
         (select count(*)::int from public.disclosure_usage u where u.user_id = p_user);
$$;

-- 이용 1회 차지. 같은 run_id면 호출 수만 올리고, 새 run_id면 승인 회원이 아닐 때 무료 한도를 본다.
create or replace function public.claim_disclosure_run(p_user uuid, p_run text, p_free_limit int, p_max_calls int)
returns table (allowed boolean, approved boolean, used int, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approved boolean;
  v_used int;
  v_calls int;
begin
  -- 같은 회원의 요청은 한 줄로 세운다(나눠 보낸 요청이 동시에 와도 한도를 넘기지 않게)
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  v_approved := exists (select 1 from public.disclosure_approved a where a.user_id = p_user);
  select count(*)::int into v_used from public.disclosure_usage u where u.user_id = p_user;
  select u.calls into v_calls from public.disclosure_usage u where u.user_id = p_user and u.run_id = p_run;

  if v_calls is not null then
    if v_calls >= p_max_calls then
      return query select false, v_approved, v_used, 'too_many_calls'::text;
      return;
    end if;
    update public.disclosure_usage set calls = calls + 1 where user_id = p_user and run_id = p_run;
    return query select true, v_approved, v_used, null::text;
    return;
  end if;

  if not v_approved and v_used >= p_free_limit then
    return query select false, v_approved, v_used, 'limit'::text;
    return;
  end if;

  insert into public.disclosure_usage (user_id, run_id) values (p_user, p_run);
  return query select true, v_approved, v_used + 1, null::text;
end;
$$;

-- AI 호출이 실패하면 그 호출을 되돌린다. 정리 전체가 실패해 호출이 0이 되면 이용 1회도 되돌린다.
create or replace function public.release_disclosure_run(p_user uuid, p_run text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  update public.disclosure_usage set calls = calls - 1 where user_id = p_user and run_id = p_run;
  delete from public.disclosure_usage where user_id = p_user and run_id = p_run and calls <= 0;
end;
$$;

-- 서버(서비스 키)만 부를 수 있다 — 브라우저에서 횟수를 직접 만지지 못하게
revoke execute on function public.disclosure_status(uuid) from public, anon, authenticated;
revoke execute on function public.claim_disclosure_run(uuid, text, int, int) from public, anon, authenticated;
revoke execute on function public.release_disclosure_run(uuid, text) from public, anon, authenticated;
grant execute on function public.disclosure_status(uuid) to service_role;
grant execute on function public.claim_disclosure_run(uuid, text, int, int) to service_role;
grant execute on function public.release_disclosure_run(uuid, text) to service_role;

-- 승인 회원(2026-11-10): 최훈서·주기쁨·이지호
insert into public.disclosure_approved (user_id, note) values
  ('04c107b3-0742-4219-a1e7-5be1572504f3', '최훈서'),
  ('ef456165-551d-4ef4-8347-f4f3fe80749b', '주기쁨'),
  ('4798b629-e92d-43c7-bfbf-83145e8cadd8', '이지호')
on conflict (user_id) do nothing;
