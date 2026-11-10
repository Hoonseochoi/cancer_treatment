-- 자동고지AI 기록에 회원·토큰을 붙인다 — 실제 분류가 맞는지 주기적으로 검증하고, AI 비용을 보려는 용도.
-- 기록은 서버(Edge Function disclosure-extract)가 로그인 확인 후 서비스 키로만 남긴다. 브라우저에서는 조회할 수 없다.
-- (적용 완료 — Supabase에 반영됨)

-- 정리 1번(run) 기록: 누가(user_id) 어떤 원문으로 어떤 결과를 봤는지
alter table public.disclosure_logs add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.disclosure_logs add column if not exists run_id text;          -- AI 호출 기록(disclosure_ai_calls)과 묶는 키
alter table public.disclosure_logs add column if not exists today date;           -- 분류 기준일(3개월·5년 경계 재현용)
alter table public.disclosure_logs add column if not exists simple jsonb;         -- 간편 알릴의무 상품별 결과·추천
alter table public.disclosure_logs add column if not exists app_version text;     -- 그때 화면 스크립트 버전(어느 규칙으로 나온 결과인지)
create index if not exists disclosure_logs_user_idx on public.disclosure_logs (user_id, created_at desc);
create index if not exists disclosure_logs_run_idx on public.disclosure_logs (run_id);

-- AI 호출 1번마다: 토큰·비용·제공사·걸린 시간·AI가 낸 원문 그대로
create table if not exists public.disclosure_ai_calls (
  id                bigserial primary key,
  user_id           uuid references auth.users(id) on delete set null,
  run_id            text not null,
  target_lines      int[],            -- 이번 요청의 출력 대상 줄(null = 원문 전체)
  model             text,
  provider          text,
  generation_id     text,             -- OpenRouter 생성 ID(대시보드에서 대조용)
  prompt_tokens     int,
  completion_tokens int,
  cached_tokens     int,
  cost_usd          numeric(12, 8),
  backup_fired      boolean,          -- 느려서 예비 요청을 보냈는지(끊은 요청도 일부 과금됐을 수 있음)
  latency_ms        int,
  ai_text           text,
  error             text,
  created_at        timestamptz not null default now()
);
create index if not exists disclosure_ai_calls_run_idx on public.disclosure_ai_calls (run_id);
create index if not exists disclosure_ai_calls_user_idx on public.disclosure_ai_calls (user_id, created_at desc);
alter table public.disclosure_ai_calls enable row level security;
-- 정책 없음: 서비스 키로만 읽고 쓴다

-- 검증용 한눈에 보기: 정리 1번 = 1줄, 회원 정보 + 그 정리에 든 AI 호출 수·토큰·비용 합계
create or replace view public.disclosure_runs
with (security_invoker = true) as
select
  l.id,
  l.created_at,
  l.today,
  p.name  as member_name,
  p.email as member_email,
  l.user_id,
  l.run_id,
  l.source,
  l.raw_text,
  l.histories,
  l.classify,
  l.simple,
  l.records,
  l.requests,
  l.retried_lines,
  l.missing_lines,
  l.latency_ms,
  l.error,
  l.model,
  l.app_version,
  c.calls,
  c.prompt_tokens,
  c.completion_tokens,
  c.cost_usd
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
