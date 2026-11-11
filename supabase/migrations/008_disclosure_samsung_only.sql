-- 자동고지AI는 지금 삼성화재 기준이라 "주로 삼성 가입제안서를 분석하는 회원"(profiles.main_insurer = 'samsung')과 승인 회원만 쓴다.
-- 메리츠 등 다른 회사 위주 회원·분석 기록이 없는 회원은 새 정리를 시작할 수 없다(서버에서 막음, 화면은 access.js가 안내).
-- (적용 완료 — Supabase에 반영됨)

-- 주 사용 회사가 동률이면 삼성을 우선한다(삼성 1·메리츠 1이면 삼성)
create or replace function public.profile_insurer_bump()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null or new.insurer is null or new.insurer = '' then
    return new;
  end if;
  update public.profiles p
     set insurer_counts = jsonb_set(p.insurer_counts, array[new.insurer],
                                    to_jsonb(coalesce((p.insurer_counts ->> new.insurer)::int, 0) + 1))
   where p.id = new.user_id;
  update public.profiles p
     set main_insurer = (select key from jsonb_each_text(p.insurer_counts)
                         order by value::int desc, (key = 'samsung') desc, key limit 1)
   where p.id = new.user_id;
  return new;
end;
$$;
revoke execute on function public.profile_insurer_bump() from public, anon, authenticated;

update public.profiles p
   set main_insurer = (select key from jsonb_each_text(p.insurer_counts)
                       order by value::int desc, (key = 'samsung') desc, key limit 1)
 where p.insurer_counts <> '{}'::jsonb;

-- 이용 1회 차지: 새 정리는 승인 회원이거나 주 사용 회사가 삼성일 때만
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
  v_insurer text;
begin
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

  if not v_approved then
    select p.main_insurer into v_insurer from public.profiles p where p.id = p_user;
    if coalesce(v_insurer, '') <> 'samsung' then
      return query select false, v_approved, v_used, 'insurer'::text;
      return;
    end if;
  end if;

  if not v_approved and v_used >= p_free_limit then
    return query select false, v_approved, v_used, 'limit'::text;
    return;
  end if;

  insert into public.disclosure_usage (user_id, run_id) values (p_user, p_run);
  return query select true, v_approved, v_used + 1, null::text;
end;
$$;
revoke execute on function public.claim_disclosure_run(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.claim_disclosure_run(uuid, text, int, int) to service_role;
