-- 1) 프로필에 "어느 회사 가입제안서를 돌리는지": 분석 기록(user_usage.insurer)에서 회사별 횟수와 가장 많이 쓴 회사를 채운다.
--    새 분석이 들어올 때마다 트리거가 갱신한다. 과거 기록은 아래에서 한 번 채운다.
-- 2) 간편보험 U/W가이드(삼성화재 대외비)는 사이트 파일에서 빼고 이 테이블에 두며, 서버(Edge Function)가 삼성 회원에게만 내려준다.
-- (적용 완료 — Supabase에 반영됨. U/W가이드 내용은 저장소에 올리지 않고 SQL로 따로 넣었다)

alter table public.profiles add column if not exists insurer_counts jsonb not null default '{}'::jsonb;  -- {"samsung": 12, "meritz": 3}
alter table public.profiles add column if not exists main_insurer text;                                   -- 가장 많이 분석한 회사

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
     set main_insurer = (select key from jsonb_each_text(p.insurer_counts) order by value::int desc, key limit 1)
   where p.id = new.user_id;
  return new;
end;
$$;
revoke execute on function public.profile_insurer_bump() from public, anon, authenticated;

drop trigger if exists user_usage_insurer_bump on public.user_usage;
create trigger user_usage_insurer_bump after insert on public.user_usage
  for each row execute function public.profile_insurer_bump();

-- 과거 분석 기록으로 채우기
with c as (
  select user_id, insurer, count(*)::int n
  from public.user_usage
  where user_id is not null and insurer is not null and insurer <> ''
  group by 1, 2
), agg as (
  select user_id, jsonb_object_agg(insurer, n) counts,
         (array_agg(insurer order by n desc, insurer))[1] top
  from c group by 1
)
update public.profiles p set insurer_counts = agg.counts, main_insurer = agg.top
from agg where agg.user_id = p.id;

-- U/W가이드 저장소(서비스 키 전용 — 정책 없음)
create table if not exists public.disclosure_uw_rules (
  id         text primary key,          -- 'samsung-simple'
  data       jsonb not null,            -- { guide: [...], freepass: [...] }
  source     text,
  updated_at timestamptz not null default now()
);
alter table public.disclosure_uw_rules enable row level security;

-- 검증용 보기에 회원의 주 사용 회사 추가
create or replace view public.disclosure_runs
with (security_invoker = true) as
select
  l.id, l.created_at, l.today,
  p.name  as member_name,
  p.email as member_email,
  l.user_id, l.run_id, l.source, l.raw_text, l.histories, l.classify, l.simple, l.records,
  l.requests, l.retried_lines, l.missing_lines, l.latency_ms, l.error, l.model, l.app_version,
  c.calls, c.prompt_tokens, c.completion_tokens, c.cost_usd,
  p.main_insurer as member_insurer
from public.disclosure_logs l
left join public.profiles p on p.id = l.user_id
left join (
  select run_id, user_id, count(*)::int as calls,
         sum(prompt_tokens)::int as prompt_tokens, sum(completion_tokens)::int as completion_tokens,
         sum(cost_usd) as cost_usd
  from public.disclosure_ai_calls
  group by run_id, user_id
) c on c.run_id = l.run_id and c.user_id is not distinct from l.user_id;
revoke all on public.disclosure_runs from public, anon, authenticated;
grant select on public.disclosure_runs to service_role;
