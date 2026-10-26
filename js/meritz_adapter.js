// ── 메리츠화재 담보 정리 ──
// 메리츠 제안서의 담보를 삼성 화면(수술비·뇌심장·간병인)이 읽을 수 있는 모양으로 맞춘다.
//
//   name  : 화면에 보일 이름 — "갱신형 ", "(20년갱신)", "(건강가입)" 같은 머리말·꼬리말만 걷어낸 원문
//   canon : 수술비·뇌심장·간병 모듈이 정규식으로 찾는 표준 이름 (없으면 name으로 찾는다)
//   kind  : surgery / circulatory / caregiver — 없으면 암 화면 담보
//
// 금액 근거: 메리츠 GA 인수지침 2610 3쪽 「통합 암치료비 연간 총 지급액 한도 및 지급금액」,
//            「특정순환계통합치료비(순통치)」, 「진단 및 치료비(치단비)」 표와
//            가입제안서 「가입담보 및 보장내용」 담보별 설명.

// 담보명 정리 — 갱신형 표기는 따로 기억해 두고 이름에서는 뺀다
function cleanMeritzName(name) {
    let s = String(name || '').replace(/\s+/g, ' ').trim();
    const renewal = /갱신형|\(\d+년갱신\)/.test(s);
    s = s
        // 갱신형 담보 아래 줄 "갱신종료 : 100세"가 다음 담보 앞에 붙어 들어온다(실측: 손영진 비갱신 64번)
        .replace(/^(?:갱신종료\s*:\s*\d+세\s*)+/, '')
        // 표 첫 칸(분류)이 담보명 앞에 붙어 들어온 경우 — "사망후유 2 일반상해사망", "재물/배상 246 의료사고법률비용"
        .replace(/^[^\s\d()]+\s+\d{1,4}\s+(?=\S)/, '')
        .replace(/^\(\d+년갱신\)\s*/, '')
        .replace(/^갱신형\s*/, '')
        // 줄바꿈에 걸려 "(건강가 입)"처럼 끊겨 들어오기도 한다
        //   (건강가입) (통합간편가입) (31간편가입) (통합간편심사형)
        .replace(/\(\s*(?:통\s*합\s*간\s*편\s*심\s*사\s*형|\d*\s*(?:통\s*합\s*)?(?:건\s*강|간\s*편|일\s*반|유\s*병\s*자)\s*가\s*입)\s*\)/g, '')
        .replace(/\s*·\s*/g, '·')
        .trim();
    return { name: s, renewal };
}

// 분류 칸 이름("질병", "상해")은 추출기가 지우는데, 메리츠는 같은 담보를 질병·상해로 나눠 판다.
// 원문 줄에서 담보명 바로 앞에 붙어 있으면 되살린다 — "질병 1-5종수술비(plus)…", "상해 통합치료비".
function restoreCause(rawName, cleaned, original) {
    if (/^(질병|상해|일반상해)/.test(cleaned) || !original || !rawName) return cleaned;
    const at = original.indexOf(rawName);
    if (at <= 0) return cleaned;
    const m = original.slice(0, at).match(/(질병|상해)\s*$/);
    return m ? `${m[1]} ${cleaned}` : cleaned;
}

