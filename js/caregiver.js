// ── 간병인 지원 ──
// 제안서에 간병 담보(간병인지원 · 간병인 사용일당 · 간호·간병통합서비스 사용일당)가 있으면
// 웹에 '간병인' 탭을, PDF에 지면 한 장을 더한다. 암·수술비·뇌심 화면에는 관여하지 않는다.
//
// 문구 근거는 두 곳뿐이다.
//   ① 가입제안서의 담보별 지급 설명(약관 요약) — 한도·조건
//   ② 가입제안서 수록 「간병인지원 이용 안내」(제2026-003호, 2026.08.13, [AGSL015_01]) — 신청 방법·연락처
// 교안의 판매 표현(타사 비교·운영기준 홍보)은 고객 자료라 옮기지 않는다.

// 번호·주소·문구는 여기서만 고친다.
const CAREGIVER_SERVICE = {
    source: '간병인지원 이용 안내 제2026-003호(2026.08.13) [AGSL015_01]',
    partner: '삼성화재 × LivOn',
    steps: [
        { t: '신청', s: '전화 · 웹 · QR', ico: 'cal' },
        { t: '대상 확인 후 배정', s: '간병인 배정', ico: 'person' },
        { t: '고객·보호자 안내', s: '전화 · 문자', ico: 'phone' },
        { t: '간병 시작', s: '', ico: 'care' }
    ],
    phone: { number: '1877-7412', label: '간병인 신청 · 문의', note: '리본케어 · 연중무휴 365일 9:00~18:00' },
    web: { label: '웹 신청', url: 'https://samsungfire.livon.care', text: 'samsungfire.livon.care' },
    productPhone: { number: '1588-5114', label: '보험 상품 문의', note: '삼성화재 고객콜센터' },
    target: '지원 대상: 상해/질병 입원 간병인지원 특약 가입자',
    lead: '간병인이 필요한 시점보다 최소 24시간 전에 신청하세요',
    leadSub: '영업일 9~18시 외 · 토·일·공휴일 신청은 최대 48시간',
    // 장점 — 1·2는 공식 안내, 3·4는 운영 서비스(약관 보장 아님), 5는 납입면제 담보가 있을 때만
    strengths: [
        { ico: 'badge',  t: '자격있는 간병인',            s: '요양보호사·간병사 자격을 갖춘 간병인' },
        { ico: 'clock',  t: '365일 연중무휴 신청·배정',    s: '9:00~18:00 · 리본케어 1877-7412' },
        { ico: 'doc',    t: 'VOC 3진아웃 · AI 간병일지',   s: '간병 품질을 관리하고 기록으로 남겨요', svc: true },
        { ico: 'shield', t: '삼성화재 배상책임',           s: '간병 중 사고에 대비해요', svc: true },
        { ico: 'coin',   t: '납입면제 가능',              s: '납입면제 사유 발생 시 이후 보험료 면제', showIf: 'hasWaiver' }
    ],
    strengthsNote: '* 표시는 회사·제휴사의 운영 서비스로 약관상 보장이 아니며, 내용이 변경될 수 있습니다.',
    // 지급 설명에 적힌 조건 — 고객이 가장 자주 놓치는 세 가지만
    keep: [
        '회사에 신청하지 않고 간병인을 쓰거나 간호·간병통합서비스를 이용하면, 간병인 대신 입원일당이 나옵니다.',
        '회사가 간병인을 보내지 못하면 실제 쓴 간병비를 지원 한도 안에서 드립니다.',
        '입원일당·간병인 지원 일수를 합쳐 1회 입원당 180일(181일 이상 담보는 185일)까지입니다.'
    ],
    homeCare: {
        title: '퇴원 후 집에서도 · 가정케어',
        line: '전문 요양보호사가 집으로 · 조건별 최대 10회(1회 4시간)',
        chips: ['암·뇌혈관·허혈성심장 진단', '관절 수술'],
        phone: { number: '1600-8204', note: '삼성화재 전용 가정케어 콜센터' }
    },
    // 상황별 하루 평균 비용 — 일당이 실제 부담을 얼마나 덮는지 가늠하게 한다
    cost: {
        // 국민건강보험공단 소식지 2023.09: 통합병동 환자 본인부담 22,340원/일(종합병원 6인실, 2023년 기준)
        ward: '하루 평균 약 2만 2천원 소요',
        // 요양병원 간병비 — 설계사 현장 기준 수치(사용자 제공). 근거 자료 확보 시 출처를 적는다
        nursing: '하루 평균 2만원 소요'
    },
    disclaimer: '가입제안서를 바탕으로 정리한 참고자료입니다. 보장 여부와 한도는 약관 및 상품설명서에 따릅니다. ' +
        '간병인 배정은 영업일 9~18시 외 또는 토·일·공휴일 신청 시 최대 48시간이 걸릴 수 있으며, ' +
        '서비스 내용은 대외환경 변화 등에 따라 변경되거나 중지될 수 있습니다.'
};

