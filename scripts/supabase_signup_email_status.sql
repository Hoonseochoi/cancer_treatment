-- 회원가입 화면의 중복 이메일 확인 (Supabase에 적용됨 — 기록용)
-- 'none' 처음 쓰는 이메일 / 'confirmed' 이미 가입 / 'pending' 가입 확인 메일을 기다리는 중
-- 그 외 정보(이름·가입일 등)는 돌려주지 않는다. 누구나 부를 수 있어 '가입 여부'만은 드러난다.
create or replace function public.signup_email_status(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    e text := lower(trim(coalesce(p_email, '')));
    confirmed timestamptz;
    found_user boolean;
begin
    if length(e) < 5 or length(e) > 254 or position('@' in e) = 0 then
        return 'none';
    end if;
    select true, u.email_confirmed_at into found_user, confirmed
      from auth.users u where lower(u.email) = e limit 1;
    if not coalesce(found_user, false) then return 'none'; end if;
    return case when confirmed is null then 'pending' else 'confirmed' end;
end;
$$;
revoke execute on function public.signup_email_status(text) from public;
grant execute on function public.signup_email_status(text) to anon, authenticated;
