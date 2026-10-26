// ── 첫 화면 업로드 칸 오른쪽: 스마트가입제안서 지면이 겹쳐 있고 맨 앞 장이 차례로 넘어간다 ──
// 지면은 실제 PDF 지면 함수(pdf_sheet.js)와 로그인 화면용 샘플(login_showcase_data.js)로 그린다.
(function landingStack() {
    const host = document.getElementById('lp-stack');
    if (!host || typeof LOGIN_SHOWCASE === 'undefined' || typeof sheetCss !== 'function') return;
    const C = SHEET_COLOR;
    const brandBlue = b => (SHEET_BRAND[b] || SHEET_BRAND.samsung).blue;
    const prevKey = window.__insurerKey;

    // 지면 CSS는 전역 클래스라 보험사마다 섞이지 않게 shadow DOM에 가둔다(auth_page.js와 같은 방식)
    const sheet = (brand, make, ac, acs) => {
        window.__insurerKey = brand;
        const d = LOGIN_SHOWCASE[brand];
        (d.cancerCards || []).forEach(c => { c.icon = getSheetIcon(c.nm); });
        let html = '';
        try { html = make(d); } catch (e) { return null; }
        const css = sheetCss() + (typeof caregiverSheetCss === 'function' ? caregiverSheetCss() : '');
        const page = document.createElement('div');
        page.className = 'page';
        page.attachShadow({ mode: 'open' }).innerHTML = `<style>:host{display:block}${css}
            .sheet{transform-origin:0 0;transform:scale(var(--s))}</style>
            <div class="sheet" style="--ac:${ac};--acs:${acs}">${html}</div>`;
        return page;
    };
    const list = [
        ['보장 요약', () => sheet('samsung', sheetSummary, brandBlue('samsung'), '#EDF2FE')],
        ['암 치료비', () => sheet('meritz', sheetCancer, C.cancer, C.cancerSoft)],
        ['수술비', () => sheet('samsung', sheetSurgery, C.surgery, C.surgerySoft)],
        ['뇌·심장', () => sheet('meritz', sheetCirc, C.brain, C.brainSoft)]
    ];
    const pages = [], names = [];
    list.forEach(([name, make]) => { const p = make(); if (p) { pages.push(p); names.push(name); host.appendChild(p); } });
    window.__insurerKey = prevKey;
    if (!pages.length) return;

    const label = document.getElementById('lp-stack-name');
    let front = 0;
    const place = () => {
        pages.forEach((p, i) => { p.dataset.pos = String(Math.min(3, (i - front + pages.length) % pages.length)); });
        if (label) label.textContent = names[front];
    };
    const fit = () => {
        const w = parseFloat(getComputedStyle(host).getPropertyValue('--w')) || 178;
        pages.forEach(p => p.style.setProperty('--s', w / SHEET_W));
    };
    place(); fit();
    window.addEventListener('resize', fit);

    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // 맨 앞 장이 왼쪽으로 빠지면서 사라지고, 맨 뒤로 돌아간다 — 업로드 칸이 보일 때만 돈다
    setInterval(() => {
        if (document.hidden || !host.offsetParent) return;
        if (host.parentNode.matches(':hover')) return;   // 펼쳐 보는 동안은 넘기지 않는다
        const out = pages[front];
        out.classList.add('lp-leave');
        front = (front + 1) % pages.length;
        setTimeout(() => {
            out.style.transition = 'none';
            out.classList.remove('lp-leave');
            place();
            void out.offsetWidth;
            out.style.transition = '';
        }, 520);
        // 나머지 장은 곧바로 한 칸씩 앞으로
        pages.forEach(p => { if (p !== out) p.dataset.pos = String(Math.min(3, (pages.indexOf(p) - front + pages.length) % pages.length)); });
        if (label) label.textContent = names[front];
    }, 2800);
})();
