-- 디스크 IO 줄이기(2026-10-28): 거의 안 쓰는 색인을 걷는다. 행을 넣을 때마다 색인도 같이 써야 해서
-- 쓰기량이 그만큼 늘어난다. 데이터는 그대로이고, 필요하면 아래 CREATE로 언제든 다시 만들 수 있다.
--   보험사별 조회는 idx_raw_coverage_items_insurer_matched (insurer, matched)가 그대로 받는다.
DROP INDEX IF EXISTS idx_raw_coverage_items_insurer;   -- CREATE INDEX idx_raw_coverage_items_insurer ON raw_coverage_items (insurer);
DROP INDEX IF EXISTS idx_raw_coverage_items_matched;   -- CREATE INDEX idx_raw_coverage_items_matched ON raw_coverage_items (matched);
DROP INDEX IF EXISTS idx_coverage_scores_insurer;      -- CREATE INDEX idx_coverage_scores_insurer ON coverage_scores (insurer);