// 오프라인으로 만들어 둔 QR (https://samsungfire.livon.care). 외부 QR API를 부르지 않는다.
const CAREGIVER_QR = 'data:image/png;base64,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';

// 흑백 라인 아이콘 — 기존 아이콘과 같은 결로 단순하게
const CG_ICON = {
    bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
    long: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17h6"/>',
    ward: '<path d="M4 20V8l8-4 8 4v12M9 20v-5h6v5M12 8v4M10 10h4"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M12 17.5s-3-1.9-3-3.9a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.9-3 3.9z"/>',
    hire: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 8h5M18.5 5.5v5"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>',
    person: '<rect x="3.5" y="4" width="17" height="13" rx="2"/><circle cx="12" cy="9" r="2.3"/><path d="M8 15a4 4 0 0 1 8 0M10 20h4"/>',
    phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15 15 0 0 1 4.5 6 2 2 0 0 1 6.5 4z"/>',
    badge: '<circle cx="12" cy="9" r="5"/><path d="M9.5 9l1.8 1.8L15 7.2M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    doc: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6M9 19h3"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 9.5l1.5 5 2-4 2 4 1.5-5M8 12h8"/>',
    care: '<path d="M3 15l4-1 5 2.5 4.5-1.5c1-.3 1.8.8 1 1.5L13 20l-7-1.5M3 15v5"/><path d="M15 9.5s-2.5-1.6-2.5-3.3a1.4 1.4 0 0 1 2.5-.7 1.4 1.4 0 0 1 2.5.7c0 1.7-2.5 3.3-2.5 3.3z"/>'
};
function cgIcon(k, size) {
    return `<svg viewBox="0 0 24 24" width="${size || 22}" height="${size || 22}" fill="none" ` +
           `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">` +
           `${CG_ICON[k] || ''}</svg>`;
}

// 보험사별 안내 — 메리츠는 js/meritz_adapter.js의 MERITZ_CAREGIVER_SERVICE
function cgIsMeritz() {
    return typeof window !== 'undefined' && window.__insurerKey === 'meritz' &&
        typeof MERITZ_CAREGIVER_SERVICE !== 'undefined';
}
function cgService() { return cgIsMeritz() ? MERITZ_CAREGIVER_SERVICE : CAREGIVER_SERVICE; }

