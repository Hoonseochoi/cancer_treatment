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
        const { data, error } = await supabaseClient
            .from('manager_logs')
            .insert([
                {
                    manager_code: code,
                    manager_name: name,
                    file_name: fileName
                }
            ]);
        if (error) throw error;
        console.log("Activity logged successfully:");

        // Fetch total count for this manager
        const { count, error: countError } = await supabaseClient
            .from('manager_logs')
            .select('*', { count: 'exact', head: true })
            .eq('manager_code', code);

        if (countError) throw countError;

        const totalCount = count || 1;
        updateManagerLevel(totalCount, name);

    } catch (err) {
        console.error("Failed to log activity:", err);
    }
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

    if (justLeveledUp && currentLevel > 1) {
        showLevelUpNotification();
    }
}

function showLevelUpNotification() {
    const bubble = document.getElementById('level-up-notification');
    if (!bubble) return;

    // Show the text dropping down
    bubble.classList.remove('opacity-0', '-translate-y-8', 'pointer-events-none');
    bubble.classList.add('opacity-100', 'translate-y-0');

    // Display for 4 seconds, then hide
    setTimeout(() => {
        bubble.classList.remove('opacity-100', 'translate-y-0');
        bubble.classList.add('opacity-0', '-translate-y-8', 'pointer-events-none');
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
            // Expand and populate data
            badgeContainer.classList.add('badge-expanded');

            if (typeof currentManagerData !== 'undefined') {
                const { level, exp, required, name } = currentManagerData;

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

                // Add theme to badge container
                badgeContainer.className = badgeContainer.className.replace(/level-theme-\d+/g, '');
                badgeContainer.classList.add(`level-theme-${level}`);
            }
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

