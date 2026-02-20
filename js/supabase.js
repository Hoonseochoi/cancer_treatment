// ── Supabase Integration ──
const SUPABASE_URL = "https://omgwvnibssizmhovporl.supabase.co";
const SUPABASE_KEY = "sb_publishable_RwpnmzYtRaskL8bNWxV2Cw_5FG05XJh";
// Use a safe check for the global supabase object provided by the CDN
const supabaseClient = (window.supabase) ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ── Manager Level Logic ──
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

let currentManagerData = { count: 0, level: 1, exp: 0, required: 1, name: '' };

async function logManagerActivity(code, name, fileName) {
    if (!supabaseClient) {
        console.warn("Supabase client not initialized.");
        return;
    }
    try {
        // 1. Insert history log
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

        // 2. Fetch total count from logs to calculate new level
        const { count, error: countError } = await supabaseClient
            .from('manager_logs')
            .select('*', { count: 'exact', head: true })
            .eq('manager_code', code);

        if (countError) throw countError;

        const totalCount = count || 1;
        const currentLevel = calculateLevelFromCount(totalCount);

        // 3. Upsert into manager_profiles
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

        // 4. Update local state and UI
        updateManagerLevel(totalCount, name);

    } catch (err) {
        console.error("Failed to log activity:", err);
    }
}

// Helper to get level from count based on thresholds
function calculateLevelFromCount(count) {
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (count >= LEVEL_THRESHOLDS[i].min) {
            level = LEVEL_THRESHOLDS[i].level;
        }
    }
    return level;
}

function updateManagerLevel(totalCount, name) {
    let currentLevel = 1;
    let nextThreshold = 2;
    let prevThreshold = 0;
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

    // Render the changes immediately
    renderManagerLevel();

    if (justLeveledUp) {
        showLevelUpNotification();
    }
}

function renderManagerLevel() {
    const { level, exp, required, name } = currentManagerData;
    const badgeContainer = document.getElementById('manager-badge-container');
    if (!badgeContainer) return;

    // 1. Update Top Badge Level Indicator
    const welcomeLvEl = document.getElementById('welcome-manager-level');
    if (welcomeLvEl) {
        welcomeLvEl.textContent = `LV.${level}`;
        welcomeLvEl.classList.remove('hidden');
    }

    // 2. Update Expanded Panel Info
    const lvNumEl = document.getElementById('level-modal-lv-num');
    if (lvNumEl) lvNumEl.textContent = level;

    const currExpEl = document.getElementById('level-modal-current-exp');
    if (currExpEl) currExpEl.textContent = exp;

    const nextExpEl = document.getElementById('level-modal-next-exp');
    if (nextExpEl) nextExpEl.textContent = required;

    const progressPercent = level >= 10 ? 100 : Math.min(100, Math.round((exp / required) * 100));
    const progressEl = document.getElementById('level-modal-progress');
    if (progressEl) progressEl.style.width = `${progressPercent}%`;

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
        imgEl.src = `level/lv${level}.png`;
    }

    // 3. Update Theme
    badgeContainer.className = badgeContainer.className.replace(/level-theme-\d+/g, '');
    badgeContainer.classList.add(`level-theme-${level}`);
}

function showLevelUpNotification() {
    const bubble = document.getElementById('level-up-notification');
    const badge = document.getElementById('manager-badge-container');
    if (!bubble) return;

    // Slide in + fade in
    bubble.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
    bubble.classList.add('opacity-95', 'translate-y-0', 'visible');

    // Red pulsing glow around the badge
    if (badge) badge.classList.add('badge-levelup-glow');

    // After 4 seconds, slide out + remove glows
    setTimeout(() => {
        bubble.classList.remove('opacity-95', 'translate-y-0', 'visible');
        bubble.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
        if (badge) badge.classList.remove('badge-levelup-glow');
    }, 4000);
}

// ── Expandable Badge Event Listeners ──
document.addEventListener('DOMContentLoaded', () => {
    const badgeContainer = document.getElementById('manager-badge-container');

    function toggleBadge(e) {
        if (!badgeContainer) return;

        // Prevent click from bubbling to document and immediately closing
        e.stopPropagation();

        if (badgeContainer.classList.contains('badge-expanded')) {
            badgeContainer.classList.remove('badge-expanded');
        } else {
            // Expand and ensure data is rendered
            badgeContainer.classList.add('badge-expanded');
            renderManagerLevel();
        }
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (badgeContainer && badgeContainer.classList.contains('badge-expanded') && !badgeContainer.contains(e.target)) {
            badgeContainer.classList.remove('badge-expanded');
        }
    });

    if (badgeContainer) badgeContainer.addEventListener('click', toggleBadge);
});


/**
 * --- COUNTER API LOGIC (DUAL: TODAY & TOTAL) ---
 * tracks analysis counts via api.counterapi.dev
 */
const COUNTER_NAMESPACE = "meritz_analyzer";

// Get KST Date Key: meritz_daily_YYYYMMDD
function getTodayKey() {
    const now = new Date();
    // Offset to KST (UTC+9)
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    return `meritz_daily_${yyyy}${mm}${dd}`;
}

const TOTAL_KEY = "meritz_total_analysis";
const DAILY_KEY = getTodayKey();

const API_BASE = "https://api.counterapi.dev/v1";

async function fetchAnalysisCounts() {
    try {
        // Fetch Total and Daily in parallel
        const [totalRes, dailyRes] = await Promise.all([
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${TOTAL_KEY}`),
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${DAILY_KEY}`)
        ]);

        const totalData = await totalRes.json();
        const dailyData = await dailyRes.json();

        updateCounterUI(dailyData.count || 0, totalData.count || 0);
    } catch (error) {
        console.error('Failed to fetch counts:', error);
    }
}

async function incrementAnalysisCounts() {
    try {
        // Increment both in parallel
        const [totalRes, dailyRes] = await Promise.all([
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${TOTAL_KEY}/up`),
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${DAILY_KEY}/up`)
        ]);

        const totalData = await totalRes.json();
        const dailyData = await dailyRes.json();

        updateCounterUI(dailyData.count, totalData.count);
    } catch (error) {
        console.error('Failed to increment counts:', error);
    }
}

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

// Global exposure for increment
window.incrementAnalysisCounts = incrementAnalysisCounts;

// Initial fetch on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAnalysisCounts);
} else {
    fetchAnalysisCounts();
}

