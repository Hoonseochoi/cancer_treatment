-- 자동고지AI 사용 기록: 고지 원문·정리결과·분류결과를 남겨 잘못 분류된 사례를 되짚는다.
-- 병력은 민감정보라 브라우저(anon)에서는 "쓰기만" 되게 하고, 조회는 서비스 키로만 한다. (적용 완료 — Supabase에 반영됨)
create table if not exists disclosure_logs (
  id            bigserial primary key,
  session_id    text,                              -- 브라우저마다 만드는 익명 ID (누구인지는 식별하지 않는다)
  source        text not null default 'ai',        -- ai | manual(🔴 포맷 직접 입력)
  raw_text      text,                              -- 붙여넣은 병력 원문
  records       jsonb,                             -- AI가 옮겨 적은 기록 줄
  histories     jsonb,                             -- 규칙으로 묶은 병력
  classify      jsonb,                             -- Q1~Q6 분류 결과와 미분류
  model         text,
  requests      int,
  retried_lines int,
  missing_lines int,
  latency_ms    int,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists disclosure_logs_created_idx on disclosure_logs (created_at desc);
create index if not exists disclosure_logs_session_idx on disclosure_logs (session_id, created_at desc);

alter table disclosure_logs enable row level security;

-- 브라우저는 기록을 남기기만 한다. 읽기·수정·삭제 정책은 두지 않아 anon 키로는 조회가 막힌다.
drop policy if exists disclosure_logs_insert on disclosure_logs;
create policy disclosure_logs_insert on disclosure_logs for insert to anon with check (true);
