-- =====================================================================
-- insurer_daily_counts 피벗 마이그레이션
-- 기존: (id, date, insurer text, count int4)  ← 행 per 보험사
-- 신규: (date PK, meritz int4, samsung int4, db int4, heungkuk int4)  ← 행 per 날짜
--
-- Supabase SQL Editor에 전체 붙여넣기 후 실행하세요.
-- =====================================================================


-- ── 1. 새 피벗 테이블 생성 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurer_daily_pivot (
    date      date PRIMARY KEY,
    meritz    int4 NOT NULL DEFAULT 0,
    samsung   int4 NOT NULL DEFAULT 0,
    db        int4 NOT NULL DEFAULT 0,
    heungkuk  int4 NOT NULL DEFAULT 0
);


-- ── 2. 기존 데이터 마이그레이션 (피벗 변환) ───────────────────────
INSERT INTO insurer_daily_pivot (date, meritz, samsung, db, heungkuk)
SELECT
    date,
    COALESCE(SUM(CASE WHEN insurer = 'meritz'   THEN count ELSE 0 END), 0) AS meritz,
    COALESCE(SUM(CASE WHEN insurer = 'samsung'  THEN count ELSE 0 END), 0) AS samsung,
    COALESCE(SUM(CASE WHEN insurer = 'db'       THEN count ELSE 0 END), 0) AS db,
    COALESCE(SUM(CASE WHEN insurer = 'heungkuk' THEN count ELSE 0 END), 0) AS heungkuk
FROM insurer_daily_counts
GROUP BY date
ORDER BY date
ON CONFLICT (date) DO UPDATE SET
    meritz   = insurer_daily_pivot.meritz   + EXCLUDED.meritz,
    samsung  = insurer_daily_pivot.samsung  + EXCLUDED.samsung,
    db       = insurer_daily_pivot.db       + EXCLUDED.db,
    heungkuk = insurer_daily_pivot.heungkuk + EXCLUDED.heungkuk;


-- ── 3. 기존 테이블 백업 후 교체 ───────────────────────────────────
ALTER TABLE insurer_daily_counts RENAME TO insurer_daily_counts_backup;
ALTER TABLE insurer_daily_pivot  RENAME TO insurer_daily_counts;


-- ── 4. RPC 함수 교체: increment_insurer_daily ─────────────────────
--    호출: supabaseClient.rpc('increment_insurer_daily', { p_insurer: 'meritz' })
CREATE OR REPLACE FUNCTION increment_insurer_daily(p_insurer text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today date := (NOW() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
    -- 오늘 행이 없으면 0으로 생성, 있으면 해당 컬럼만 +1
    INSERT INTO insurer_daily_counts (date, meritz, samsung, db, heungkuk)
    VALUES (
        v_today,
        CASE WHEN p_insurer = 'meritz'   THEN 1 ELSE 0 END,
        CASE WHEN p_insurer = 'samsung'  THEN 1 ELSE 0 END,
        CASE WHEN p_insurer = 'db'       THEN 1 ELSE 0 END,
        CASE WHEN p_insurer = 'heungkuk' THEN 1 ELSE 0 END
    )
    ON CONFLICT (date) DO UPDATE SET
        meritz   = insurer_daily_counts.meritz   + CASE WHEN p_insurer = 'meritz'   THEN 1 ELSE 0 END,
        samsung  = insurer_daily_counts.samsung  + CASE WHEN p_insurer = 'samsung'  THEN 1 ELSE 0 END,
        db       = insurer_daily_counts.db       + CASE WHEN p_insurer = 'db'       THEN 1 ELSE 0 END,
        heungkuk = insurer_daily_counts.heungkuk + CASE WHEN p_insurer = 'heungkuk' THEN 1 ELSE 0 END;
END;
$$;


-- ── 5. 결과 확인 ───────────────────────────────────────────────────
SELECT * FROM insurer_daily_counts ORDER BY date;
