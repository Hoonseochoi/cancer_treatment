// ── 수술비 백과사전 ──
// 질병명·수술명·수가코드로 검색하면 1~8종 분류(ADRG)와 종을 찾아준다.
// 데이터: surgery_dict_data.js (옵시디언 KDRG 위키에서 생성)
//
// 검색이 어려운 이유: 고객이 쓰는 말과 약관 용어가 다르다.
//   "백내장" → 약관은 "수정체", "대장용종" → 약관은 "결장경 … 폴립 절제술"
// 그래서 동의어 사전을 한 겹 두고, 관련율로 순위를 매긴다.
//
// ⚠ 예전엔 검색어를 "임의 위치에서 두 조각으로 자르는" 방식으로 동의어를 자동
// 생성했다. 편해 보이지만 위험했다 — "요추간판탈출증"을 자르면 "탈출증"이라는
// 조각이 나오고, 이게 완전히 무관한 "직장 탈출증 수술"(치질 계열)과 글자가
// 겹쳐 그쪽이 1위로 뜨는 사고가 났다(실측: 44점 vs 정답 40점).
// 그래서 자동 분할을 걷어내고, 위키 원문에서 직접 확인한 동의어만 싣는다.
// 새 동의어를 추가할 땐 KDRG 위키에서 그 글자가 다른 무관한 항목과 겹치지
// 않는지 먼저 확인할 것 — 안전한 동의어의 조건은 "구체적일 것"이다.
// ── 급여가 발생하지 않아 1~8종 대상이 아닌 수술 ──
// 이 특약의 대전제는 약관 제3조② — "요양급여 절차를 거쳐 처치 및 수술료 항목에서
// 급여항목이 발생"해야 한다. 전액 비급여로만 시행되는 수술은 KDRG에 등재되지
// 않아 검색해도 0건이 나오는데, 그러면 사용자는 "자료가 부족한가?" 하고 넘어가게 된다.
// 그래서 대표적인 것들은 이름을 미리 잡아 두고 "없음"이 아니라 "대상이 아님"이라고 말한다.
//   why  : 왜 안 되는지 근거 — 상담에서 그대로 읽을 수 있게 적는다.
//   both : 같은 이름으로 급여 갈래가 실제로 존재하는 경우에만 true.
//
// ⚠ both를 안 켠 항목은 검색 결과를 통째로 숨긴다. 제외된 ADRG의 수가코드가
// 같은 군의 다른(보장되는) ADRG에 그대로 남아 있어서다 — 실측: 주2)로 빠진
// M094(정관 수술)의 코드 R3892~R3896이 M09 군에 남아, "정관수술"을 치면
// 전혀 다른 M091 정계정맥류가 관련율 100%로 1위에 떴다.
const DICT_NONCOVERED = [
    { k: ['하이푸', 'HIFU', '하이푸시술'], n: '하이푸(고강도초음파집속술)',
      why: '자궁근종 하이푸는 전액 비급여로 시행돼 처치·수술료에서 급여항목이 발생하지 않습니다.' },
    { k: ['유로리프트', '전립선결찰', '전립선결찰술'], n: '유로리프트(전립선결찰술)',
      why: '비급여 시술이라 급여항목이 발생하지 않습니다. 같은 전립선비대증이라도 경요도 절제술(TURP)은 급여로 잡힙니다.' },
    { k: ['다초점', '다초점렌즈', '노안수술', '시력교정', '라식', '라섹', '스마일라식'],
      n: '다초점렌즈 · 시력교정술', both: true,
      why: '시력 교정 목적은 「요양급여의 기준에 관한 규칙」 별표2 비급여대상입니다. 다만 백내장 수술 자체는 급여라, 렌즈만 비급여인 경우와는 구분해야 합니다.' },
    { k: ['도수치료', '도수', '체외충격파치료', 'ESWT', '증식치료', '프롤로', '프롤로치료'],
      n: '도수치료 · 증식치료 · 근골격계 체외충격파',
      why: '수술이 아닌 비급여 처치라 1~8종 분류에 없습니다. 같은 체외충격파라도 결석 제거용 쇄석술은 급여로 잡힙니다.' },
    { k: ['줄기세포', '줄기세포주사', '카티스템', 'PRP'], n: '줄기세포 · PRP 주사',
      why: '비급여 주사 치료라 처치 및 수술료 급여항목이 발생하지 않습니다.' },
    { k: ['코성형', '융비술', '쌍꺼풀', '지방흡입', '가슴성형', '보톡스', '필러', '미용성형'],
      n: '미용 목적 성형',
      why: '미용 목적은 별표2 비급여대상이고, 코성형술(D070)은 분류표 주2)에도 제외로 명시돼 있습니다.' },
    { k: ['정관수술', '정관절제', '난관결찰', '불임수술', '피임'], n: '피임 목적 수술',
      why: '피임 목적은 별표2 비급여대상이며, 정관 수술(M094)·난관 결찰술(N122)은 분류표 주2)에도 제외로 명시돼 있습니다.' },
    { k: ['치아교정', '임플란트', '스케일링', '발치', '충치치료'], n: '치과 치료',
      why: '치아우식증·치주질환(K00~K08)은 이 특약의 면책 질병이고, 발치(D300)·치아 보존치료(D502)는 분류표 주2)에도 제외로 명시돼 있습니다.' },
    { k: ['건강검진', '내시경검사', '조직검사', '생검', '침생검', '침흡인'], n: '검사 · 진단 목적',
      why: '검사 및 진단 목적은 별표2 비급여대상입니다. 분류표 주2)도 각종 생검·진단적 시술(관절경검사 I230, 유방 침흡인생검 J500 등)을 제외로 두고 있습니다.' },
    // 목적에 따라 급여/비급여가 갈리는 것들 — 급여 갈래가 실재하므로 결과도 함께 보여준다.
    { k: ['맘모톰', '진공보조유방생검'], n: '맘모톰(진공보조 유방 시술)', both: true,
      why: '<strong>진단 목적</strong>의 진공보조유방생검은 비급여이자 주2) 제외(유방 침흡인생검 J500)라 대상이 아닙니다. 반면 <strong>치료 목적</strong>으로 양성종양을 절제한 경우는 급여 항목(J071, 1종)으로 잡힙니다.' },
    { k: ['고주파절제', '갑상선결절고주파', '고주파열치료'], n: '고주파절제술', both: true,
      why: '갑상선 결절 고주파절제처럼 <strong>비급여로 시행되는 경우</strong>가 많습니다. 척추 고주파열응고술(S4825·S4826)처럼 급여 코드가 있는 갈래와 구분해, 진료비세부내역서에서 급여 발생 여부를 확인하세요.' }
];

