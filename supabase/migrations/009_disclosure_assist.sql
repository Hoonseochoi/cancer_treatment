-- 자동고지AI 보조 기능(고객 확인 질문·AI 점검 메모·U/W가이드·약 종류 연결) 호출도 disclosure_ai_calls에 남긴다.
-- kind로 원문 옮기기(extract)와 보조 호출(assist-questions / assist-review / assist-match / weekly-review)을 나눈다.
-- 보조 호출은 이용 횟수를 깎지 않고, 이미 이용 1회를 차지한 정리(run)의 주인만 부를 수 있다(Edge Function disclosure-assist).

alter table public.disclosure_ai_calls add column if not exists kind text not null default 'extract';
create index if not exists disclosure_ai_calls_run_kind_idx on public.disclosure_ai_calls (run_id, kind);

-- 정리 1번 = 1줄: 기존 calls·토큰·비용은 원문 옮기기만, 보조 호출은 끝에 따로(뷰 열은 끝에만 더할 수 있다)
create or replace view public.disclosure_runs
with (security_invoker = true) as
select
  l.id, l.created_at, l.today,
  p.name  as member_name,
  p.email as member_email,
  l.user_id, l.run_id, l.source, l.raw_text, l.histories, l.classify, l.simple, l.records,
  l.requests, l.retried_lines, l.missing_lines, l.latency_ms, l.error, l.model, l.app_version,
  c.calls, c.prompt_tokens, c.completion_tokens, c.cost_usd,
  p.main_insurer as member_insurer,
  c.assist_calls, c.assist_cost_usd
from public.disclosure_logs l
left join public.profiles p on p.id = l.user_id
left join (
  select run_id, user_id,
         (count(*) filter (where kind = 'extract'))::int as calls,
         (sum(prompt_tokens) filter (where kind = 'extract'))::int as prompt_tokens,
         (sum(completion_tokens) filter (where kind = 'extract'))::int as completion_tokens,
         sum(cost_usd) filter (where kind = 'extract') as cost_usd,
         (count(*) filter (where kind like 'assist-%'))::int as assist_calls,
         sum(cost_usd) filter (where kind like 'assist-%') as assist_cost_usd
  from public.disclosure_ai_calls
  group by run_id, user_id
) c on c.run_id = l.run_id and c.user_id is not distinct from l.user_id;
revoke all on public.disclosure_runs from public, anon, authenticated;
grant select on public.disclosure_runs to service_role;