// ── 담보 정리 ──
// 같은 상황(scope)에 상해·질병이 둘 다 있으면 카드 한 장으로 합친다.
function buildCaregiverPolicy(results) {
    const list = (results || []).filter(r => r && r.kind === 'caregiver');
    if (!list.length) return null;
    const norm = s => String(s || '').replace(/\s+/g, '');
    const items = list.map(r => {
        const n = norm(r.name);
        const cause = /상해/.test(n) ? '상해' : /질병/.test(n) ? '질병' : '';
        const long = /181일/.test(n);
        let key;
        // 메리츠 요양성특정질병(치매·뇌혈관·신경계) — 요양병원 181일째부터 간병인 지원
        if (/간병인지원/.test(n) && /요양성특정질병/.test(n)) key = 'supportRehab';
        else if (/간병인지원/.test(n)) key = long ? 'supportLong' : 'support';
        else if (/간호[·ㆍ]?간병통합/.test(n)) key = long ? 'wardLong' : 'ward';
        else if (/간병인사용일당/.test(n) && /요양병원/.test(n) && !/요양병원제외/.test(n)) key = 'nursing';
        else if (/간병인사용일당/.test(n)) key = long ? 'hireLong' : 'hire';
        else key = 'etc';
        // 간병인지원의 가입금액은 '5천원'처럼 천 단위다. parseKoAmount는 만원 단위라
        // 그대로 쓰면 5,000만원이 된다 — 천원 표기는 제안서 글자 그대로 보여준다.
        const amt = String(r.amount || '').replace(/\s+/g, '');
        // 메리츠 간병인지원은 가입금액 칸에 금액 대신 '간병인지원'이라고만 적혀 있다
        const disp = amt === '간병인지원' ? '간병인 지원'
            : /천원$/.test(amt) && !/천만/.test(amt) ? amt : formatKoAmount(parseKoAmount(r.amount));
        return { key, cause, v: parseKoAmount(r.amount), disp,
                 name: String(r.name || '').trim(), stepUp: /체증형/.test(n) };
    });
    const by = {};
    items.forEach(it => { (by[it.key] = by[it.key] || []).push(it); });
    return { items, by, hasSupport: !!(by.support || by.supportLong || by.supportRehab), mz: cgIsMeritz() };
}

// 상해·질병 금액 묶어 쓰기 — 같으면 한 번, 다르면 나눠서
function cgAmount(list) {
    const causes = list.map(x => x.cause).filter(Boolean);
    const vals = [...new Set(list.map(x => x.disp))];
    const who = causes.length > 1 ? causes.join('·') : (causes[0] || '');
    if (vals.length === 1) return { main: vals[0], who };
    return { main: list.map(x => `${x.cause} ${x.disp}`).join(' · '), who: '' };
}

// 상황별 카드 — 가입한 것만, 실제로 일어나는 순서대로
function caregiverCards(p) {
    const C = [];
    const add = (key, o) => { if (p.by[key]) C.push(Object.assign({ key, list: p.by[key] }, o)); };
    // 메리츠 간병인지원은 간병인 대신 받는 일당이 없다 — 회사가 못 보내면 실제 간병비를 한도 안에서 준다
    add('support', {
        ico: 'bed', title: '병원에 입원하면',
        head: p.mz ? '간병인을 보내드려요' : '<em class="cg-q">자격있는</em> 간병인을 보내드려요', big: false,
        meta: p.mz ? '1일 이상 · 1회 입원 180일까지' : '1일 이상 · 요양병원 제외 · 1회 입원 180일까지',
        foot: a => (p.mz ? '48시간 전 신청 · 1688-0090' : `간병인 대신 받으면 1일 ${a.main}`) });
    add('supportLong', {
        ico: 'long', title: '181일 넘게 입원해도', head: '계속 보내드려요', big: false,
        meta: '181일째부터 · 요양·정신·한방병원 제외 · 185일까지',
        foot: a => (p.mz ? '' : `간병인 대신 받으면 1일 ${a.main}`) });
    add('supportRehab', {
        ico: 'home', title: '요양병원에 오래 있어도', head: '간병인을 보내드려요', big: false,
        meta: '치매·뇌혈관·신경계 질환 · 요양병원 181일째부터 · 185일까지',
        foot: () => '' });
    add('ward', {
        ico: 'ward', title: '간호·간병통합병동이면', head: a => `1일 ${a.main}`, big: true,
        meta: p.mz ? '1일 이상 · 180일까지' : '1일 이상 · 요양병원 제외 · 180일까지', cost: CAREGIVER_SERVICE.cost.ward,
        foot: () => (p.by.ward.some(x => x.stepUp) ? '5년마다 가입금액의 10%씩 늘어나요' : '') });
    add('wardLong', {
        ico: 'long', title: '통합병동 181일 넘으면', head: a => `1일 ${a.main}`, big: true,
        meta: '181일째부터 · 요양·정신·한방병원 제외 · 185일까지', cost: CAREGIVER_SERVICE.cost.ward,
        foot: () => '' });
    add('hire', {
        ico: 'hire', title: '간병인을 직접 쓰면', head: a => `1일 ${a.main}`, big: true,
        meta: '간병인 사용 1일당', foot: () => '' });
    add('nursing', {
        ico: 'home', title: '요양병원에서는', head: a => `간병인 쓰면 1일 ${a.main}`, big: true,
        meta: '1일 이상 · 180일까지', cost: CAREGIVER_SERVICE.cost.nursing, foot: () => '' });
    return C.map(c => {
        const a = cgAmount(c.list);
        return {
            ico: c.ico, title: c.title, who: a.who,
            head: typeof c.head === 'function' ? c.head(a) : c.head,
            meta: c.meta, cost: c.cost || '', foot: c.foot(a), big: c.big
        };
    });
}