// 검색어가 위 목록에 걸리는지 본다. 부분 문자열로 잡아 "하이푸시술", "도수치료받았어요"도 걸린다.
function dictNonCovered(q) {
    const raw = (q || '').replace(/\s+/g, '').toLowerCase();
    if (raw.length < 2) return null;
    return DICT_NONCOVERED.find(x => x.k.some(k => raw.includes(k.toLowerCase()))) || null;
}

const DICT_SYNONYM = {
    '백내장': ['수정체'],
    // 렌즈만 비급여인 경우와 구분해야 해서, 백내장 수술 자체(급여)를 같이 보여준다
    '다초점렌즈': ['수정체'],
    '다초점': ['수정체'],
    '대장용종': ['결장경', '폴립'],
    '위용종': ['위내시경', '폴립'],
    '용종': ['폴립'],
    '디스크': ['추간판'],
    '허리디스크': ['추간판'],
    '목디스크': ['추간판', '경추'],
    '요추간판탈출증': ['추간판'],
    '경추간판탈출증': ['추간판', '경추'],
    '맹장': ['충수'],
    '담석': ['담낭'],
    '치질': ['치핵'],
    '축농증': ['부비동'],
    '오십견': ['회전근개', '견부'],
    '유착성관절낭염': ['회전근개', '견부'],
    '견관절유착낭염': ['회전근개', '견부'],
    '회전근개파열': ['회전근개'],
    '중이염': ['고실', '유양돌기'],
    '알레르기성비염': ['비중격', '비갑개'],
    '비염': ['비중격', '비갑개'],
    '자궁근종': ['자궁', '근종'],
    '갑상선혹': ['갑상선'],
    '갑상선결절': ['갑상선'],
    // '스텐트'→'삽입'은 위험한 동의어였다 — "삽입"은 뇌전증 수술의 "전극삽입술"
    // 등 완전히 무관한 시술에도 등장해, "관상동맥 스텐트"를 검색해도 뇌전증
    // 수술이 1위로 뜨는 사고가 났다. 스텐트는 혈관마다 분류가 갈려(관상동맥·
    // 대동맥·뇌혈관 등) 안전하게 통칭할 방법이 없어 동의어를 두지 않는다.
    // 심근경색·뇌경색처럼 구체적인 부위로 검색하면 아래 항목들이 안전하게 잡는다.
    '제왕절개': ['제왕'],
    '인공관절': ['인공관절', '치환'],
    '무릎관절증': ['슬관절', '반월상'],
    '퇴행성관절염': ['슬관절', '고관절', '인공관절'],
    '무릎': ['슬관절', '반월상'],
    '어깨': ['견관절', '회전근개'],
    '요로결석': ['체외충격파', '요관'],
    '전립선비대증': ['전립선'],
    '전립선비대': ['전립선'],
    '맘모톰': ['유방', '진공'],
    // '정맥류'는 위험한 동의어였다 — 다리 정맥류(하지정맥류) 말고도 식도정맥류
    // (간질환), 정계정맥류(음낭)까지 전부 "-정맥류"로 끝나 완전히 다른 세 부위가
    // 뒤섞였다. 실측: "출혈성 정맥류에 대한 내시경 시술"(식도 쪽)이 다리 정맥류
    // 검색에서 1위로 뜨는 사고가 났다. 다리 정맥류 수술만의 정식 명칭을 쓴다.
    '하지정맥류': ['정맥 결찰', '스트리핑'],
    '심근경색': ['관상동맥'],
    // 자기 자신을 값으로 두는 항목 — "관상동맥 스텐트"처럼 앞에 다른 말이 붙어도
    // "관상동맥"이라는 핵심 단어만 따로 뽑아내는 용도다.
    '관상동맥': ['관상동맥'],
    '뇌경색': ['뇌혈관', '혈전'],
    '뇌출혈': ['두개내', '혈종'],
    // 장기명 + "수술/암수술" 조합 — "정관수술"처럼 그대로도 5자 이상이라
    // 원문 그대로는 명칭에 안 걸린다. 핵심 장기명만 남겨 매칭한다.
    // ⚠ "위암수술"처럼 -수술이 붙은 형태만 키로 넣으면 "위암"만 단독으로 쳤을 때는
    // 안 걸린다(raw.includes(key) 방향이 반대라서). 그래서 병명 단독 형태도
    // 반드시 같이 넣는다 — 상담에서는 "위암 걸리면?"처럼 병명만 말하는 게 보통이다.
    '편도절제술': ['편도'],
    '유방수술': ['유방'],
    '유방암': ['유방'],
    '유방암수술': ['유방'],
    '전립선수술': ['전립선'],
    '전립선암': ['전립선'],
    // '위절제'는 쓰지 않는다 — "광범위절제술"(범위+절제) 안에 우연히 끼어들어
    // 위암과 무관한 골종양 항목이 1위로 뜨는 사고가 났다(실측). 더 긴 정식
    // 명칭을 쓰면 이런 우연한 끼임이 생기지 않는다.
    '위암': ['위전절제', '위아전절제'],
    '위암수술': ['위전절제', '위아전절제'],
    '대장암': ['결장'],
    '대장암수술': ['결장'],
    '직장암': ['결장'],
    '폐암': ['폐 수술'],
    '폐암수술': ['폐 수술'],
    '간암': ['간 절제술'],
    '간암수술': ['간 절제술'],
    '갑상선암': ['갑상선'],
    '갑상선암수술': ['갑상선'],
    '자궁경부암': ['자궁경부'],
    '난소암': ['난소'],
    '신장암': ['신장'],
    '콩팥암': ['신장'],
    '방광암': ['방광'],
    '췌장암': ['췌장절제'],
    '담낭암': ['담낭절제'],
    '담도암': ['담도'],
    '담관암': ['담도'],
    '식도암': ['식도'],
    '후두암': ['후두'],
    '뇌종양': ['뇌종양'],
    '백혈병': ['백혈병'],
    '림프종': ['림프종'],

    // ── 심혈관 응급질환 ──
    // 급성심근경색은 이미 '심근경색' 키가 문자열 포함으로 걸린다("급성심근경색".
    // includes("심근경색")). 협심증은 다른 단어라 별도로 넣는다. 스텐트·카테터는
    // 혈관마다 분류가 갈려 통칭이 위험하므로 동의어를 두지 않는 대신, 부위명과
    // 함께 쓰면("관상동맥 스텐트") '관상동맥' 키가 알아서 잡아낸다.
    '협심증': ['관상동맥'],
    '부정맥': ['부정맥'],
    '심장판막증': ['판막'],
    '판막질환': ['판막'],
    '대동맥류': ['대동맥'],
    '대동맥박리': ['대동맥'],
    // 심부전의 수술적 치료는 매우 제한적이다(심장이식·보조장치는 별도 특수
    // 영역). 여기서는 약관 분류표에 실제로 있는 심박조율기 삽입만 안전하게 잡는다.
    '심부전': ['심박조율기'],
    // '동정맥루'는 쓰지 않는다 — 투석용(신장) 말고 뇌혈관 기형 색전술(뇌)에도
    // 똑같이 쓰이는 말이라 부위가 섞인다. "혈액투석"으로 한정하면 안전하다.
    '신부전': ['혈액투석'],
    '만성콩팥병': ['혈액투석'],

    // ── 뇌혈관질환 ──
    '뇌졸중': ['뇌졸중'],

    // ── 유사도(바이그램)로도 못 잡는 것들 ──
    // 한글 병명과 약관의 한자어 용어가 글자를 하나도 안 공유하면 바이그램
    // 유사도 자체가 성립하지 않는다(예: "손목터널증후군" vs "수근관"은 겹치는
    // 글자가 없다). 이런 건 유사도가 아니라 의학적으로 같은 걸 안다는 지식이
    // 있어야 이어줄 수 있어서, 발견할 때마다 여기에 추가한다.
    '손목터널증후군': ['수근관'],
    '수근관증후군': ['수근관'],
    '척추관협착증': ['척추후궁'],
    '허리협착증': ['척추후궁']
};

