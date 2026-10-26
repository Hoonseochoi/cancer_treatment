-- 로그인 회원 분석 기록 (레벨링용)
-- 회원 한 명이 분석을 마칠 때마다 한 줄. 레벨은 이 줄 수로 계산한다(js/auth.js).
-- 본인 기록만 쓰고 읽을 수 있다 — 다른 회원의 기록은 보이지 않는다.
-- Supabase 대시보드 → SQL Editor에 붙여 넣고 Run 한 번.

create table if not exists public.user_usage (
    id          bigserial primary key,
    user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    file_name   text,
    insurer     text,
    created_at  timestamptz not null default now()
);

create index if not exists user_usage_user_id_idx on public.user_usage (user_id, created_at desc);

alter table public.user_usage enable row level security;

drop policy if exists "user_usage insert own" on public.user_usage;
create policy "user_usage insert own" on public.user_usage
    for insert to authenticated
    with check (auth.uid() = user_id);

drop policy if exists "user_usage select own" on public.user_usage;
create policy "user_usage select own" on public.user_usage
    for select to authenticated
    using (auth.uid() = user_id);