// 한장요약 간병 줄 — 상황별 카드를 표 한 줄로 줄인다(가입한 상황만)
function caregiverSummaryCells(p) {
    if (!p) return [];
    const SHORT = {
        support:     { h: '병원 입원',        v: () => '간병인 지원' },
        supportLong: { h: '181일 이상 입원',  v: () => '간병인 지원' },
        supportRehab:{ h: '요양병원 181일~',  v: () => '간병인 지원' },
        ward:        { h: '간호·간병통합병동', v: a => `1일 ${a.main}` },
        wardLong:    { h: '통합병동 181일~',  v: a => `1일 ${a.main}` },
        hire:        { h: '간병인 직접 고용',  v: a => `1일 ${a.main}` },
        nursing:     { h: '요양병원',         v: a => `1일 ${a.main}` }
    };
    const SUB = { support: '1회 입원 180일', supportLong: '185일까지', supportRehab: '185일까지', ward: '180일까지',
                  wardLong: '185일까지', hire: '', nursing: '180일까지' };
    return Object.keys(SHORT).filter(k => p.by[k]).map(k => {
        const a = cgAmount(p.by[k]);
        return { h: SHORT[k].h, v: SHORT[k].v(a), s: SUB[k] };
    });
}

// '가입한 담보 쉽게보기' — 지원형의 5천원은 간병인 대신 받는 입원일당이라 금액으로만 두면 오해를 산다.
// 상해·질병이 같은 조건·같은 금액으로 짝지어 들어오는 게 보통이라 한 줄로 합친다(10줄 → 5줄).
function caregiverCovList(p) {
    const clean = s => s.replace(/\[[^\]]*\]\s*/g, '').trim();
    const out = [];
    const ORDER = ['support', 'supportLong', 'supportRehab', 'ward', 'wardLong', 'hire', 'nursing', 'etc'];
    ORDER.filter(k => p.by[k]).map(k => p.by[k]).forEach(list => {
        const groups = new Map();
        list.forEach(it => {
            const k = it.disp;
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(it);
        });
        groups.forEach(g => {
            const causes = [...new Set(g.map(x => x.cause).filter(Boolean))];
            let nm = clean(g[0].name);
            if (causes.length > 1) nm = nm.replace(/상해|질병/, causes.join('·'));
            out.push({ nm, v: g[0].v, label: /support/.test(g[0].key) ? '간병인 지원' : g[0].disp });
        });
    });
    return out;
}

// 장점 목록 — 납입면제는 담보가 있을 때만, 운영 서비스는 * 표시
function caregiverStrengths(flags) {
    const S = CAREGIVER_SERVICE;
    const list = S.strengths.filter(x => !x.showIf || (flags && flags[x.showIf]));
    const hasSvc = list.some(x => x.svc);
    return { list, note: hasSvc ? S.strengthsNote : '' };
}
function caregiverStrengthsHtml(flags, size) {
    const st = caregiverStrengths(flags);
    return `<div class="cg-pros">${st.list.map(x => `
        <div class="cg-pro"><span class="cg-pico">${cgIcon(x.ico, size)}</span>
          <div class="cg-ptx"><b>${x.t}${x.svc ? '<sup>*</sup>' : ''}</b><span>${x.s}</span></div></div>`).join('')}</div>` +
      (st.note ? `<p class="cg-pnote">${st.note}</p>` : '');
}

