-- 예전 기록 통로 닫기: 브라우저(anon 키)가 disclosure_logs에 바로 쓰던 insert 정책을 없앤다.
-- 이제 기록은 서버(Edge Function disclosure-extract, action 'log')가 로그인 확인 후 서비스 키로만 남긴다(005).
-- (적용 완료 — Supabase에 반영됨)
drop policy if exists disclosure_logs_insert on public.disclosure_logs;
revoke insert on public.disclosure_logs from anon;
