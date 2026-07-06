-- 담보 가치점수(암 치료비 점수) 라이브 산출 결과 기록 테이블
-- Supabase Dashboard > SQL Editor에서 실행
--
-- 목적: js/score.js의 calcCoverageScore()가 실시간(live) 산출한 점수를
-- 분석 시마다 저장해, 향후 "평균은 OO점이에요" 벤치마크를 실측치로 전환하고
-- 나아가 상대 백분위(예: "상위 12%예요") 표시로 발전시키기 위한 축적 데이터.
-- (samsung_proposals 스냅샷과 달리 암 담보 전용 보험료 + annualCount까지 반영된
--  live 공식 그대로의 값이므로, 벤치마크 계산은 반드시 이 테이블 기준으로 해야 함)

CREATE TABLE IF NOT EXISTS coverage_scores (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    file_name TEXT,
    insurer TEXT NOT NULL,              -- 'samsung' | 'meritz'
    age INTEGER,
    product_name TEXT,
    score INTEGER NOT NULL,             -- 0~100 (로그 압축 + 상한, js/score.js SCORE_LOG_SCALE/SCORE_CAP)
    value_multiple NUMERIC,             -- expectedValue5y / totalPremium20y
    expected_value_5y NUMERIC,          -- 5년 기대 암치료가치 (만원)
    total_premium_20y NUMERIC,          -- 20년 총 납입보험료, 암 담보 전용 (만원)
    monthly_premium_won INTEGER         -- 암 담보 전용 월보험료 (원) — 참고용 원본값
);

CREATE INDEX IF NOT EXISTS idx_coverage_scores_insurer ON coverage_scores (insurer);
CREATE INDEX IF NOT EXISTS idx_coverage_scores_created_at ON coverage_scores (created_at);

-- RLS: 기존 스냅샷 테이블들과 동일하게 anon 키로 insert만 허용
ALTER TABLE coverage_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert for coverage_scores" ON coverage_scores;
CREATE POLICY "Allow insert for coverage_scores"
ON coverage_scores FOR INSERT
WITH CHECK (true);

-- 평균/백분위 계산을 위해 클라이언트에서 집계 조회도 필요하므로 select도 허용
-- (coverage_snapshots는 select 정책이 없어 anon으로 못 읽는 문제가 있었음 — 동일 실수 방지)
DROP POLICY IF EXISTS "Allow select for coverage_scores" ON coverage_scores;
CREATE POLICY "Allow select for coverage_scores"
ON coverage_scores FOR SELECT
USING (true);