// 검색어를 약관 용어까지 넓힌다. ['대장용종'] → ['대장용종','결장경','폴립']
// 동의어 사전에 없는 말은 원문 그대로만 찾는다 — 임의로 잘라 붙이지 않는다.
function dictExpand(q) {
    const raw = q.trim().replace(/\s+/g, ' ');
    const out = [raw];
    Object.keys(DICT_SYNONYM).forEach(k => {
        if (raw.includes(k)) DICT_SYNONYM[k].forEach(s => out.push(s));
    });
    return [...new Set(out)].filter(Boolean);
}

// 관련율 산출.
//  · 별표16의 구분/명칭에 맞으면 가장 높게 — 담보가 실제로 쓰는 이름이라서다.
//  · 시술명 매칭은 그다음. 같은 시술 테이블을 여러 군이 공유하는 경우가 있어
//    이것만으로 순위를 매기면 엉뚱한 군이 1위가 된다(백내장 → 안부 관통상 수술).
function dictScore(terms, code, t, procs) {
    const [gname, name] = t;
    let s = 0, hitProc = [];
    terms.forEach((tk, i) => {
        const w = i === 0 ? 1 : 0.55;          // 원문 검색어에 가중
        if (gname.includes(tk)) s += 60 * w;
        else if (name.includes(tk)) s += 40 * w;
    });
    procs.forEach(p => {
        const hit = terms.some((tk, i) => p[1].includes(tk) || p[0] === tk.toUpperCase());
        if (hit) hitProc.push(p);
    });
    // 시술명 일치는 "곁다리 증거"로만 쓴다 — 절대 등급명 일치를 앞지르면 안 된다.
    // 실측: "위암수술"이 "위전절제"로 매칭돼야 하는데, 시술명 목록에 우연히 섞인
    // "광범위절제술"(뼈종양, 무관)이 이전 배점(최대 40점)으로는 절반 가중 등급명
    // 일치(33점)를 앞질러 버렸다. 최대치를 20점으로 낮춰 이 역전을 원천 차단한다.
    if (hitProc.length) s += 14 + Math.min(6, hitProc.length * 2);
    // 수가코드를 그대로 친 경우
    if (/^[A-Z]{1,2}\d{3,4}$/i.test(terms[0])) {
        const up = terms[0].toUpperCase();
        if (procs.some(p => p[0] === up)) s += 80;
        if (code === up) s += 100;
    }
    return { s, hitProc };
}

