/**
 * supabase.js
 * ─────────────────────────────────────────────────────────────
 * 1. Supabase 연동: 매니저 로그/프로필, 미인식 업로드 기록
 * 2. 매니저 레벨 시스템: 실행 횟수 기반 레벨(1~10), 경험치, 레벨업 알림
 * 3. 분석 횟수 카운터: api.counterapi.dev로 오늘/전체 분석 횟수 추적
 * ─────────────────────────────────────────────────────────────
 */

/**
 * ── Supabase 연동 설정 ──
 * Supabase 프로젝트 URL과 공개(anon) API 키로 클라이언트를 초기화합니다.
 */
const SUPABASE_URL = "https://omgwvnibssizmhovporl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZ3d2bmlic3Npem1ob3Zwb3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzA4MDYsImV4cCI6MjA4NzE0NjgwNn0.Cx9OFo_UAJOB2AnsRUg1FbWAD8avU7ktYIea1z4hCDY";
// CDN에서 로드된 supabase 객체가 있을 때만 클라이언트 생성 (안전 체크)
const supabaseClient = (window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * ── 매니저 레벨 시스템 ──
 * 실행 횟수(min)에 따른 레벨 구간 정의. next는 다음 레벨까지 필요한 최소 횟수.
 */
const LEVEL_THRESHOLDS = [
    { level: 1, min: 0, next: 2 },
    { level: 2, min: 2, next: 5 },
    { level: 3, min: 5, next: 9 },
    { level: 4, min: 9, next: 14 },
    { level: 5, min: 14, next: 20 },
    { level: 6, min: 20, next: 27 },
    { level: 7, min: 27, next: 35 },
    { level: 8, min: 35, next: 44 },
    { level: 9, min: 44, next: 54 },
    { level: 10, min: 54, next: Infinity }
];

// 현재 매니저 상태: 실행 횟수, 레벨, 현재 경험치, 다음 레벨 필요 경험치, 이름
let currentManagerData = { count: 0, level: 1, exp: 0, required: 1, name: '' };

/**
 * 매니저 활동 기록 (PDF 분석 실행 시 호출)
 * 1) manager_logs에 로그 삽입 → 2) 총 실행 횟수 조회 → 3) manager_profiles 업데이트 → 4) UI 갱신
 */
async function logManagerActivity(code, name, fileName) {
    if (!supabaseClient) {
        console.warn("Supabase client not initialized.");
        return;
    }
    try {
        // 1. manager_logs 테이블에 실행 이력 저장
        const { error: logError } = await supabaseClient
            .from('manager_logs')
            .insert([
                {
                    manager_code: code,
                    manager_name: name,
                    file_name: fileName
                }
            ]);
        if (logError) throw logError;
        console.log("Activity logged successfully.");

        // 2. 해당 매니저의 총 실행 횟수를 조회하여 새 레벨 계산
        const { count, error: countError } = await supabaseClient
            .from('manager_logs')
            .select('*', { count: 'exact', head: true })
            .eq('manager_code', code);

        if (countError) throw countError;

        const totalCount = count || 1;
        const currentLevel = calculateLevelFromCount(totalCount);

        // 3. manager_profiles 테이블에 upsert (있으면 갱신, 없으면 삽입)
        const { error: profileError } = await supabaseClient
            .from('manager_profiles')
            .upsert({
                manager_code: code,
                manager_name: name,
                execution_count: totalCount,
                level: currentLevel,
                updated_at: new Date().toISOString()
            }, { onConflict: 'manager_code' });

        if (profileError) throw profileError;
        console.log("Manager profile updated successfully.");

        // 4. 로컬 상태 및 화면 UI 갱신
        updateManagerLevel(totalCount, name);

    } catch (err) {
        console.error("Failed to log activity:", err);
    }
}

/**
 * ── 미인식 매니저 업로드 로그 ──
 * 매니저 코드를 찾지 못한 PDF 파일명을 unrecognized_uploads 테이블에 기록
 */
async function logUnrecognizedUpload(fileName) {
    if (!supabaseClient) {
        console.warn("Supabase client not initialized.");
        return;
    }
    try {
        const { error } = await supabaseClient
            .from('unrecognized_uploads')
            .insert([{
                file_name: fileName,
                created_at: new Date().toISOString()
            }]);
        if (error) throw error;
        console.log("Unrecognized upload logged:", fileName);
    } catch (err) {
        console.error("Failed to log unrecognized upload:", err);
    }
}

/** 실행 횟수로 레벨 계산 (LEVEL_THRESHOLDS 기준) */
function calculateLevelFromCount(count) {
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (count >= LEVEL_THRESHOLDS[i].min) {
            level = LEVEL_THRESHOLDS[i].level;
        }
    }
    return level;
}