// ── 웹 탭 ──
function renderCaregiverPanel(results) {
    const host = document.getElementById('caregiver-panel');
    if (!host) return false;
    const p = buildCaregiverPolicy(results);
    if (!p) return false;
    const S = cgService();
    const cards = caregiverCards(p);
    const cov = caregiverCovList(p);
    const meta = window.__lastMeta || {};

    const covHtml = `
      <div class="sf-cov">
        <div class="sf-cov-hd" role="button" tabindex="0" aria-expanded="false"><span class="t">가입한 담보 쉽게보기</span><span class="n">간병 ${cov.length}개</span></div>
        <ul>${cov.map(x => `<li><span title="${x.nm}">${clipName(x.nm, 26)}</span><b>${x.label}</b></li>`).join('')}</ul>
      </div>`;

    const cardHtml = cards.map(c => `
      <div class="cg-card">
        <div class="cg-ct"><span class="cg-ico">${cgIcon(c.ico, 22)}</span><span class="cg-ti">${c.title}</span>
          ${c.who ? `<span class="cg-who">${c.who}</span>` : ''}</div>
        <div class="cg-head${c.big ? ' num' : ''}">${c.head}</div>
        <div class="cg-meta">${c.meta}${c.cost ? ` · <span class="cg-cost">${c.cost}</span>` : ''}</div>
        ${c.foot ? `<div class="cg-foot">${c.foot}</div>` : ''}
      </div>`).join('');

    const applyHtml = p.hasSupport ? `
      <h3 class="sf-h3" style="--sf-sec:#0B8A7A">간병인 신청은 이렇게<span class="hint">${S.partner}</span></h3>
      <div class="cg-apply">
        <div class="cg-flow">${S.steps.map((s, i) => (i ? '<span class="cg-arw">›</span>' : '') +
            `<div class="cg-step"><span class="cg-sico">${cgIcon(s.ico, 20)}</span><b>${s.t}</b>` +
            `${s.s ? `<em>${s.s}</em>` : ''}</div>`).join('')}</div>
        <div class="cg-call">
          ${S.web ? `<img class="cg-qr" src="${CAREGIVER_QR}" alt="간병인 신청 웹페이지 QR">` : ''}
          <div class="cg-num">
            <span class="cg-lbl">${S.phone.label}</span>
            <span class="cg-tel">${S.phone.number}</span>
            <span class="cg-note">${S.phone.note}</span>
            ${S.web ? `<span class="cg-web">${S.web.label} · ${S.web.text}</span>` : ''}
          </div>
        </div>
        <div class="cg-lead"><b>${S.lead}</b><span>${S.leadSub}</span></div>
        <div class="cg-sub">${S.productPhone.label} ${S.productPhone.number} · ${S.productPhone.note}</div>
      </div>` : '';

    const homeHtml = meta.hasHomeCareService ? `
      <div class="cg-home">
        <div class="cg-hh"><b>${S.homeCare.title}</b><span class="cg-tag">부가서비스</span></div>
        <p>${S.homeCare.line}</p>
        <div class="cg-chips">${S.homeCare.chips.map(c => `<span>${c}</span>`).join('')}</div>
        <p class="cg-hp">가정케어 신청 ${S.homeCare.phone.number} · ${S.homeCare.phone.note}</p>
      </div>` : '';

    host.innerHTML = `
      ${covHtml}
      <h3 class="sf-h3" style="--sf-sec:#0B8A7A">입원하면 이렇게 받아요<span class="hint">가입한 담보 기준</span></h3>
      <div class="cg-cards">${cardHtml}</div>
      ${applyHtml}
      ${p.hasSupport && !p.mz ? `<h3 class="sf-h3" style="--sf-sec:#0B8A7A">삼성화재 간병인지원은 이렇게 달라요</h3>
        ${caregiverStrengthsHtml({ hasWaiver: !!meta.hasWaiver }, 22)}` : ''}
      <h3 class="sf-h3" style="--sf-sec:#0B8A7A">꼭 알아두세요</h3>
      <ul class="cg-keep">${S.keep.map(k => `<li>${k}</li>`).join('')}</ul>
      ${homeHtml}
      <p class="cg-disc">${S.disclaimer}</p>`;
    return true;
}

