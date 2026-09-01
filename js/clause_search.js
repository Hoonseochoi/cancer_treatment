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

// 사람들이 쓰는 말과 약관 용어가 갈리는 자리를 잇는다.
// 약관 표에 대응이 실린 것(키트루다↔펨브롤리주맙)은 별칭으로 자동으로 이어지므로,
// 여기에는 표로는 이을 수 없는 것만 적는다.
// 값은 약관에 실제로 적힌 말이어야 한다 — 짐작으로 넣으면 엉뚱한 담보를 물어 온다.
const CL_SYNONYM = {
    // 담보 이름을 이루는 말들. 뜻을 바꾸려는 게 아니라, 붙여 쓴 문장에서 꺼내
    // 쓰려고 올려 둔다("암통합치료비의면책…" 한 덩어리에서 '통합치료비'를 집어낸다).
    '통합치료비': ['통합치료비'],
    '순환계': ['특정순환계질환', '순환계'],
    '특정치료비': ['특정치료비'],
    '진단비': ['진단비'],
    '수술비': ['수술비'],
    '치료비': ['치료비'],
    '입원일당': ['입원일당'],
    '통원일당': ['통원일당'],
    '간병인': ['간병인'],
    '지원금': ['지원금'],
    '검사비': ['검사비'],
    '회복지원금': ['회복지원금'],
    '입원지원금': ['입원지원금'],

    '하지정맥류': ['정맥류'],
    '정맥류': ['정맥류'],
    '스텐트': ['스텐트'],
    '백내장': ['수정체', '백내장'],
    '대장용종': ['결장경', '폴립'],
    '용종': ['폴립'],
    '디스크': ['추간판'],
    '허리디스크': ['추간판'],
    '목디스크': ['추간판', '경추'],
    '맹장': ['충수'],
    '맹장염': ['충수'],
    '담석': ['담낭'],
    '치질': ['치핵'],
    '축농증': ['부비동'],
    '오십견': ['회전근개', '견부'],
    '중이염': ['고실', '유양돌기'],
    '비염': ['비중격', '비갑개'],
    '자궁근종': ['평활근종', '자궁'],
    '근종': ['평활근종'],
    '물혹': ['낭종'],
    '탈장': ['탈장'],
    '제왕절개': ['제왕절개분만'],
    '심근경색': ['심근경색', '관상동맥'],
    '뇌경색': ['뇌경색', '뇌혈관'],
    '뇌출혈': ['두개내', '출혈'],
    '치매': ['치매', '인지'],
    '전립선비대': ['전립선'],
    '갑상선결절': ['갑상선'],
    '유방암': ['유방'],
    '위암': ['위'],
    '대장암': ['결장', '직장'],
    '폐암': ['폐'],
    '간암': ['간'],
    '췌장암': ['췌장'],
    '자궁경부암': ['자궁경부'],
    '난소암': ['난소'],
    '전립선암': ['전립선'],
    '갑상선암': ['갑상선'],
    '신장암': ['신장', '신'],
    '방광암': ['방광'],
    '식도암': ['식도'],
    '담도암': ['담관', '담낭'],
    '혈액암': ['백혈병', '림프종'],
    '뇌종양': ['두개내', '뇌']
};

const CL_STOP = new Set(('그리고 어떤 어떤게 있어 있나요 알려줘 뭐야 무엇 뭔가 받을 수 있는 하면 ' +
    '했을 경우 담보 담보들 해당 관련 얼마 나와 나오나요 인가요 있습니까 뭐가 어떻게 ' +
    '무슨 언제 어디 얼마나 대해 대한 관해').split(' '));

// 사람은 "암통합치료비"라 붙여 쓰고 약관은 "암 통합치료비"라 띄어 쓴다.
// 글자만 보면 서로 다른 말이 되어 버려, 실재하는 담보(26-1-66 등 8개)를 통째로
// 놓쳤다. 견줄 때는 양쪽에서 공백을 턴다.
const clTight = s => (s || '').replace(/[\s·]/g, '');

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

