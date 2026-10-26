-- 회원 목록 (Table Editor에서 보는 용도)
-- 가입하면 auth.users에 계정이 생기고, 아래 트리거가 이름·휴대폰·동의 시각을 여기로 옮겨 적는다.
-- 사이트(브라우저)에서는 본인 행만 읽을 수 있다. 대시보드 Table Editor는 관리자 권한이라 전체가 보인다.

create table if not exists public.profiles (
    id                 uuid primary key references auth.users(id) on delete cascade,
    email              text,
    name               text,
    phone              text,
    privacy_agreed_at  timestamptz,
    created_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
    for select to authenticated
    using (auth.uid() = id);

-- 가입 시 자동 생성
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, email, name, phone, privacy_agreed_at, created_at)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'phone',
        nullif(new.raw_user_meta_data ->> 'privacy_agreed_at', '')::timestamptz,
        coalesce(new.created_at, now())
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

-- 트리거 전용 — 사이트에서 직접 부를 수 없게 막는다
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute function public.handle_new_user_profile();

-- 이미 가입한 회원 채우기
insert into public.profiles (id, email, name, phone, privacy_agreed_at, created_at)
select u.id, u.email,
       u.raw_user_meta_data ->> 'name',
       u.raw_user_meta_data ->> 'phone',
       nullif(u.raw_user_meta_data ->> 'privacy_agreed_at', '')::timestamptz,
       u.created_at
from auth.users u
on conflict (id) do nothing;

-- 회원별 분석 횟수까지 한눈에 (Table Editor에서 profiles_with_usage 보기)
create or replace view public.profiles_with_usage
with (security_invoker = true) as
select p.created_at as 가입일, p.name as 이름, p.email as 이메일, p.phone as 휴대폰,
       count(u.id) as 분석횟수, max(u.created_at) as 마지막분석
from public.profiles p
left join public.user_usage u on u.user_id = p.id
group by p.id
order by p.created_at desc;
