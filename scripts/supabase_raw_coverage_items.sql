-- 추출된 담보 전량 원본 로깅 테이블
-- Supabase Dashboard > SQL Editor에서 실행
--
-- 목적: 제안서 분석 시 추출된 모든 담보 행(매칭 성공/실패 무관)을 그대로 쌓아,
-- 암 치료비·수술비 분석 로직이 놓치는 담보명이 있는지 추후 일괄 점검하고
-- 보험사별 매핑 로직(samsung_config.js 등)에 반영하기 위한 원본 데이터 축적.
-- 기존 unmatched_coverages는 미인식 담보명만 기록하지만, 이 테이블은 매칭된
-- 담보까지 전량 기록해 "왜 이건 잡히고 저건 안 잡히는지" 대조가 가능하다.

CREATE TABLE IF NOT EXISTS raw_coverage_items (
    id BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    file_name     TEXT,                 -- 돌린 파일명
    insurer       TEXT NOT NULL,        -- 돌린회사: samsung | db | heungkuk | mirae | meritz
    product_name  TEXT,                 -- 제목(상품명)
    coverage_name TEXT NOT NULL,        -- 담보명(full, 원문 그대로)
    amount        TEXT,                 -- 가입금액 (보험사별 표기가 달라 원문 텍스트로 보관)
    premium       TEXT,                 -- 보험료 (원문 텍스트)
    period        TEXT,                 -- 납기/만기 (원문 텍스트, 추출기가 제공하는 경우만)
    kind          TEXT,                 -- 'surgery' 등 세부 계열 태그 (현재는 삼성 한정, 없으면 NULL)
    matched       BOOLEAN               -- 암 9카드 매핑 로직(findXDetails)에 잡히는지.
                                         -- kind='surgery' 행은 애초에 이 로직 대상이 아니므로 NULL(해당 없음).
                                         -- 그 외 NULL은 해당 보험사에 매칭 함수가 아직 없는 경우.
);

CREATE INDEX IF NOT EXISTS idx_raw_coverage_items_insurer    ON raw_coverage_items (insurer);
CREATE INDEX IF NOT EXISTS idx_raw_coverage_items_matched    ON raw_coverage_items (matched);
CREATE INDEX IF NOT EXISTS idx_raw_coverage_items_created_at ON raw_coverage_items (created_at);
-- 자주 쓸 조회: 보험사별 미매칭 담보명 빈도 집계
CREATE INDEX IF NOT EXISTS idx_raw_coverage_items_insurer_matched ON raw_coverage_items (insurer, matched);

-- RLS: unrecognized_uploads / unmatched_coverages와 동일하게 anon 키로 insert만 허용.
-- 점검은 Supabase Dashboard(SQL Editor, service_role)에서 하므로 select 정책은 두지 않는다.
ALTER TABLE raw_coverage_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert for raw_coverage_items" ON raw_coverage_items;
CREATE POLICY "Allow insert for raw_coverage_items"
ON raw_coverage_items FOR INSERT
WITH CHECK (true);

-- ── 점검용 쿼리 예시 (Dashboard SQL Editor에서 실행) ──
--
-- 보험사별 미매칭 담보명 빈도 (반영 우선순위 판단용)
-- SELECT insurer, coverage_name, COUNT(*) AS cnt
-- FROM raw_coverage_items
-- WHERE matched = false
-- GROUP BY insurer, coverage_name
-- ORDER BY insurer, cnt DESC;
--
-- 최근 업로드에서 미매칭 담보만 훑어보기
-- SELECT created_at, insurer, product_name, coverage_name, amount
-- FROM raw_coverage_items
-- WHERE matched = false
-- ORDER BY created_at DESC
-- LIMIT 200;
