// ── 약관 검색 (슈린슈 AI) ──
// LLM에 넘길 근거를 고르는 단계. 여기서는 모델을 쓰지 않는다 — 검색까지 맡기면
// 호출이 두 배가 되고, 무엇을 근거로 골랐는지도 흐려진다.
//
// 약관은 "특약 본문 → 별표 참조 → 코드·등급"의 2홉 구조다. 그래서 경로가 둘이다.
//   A. 본문 직격  질문 낱말이 담보명에 그대로 있는 경우
//   B. 별표 2홉   질문 낱말이 별표의 시술·질환명에 있고, 그 별표를 참조하는 특약을 끌어온다
// "혈전제거술 → 수술비"는 B로만 닿는다. 수술비 특약 본문에는 '혈전제거'라는 말이
// 한 번도 나오지 않기 때문이다(실측: 혈전제거 언급 특약 25개 중 담보분류=수술비 0개).
// 정답은 별표16의 B027(경피적 뇌혈관 수술, 혈전제거)이 6종이고, 그 별표를 참조하는
// 특약이 1~8종 수술비라는 경로에 있다.

// 질문에 담보 종류가 드러나면 그쪽으로 좁힌다("수술비 담보 뭐 있어?" → 수술비)
const CL_CLS_HINT = [
    ['수술비', ['수술비', '수술 비']],
    ['치료비', ['치료비']],
    ['진단비', ['진단비', '진단금']],
    ['입원일당', ['입원일당', '입원 일당']],
    ['통원일당', ['통원일당']],
    ['간병인사용일당', ['간병인']],
    ['검사비', ['검사비']],
    ['지원금', ['지원금']]
];

// "면책 알려줘"의 '면책'은 담보 이름이 아니라 어느 대목을 읽을지를 가리킨다.
// 검색어로 남겨 두면 담보명의 '(1년감액)'과 맞아떨어져, 진단비를 물었는데
// 수술비 특약이 올라오는 일이 벌어진다(실측). 그래서 의도로 떼어 낸다.
const CL_SEC_HINT = [
    // 면책·감액에 보상범위를 함께 넣는 이유: 볼트의 '면책·감액 핵심'은 자동 추출이라
    // 빠지는 게 있다. 실측 — 암 진단비(2-10)의 90일 보장개시일 규정은 그 섹션에 없고
    // '보상범위(지급사유·세부규정)' 제1조 ②항에 있다. 면책만 읽으면 정작 면책기간을
    // 못 찾는다.
    ['면책', ['면책', '보상하지 않', '안 나오는', '지급하지 않'],
        ['면책·감액 핵심 (자동 추출)', '보상하지 않는 범위', '보상범위 (지급사유·세부규정)']],
    ['감액', ['감액', '깎이', '삭감'],
        ['면책·감액 핵심 (자동 추출)', '보상범위 (지급사유·세부규정)']],
    ['지급', ['지급사유', '언제 나오', '보장범위', '보상범위', '얼마'],
        ['보상범위 (지급사유·세부규정)']],
    ['정의', ['정의', '무슨 뜻', '뭐야', '무엇'],
        ['담보정의']],
    ['한도', ['한도', '소멸', '몇 번', '횟수'],
        ['소멸·한도 등']],
    ['분류표', ['분류표', '코드', '몇종', '몇 종'],
        ['관련 분류표']]
];

// 상해 특약과 질병 특약은 번호대가 다르다(1-…/2-…). 질문에 드러나면 그쪽만 본다.
const CL_SCOPE = [['질병', /^2-/], ['상해', /^1-/]];

const CL_STOP = new Set(('그리고 어떤 어떤게 있어 있나요 알려줘 뭐야 무엇 뭔가 받을 수 있는 하면 ' +
    '했을 경우 담보 담보들 해당 관련 얼마 나와 나오나요 인가요 있습니까 뭐가 어떻게 ' +
    '무슨 언제 어디 얼마나 대해 대한 관해').split(' '));

function clBigrams(s) {
    const t = (s || '').replace(/[\s()·,\-\[\]/]/g, '');
    const out = new Set();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    if (!out.size && t) out.add(t);
    return out;
}

function clDice(a, b) {
    if (!a.size || !b.size) return 0;
    let n = 0;
    a.forEach(g => { if (b.has(g)) n++; });
    return (2 * n) / (a.size + b.size);
}

