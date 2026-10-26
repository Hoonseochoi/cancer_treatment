-- 2026-10-26 보안 점검 조치 (Supabase에 이미 적용됨 — 기록용)
-- 사이트가 실제로 쓰는 경로만 남기고 누구나 읽기·수정·삭제가 되던 곳을 막았다.
--   유지: analysis_counters 읽기(화면 카운터) · 카운터 증가 함수(RPC) · 각종 기록 테이블 insert ·
--         clause_chunks 읽기(약관 원문, 공개 자료) · user_usage/profiles 본인 행
-- 대시보드(Table Editor)는 관리자 권한이라 RLS와 상관없이 전부 보인다.

-- 1. RLS가 꺼져 있던 테이블 — 사이트는 직접 읽고 쓰지 않는다(카운터는 SECURITY DEFINER 함수로만)
alter table public.managers enable row level security;
alter table public.insurer_daily_counts enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public."public.push_subscriptions" enable row level security;

-- 2. 누구나 읽기·수정·삭제가 되던 정책
drop policy if exists "Enable all operations for all users" on public.manager_profiles;
drop policy if exists "Allow public select" on public.manager_logs;
drop policy if exists "Allow public insert" on public.manager_logs;
drop policy if exists "allow_all" on public.insurer_daily_counts_backup;
drop policy if exists "Public upsert" on public.analysis_counters;
drop policy if exists "Public update" on public.analysis_counters;
drop policy if exists "allow_select" on public.samsung_proposals;
drop policy if exists "Allow select for coverage_scores" on public.coverage_scores;

-- 3. 만든 사람 권한으로 돌던 집계 뷰 → 조회하는 사람 권한으로
alter view public.faq_top set (security_invoker = true);
alter view public.chat_trace set (security_invoker = true);
alter view public.hint_misses set (security_invoker = true);
alter view public.costly_questions set (security_invoker = true);

-- 4. 함수 search_path 고정
alter function public.increment_analysis_counter(text) set search_path = public;
alter function public.increment_insurer_daily(text) set search_path = public;