// 담보 하나를 분류하고 표준 이름을 붙인다
function classifyMeritz(nm) {
    const n = nm.replace(/\s+/g, '');
    // ── 간병 ──
    if (/간병인지원/.test(n)) {
        const cause = /상해/.test(n) ? '상해' : '질병';
        if (/요양성특정질병/.test(n)) return { kind: 'caregiver', canon: `${cause} 입원 간병인지원(요양성특정질병 181일이상 요양병원)` };
        if (/181일/.test(n)) return { kind: 'caregiver', canon: `${cause} 입원 간병인지원(181일이상)` };
        return { kind: 'caregiver', canon: `${cause} 입원 간병인지원(1일이상)` };
    }
    if (/간호·?간병통합서비스/.test(n)) {
        const cause = /상해/.test(n) ? '상해' : '질병';
        return { kind: 'caregiver',
                 canon: `${cause}입원간호간병통합서비스사용일당(${/181일/.test(n) ? '181일이상' : '1일이상'})` };
    }
    // ── 뇌·심장 ──
    if (/뇌혈관질환|허혈성심장질환|특정순환계질환|심장질환|뇌졸중|뇌출혈|심근경색/.test(n) && !/암/.test(n)) {
        // 산정특례는 진단비가 아니라 '등록'에 붙는다 — 진단비 칸에 섞이지 않게 표준명에서 '진단비'를 뺀다
        if (/산정특례/.test(n)) return { kind: 'circulatory', canon: `산정특례(${/뇌/.test(n) ? '뇌혈관질환' : '심장질환'})` };
        // 특정혈전치료비 — 1년 안에 혈전용해와 기계적혈전제거술을 모두 받아야 지급(삼성 특정치료비Ⅲ와 다름)
        if (/특정혈전치료비/.test(n)) return { kind: 'circulatory', canon: `특정혈전(${/뇌/.test(n) ? '뇌' : '심장'})`, clot: true };
        if (/통합치료생활비/.test(n)) return { kind: 'circulatory', canon: `순환계생활비(${/3회/.test(n) ? 3 : 2}회)` };
        if (/특정순환계질환통합치료비/.test(n)) return { kind: 'circulatory', canon: '특정순환계질환 통합치료비' };
        if (/뇌혈관질환.*진단비/.test(n)) return { kind: 'circulatory', canon: '뇌혈관질환 진단비' };
        if (/허혈성심장질환.*진단비/.test(n)) return { kind: 'circulatory', canon: '허혈성심장질환 진단비' };
        return { kind: 'circulatory', canon: nm };
    }
    // ── 수술비 ──
    let m;
    if ((m = n.match(/^수술비Ⅱ\(1-5종\)\[(질병|상해)(\d)종\]/))) {
        return { kind: 'surgery', canon: `${m[1]} 1~5종 수술비(${m[2]}종)` };
    }
    if ((m = n.match(/^(질병|상해)?1-5종수술비\(plus\).*\((\d)종/))) {
        return { kind: 'surgery', canon: `${m[1] || '질병'} 1~5종 plus(${m[2]}종)`, plus: true };
    }
    if (/^질병수술비\(특정5대질병제외\)/.test(n)) return { kind: 'surgery', canon: '질병 추가수술비(특정5대질병 제외)' };
    if (/^질병수술비/.test(n)) return { kind: 'surgery', canon: '질병 입원 수술비' };
    if (/^인공관절수술비/.test(n)) return { kind: 'surgery', canon: '인공관절치환 수술비' };
    if (/수술비/.test(n) && !/암|다빈치|로봇/.test(n)) return { kind: 'surgery', canon: nm };
    if (/전신마취치료비/.test(n)) return { kind: 'surgery', canon: nm };
    return {};
}

// 간병인지원은 가입금액 칸에 숫자 대신 '간병인지원'이라고 적혀 있어 금액 추출기가 줄을 통째로 버린다.
// 목록 원문에서 따로 읽어 온다.
//   "453 (20년갱신)갱신형 간병인지원 질병입원일당(Ⅵ)(1일이상 180일한도)(건강
//    가입) 간병인지원 9,050 20년 / 20년"
function extractMeritzCaregiverRows(text) {
    const lines = String(text || '').split('\n').map(s => s.trim());
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
        if (!/^\d{1,4}\s+\S/.test(lines[i]) || !/간병인지원/.test(lines[i])) continue;
        let joined = lines[i];
        for (let k = 1; k <= 2 && !/간병인지원\s+[\d,]+\s+\d+년/.test(joined.replace(/^\d{1,4}\s+\S*간병인지원/, '')); k++) {
            if (i + k >= lines.length || /^\d{1,4}\s+\S/.test(lines[i + k])) break;
            joined += ' ' + lines[i + k];
        }
        const m = joined.match(/^\d{1,4}\s+(.+?간병인지원.+?)\s+간병인지원\s+([\d,]+)\s+\d+년/);
        if (m) rows.push({ name: m[1].trim(), amount: '간병인지원', premium: m[2] + '원', original: joined });
    }
    return rows;
}