// 조사·군더더기를 떼고 명사 덩어리만 남긴다(형태소 분석기 없이).
// drop에는 담보 종류를 나타내는 말이 들어온다 — 이미 분류 필터로 반영했는데
// 검색어로도 남겨 두면 이름에 '수술비'가 든 특약이 전부 만점을 받아 상위를 독식한다.
// 담보명에 실제로 쓰이는 한 글자 말. '암 진단비'의 '암'을 길이로 잘라 버리면
// 정작 핵심어가 사라진다.
const CL_ONE = new Set(['암', '뇌', '폐', '간', '위', '눈', '뼈', '귀', '코']);

function clKeywords(q, drop) {
    return q.replace(/[?!.,]/g, ' ').split(/\s+/).map(w => w
        .replace(/(을|를|이|가|은|는|도|만|에|의|로|으로|와|과|들|에서|한테|까지|부터)$/, '')
        .replace(/(했을|하면|받으면|받을|나오는|되는)$/, ''))
        .filter(w => (w.length >= 2 || CL_ONE.has(w))
            && !CL_STOP.has(w) && !(drop && drop.has(w)));
}

// 약관은 '혈전제거술'을 '경피적 뇌혈관 수술(혈전제거의 경우)'처럼 풀어 쓴다.
// 끝의 술/수술/시술을 떼어 낸 어간까지 넣어야 이런 표기에 닿는다.
function clVariants(k) {
    const v = new Set([k]);
    ['수술', '시술', '술'].forEach(suf => {
        if (k.endsWith(suf) && k.length > suf.length + 1) v.add(k.slice(0, -suf.length));
    });
    // 별표는 부위로 등재돼 있다 — '유방암'은 없고 '유방재건술·유방절제술'만 있다.
    if (k.length >= 3 && k.endsWith('암')) v.add(k.slice(0, -1));
    return v;
}

// 흔한 낱말은 부분일치를 막는다.
// '백내장 수술'의 '수술'이 별표의 "두개내 혈관 수술"에도 들어 있어 부분일치로 만점을
// 받으면, 정작 백내장은 밀려나고 뇌수술이 1위가 된다(실측). 낱말이 별표 항목 몇 개에
// 걸리는지 세어, 너무 흔하면 부분일치를 끄고 유사도만 쓴다 — 불용어 목록을 손으로
// 관리하는 것보다 약관 어휘 변화에 잘 견딘다.
let _clDf = null;
function clDocFreq(IDX, form) {
    if (!_clDf) _clDf = new Map();
    if (_clDf.has(form)) return _clDf.get(form);
    let n = 0;
    for (const t of IDX.terms) if (t.t.includes(form)) n++;
    _clDf.set(form, n);
    return n;
}

// 어떤 수술이든 함께 검토되는 담보들.
// 수술비는 하나만 나오는 게 아니라 질병수술비 · 1~5종 · 1~8종 · N대질병이 겹쳐 지급된다.
// 그런데 검색은 질병명이 걸린 담보 하나만 집어내기 쉽다 — 실측: "하지정맥류 수술비"에
// I83이 62대생활질병 분류표에 걸려 111대질병 수술비(2-124) 하나만 나왔고, 정작
// 1~8종(정맥류 절제술)과 질병 입원·통원 수술비가 빠졌다.
// 수술 이야기가 나오면 이 기본군을 후보에 얹어, 모델이 빠뜨리지 않게 한다.
const CL_SURG_BASE = {
    질병: ['2-101', '2-104', '2-107', '2-108', '2-109', '2-112'],
    상해: ['1-24', '1-26', '1-27', '1-28', '1-29']
};

