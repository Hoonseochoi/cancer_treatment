-- 매니저 코드 미인식 가입제안서 PDF 기록 테이블
-- Supabase Dashboard > SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS unrecognized_uploads (
    id BIGSERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: manager_logs와 동일하게 anon 키로 insert 허용
ALTER TABLE unrecognized_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert for unrecognized_uploads" ON unrecognized_uploads;
CREATE POLICY "Allow insert for unrecognized_uploads"
ON unrecognized_uploads FOR INSERT
WITH CHECK (true);