// ── 관련도 낮은 결과를 위한 유사도 매칭 ──
// 관련율(%)을 굳이 만든 이유가 "정확히 안 맞아도 관련 있는 걸 보여주기" 위해서인데,
// 지금까지는 정답이 하나도 안 걸리면 그냥 빈 화면이었다. "탈출증" 같은 우연한
// 글자 겹침 사고를 겪고 나서 임의 위치 분할(blind splitting)은 걷어냈지만,
// 그 자리를 메울 안전한 대체재가 없었다.
// 2글자 슬라이딩 윈도우(바이그램) 자카드 계수는 이 둘의 장점만 취한다 —
// 부분 글자가 겹치면 관련도가 오르되(재현율), 겹치는 비율이 낮으면 점수도
// 낮게 나온다(정밀도). "요추간판탈출증"과 "직장 탈출증 수술"은 "탈출증" 2글자만
// 겹쳐 비율이 낮고, 진짜 정답 "추간판제거술"과는 "추간"·"간판"이 겹쳐 비율이
// 훨씬 높다 — 즉 이 사고 케이스에서도 정답이 자연히 위로 온다.
function bigrams(s) {
    const out = new Set();
    const clean = s.replace(/[\s()·,\-\[\]]/g, '');
    if (clean.length < 2) { if (clean) out.add(clean); return out; }
    for (let i = 0; i < clean.length - 1; i++) out.add(clean.slice(i, i + 2));
    return out;
}
function diceSim(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    a.forEach(g => { if (b.has(g)) inter++; });
    return (2 * inter) / (a.size + b.size);
}