// ── PDF 지면 ──
const CG_COLOR = { c: '#0B8A7A', s: '#E7F5F2' };

function caregiverSheetCss() {
    const C = SHEET_COLOR;
    return `
    .cg-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${mm(2.6)}}
    .cg-card{border:1px solid ${C.rule};border-radius:${mm(3.2)};padding:${mm(2.4)} ${mm(3.2)};background:#fff}
    .cg-ct{display:flex;align-items:center;gap:${mm(2)};color:${C.ink2}}
    .cg-ico{color:${CG_COLOR.c};display:flex}
    .cg-ti{font-size:${px(7.6)};font-weight:700;white-space:nowrap}
    .cg-who{margin-left:auto;font-size:${px(6.5)};font-weight:700;color:${CG_COLOR.c};
      background:${CG_COLOR.s};border-radius:999px;padding:0 ${mm(1.8)};height:${mm(4)};line-height:${mm(4)}}
    .cg-head{font-size:${px(10)};font-weight:800;letter-spacing:-.03em;margin-top:${mm(1.2)};color:${C.ink}}
    .cg-head.num{font-family:'Plus Jakarta Sans','Noto Sans KR',sans-serif;color:${CG_COLOR.c}}
    .cg-meta{font-size:${px(6.5)};color:${C.muted};margin-top:${mm(0.8)};line-height:1.45}
    .cg-cost{color:${C.ink2};font-weight:700}
    .cg-q{font-style:normal;color:${C.blue}}
    .cg-foot{font-size:${px(6.6)};color:${C.ink2};margin-top:${mm(1.3)};padding-top:${mm(1.3)};
      border-top:1px dotted ${C.rule}}
    .cg-apply{border-radius:${mm(4)};background:${CG_COLOR.s};padding:${mm(3.4)} ${mm(4.5)}}
    .cg-flow{display:flex;align-items:flex-start;gap:${mm(1.5)}}
    .cg-step{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:${mm(0.8)}}
    .cg-sico{width:${mm(10)};height:${mm(10)};border-radius:50%;background:#fff;color:${CG_COLOR.c};
      display:flex;align-items:center;justify-content:center}
    .cg-step b{font-size:${px(7.5)};font-weight:700}
    .cg-step em{font-style:normal;font-size:${px(6.5)};color:${C.muted}}
    .cg-arw{color:${CG_COLOR.c};font-size:${px(12)};margin-top:${mm(2.5)}}
    .cg-call{display:flex;align-items:center;gap:${mm(5)};margin-top:${mm(3)};padding-top:${mm(3)};
      border-top:1px solid rgba(11,138,122,.2)}
    .cg-qr{width:${mm(21)};height:${mm(21)};background:#fff;border-radius:${mm(2)};padding:${mm(1)}}
    .cg-num{display:flex;flex-direction:column;gap:${mm(0.8)}}
    .cg-lbl{font-size:${px(7.5)};font-weight:700;color:${C.ink2}}
    .cg-tel{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(22)};font-weight:800;
      letter-spacing:-.02em;color:${CG_COLOR.c};line-height:1.1}
    .cg-note{font-size:${px(7)};color:${C.ink2}}
    .cg-web{font-size:${px(7.5)};font-weight:700;color:${C.ink}}
    .cg-lead{margin-top:${mm(2.4)};background:#fff;border-radius:${mm(2.6)};padding:${mm(2)} ${mm(3.4)};
      display:flex;align-items:baseline;gap:${mm(2.4)};flex-wrap:wrap}
    .cg-lead b{font-size:${px(8)};font-weight:800}
    .cg-lead span{font-size:${px(6.8)};color:${C.muted}}
    .cg-sub{margin-top:${mm(1.6)};font-size:${px(6.8)};color:${C.muted}}
    .cg-a2{display:grid;grid-template-columns:1.3fr 1fr;gap:${mm(5)};align-items:center}
    .cg-a2 .cg-call{margin-top:0;padding-top:0;border-top:0}
    .cg-steps2{list-style:none;display:flex;flex-direction:column;gap:${mm(1.6)};
      padding-left:${mm(4)};border-left:1px solid rgba(11,138,122,.25)}
    .cg-steps2 li{display:flex;align-items:baseline;gap:${mm(1.8)}}
    .cg-steps2 .n{flex:none;width:${mm(4.6)};height:${mm(4.6)};line-height:${mm(4.6)};border-radius:50%;
      background:${CG_COLOR.c};color:#fff;font-size:${px(6.5)};font-weight:800;text-align:center}
    .cg-steps2 b{font-size:${px(7.6)};font-weight:700;white-space:nowrap}
    .cg-steps2 em{font-style:normal;font-size:${px(6.4)};color:${C.muted};white-space:nowrap}
    .cg-pros{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${mm(1.6)} ${mm(3)}}
    .cg-pro{display:flex;align-items:flex-start;gap:${mm(1.8)}}
    .cg-pico{flex:none;width:${mm(6.6)};height:${mm(6.6)};border-radius:50%;background:${CG_COLOR.s};
      color:${CG_COLOR.c};display:flex;align-items:center;justify-content:center}
    .cg-ptx{display:flex;flex-direction:column;gap:${mm(0.4)};min-width:0}
    .cg-ptx b{font-size:${px(7.6)};font-weight:800;color:${C.ink};letter-spacing:-.02em}
    .cg-ptx b sup{font-size:${px(5.5)};color:${C.muted};margin-left:1px}
    .cg-ptx span{font-size:${px(6.4)};color:${C.muted};line-height:1.4}
    .cg-pnote{font-size:${px(6.2)};color:${C.muted};margin-top:${mm(1.2)}}
    .cg-keep{list-style:none;display:flex;flex-direction:column;gap:${mm(1.2)}}
    .cg-keep li{font-size:${px(7.8)};color:${C.ink2};line-height:1.55;padding-left:${mm(4)};position:relative}
    .cg-keep li::before{content:"";position:absolute;left:${mm(0.6)};top:${mm(1.6)};width:${mm(1.4)};
      height:${mm(1.4)};border-radius:50%;background:${CG_COLOR.c}}
    .cg-home{border:1px dashed ${C.rule};border-radius:${mm(3.6)};padding:${mm(3)} ${mm(4)};background:${C.wash}}
    .cg-hh{display:flex;align-items:center;gap:${mm(2)}}
    .cg-hh b{font-size:${px(8.5)};font-weight:700}
    .cg-tag{margin-left:auto;font-size:${px(6.5)};font-weight:700;color:${C.muted};
      border:1px solid ${C.rule};border-radius:999px;padding:0 ${mm(1.8)};height:${mm(4)};line-height:${mm(4)}}
    .cg-home p{font-size:${px(7.2)};color:${C.ink2};margin-top:${mm(1.2)}}
    .cg-chips{display:flex;gap:${mm(1.4)};margin-top:${mm(1.4)}}
    .cg-chips span{font-size:${px(6.8)};background:#fff;border:1px solid ${C.rule};border-radius:999px;
      padding:0 ${mm(2)};height:${mm(4.6)};line-height:${mm(4.6)}}
    .cg-disc{font-size:${px(6.5)};color:${C.muted};line-height:1.6}`;
}

