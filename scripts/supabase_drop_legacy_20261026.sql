-- 2026-10-26 쓰지 않는 테이블 정리
-- 되돌릴 수 없다. Supabase 대시보드 → SQL Editor에 붙여 넣고 Run.
-- 이 테이블들을 참조하는 뷰·외래키는 없다(실행 전 확인함).
--
--   push_subscriptions, "public.push_subscriptions" : 0건 · 어디서도 안 씀(이름이 잘못 만들어진 중복 포함)
--   insurer_daily_counts_backup                    : 2026-05 집계 표 구조 변경 때의 백업
--   unmatched_coverages                            : 0건 · raw_coverage_items(matched)로 대체
--   manager_logs · manager_profiles · managers ·
--   unrecognized_uploads                           : 예전 메리츠 설계번호 매니저 레벨링 — 회원 레벨링(user_usage)으로 교체

drop table if exists public.push_subscriptions;
drop table if exists public."public.push_subscriptions";
drop table if exists public.insurer_daily_counts_backup;
drop table if exists public.unmatched_coverages;
drop table if exists public.manager_logs;
drop table if exists public.manager_profiles;
drop table if exists public.managers;
drop table if exists public.unrecognized_uploads;