function dictSearch(q, limit = 20) {
    if (!q || q.trim().length < 2) return [];
    const terms = dictExpand(q);
    const res = [];
    Object.keys(SURGERY_DICT.tier).forEach(code => {
        const t = SURGERY_DICT.tier[code];
        const procs = SURGERY_DICT.proc[code.slice(0, 3)] || [];
        const { s, hitProc } = dictScore(terms, code, t, procs);
        if (s > 0) res.push({ code, g: t[0], n: t[1], tier: t[2], score: s, procs: hitProc });
    });

    if (res.length) {
        res.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
        const top = res.slice(0, limit);
        const max = top.length ? top[0].score : 1;
        top.forEach(r => { r.rel = Math.max(5, Math.round(r.score / max * 100)); r.fuzzy = false; });
        return top;
    }

    // ── 정확히 맞는 게 하나도 없을 때만 유사도로 대체한다 ──
    // 확실한 결과가 있는데 굳이 흐릿한 후보를 섞지 않는다. 완전히 빈 화면일 때만
    // "그나마 관련 있을 수 있는" 항목을 보여준다.
    const qBig = bigrams(terms[0]);
    const fuzzy = [];
    Object.keys(SURGERY_DICT.tier).forEach(code => {
        const t = SURGERY_DICT.tier[code];
        const text = t[0] + t[1];
        const sim = diceSim(qBig, bigrams(text));
        // 0.12까지 받아주니 "도수치료 → 요도 수술", "줄기세포주사 → 조혈모세포 이식"처럼
        // 글자만 겹치는 무관한 항목이 13~22%로 올라왔다. 그 정도 유사도는 정보가 아니라
        // 오해라서, 문턱을 0.25로 올려 애매한 건 아예 내보내지 않는다.
        if (sim >= 0.25) fuzzy.push({ code, g: t[0], n: t[1], tier: t[2], score: sim, procs: [] });
    });
    fuzzy.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
    const top = fuzzy.slice(0, Math.min(limit, 8));
    // 관련율 상한을 60%로 눌러 "확실한 일치"와 시각적으로 구분한다.
    top.forEach(r => { r.rel = Math.max(5, Math.min(60, Math.round(r.score * 100))); r.fuzzy = true; });
    return top;
}

// 제안서가 올라와 있으면 그 사람 가입금액으로 실제 금액까지 보여준다.
// 없으면 종만 보여준다(백과사전 단독으로도 쓸 수 있어야 하므로).
function dictPolicy() {
    try {
        if (typeof window.__lastResults === 'undefined' || !window.__lastResults) return null;
        if (typeof buildSurgeryPolicy !== 'function') return null;
        return buildSurgeryPolicy(window.__lastResults);
    } catch (e) { return null; }
}

