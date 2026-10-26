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
    // 매니저 배지 — 이름과 레벨을 회원 기준으로 채운다
    function renderBadge(leveledUp) {
        const badge = document.getElementById('manager-badge-container');
        if (!badge) return;
        if (!user) { badge.classList.add('hidden', 'scale-90', 'opacity-0'); return; }
        // "OOO님 환영합니다 !" — 누르면 기존 레벨 패널(캐릭터·경험치 바)이 펼쳐진다(supabase.js toggleBadge)
        const nameBox = document.querySelector('.welcome-name');
        const lv = document.getElementById('welcome-manager-level');
        if (nameBox) {
            nameBox.innerHTML = `<span><span id="welcome-manager-name"></span>님 환영합니다 !</span> ${lv ? lv.outerHTML : ''}`;
            document.getElementById('welcome-manager-name').textContent = displayName();
        }
        const greet = badge.querySelector('.welcome-greet');
        if (greet) greet.textContent = '눌러서 내 레벨 보기';
        badge.style.cursor = 'pointer';
        badge.title = '내 레벨 보기';
        const code = document.getElementById('welcome-manager-code');
        if (code) code.classList.add('hidden');
        if (typeof updateManagerLevel === 'function') updateManagerLevel(count, displayName(), leveledUp);
        badge.classList.remove('hidden');
        setTimeout(() => { badge.classList.remove('scale-90', 'opacity-0'); badge.classList.add('scale-100', 'opacity-100'); }, 60);
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
                refreshCount().then(() => { renderHeader(); renderBadge(false); });
            });
        }
        if (user) await refreshCount();
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