function sheetCaregiver(d) {
    const p = d.caregiver;
    const S = cgService();
    const cards = caregiverCards(p);
    const cov = caregiverCovList(p).map(x => ({ nm: x.nm, v: 1, label: x.label }));
    const covHtml = `<div class="cov">
      <div class="cov-hd"><span class="t">가입한 담보 쉽게보기</span><span class="n">간병 ${cov.length}개</span></div>
      <ul>${cov.map(x => `<li><span>${sClip(x.nm, 24)}</span><b>${x.label}</b></li>`).join('')}</ul></div>`;
    return sheetHead(d.who) + sheetTop(sheetBrandName(), '간병인 지원', 'Caregiver') + covHtml +
      `<div class="body" style="gap:${mm(4.2)}">
         <div><h3>입원하면 이렇게 받아요<span class="hint">가입한 담보 기준</span></h3>
           <div class="cg-cards">${cards.map(c => `
             <div class="cg-card">
               <div class="cg-ct"><span class="cg-ico">${cgIcon(c.ico, 20)}</span><span class="cg-ti">${c.title}</span>
                 ${c.who ? `<span class="cg-who">${c.who}</span>` : ''}</div>
               <div class="cg-head${c.big ? ' num' : ''}">${c.head}</div>
               <div class="cg-meta">${c.meta}${c.cost ? ` · <span class="cg-cost">${c.cost}</span>` : ''}</div>
               ${c.foot ? `<div class="cg-foot">${c.foot}</div>` : ''}
             </div>`).join('')}</div></div>
         ${p.hasSupport ? `<div><h3>간병인 신청은 이렇게<span class="hint">${S.partner}</span></h3>
           <div class="cg-apply">
             <!-- 지면에서는 번호·QR(왼쪽)과 4단계(오른쪽)를 나란히 — 세로로 쌓으면 한 장을 넘는다 -->
             <div class="cg-a2">
               <div class="cg-call">
                 ${S.web ? `<img class="cg-qr" src="${CAREGIVER_QR}" alt="">` : ''}
                 <div class="cg-num">
                   <span class="cg-lbl">${S.phone.label}</span>
                   <span class="cg-tel">${S.phone.number}</span>
                   <span class="cg-note">${S.phone.note}</span>
                   ${S.web ? `<span class="cg-web">${S.web.label} · ${S.web.text}</span>` : ''}
                   <span class="cg-note">${S.productPhone.label} ${S.productPhone.number}</span>
                 </div>
               </div>
               <ol class="cg-steps2">${S.steps.map((s, i) =>
                 `<li><span class="n">${i + 1}</span><b>${s.t}</b>${s.s ? `<em>${s.s}</em>` : ''}</li>`).join('')}</ol>
             </div>
             <div class="cg-lead"><b>${S.lead}</b><span>${S.leadSub}</span></div>
           </div></div>` : ''}
         ${p.hasSupport && !p.mz ? `<div><h3>삼성화재 간병인지원은 이렇게 달라요</h3>
           ${caregiverStrengthsHtml({ hasWaiver: d.hasWaiver }, 18)}</div>` : ''}
         <div><h3>꼭 알아두세요</h3>
           <ul class="cg-keep">${S.keep.map(k => `<li>${k}</li>`).join('')}</ul></div>
         ${d.hasHomeCare ? `<div class="cg-home">
           <div class="cg-hh"><b>${S.homeCare.title}</b><span class="cg-tag">부가서비스</span></div>
           <p>${S.homeCare.line}</p>
           <div class="cg-chips">${S.homeCare.chips.map(c => `<span>${c}</span>`).join('')}</div>
           <p>가정케어 신청 ${S.homeCare.phone.number} · ${S.homeCare.phone.note}</p></div>` : ''}
         <p class="cg-disc">${S.disclaimer}</p>
       </div>` +
      sheetFoot(p.mz ? '메리츠화재 가입제안서 · 간병인지원 특약에 관한 사항 기준'
                     : '삼성화재 가입제안서 · 간병인지원 이용 안내 기준', 0, 0);
}