function dictAmountHtml(tier, policy) {
    if (!policy) return '';
    const won = n => (typeof formatKoAmount === 'function' ? formatKoAmount(n) : n + '만원');
    const rows = [];
    const a8 = policy.종8 ? policy.종8[tier] : 0;
    if (a8 > 0) rows.push([`1~8종 수술비(${tier}종)`, a8]);
    const base = Math.max(policy.입원 || 0, policy.통원 || 0);
    if (base > 0) rows.push(['질병 수술비', base]);
    if (!rows.length) return '';
    const total = rows.reduce((a, r) => a + r[1], 0);
    return `<div class="sd-amt">
        <span class="sd-amt-l">${rows.map(r => `${r[0]} ${won(r[1])}`).join(' + ')}</span>
        <b>${won(total)}</b>
      </div>`;
}

function dictRender(q) {
    const box = document.getElementById('sd-result');
    if (!box) return;
    if (!q || q.trim().length < 2) { box.innerHTML = dictTutorialHtml(); return; }

    // 비급여라 대상이 아닌 수술은 결과보다 먼저 이유를 말해준다.
    // 아래에 검색 결과가 딸려 나오면(맘모톰처럼 급여 갈래가 따로 있는 경우) 그것도 같이 보여준다.
    const nc = dictNonCovered(q);
    // both인 항목은 급여 갈래가 실재하므로 "대상이 아니다"라고 잘라 말하면 틀린다.
    const ncHtml = nc ? `<div class="sd-nc${nc.both ? ' half' : ''}">
        <b>⚠ ${nc.n} — ${nc.both ? '급여로 시행한 경우에만 대상입니다' : '1~8종 수술비 대상이 아닙니다'}</b>
        <p>${nc.why}</p>
        <p class="sd-nc-base">이 특약은 <strong>요양급여 절차를 거쳐 처치 및 수술료 항목에서 급여항목이 발생</strong>한
           수술만 보장합니다(약관 제3조②). 전액 비급여로 시행하면 같은 이름의 수술이라도 지급되지 않습니다.</p>
      </div>` : '';

    // both가 아닌 비급여 항목은 결과를 통째로 숨긴다 — 제외된 ADRG의 수가코드가
    // 같은 군에 남아 엉뚱한 항목이 100%로 올라오기 때문이다(위 DICT_NONCOVERED 주석 참고).
    if (nc && !nc.both) { box.innerHTML = ncHtml; return; }

    const hits = dictSearch(q);
    if (!hits.length) {
        if (nc) { box.innerHTML = ncHtml; return; }
        // 유사도 기준(0.12)조차 못 넘긴 경우 — 진짜로 관련 항목이 없다고 볼 수 있다.
        box.innerHTML = `<div class="sd-empty">
            <b>‘${q}’와 관련 있어 보이는 항목을 찾지 못했어요.</b>
            <p>수술명이 약관 용어로 적혀 있어서일 수 있어요. 예를 들어 백내장은 <em>수정체</em>,
               대장용종은 <em>결장경</em>으로 검색해 보세요. 수가코드(예: <em>Q7701</em>)도
               바로 찾을 수 있습니다.<br><br>
               그래도 안 나온다면 <strong>절단·절제 등을 동반하는 수술로 분류되지 않는
               질환</strong>일 가능성이 높아요. 감기·고혈압·당뇨병처럼 약물로 치료하는
               질환은 애초에 1~8종 수술비 대상이 아닙니다.</p>
          </div>`;
        return;
    }
    const policy = dictPolicy();
    const isFuzzy = hits[0].fuzzy;
    box.innerHTML = ncHtml + `
      <div class="sd-count">${hits.length}건 · 관련율 높은 순</div>
      ${nc ? `<p class="sd-fuzzy-note">아래는 이름이 비슷한 <strong>급여 항목</strong>입니다.
          같은 부위라도 급여로 시행한 경우에만 해당하니, 진료비세부내역서에서 급여 발생 여부를 확인하세요.</p>` : ''}
      ${isFuzzy ? `<p class="sd-fuzzy-note">⚡ 정확히 일치하는 항목은 없어서, <strong>글자가 비슷한 순</strong>으로
          관련 있을 수 있는 항목을 보여드려요. 관련율이 낮을수록 실제로는 무관할 가능성이 커요 —
          아래 목록은 참고만 하시고, 정확한 명칭이나 수가코드로 다시 검색해 보시는 걸 권해요.</p>` : ''}
      ${hits.map(h => `
        <div class="sd-card${h.fuzzy ? ' fuzzy' : ''}">
          <div class="sd-top">
            <span class="sd-rel" style="--w:${h.rel}%"><i></i><b>${h.rel}%</b></span>
            <span class="sd-name">${h.n}</span>
            <span class="sd-tier t${h.tier}">${h.tier}종</span>
          </div>
          <div class="sd-sub">${h.g} · <code>${h.code}</code></div>
          ${h.procs.length ? `<ul class="sd-procs">${h.procs.slice(0, 5).map(p =>
              `<li><code>${p[0]}</code> ${p[1]}</li>`).join('')}</ul>` : ''}
          ${h.fuzzy ? '' : dictAmountHtml(h.tier, policy)}
        </div>`).join('')}`;
    // 면책 문구는 항상 보이는 하단 고정 영역(#sd-foot)에 있어 결과마다 반복하지 않는다.
}