/**
 * 매니저 레벨 상태 갱신 및 UI 반영
 * 레벨업 시 알림 표시
 */
function updateManagerLevel(totalCount, name) {
    let currentLevel = 1;
    let nextThreshold = 2;   // 다음 레벨까지 필요한 총 횟수
    let prevThreshold = 0;  // 현재 레벨 시작 횟수
    let justLeveledUp = false;

    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (totalCount >= LEVEL_THRESHOLDS[i].min) {
            currentLevel = LEVEL_THRESHOLDS[i].level;
            nextThreshold = LEVEL_THRESHOLDS[i].next;
            prevThreshold = LEVEL_THRESHOLDS[i].min;

            if (totalCount > 0 && totalCount === LEVEL_THRESHOLDS[i].min) {
                justLeveledUp = true;
            }
        }
    }

    let exp = totalCount - prevThreshold;
    let required = nextThreshold - prevThreshold;

    if (currentLevel === 10) {
        exp = totalCount;
        required = totalCount;
        if (totalCount === LEVEL_THRESHOLDS[9].min) justLeveledUp = true;
    }

    currentManagerData = { count: totalCount, level: currentLevel, exp, required, name };

    // 변경 사항 즉시 화면에 반영
    renderManagerLevel();

    if (justLeveledUp) {
        showLevelUpNotification();
    }
}

/** 매니저 배지 UI에 레벨/경험치 정보 표시 */
function renderManagerLevel() {
    const { level, exp, required, name } = currentManagerData;
    const badgeContainer = document.getElementById('manager-badge-container');
    if (!badgeContainer) return;

    // 1. 상단 배지 레벨 표시
    const welcomeLvEl = document.getElementById('welcome-manager-level');
    if (welcomeLvEl) {
        welcomeLvEl.textContent = `LV.${level}`;
        welcomeLvEl.classList.remove('hidden');
    }

    // 2. 펼친 패널 내 상세 정보 (경험치, 진행률 등)
    const lvNumEl = document.getElementById('level-modal-lv-num');
    if (lvNumEl) lvNumEl.textContent = level;

    const currExpEl = document.getElementById('level-modal-current-exp');
    if (currExpEl) currExpEl.textContent = exp;

    const nextExpEl = document.getElementById('level-modal-next-exp');
    if (nextExpEl) nextExpEl.textContent = required;

    const progressPercent = level >= 10 ? 100 : Math.min(100, Math.round((exp / required) * 100));
    const progressEl = document.getElementById('level-modal-progress');
    if (progressEl) progressEl.style.width = `${progressPercent}%`;  // 진행률 바 너비

    const hintEl = document.getElementById('level-modal-exp-hint');
    if (hintEl) {
        if (level >= 10) {
            hintEl.textContent = '최고 레벨에 도달했습니다!';
        } else {
            hintEl.textContent = `다음 레벨까지 ${required - exp}회 남았습니다.`;
        }
    }

    const imgEl = document.getElementById('level-modal-image');
    if (imgEl) {
        imgEl.src = `level/lv${level}.png`;  // 레벨별 이미지
    }

    // 3. 레벨 테마 클래스 적용 (level-theme-1 ~ level-theme-10)
    badgeContainer.className = badgeContainer.className.replace(/level-theme-\d+/g, '');
    badgeContainer.classList.add(`level-theme-${level}`);
}

/** 레벨업 시 알림 버블 표시 (4초 후 자동 숨김) */
function showLevelUpNotification() {
    const bubble = document.getElementById('level-up-notification');
    const badge = document.getElementById('manager-badge-container');
    if (!bubble) return;

    // 슬라이드 인 + 페이드 인
    bubble.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
    bubble.classList.add('opacity-95', 'translate-y-0', 'visible');

    // 배지 주변 빨간 펄스 글로우 효과
    if (badge) badge.classList.add('badge-levelup-glow');

    // 4초 후 슬라이드 아웃 + 글로우 제거
    setTimeout(() => {
        bubble.classList.remove('opacity-95', 'translate-y-0', 'visible');
        bubble.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
        if (badge) badge.classList.remove('badge-levelup-glow');
    }, 4000);
}

/**
 * ── 배지 클릭 이벤트 ──
 * 배지 클릭 시 펼침/접힘 토글, 바깥 클릭 시 접힘
 */