// main.js가 추출 직후 부른다. 원본 배열을 고치지 않고 새 배열을 돌려준다.
function normalizeMeritzResults(results, text) {
    const base = (results || []).slice();
    // 간병인지원 줄 보충 — 이미 들어 있으면(다른 경로로 잡힌 경우) 건너뛴다
    const have = new Set(base.map(r => cleanMeritzName(r.name).name));
    extractMeritzCaregiverRows(text).forEach(r => {
        if (!have.has(cleanMeritzName(r.name).name)) base.push(r);
    });
    const seen = new Set();
    return base.map(r => {
        const c = cleanMeritzName(r.name);
        const name = restoreCause(r.name, c.name, r.original);
        const k = classifyMeritz(name);
        // '간병인지원'은 금액 대신 적힌 글자다 — 숫자로 읽지 않는다
        const amount = /간병인지원/.test(r.amount || '') ? '간병인지원' : r.amount;
        return Object.assign({}, r, { name, rawName: r.name, amount, renewal: c.renewal }, k);
    }).filter(r => {
        // 갱신형·비갱신형이 같은 이름으로 정리되면 둘 다 남긴다(가입금액이 다를 수 있다).
        // 이름·금액·보험료까지 같으면 청약서 쪽 재등장이라 하나만 둔다.
        const key = r.name + '|' + r.amount + '|' + (r.premium || '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// 카드 내역 줄은 열네 글자 남짓이라 메리츠 담보명 그대로는 앞머리만 보인다
// ("암 통합치료비Ⅱ(비급…"이 기본형인지 Ⅱ인지 안 보였다). 설계사가 부르는 이름으로 줄인다.
// 원래 이름은 title로 남긴다.
function meritzShortName(name) {
    const n = String(name || '').replace(/\s+/g, '');
    let m;
    if (/^암통합치료비/.test(n)) {
        const ver = /Ⅲ|III/.test(n) ? 'Ⅲ' : /Ⅱ|II/.test(n) ? 'Ⅱ' : '';
        const type = /기본형/.test(n) ? ' 기본형' : /실속형/.test(n) ? ' 실속형' : /주요치료/.test(n) ? ' 주요치료'
                   : /비급여/.test(n) ? ' 비급여' : '';
        return `암통치${ver}${type}`;
    }
    if ((m = n.match(/^암진단및치료비Ⅱ?\[(.+)\]$/))) {
        const t = m[1];
        if (/표적/.test(t)) return '치단비 표적(2·3종)';
        if (/항암약물/.test(t)) return '치단비 항암약물';
        if (/암진단비/.test(t)) return '치단비 암진단';
        return '치단비 ' + t.slice(0, 8);
    }
    if ((m = n.match(/^표적항암약물허가치료비\(연간약물종류개수별\).*\[(\d)종이상\]/))) return `표적 ${m[1]}종 이상`;
    if ((m = n.match(/^수술비Ⅱ\(1-5종\)\[(질병|상해)(.+)\]$/))) return `1-5종 ${m[1]} ${m[2]}`;
    if (/^질병수술비\(특정5대질병제외\)/.test(n)) return '질병수술비(5대제외)';
    if ((m = n.match(/^(뇌혈관질환|허혈성심장질환)진단및치료비Ⅱ?\[(.+)\]$/))) {
        const who = m[1] === '뇌혈관질환' ? '뇌혈관' : '허혈성심장';
        return /특정혈전/.test(m[2]) ? `${who} 특정혈전치료비` : `${who} 진단비`;
    }
    if ((m = n.match(/^중증질환자\((뇌혈관질환|심장질환)\)산정특례/))) return `산정특례(${m[1].replace('질환', '')})`;
    if ((m = n.match(/^특정순환계질환통합치료생활비.*(\d)회이상/))) return `순환계 생활비(${m[1]}회 이상)`;
    if ((m = n.match(/^26종항암방사선및약물치료비.*\[(항암방사선|항암약물)치료비/))) return `26종 ${m[1]}`;
    return name;
}

// ── 암 수술에 함께 나오는 수술비 ──
// 암도 질병이라 암으로 수술하면 질병수술비·질병수술비(특정5대질병 제외)·수술비Ⅱ(1-5종)가 같이 나온다.
// 삼성 applySurgeryTiersToCancerSurgery와 같은 생각이다. 1-5종은 술기에 따라
// 3종(내시경·경피적) ~ 5종(관혈적 근치수술)으로 갈려 범위로 싣는다.
// 다빈치 로봇 수술도 암 수술이라 같은 금액이 붙는다(전체 합계에는 암수술비 쪽만 센다).
function applyMeritzSurgeryToCancer(summaryMap, results) {
    const surg = (results || []).filter(r => r && r.kind === 'surgery' && r.canon);
    if (!surg.length || !summaryMap.size) return;
    const pick = re => surg.find(r => re.test(r.canon.replace(/\s+/g, '')));
    const amt = r => (r ? parseKoAmount(r.amount) : 0);
    const rows = [];
    [pick(/^질병입원수술비$/), pick(/^질병추가수술비/)].filter(r => amt(r) > 0).forEach(r =>
        rows.push({ name: r.name, lo: amt(r), hi: amt(r), cycle: '매회' }));
    const j3 = pick(/^질병1~5종수술비\(3종\)/), j5 = pick(/^질병1~5종수술비\(5종\)/);
    if (amt(j3) || amt(j5)) {
        const lo = amt(j3) || amt(j5), hi = amt(j5) || amt(j3);
        rows.push({ name: '수술비Ⅱ(1-5종)[질병3종~5종]', lo: Math.min(lo, hi), hi: Math.max(lo, hi),
                    cycle: '매회' });
    }
    if (!rows.length) return;
    const fmt = v => formatKoAmount(v).replace(/원$/, '');
    ['암수술비', '다빈치로봇수술비'].forEach((key, i) => {
        let g = summaryMap.get(key);
        if (!g) {
            if (i) return;   // 다빈치 담보가 없으면 카드를 새로 만들지 않는다
            g = { displayName: key, totalMin: 0, totalMax: 0, isolatedMin: 0, isolatedMax: 0,
                  isolatedOnceMin: 0, isolatedOnceMax: 0, items: [], onceOnly: false };
            summaryMap.set(key, g);
        }
        rows.forEach(r => {
            g.items.push({ name: r.name, amount: fmt(r.lo), ...(r.hi > r.lo ? { maxAmount: fmt(r.hi) } : {}),
                           source: r.name, surgeryTier: true, cycle: r.cycle, payFreq: '' });
            g.totalMin += r.lo; g.totalMax += r.hi;
            if (!i) { g.isolatedMin += r.lo; g.isolatedMax += r.hi; }
        });
    });
}

// ── 암 진단비 · 생활비 ──
// 9장 카드(치료비)에 들어가지 않는 암 담보. 진단은 최초 1회, 생활비는 연간 통합치료 2회 이상일 때 연 1회.
function meritzCancerExtras(results) {
    const R = (results || []).filter(r => r && !r.kind);
    const v = r => parseKoAmount(r.amount);
    const out = [];
    const add = (re, label, note, once) => R.filter(r => re.test(r.name.replace(/\s+/g, ''))).forEach(r =>
        out.push({ nm: label || r.name, src: r.name, v: v(r), note, once: !!once }));
    add(/암진단비\(유사암제외\)|^암진단비/, '암 진단비', '유사암 제외 · 최초 1회', true);
    add(/^유사암진단비/, '유사암 진단비', '제자리암·기타피부암·경계성종양·갑상선암 각각 최초 1회', true);
    add(/^암\(유사암제외\)통합치료생활비/, '암 통합치료 생활비', '한 해 수술·방사선·약물 치료 2회 이상이면 연 1회');
    add(/^유사암통합치료생활비/, '유사암 통합치료 생활비', '한 해 치료 2회 이상이면 연 1회');
    add(/특정호르몬약물허가치료비\[특정항암\]/, '특정항암 호르몬약물치료', '최초 1회', true);
    add(/특정호르몬약물허가치료비\[갑상선암수술후\]/, '갑상선암 수술 후 호르몬약물', '최초 1회', true);
    add(/^계속받는특정항암호르몬약물허가치료비/, '계속받는 항암호르몬약물', '연 1회');
    add(/^암후유장해/, '암 후유장해', '장해지급률(3~100%)만큼');
    return out.filter(x => x.v > 0);
}

// ── 메리츠 특정순환계질환 통합치료비(순통치) 지급표 ──
// 가입금액(만원)별 항목 금액(만원). 인수지침 2610 3쪽, 제안서 담보 설명과 대조.
// 수술은 회당, 재활은 1일당(입원·외래 각각, 연 15회), 그 외는 연간 1회한.
const MERITZ_SUNTONG = {
    tiers: [2000, 3000, 5000, 8000, 10000],
    groups: [
        { g: '검사', items: [
            { n: 'MRI (급여)', v: [5, 5, 5, 5, 5] },
            { n: 'PET (급여)', v: [5, 5, 5, 5, 5] },
            { n: 'CT (급여)', v: [10, 10, 10, 10, 10] }] },
        { g: '치료', items: [
            { n: '혈전용해', v: [400, 700, 1000, 2000, 2500] },
            { n: 'CRRT (급여)', v: [200, 300, 500, 500, 500] },
            { n: '인공호흡 (급여)', v: [100, 100, 200, 200, 200] },
            { n: '저체온요법 (급여)', v: [50, 50, 100, 100, 100] },
            { n: '부분체외순환 (급여)', v: [500, 1000, 2000, 2000, 2000] }] },
        { g: '수술', items: [
            { n: '수술 (회당)', v: [400, 700, 1000, 2000, 2000] },
            { n: '중환자실', v: [400, 700, 1000, 2000, 2000] }] },
        { g: '재활', items: [
            { n: '전문재활치료 (1일당)', v: [2, 2, 2, 2, 2] }] }
    ]
};
// 가입금액에 맞는 열 — 표에 없는 금액이면 그보다 작은 가장 가까운 열
function meritzSuntongCol(amount) {
    let col = 0;
    MERITZ_SUNTONG.tiers.forEach((t, i) => { if (amount >= t) col = i; });
    return col;
}
function meritzSuntongValue(amount, key) {
    const it = MERITZ_SUNTONG.groups.flatMap(g => g.items).find(x => x.n.startsWith(key));
    return it ? it.v[meritzSuntongCol(amount)] : 0;
}

const MERITZ_CIRC_TEXT = {
    DISC: `표시 금액은 가입금액 기준 검토 가능한 범위이며 지급을 확정하는 값이 아닙니다. 보상 여부는 청구 시 제출된 진단명(한국표준질병·사인분류)과 실제 받은 치료, 약관에 따라 결정됩니다.
      <strong>특정혈전치료비</strong>는 한 해 안에 <strong>혈전용해치료와 급여 기계적혈전제거술(카테터법)을 각각 1회씩 모두</strong> 받아야 연 1회 지급되며, 항응고제·항혈소판제·혈전용해제를 쓰지 않은 혈전제거술은 제외됩니다.
      <strong>특정순환계질환 통합치료비</strong>는 검사·주요치료·재활을 합쳐 <strong>연간 가입금액 한도</strong>로 지급하고, 수술은 회당·그 외 항목은 연 1회한입니다.
      <strong>계약일부터 1년 이내</strong>에는 항목별 지급금액과 연간 한도가 <strong>50% 감액</strong>됩니다.`,
    SRC: `가입제안서 「가입담보 및 보장내용」과 메리츠화재 GA 인수지침(2026.10) 특정순환계질환 통합치료비 지급표를 근거로 정리했습니다. 진단비의 질병 범위는 약관 분류표를 따릅니다.`
};

// ── 메리츠 간병인지원 안내 ──
// 출처: 가입제안서 담보별 설명과 「간병인지원 특약에 관한 사항」①~③ (주요사항 안내)
const MERITZ_CAREGIVER_SERVICE = {
    partner: '메리츠화재 간병인지원',
    steps: [
        { t: '전화 신청', s: '1688-0090 → 1번', ico: 'phone' },
        { t: '고객 인증', s: '', ico: 'person' },
        { t: '간병업체 연결', s: '', ico: 'cal' },
        { t: '간병인 지원', s: '', ico: 'care' }
    ],
    phone: { number: '1688-0090', label: '간병인 지원 신청', note: '연결 후 1번(간병인지원) 선택' },
    productPhone: { number: '1566-7711', label: '보험 상품 문의', note: '메리츠화재 고객콜센터' },
    lead: '간병인이 필요한 날보다 48시간 전에 신청하세요',
    leadSub: '회사에 신청하지 않고 쓴 간병인은 간병인사용비용이 나오지 않아요',
    keep: [
        '회사에 신청하지 않고 임의로 간병인을 쓰거나 간호·간병통합서비스를 이용하면 간병인 지원·간병인사용비용이 나오지 않습니다.',
        '회사가 부득이하게 간병인을 보내지 못하면, 직접 고른 간병인 비용을 회사가 정한 하루 한도 안에서 드립니다(사업자 영수증 필요 · 예: 2026년 가입 첫해 140,400원).',
        '간병인 지원일수는 1회 입원당 180일까지, 181일 이상 담보가 있으면 185일까지입니다.'
    ],
    disclaimer: '가입제안서를 바탕으로 정리한 참고자료입니다. 보장 여부와 한도는 약관 및 상품설명서에 따릅니다. ' +
        '간병인지원비용과 간병인사용비용 한도는 매년 재산정되며 회사 홈페이지(공시실-상품공시)에서 확인할 수 있습니다.'
};
