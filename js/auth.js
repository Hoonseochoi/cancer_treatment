// ── 로그인 · 하루 무료 분석 · 회원 레벨 ──
// 로그인하지 않으면 이 브라우저에서 하루 5건까지 분석할 수 있다. 6건째부터 로그인 안내가 뜬다.
// 로그인 회원은 제한이 없고, 분석할 때마다 user_usage에 한 줄씩 쌓아 그 수로 레벨을 매긴다.
// (예전 메리츠 설계번호 앞 9자리로 매니저를 알아보던 레벨링을 대신한다)
//
// 브라우저 저장소로 세는 제한이라 시크릿 창·저장소 삭제로 다시 5건이 생긴다.
// 가입을 자연스럽게 권하는 장치이지 막는 장치가 아니다.

const FREE_DAILY_LIMIT = 5;
const FREE_KEY = 'surinsurFreeUsage';

const SurAuth = (function () {
    // supabase.js가 같은 프로젝트로 만든 클라이언트를 쓴다 — 로그인 세션도 login.html과 공유된다
    const sb = (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : null;
    let user = null;
    let count = 0;

    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    // 저장소를 못 쓰는 환경(일부 시크릿 모드)에서는 0건으로 본다 — 막지 않는 쪽으로 기운다
    function freeUsed() {
        try {
            const o = JSON.parse(localStorage.getItem(FREE_KEY) || 'null');
            return o && o.date === today() ? (o.n || 0) : 0;
        } catch (e) { return 0; }
    }
    function bumpFree() {
        try { localStorage.setItem(FREE_KEY, JSON.stringify({ date: today(), n: freeUsed() + 1 })); } catch (e) {}
    }
    const displayName = () => (user && user.user_metadata && user.user_metadata.name) || (user && user.email ? user.email.split('@')[0] : '');

    // 접속한 날 — 하루(한국 시간) 한 번만 user_visits에 남긴다. 같은 날 두 번째부터는 DB가 무시하고,
    // 이 브라우저에서도 그날은 다시 보내지 않는다. 트리거가 profiles.visit_days를 올린다.
    async function recordVisit() {
        if (!sb || !user) return;
        const key = 'surinsurVisit:' + user.id;
        try { if (localStorage.getItem(key) === today()) return; } catch (e) {}
        const { error } = await sb.from('user_visits')
            .upsert({ user_id: user.id }, { onConflict: 'user_id,visit_date', ignoreDuplicates: true });
        if (error) { console.warn('[auth] 접속 기록 실패', error.message); return; }
        try { localStorage.setItem(key, today()); } catch (e) {}
    }

    async function refreshCount() {
        if (!sb || !user) return 0;
        const { count: c, error } = await sb.from('user_usage').select('id', { count: 'exact', head: true });
        if (error) { console.warn('[auth] 분석 횟수 조회 실패', error.message); return count; }
        count = c || 0;
        return count;
    }

    // ── 화면 ──
    function renderHeader() {
        const btn = document.getElementById('auth-btn');
        const out = document.getElementById('auth-logout');
        if (btn) {
            btn.hidden = !!user;
            btn.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
        }
        if (out) out.hidden = !user;
        const left = document.getElementById('free-left');
        if (left) {
            const n = Math.max(0, FREE_DAILY_LIMIT - freeUsed());
            left.innerHTML = user ? ''
                : `오늘 비회원 분석 가능 횟수 <b>${n}건</b> · <a href="login.html?mode=signup">가입하면 제한 없이</a>`;
            left.hidden = !!user;
        }
    }
    // 위 노치 섬의 회원 이름 — 누르면 같은 섬이 레벨 패널로 펼쳐진다(index.html 노치 스크립트)
    function renderBadge(leveledUp) {
        const btn = document.getElementById('nn-user');
        if (!btn) return;
        if (!user) {
            btn.hidden = true;
            if (window.SurNotch && document.getElementById('notch').dataset.mode === 'level') SurNotch.close();
            return;
        }
        const nm = document.getElementById('welcome-manager-name');
        if (nm) nm.textContent = displayName();
        btn.title = '내 레벨 보기';
        if (typeof updateManagerLevel === 'function') updateManagerLevel(count, displayName(), leveledUp);
        btn.hidden = false;
    }

    // ── 6건째 안내 ──
    function showLimit() {
        const m = document.getElementById('free-limit-modal');
        if (!m) { location.href = 'login.html?next=index.html'; return; }
        m.hidden = false;
        const first = m.querySelector('a, button');
        if (first) first.focus();
    }
    function hideLimit() { const m = document.getElementById('free-limit-modal'); if (m) m.hidden = true; }

    async function init() {
        if (sb) {
            try {
                const { data } = await sb.auth.getSession();
                user = (data && data.session && data.session.user) || null;
            } catch (e) { user = null; }
            sb.auth.onAuthStateChange((evt, session) => {
                const next = (session && session.user) || null;
                if ((next && next.id) === (user && user.id)) return;
                user = next;
                recordVisit();
                refreshCount().then(() => { renderHeader(); renderBadge(false); });
            });
        }
        if (user) { recordVisit(); await refreshCount(); }
        renderHeader();
        renderBadge(false);
        const out = document.getElementById('auth-logout');
        if (out) out.onclick = async () => { if (sb) await sb.auth.signOut(); user = null; count = 0; renderHeader(); renderBadge(false); };
        const m = document.getElementById('free-limit-modal');
        if (m) m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) hideLimit(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') hideLimit(); });
    }
    const ready = (document.readyState === 'loading')
        ? new Promise(r => document.addEventListener('DOMContentLoaded', () => init().then(r)))
        : init();

    return {
        ready,
        get user() { return user; },
        // 분석을 시작해도 되는가 — 안 되면 안내를 띄우고 false
        async allowAnalysis() {
            await ready;
            if (user || freeUsed() < FREE_DAILY_LIMIT) return true;
            showLimit();
            return false;
        },
        // 분석을 마친 뒤 한 번 — 회원이면 기록·레벨, 아니면 오늘 무료 횟수 차감
        async recordAnalysis(fileName, insurer) {
            await ready;
            if (!user) { bumpFree(); renderHeader(); return; }
            if (!sb) return;
            const { error } = await sb.from('user_usage').insert([{ file_name: fileName || null, insurer: insurer || null }]);
            if (error) { console.warn('[auth] 분석 기록 실패', error.message); return; }
            await refreshCount();
            renderBadge(true);
        }
    };
})();
window.SurAuth = SurAuth;