document.addEventListener('DOMContentLoaded', () => {
    const badgeContainer = document.getElementById('manager-badge-container');

    function toggleBadge(e) {
        if (!badgeContainer) return;

        // 클릭이 document로 전파되어 바로 닫히는 것 방지
        e.stopPropagation();

        if (badgeContainer.classList.contains('badge-expanded')) {
            badgeContainer.classList.remove('badge-expanded');
        } else {
            // 펼치고 데이터 렌더링
            badgeContainer.classList.add('badge-expanded');
            renderManagerLevel();
        }
    }

    // 배지 바깥 클릭 시 접기
    document.addEventListener('click', (e) => {
        if (badgeContainer && badgeContainer.classList.contains('badge-expanded') && !badgeContainer.contains(e.target)) {
            badgeContainer.classList.remove('badge-expanded');
        }
    });

    if (badgeContainer) badgeContainer.addEventListener('click', toggleBadge);
});


/**
 * ── 분석 횟수 카운터 (Supabase analysis_counters 테이블) ──
 * counterapi.dev → Supabase로 전환 (브라우저 CORS 차단 이슈로 인해)
 */

// KST 기준 오늘 날짜 키: daily_YYYYMMDD
function getTodayKey() {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    return `daily_${yyyy}${mm}${dd}`;
}

const TOTAL_KEY = "total";
const DAILY_KEY = getTodayKey();

/** 오늘/전체 분석 횟수 조회 후 UI 갱신 */
async function fetchAnalysisCounts() {
    if (!supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('analysis_counters')
            .select('key, count')
            .in('key', [TOTAL_KEY, DAILY_KEY]);

        if (error) throw error;

        const totalRow = (data || []).find(r => r.key === TOTAL_KEY);
        const dailyRow = (data || []).find(r => r.key === DAILY_KEY);
        // 값이 있을 때만 UI 업데이트 (실패 시 기존 표시값 유지)
        if (totalRow || dailyRow) {
            updateCounterUI(dailyRow?.count || 0, totalRow?.count || 0);
        }
    } catch (error) {
        console.error('Failed to fetch counts:', error);
    }
}

/** 분석 실행 시 오늘/전체 횟수 1씩 증가 */
async function incrementAnalysisCounts() {
    if (!supabaseClient) return;
    try {
        await Promise.all([
            supabaseClient.rpc('increment_analysis_counter', { counter_key: TOTAL_KEY }),
            supabaseClient.rpc('increment_analysis_counter', { counter_key: DAILY_KEY })
        ]);
        // RPC 반환값 대신 DB 재조회로 UI 갱신 (RPC 실패 시 0 덮어쓰기 방지)
        await fetchAnalysisCounts();
    } catch (error) {
        console.error('Failed to increment counts:', error);
    }
}

/** 카운터 UI에 오늘/전체 횟수 표시 */
function updateCounterUI(daily, total) {
    const todayEl = document.getElementById('analysis-count-today');
    const totalEl = document.getElementById('analysis-count-total');
    const badgeEl = document.getElementById('counter-badge');

    if (todayEl) todayEl.innerText = Number(daily).toLocaleString();
    if (totalEl) totalEl.innerText = Number(total).toLocaleString();

    if (badgeEl) {
        badgeEl.style.opacity = '1';
        badgeEl.style.transform = 'scale(1)';
    }
}

// 전역 노출 (다른 스크립트에서 분석 실행 시 호출)
window.incrementAnalysisCounts = incrementAnalysisCounts;

// 페이지 로드 시 초기 조회
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAnalysisCounts);
} else {
    fetchAnalysisCounts();
}

/**
 * ── 오류 제보 Supabase 연동 ──
 * 파일(선택)을 Storage에 업로드하고 DB(error_reports)에 제보 내용을 저장합니다.
 */
async function uploadErrorReport(email, content, file) {
    if (!supabaseClient) {
        throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
    }

    let attachmentUrl = null;

    try {
        // 1. 첨부 파일이 있을 경우 Storage에 업로드
        if (file) {
            // 파일명 중복 방지를 위한 타임스탬프 추가
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const filePath = `reports/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('error_attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 파일의 Public URL 가져오기
            const { data: publicUrlData } = supabaseClient
                .storage
                .from('error_attachments')
                .getPublicUrl(filePath);

            attachmentUrl = publicUrlData.publicUrl;
        }

        // 2. DB (error_reports)에 데이터 삽입
        const { error: insertError } = await supabaseClient
            .from('error_reports')
            .insert([{
                email: email,
                content: content,
                attachment_url: attachmentUrl
            }]);

        if (insertError) throw insertError;

        return true;
    } catch (error) {
        console.error("Error in uploadErrorReport:", error);
        throw error;
    }
}

// 전역 노출
window.uploadErrorReport = uploadErrorReport;