function dictTutorialHtml() {
    return `
      <div class="sd-tut">
        <div class="sd-tut-head">
          <b>이렇게 쓰세요</b>
          <span>질병명 · 수술명 · 수가코드로 찾을 수 있어요</span>
        </div>
        <ol class="sd-steps">
          <li><span class="sd-step-n">1</span>
            <div><b>고객이 말한 그대로 넣어보세요</b>
              <p>‘대장용종’, ‘백내장’, ‘디스크’처럼 흔히 쓰는 말도 약관 용어로 바꿔 찾아줍니다.</p></div></li>
          <li><span class="sd-step-n">2</span>
            <div><b>관련율로 어느 게 맞는지 판단하세요</b>
              <p>같은 시술이 여러 분류에 걸칠 수 있어요. 왼쪽 막대가 길수록 검색어에 가까운 항목입니다.</p></div></li>
          <li><span class="sd-step-n">3</span>
            <div><b>몇 종인지, 얼마인지 바로 확인</b>
              <p>오른쪽에 1~8종 등급이 나옵니다. 제안서를 올린 상태라면 그 고객 가입금액으로 계산한 금액까지 함께 보여줘요.</p></div></li>
        </ol>
        <div class="sd-tut-shot">
          <img src="ABOUT/dict_demo.png" alt="‘대장용종’으로 검색한 결과 예시">
          <span>‘대장용종’ 검색 — 결장경 시술(1종)과 폴립 절제술 수가코드, 그리고 그 고객 가입금액으로 계산한 금액까지.</span>
        </div>
        <div class="sd-quick">
          <span>바로 해보기</span>
          ${['대장용종', '백내장', '치핵', '하지정맥류', '추간판', 'Q7701']
            .map(k => `<button type="button" data-q="${k}">${k}</button>`).join('')}
        </div>
      </div>`;
}

window.openSurgeryDict = function () {
    const ov = document.getElementById('sd-overlay');
    if (!ov) return;
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    const input = document.getElementById('sd-input');
    dictRender(input ? input.value : '');
    setTimeout(() => input && input.focus(), 120);
};

window.closeSurgeryDict = function () {
    const ov = document.getElementById('sd-overlay');
    if (!ov) return;
    ov.classList.remove('open');
    document.body.style.overflow = '';
};

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('sd-input');
    const box = document.getElementById('sd-result');
    if (!input || !box) return;

    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => dictRender(input.value), 160);
    });
    // 튜토리얼의 '바로 해보기' 칩
    box.addEventListener('click', e => {
        const b = e.target.closest('button[data-q]');
        if (!b) return;
        input.value = b.dataset.q;
        dictRender(input.value);
        input.focus();
    });
    const ov = document.getElementById('sd-overlay');
    if (ov) ov.addEventListener('click', e => { if (e.target === ov) window.closeSurgeryDict(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && ov && ov.classList.contains('open')) window.closeSurgeryDict();
    });
    dictRender('');
});