function clauseSearch(q, limit) {
    limit = limit || 8;
    const IDX = CLAUSE_INDEX;
    const cardById = {};
    IDX.cards.forEach(c => { cardById[c.i] = c; });
    const COMMON = Math.max(12, IDX.terms.length * 0.02);   // 2% 넘게 걸리면 흔한 말

    const hint = CL_CLS_HINT.find(([, pats]) => pats.some(p => q.includes(p)));
    const cls = hint ? hint[0] : null;

    const secHits = CL_SEC_HINT.filter(([, pats]) => pats.some(p => q.includes(p)));
    const wantSecs = [...new Set(secHits.flatMap(h => h[2]))];
    const scope = CL_SCOPE.find(([w]) => q.includes(w));

    // 분류·섹션·범위를 가리킨 말은 검색어에서 뺀다 — 이미 필터로 반영했다
    const drop = new Set([
        ...(hint ? hint[1] : []),
        ...secHits.flatMap(h => h[1]),
        ...secHits.map(h => h[0]),
        ...(scope ? [scope[0]] : [])
    ]);
    const kws = clKeywords(q, drop);

    const forms = [...new Set(kws.flatMap(k => [...clVariants(k)]))];
    // 흔한 낱말만 부분일치를 막는다. 길이로 자르면 '유방암 → 유방'처럼 어간이
    // 두 글자로 줄어든 경우를 통째로 놓친다('유방'은 별표에 19건뿐이라 안전하고,
    // '수술'은 수백 건이라 빈도로 자동 배제된다).
    const kb = forms.map(k => [k, clBigrams(k),
        k.length >= 2 && clDocFreq(IDX, k) <= COMMON]);

    // ── B. 별표 매칭 ──
    const hitTerms = [], tableScore = {};
    IDX.terms.forEach(t => {
        const tb = clBigrams(t.t);
        let s = 0;
        kb.forEach(([k, b, exact]) => {
            if (exact && (t.t.includes(k) || k.includes(t.t))) s = 1;
            else s = Math.max(s, clDice(b, tb));
        });
        if (s >= 0.62) {
            hitTerms.push({ s, t });
            tableScore[t.b] = Math.max(tableScore[t.b] || 0, s);
        }
    });
    hitTerms.sort((a, b) => b.s - a.s);

    // ── 그 별표를 참조하는 특약으로 한 홉 더 ──
    const cand = {};
    const bump = (id, sc, via) => {
        if (!cardById[id]) return;
        const e = cand[id] || (cand[id] = { score: 0, via: new Set() });
        e.score = Math.max(e.score, sc);
        e.via.add(via);
    };
    Object.entries(tableScore).forEach(([tid, ts]) => {
        (IDX.refmap[tid] || []).forEach(cid => {
            bump(cid, ts * 0.9, cardById[tid] ? cardById[tid].t : '분류표');
        });
    });

    // ── A. 담보명 직격 ──
    IDX.cards.forEach(c => {
        if (c.k !== 'c') return;                       // clause만
        const tb = clBigrams(c.t);
        let s = 0;
        kb.forEach(([k, b, exact]) => {
            // 한 글자 핵심어는 바이그램이 성립하지 않아 유사도가 늘 0에 가깝다.
            // 담보명에 대해서는 빈도와 무관하게 부분일치를 허용해야 '암 진단비'가 잡힌다.
            if ((exact || CL_ONE.has(k)) && c.t.includes(k)) s = Math.max(s, 0.85);
            s = Math.max(s, clDice(b, tb));
        });
        if (s >= 0.4) bump(c.i, s, '담보명');
    });

    const pack = (minScore, keepCls) => Object.entries(cand)
        .map(([id, e]) => ({ card: cardById[id], score: +e.score.toFixed(3), via: [...e.via].slice(0, 3) }))
        .filter(r => r.card && r.score >= minScore
            && (!keepCls || !cls || r.card.c === cls)
            && (!scope || scope[1].test(String(r.card.n || ''))))
        .sort((a, b) => b.score - a.score || String(a.card.n).localeCompare(String(b.card.n)))
        .slice(0, limit);

    // 담보 종류 필터가 너무 좁혀 아무것도 안 남는 경우가 있다("유방암 수술 담보 알려줘"처럼
    // 질문에 종류가 없으면 필터가 안 걸리지만, 반대로 걸린 필터가 정답을 다 쳐내기도 한다).
    // 빈손으로 돌려보내느니 필터를 풀어 한 번 더 본다 — 무엇이 완화됐는지는 표시한다.
    let cards = pack(0.4, true), relaxed = false;
    if (!cards.length) { cards = pack(0.3, true); relaxed = !!cards.length; }

    // "질병 수술비의 면책 알려줘"처럼 분류와 범위만으로 지정한 질문은 검색할 낱말이
    // 남지 않는다(분류·범위·의도를 모두 떼어 냈으니 당연하다). 이때는 찾을 게 없는
    // 것이 아니라 조건에 맞는 담보 전체가 답이므로, 필터만으로 목록을 만든다.
    let listed = false;
    if (!cards.length && (cls || scope)) {
        cards = IDX.cards
            .filter(c => c.k === 'c'
                && (!cls || c.c === cls)
                && (!scope || scope[1].test(String(c.n || ''))))
            .map(c => ({ card: c, score: 0, via: ['분류'] }))
            .sort((a, b) => String(a.card.n).localeCompare(String(b.card.n), 'ko', { numeric: true }))
            .slice(0, limit);
        listed = !!cards.length;
    }
    if (!cards.length && cls) { cards = pack(0.3, false); relaxed = !!cards.length; }

    // 수술 질문이면 기본 수술비 담보군을 얹는다(이미 들어 있으면 건너뛴다).
    const asksSurgery = cls === '수술비' ||
        /수술|시술|절제|제거|이식|치환|성형|봉합|접합|절개/.test(q);
    if (asksSurgery) {
        const have = new Set(cards.map(r => r.card.n));
        const want = scope === CL_SCOPE[1] ? CL_SURG_BASE.상해
            : scope === CL_SCOPE[0] ? CL_SURG_BASE.질병
            : [...CL_SURG_BASE.질병, ...CL_SURG_BASE.상해];
        const byNo = {};
        IDX.cards.forEach(c => { if (c.k === 'c') byNo[c.n] = c; });
        want.forEach(no => {
            if (have.has(no) || !byNo[no]) return;
            cards.push({ card: byNo[no], score: 0.35, via: ['수술비 공통'], base: true });
        });
        cards = cards.slice(0, Math.max(limit, 8));
    }

    // 고른 담보에서 실제로 읽을 대목. 의도가 없으면 담보정의·보상범위를 기본으로 둔다.
    const secWanted = wantSecs.length ? wantSecs
        : ['담보정의', '보상범위 (지급사유·세부규정)'];
    // ── 같은 담보의 변형을 하나로 묶는다 ──
    // 2-10 암 진단비 / 2-11 갱신형 / 2-12 10대 주요암 / 2-13 갱신형처럼, 이름만
    // 다르고 본문이 사실상 같은 특약이 줄줄이 있다. 넷을 다 읽히면 같은 조항을 네 번
    // 넘기게 되어 토큰만 먹고 답도 흐려진다. 대표 하나만 남기고 변형은 이름만 달아 둔다.
    const famKey = t => t.replace(/\[[^\]]*\]/g, '')
        .replace(/\((추가가입용|갱신형)\)/g, '')
        .replace(/^[0-9-]+\s*/, '').replace(/\s+/g, '');
    const fam = new Map();
    cards.forEach(r => {
        const k = famKey(r.card.t);
        const cur = fam.get(k);
        if (!cur) fam.set(k, { ...r, variants: [] });
        else cur.variants.push(r.card.n);
    });
    cards = [...fam.values()];

    // 담보 순위대로 돌면서 담보당 몇 개씩만 가져온다. 앞 담보가 섹션을 다 차지해
    // 뒤 담보가 통째로 빠지는 일을 막는다.
    // 무엇을 읽을지 지목하지 않은 질문("어떤 담보가 있어?")은 목록이 답이라
    // 원문을 적게 가져간다.
    const PER_CARD = wantSecs.length ? 2 : 1;
    const MAX_READ = wantSecs.length ? 6 : 4;
    const secOf = {};
    (IDX.secs || []).forEach(x => (secOf[x.c] || (secOf[x.c] = [])).push(x));
    const read = [];
    for (const r of cards) {
        if (read.length >= MAX_READ) break;
        const picked = (secOf[r.card.i] || [])
            .filter(x => secWanted.includes(x.s))
            .sort((a, b) => secWanted.indexOf(a.s) - secWanted.indexOf(b.s))
            .slice(0, PER_CARD);
        picked.forEach(x => {
            if (read.length < MAX_READ)
                read.push({ id: x.i, card: x.c, sec: x.s, title: r.card.t, no: r.card.n });
        });
    }

    return {
        cls, kws, relaxed, listed, scope: scope ? scope[0] : null,
        intent: secHits.map(h => h[0]), read,
        terms: hitTerms.slice(0, 10).map(h => ({
            name: h.t.r || h.t.t, code: h.t.c, tier: h.t.g || '',
            table: cardById[h.t.b] ? cardById[h.t.b].t : '', s: +h.s.toFixed(2)
        })),
        cards
    };
}