// 검색어가 상대 이름에 얼마나 담겼는가. 담보명을 견줄 때는 이쪽이 맞다.
// Dice는 두 이름의 길이를 함께 나누므로 짧은 이름이 유리해진다 — 실측:
// "순환계통합치료비"를 물었는데 "상해 통합치료비"(짧음)가 "특정순환계질환
// 통합치료비"(정답, 김)보다 높은 점수를 받았다. 담보명은 길고 수식어가 많아
// 검색어가 그 안에 얼마나 들어 있는지로 재야 한다.
function clHas(a, b) {
    if (!a.size || !b.size) return 0;
    let n = 0;
    a.forEach(g => { if (b.has(g)) n++; });
    return n / a.size;
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
// 낱말 하나를 여러 형태로 펼치되, 원래 낱말과 파생형에 다른 무게를 준다.
// 동의어를 같은 무게로 두면 원래 말이 밀린다 — 실측: '백내장'에 '수정체'를
// 같은 무게로 얹었더니 "후발성 백내장 수술"(정답)보다 "전안부 관통상 수술
// (수정체 수술 동반)"이 위로 올라왔다. 사람이 쓴 말이 언제나 먼저다.
function clVariants(k) {
    const out = new Map([[k, 1]]);
    const add = (x, w) => { if (x && !out.has(x)) out.set(x, w); };
    (CL_SYNONYM[k] || []).forEach(x => add(x, 0.82));
    ['수술', '시술', '술'].forEach(suf => {
        if (k.endsWith(suf) && k.length > suf.length + 1) add(k.slice(0, -suf.length), 0.95);
    });
    // 별표는 부위로 등재돼 있다 — '유방암'은 없고 '유방재건술·유방절제술'만 있다.
    if (k.length >= 3 && k.endsWith('암')) add(k.slice(0, -1), 0.9);
    return out;
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

    const forms = new Map();
    const put = (form, w) => {
        if (!forms.has(form) || forms.get(form) < w) forms.set(form, w);
    };
    kws.forEach(k => clVariants(k).forEach((w, form) => put(form, w)));

    // 띄어쓰기 없이 몰아 쓴 입력을 건진다.
    // "하지정맥류수술하면받을수있는"은 어절 하나라 사전에 그대로 걸리지 않는다.
    // 실측: 띄어 쓴 "하지정맥류 수술"은 F252(1종)를 찾는데, 붙여 쓰면 못 찾았다.
    // 아는 낱말이 어절 안에 박혀 있으면 꺼내 쓴다 — 세 글자 이상만 본다.
    // ('위'·'간' 같은 한두 글자를 넣으면 아무 데나 걸린다)
    // 손으로 적은 동의어 + 담보명에서 자동으로 모은 낱말.
    // 뒤엣것이 있어야 담보가 늘어도 목록을 따라 고치지 않는다.
    const KNOWN = [...Object.keys(CL_SYNONYM), ...(IDX.words || [])]
        .filter(k => k.length >= 3);
    kws.forEach(k => {
        if (k.length < 4) return;
        KNOWN.forEach(known => {
            if (k.includes(known)) clVariants(known).forEach((w, form) => put(form, w * 0.95));
        });
        // 담보 이름 앞에 붙는 한 글자 구분(암·뇌·간…)도 살린다.
        // "암통합치료비"에서 '통합치료비'만 꺼내면 상해 통합치료비와 구분이 안 된다.
        CL_ONE.forEach(one => { if (k.includes(one)) put(one, 0.9); });
    });
    // 흔한 낱말만 부분일치를 막는다. 길이로 자르면 '유방암 → 유방'처럼 어간이
    // 두 글자로 줄어든 경우를 통째로 놓친다('유방'은 별표에 19건뿐이라 안전하고,
    // '수술'은 수백 건이라 빈도로 자동 배제된다).
    const kb = [...forms].map(([k, w]) => [k, clBigrams(k),
        k.length >= 2 && clDocFreq(IDX, k) <= COMMON, w]);

    // ── B. 별표 매칭 ──
    const hitTerms = [], tableScore = {};
    IDX.terms.forEach(t => {
        // 별칭도 같이 본다. 약관은 '펨브롤리주맙'이라 적지만 사람들은 '키트루다'라
        // 부르고, 그 대응이 약관 표 안에 이미 들어 있다.
        const names = t.a ? [t.t, ...t.a] : [t.t];
        let s = 0;
        names.forEach(nm => {
            const tb = clBigrams(nm);
            const nmT = clTight(nm);
            kb.forEach(([k, b, exact, w]) => {
                const kT = clTight(k);
                if (exact && (nmT.includes(kT) || kT.includes(nmT))) s = Math.max(s, w);
                else s = Math.max(s, clDice(b, tb) * w);
            });
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
        const ctT = clTight(c.t);
        let s = 0;
        const matched = [];
        kb.forEach(([k, b, exact, w]) => {
            // 한 글자 핵심어는 바이그램이 성립하지 않아 유사도가 늘 0에 가깝다.
            // 담보명에 대해서는 빈도와 무관하게 부분일치를 허용해야 '암 진단비'가 잡힌다.
            let hit = 0;
            if ((exact || CL_ONE.has(k)) && ctT.includes(clTight(k))) hit = 0.85 * w;
            // Dice와 담김비율을 함께 본다. Dice만 쓰면 짧은 담보명이 유리해
            // "순환계통합치료비"에 "상해 통합치료비"가 먼저 오고, 담김비율만 쓰면
            // 한두 글자짜리 낱말이 아무 이름에나 100%로 담겨 엉뚱한 담보가 올라온다.
            // 담김비율은 검색어가 충분히 길 때만(바이그램 4개 이상) 쓴다.
            hit = Math.max(hit, clDice(b, tb) * w);
            if (b.size >= 4) hit = Math.max(hit, clHas(b, tb) * 0.88 * w);
            if (hit >= 0.4) matched.push(k.length);
            s = Math.max(s, hit);
        });
        // 낱말이 여럿 맞으면 더 올리되, 긴 낱말에 더 무게를 준다.
        // 개수만 세면 '통합치료비'가 맞은 담보와 '치료비'만 맞은 담보가 같아진다 —
        // 실측: "순환계통합치료비"에 순환계 담보 일곱 개가 모두 만점을 받아, 정작
        // 지목한 통합치료비(28-1-53·55)가 다른 것들 사이에 묻혔다.
        // 상한을 두지 않는다. 1을 넘어도 정렬에만 쓰인다.
        if (matched.length > 1) {
            const top = Math.max(...matched);
            const rest = matched.reduce((a, n) => a + n, 0) - top;
            s += Math.max(0, rest - 2) * 0.03;
        }
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
    // '수술'이라는 말이 없어도 수술을 묻는 경우가 많다. 실측: "스텐트삽입술을
    // 심장에 하면 어떤 담보?"에 '수술'이 없어 기본 수술비군이 붙지 않았고,
    // 힌트가 세 개뿐이라 전용 담보 하나만 답했다. 술기 이름은 대개 '…술'로 끝난다.
    const asksSurgery = cls === '수술비' ||
        /수술|시술|절제|제거|이식|치환|성형|봉합|접합|절개|절단|결찰|생검|색전|삽입/.test(q) ||
        /[가-힣]{2,}술(?![가-힣])/.test(q);
    if (asksSurgery) {
        const have = new Set(cards.map(r => r.card.n));
        // 상해 수술비는 사고로 다친 경우다. 병명을 말한 물음에 얹으면
        // "상해로 인한 하지정맥류 수술 시 적용됩니다" 같은 억지 답이 나온다(실측).
        // 다친 것을 가리키는 말이 있을 때만 상해군을 얹는다.
        const hurt = scope === CL_SCOPE[1] ||
            /사고|다[치친쳐쳤]|골절|낙상|외상|화상|교통|넘어져|부딪/.test(q);
        const want = hurt ? [...CL_SURG_BASE.상해, ...CL_SURG_BASE.질병]
            : CL_SURG_BASE.질병;

        // 다쳤다는 말이 없으면 상해 담보는 후보에서 뺀다. 기본군으로 얹지 않아도
        // '상해 1~8종 수술비'가 '수술비'라는 낱말에 걸려 점수로 올라온다.
        if (!hurt) cards = cards.filter(r => !/^1-/.test(r.card.n));
        const byNo = {};
        IDX.cards.forEach(c => { if (c.k === 'c') byNo[c.n] = c; });
        want.forEach(no => {
            if (have.has(no) || !byNo[no]) return;
            cards.push({ card: byNo[no], score: 0.35, via: ['수술비 공통'], base: true });
        });
        // 기본군 여섯 개가 통째로 들어가므로 자리를 넉넉히 둔다. 여덟 개로 자르면
        // 이름이 스친 담보(2-61 '2대 주요기관…', 3-1 '중증질환…')가 앞자리를 먹고
        // 정작 1~5종·1~8종이 밀린다 — 실측: 스텐트 질문에서 2-112가 빠져
        // "2-123에서만 보장됩니다"라고 단정했다. 실제로는 1~5종 3종으로도 받는다.
        cards = cards.slice(0, Math.max(limit, 12));
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
