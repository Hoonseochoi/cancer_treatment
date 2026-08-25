// ── 뇌·심장(순환계) 분석기 ──
// 수술비 분석기와 같은 패턴: 삼성화재 제안서에서 순환계 담보(kind:'circulatory')가
// 감지되면 토글로 전환해 보는 사이드 뷰. 암 9카드·수술비 뷰에는 일절 관여하지 않는다.
// 디자인 출처: 클로드 아티팩트 "뇌·심장 보장 한눈에" (2026-08-25 확정안 이식)

// 금액 포맷 — parseKoAmount가 만원 단위를 반환하므로 여기서도 만원 단위 기준.
// 0은 "미가입", 10000(=1억) 이상은 억 표시, 나머지는 천단위 콤마 (아티팩트 원본 로직 변환)
function ccW(n) {
    if (!n || n <= 0) return '미가입';
    if (n >= 10000) {
        return (n % 10000 ? (n / 10000).toFixed(1) : n / 10000) + '억원';
    }
    return n.toLocaleString('ko-KR') + '만원';
}

// 제안서에서 추출한 순환계 담보(kind:'circulatory') + 수술비 담보(kind:'surgery')를
// 뷰에 필요한 금액 묶음으로 정리한다.
function buildCirculatoryPolicy(results) {
    const all = results || [];
    const circ = all.filter(r => r && r.kind === 'circulatory');
    if (!circ.length) return null;

    const norm = s => (s || '').replace(/\s+/g, '');
    // kind 태그가 누락된 담보 보완용으로 전체 results에서도 재검색한다.
    const find = re => circ.find(r => re.test(norm(r.name))) || all.find(r => re.test(norm(r.name)));
    const val = r => (r ? parseKoAmount(r.amount) : 0);
    // 같은 질환에 담보가 여러 개 붙는 경우(예: "뇌혈관질환 진단비" + "뇌혈관질환(90일면책) 진단비")
    // 둘은 별개 특약이고 각각 "최초 1회한"이라 면책기간을 넘기면 둘 다 지급된다.
    // find()로 첫 건만 잡으면 실제 보장의 절반만 표시되므로 전부 더한다.
    const sumAll = re => {
        const pool = circ.length ? circ : all;
        const seen = new Set();
        return pool.reduce((acc, r) => {
            const n = norm(r.name);
            if (!re.test(n) || seen.has(n)) return acc;
            seen.add(n);
            return acc + parseKoAmount(r.amount);
        }, 0);
    };

    const p = { dx: {}, dxParts: {}, 치료비: 0, 중환자실: 0, sx: {}, count: circ.length };

    CIRCULATORY_DATA.DX.forEach(d => {
        p.dx[d.k] = sumAll(d.re);
        // 어떤 담보들이 합쳐졌는지 툴팁/설명용으로 남긴다
        p.dxParts[d.k] = (circ.length ? circ : all)
            .filter(r => d.re.test(norm(r.name)))
            .map(r => ({ name: r.name, v: parseKoAmount(r.amount) }));
    });
    p.치료비 = val(find(CIRCULATORY_DATA.TREAT_RE));
    p.중환자실 = val(find(CIRCULATORY_DATA.ICU_RE));

    // 순환계 통합치료비(순통치) — 특정치료비Ⅲ와 별개 담보. 검사~재활 전 경로를
    // 연간 한도 내에서 보장하며, 있을 때만 치료 경로 차트를 노출한다.
    // type: std=표준형(연간 1억) / lite=실속형(연간 5천)
    const tongM = find(/특정순환계질환.*통합치료비/);
    p.통합 = null;
    if (tongM) {
        const amount = parseKoAmount(tongM.amount);
        const n = norm(tongM.name);
        const type = n.includes('실속형') ? 'lite' : 'std';
        p.통합 = { amount, type };
    }

    // 수술비 구성 — 수술비 분석기의 buildSurgeryPolicy를 그대로 재사용해 출처를 일치시킨다.
    //   입원   = 질병 입원 수술비 (뇌·심장 수술은 입원 수술이므로 통원은 배제)
    //   종5    = 질병 1~5종 수술비 중 5종 (두개내·심장내 관혈수술 등 최상위 등급)
    //   대질병 = N대질병 수술비 그룹 중 최고 그룹. 단 그룹 간 중복 미지급이므로 전체 그룹 중
    //            최고 금액이 5대주요기관이면 대질병은 0 (합계 = 전체 그룹 최고값 1개)
    //   오대   = 5대주요기관 그룹 (뇌·심장 포함, 111대의 하위 그룹)
    //   종8    = 질병 1~8종 수술비 최고 등급
    const sp = (typeof buildSurgeryPolicy === 'function') ? buildSurgeryPolicy(results) : null;
    p.sx.입원 = sp ? sp.입원 : 0;
    p.sx.종5 = sp ? (sp.종5[5] || 0) : 0;
    p.sx.종8 = 0;
    p.sx.대질병 = 0;
    p.sx.오대 = 0;
    if (sp) {
        Object.keys(sp.종8).forEach(g => { p.sx.종8 = Math.max(p.sx.종8, sp.종8[g] || 0); });
        let groupMax = 0, groupMaxIsOdae = false;
        Object.keys(sp.군).forEach(key => {
            const amt = sp.군[key] || 0;
            const isOdae = key.includes('5대주요기관');
            if (isOdae) p.sx.오대 = Math.max(p.sx.오대, amt);
            if (amt > groupMax) { groupMax = amt; groupMaxIsOdae = isOdae; }
        });
        p.sx.대질병 = groupMaxIsOdae ? 0 : groupMax;
    }

    // 치료행위별 지급 (수술·혈전용해·혈전제거는 각각 따로 지급된다)
    //   특정치료비Ⅲ : 각 행위마다 가입금액 전액
    //   통합치료비   : 약관 지급표의 행위별 금액 (표준형/실속형)
    p.surgTreat = { 수술: 0, 혈전용해: 0, 혈전제거: 0 };
    if (p.치료비 > 0) {
        // 특정치료비Ⅲ는 "각 치료행위별로 각각 가입금액 지급"이므로 행위마다 전액이 붙는다
        p.surgTreat.수술 += p.치료비;
        p.surgTreat.혈전용해 += p.치료비;
        p.surgTreat.혈전제거 += p.치료비;
    }
    if (p.통합) {
        const col = p.통합.type === 'std' ? 'std' : 'stdL';
        const flat = CIRCULATORY_DATA.JOURNEY.flatMap(g => g.items);
        const jItem = key => flat.find(x => x.n.startsWith(key));
        ['수술', '혈전용해', '혈전제거'].forEach(k => {
            const it = jItem(k);
            if (it) p.surgTreat[k] += (it[col] || 0);
        });
    }

    p.surgSum = p.sx.입원 + p.sx.종5 + p.sx.대질병 + p.sx.종8 + p.sx.오대;

    // ── 대표 금액과 최대 금액을 분리한다 ──
    // 약관 지급표가 "수술(혈전제거술 제외)"로 못박고 있어 수술과 혈전제거는 배타적이고,
    // 혈전용해·혈전제거도 통상 택일이다. 세 행위를 모두 받는 건 극단적 시나리오라
    // 대표 금액(ringTotal)은 가장 높은 단일 치료행위 하나 + 수술비로 잡고,
    // 세 행위를 모두 받는 경우는 maxTotal 로 따로 보여준다.
    const acts = [p.surgTreat.수술, p.surgTreat.혈전용해, p.surgTreat.혈전제거];
    p.treatBest = Math.max(...acts, 0);
    p.treatAll = acts.reduce((a, b) => a + b, 0);

    // 통합치료비는 연 최대 한도(표준형 1억 / 실속형 5천)를 넘길 수 없다.
    p.cap = p.통합 ? (p.통합.type === 'std' ? CIRCULATORY_DATA.CAP.std : CIRCULATORY_DATA.CAP.lite) : 0;
    p.capped = false;
    if (p.cap > 0 && p.treatAll > p.cap) { p.treatAll = p.cap; p.capped = true; }

    p.treatSum = p.treatBest;                    // 대표 시나리오
    p.ringTotal = p.treatBest + p.surgSum;       // 동심원 대표 금액
    p.maxTotal = p.treatAll + p.surgSum;         // 세 행위 모두 받은 최대치
    return p;
}

// ── SVG 동심원 ──
const CC_PATHS = {
    brain: 'M50,11 C61,6 74,10 79,19 C88,21 93,30 90,39 C95,46 93,56 86,61 C85,71 77,78 67,78 C62,84 52,86 45,82 C37,86 28,83 24,76 C15,75 8,67 9,58 C3,52 3,42 9,36 C7,27 13,18 22,16 C28,9 41,7 50,11 Z',
    heart: 'M50,88 C50,88 12,62 12,37 C12,22 24,13 36,13 C44,13 49,18 50,22 C51,18 56,13 64,13 C76,13 88,22 88,37 C88,62 50,88 50,88 Z'
};
const CC_FISSURE = 'M50,13 C50,28 45,37 50,47 C55,57 49,67 50,81';

function ccOrgan(o, policy) {
    const p = CC_PATHS[o.path];
    // 치료행위 카드가 놓일 기준선 — 기관 그림 아래
    const y1 = o.cy + o.size / 2 - 6;
    // base 고리(가장 바깥) = 치료행위 중 가장 높은 하나 + 별도 수술비 담보 총액.
    // 진단비는 그림에 넣지 않고 하단 진단비 막대에서 별도로 보여준다.
    const baseTotal = policy.ringTotal;
    let s = `<g filter="url(#cc-soft)" transform="translate(${o.cx},${o.cy}) scale(${o.size / 100}) translate(-50,-50)">`;
    o.rings.forEach(r => {
        const v = r.base ? baseTotal : (policy.dx[r.k] || 0);
        const on = v > 0;
        s += `<path d="${p}" class="ring-shape" stroke-linejoin="round"
      transform="translate(50,50) scale(${r.s}) translate(-50,-50)"
      fill="${on ? r.c : 'rgba(255,255,255,.82)'}"
      stroke="${on ? 'rgba(255,255,255,.95)' : '#9AA1B4'}"
      stroke-width="${on ? 1.5 : 1.3}" ${on ? '' : 'stroke-dasharray="3.2 2.4"'}></path>`;
    });
    if (o.path === 'brain')
        s += `<path d="${CC_FISSURE}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.3" stroke-linecap="round"></path>`;
    s += `</g>`;
    o.rings.forEach(r => {
        const v = r.base ? baseTotal : (policy.dx[r.k] || 0);
        const y = o.cy + r.ty * o.size;
        // 미가입 고리는 도형이 흰색이므로 글자를 회색으로 — ink(흰색)를 쓰면 안 보인다
        const fill = (r.base || v > 0) ? r.ink : '#7C8397';
        s += `<text x="${o.cx}" y="${y}" text-anchor="middle" class="r-name"
      style="font-size:${r.nf}px" fill="${fill}" opacity=".94">${r.k}</text>`;
        // base는 총액, 내부 고리는 전용 담보가 있을 때만 "+금액". 없으면 금액 없이 질환명만.
        if (r.base || v > 0) {
            const txt = r.base ? ccW(v) : '+' + ccW(v);
            s += `<text x="${o.cx}" y="${y + r.af * 0.92 + 2}" text-anchor="middle" class="r-amt"
      style="font-size:${r.af}px" fill="${fill}">${txt}</text>`;
        }
    });
    // ── 기관 하단 치료행위 카드 ──
    // 수술·혈전용해·혈전제거는 서로 배타적이라 합산하지 않고 각각 얼마인지 카드로 보여준다.
    // 그림 안에 들어가야 하므로 작게, 셋을 나란히 배치한다.
    const acts = [
        { n: '수술', v: policy.surgTreat.수술 },
        { n: '혈전용해', v: policy.surgTreat.혈전용해 },
        { n: '혈전제거', v: policy.surgTreat.혈전제거 }
    ].filter(a => a.v > 0);
    if (acts.length) {
        const cw = 86, gap = 6;
        const totalW = acts.length * cw + (acts.length - 1) * gap;
        let cx0 = o.cx - totalW / 2;
        acts.forEach(a => {
            s += `<g transform="translate(${cx0},${y1 - 10})">
        <rect width="${cw}" height="34" rx="8" fill="#fff" stroke="${o.actLine}" stroke-width="1"></rect>
        <text x="${cw / 2}" y="13" text-anchor="middle" class="dia-note"
          style="font-size:9.6px" fill="var(--muted)">${a.n}</text>
        <text x="${cw / 2}" y="27" text-anchor="middle" class="r-amt"
          style="font-size:13px" fill="${o.actInk}">${ccW(a.v)}</text>
      </g>`;
            cx0 += cw + gap;
        });
        if (policy.surgSum > 0) {
            s += `<text x="${o.cx}" y="${y1 + 38}" text-anchor="middle" class="dia-note"
        style="font-size:10.4px" fill="var(--ink-2)">+ 수술비 ${ccW(policy.surgSum)} (수술 시 함께 지급)</text>`;
        }
    }
    // 라벨은 기관 그림 위쪽(히어로 바 바로 아래)에 배치
    s += `<text x="${o.cx}" y="${o.cy - o.size / 2 - 8}" text-anchor="middle" class="organ-label">${o.label}</text>`;
    return s;
}

// 부정맥·특정3대심장질환은 허혈성심장질환의 부분집합이 아니라 특정순환계질환 안의
// 별개 집합이다(별표55에 각각 독립 항목 I49·I46.0·I47·I48·I50으로 들어있다).
function ccSmallHeart(h) {
    let s = `<g filter="url(#cc-soft)" transform="translate(${h.cx},${h.cy}) scale(${h.size / 100}) translate(-50,-50)">
    <path d="${CC_PATHS.heart}" class="ring-shape" stroke-linejoin="round"
      fill="${h.c}" stroke="rgba(255,255,255,.95)" stroke-width="1.6"></path></g>`;
    // 이 둘도 특정순환계질환Ⅱ 안에 있어 같은 치료비가 적용된다.
    // 총액을 또 찍으면 화면에 같은 숫자가 네 번 나오므로 "적용"만 표시한다.
    s += `<text x="${h.cx}" y="${h.cy + 2}" text-anchor="middle"
    style="font-size:18px" fill="${h.ink}">치료비 적용</text>`;
    s += `<text x="${h.cx}" y="${h.cy + h.size / 2 + 4}" text-anchor="middle"
    style="font-size:17px" fill="var(--ink)">${h.k}</text>`;
    s += `<text x="${h.cx}" y="${h.cy + h.size / 2 + 18}" text-anchor="middle" class="dia-note"
    style="font-size:9.6px">${h.kcd}</text>`;
    return s;
}

// 진단비 포함 총액 — 동심원(치료비+수술비)에 뇌혈관질환·허혈성심장질환 진단비를 더한 값.
// 두 진단비 금액이 다르면 min~max 범위로 표시.
function inclHtml(policy) {
    const dxB = policy.dx['뇌혈관질환'] || 0;
    const dxH = policy.dx['허혈성심장질환'] || 0;
    if (dxB + dxH <= 0) return '';
    const lo = policy.ringTotal + Math.min(dxB, dxH);
    const hi = policy.ringTotal + Math.max(dxB, dxH);
    const txt = lo === hi ? ccW(lo) : ccW(lo) + '~' + ccW(hi);
    return `<div class="sx-sum" style="font-size:13.5px;color:var(--brain-2)"><span>+ 진단비 포함</span><span class="num">${txt}</span></div>`;
}

// 세 치료행위를 모두 받은 극단적 시나리오의 최대 금액.
// 대표 금액(ringTotal)과 분리해서, 무엇을 더한 값인지 근거를 같이 적는다.
function maxHtml(policy) {
    if (policy.maxTotal <= policy.ringTotal) return '';
    const acts = [
        ['수술', policy.surgTreat.수술],
        ['혈전용해', policy.surgTreat.혈전용해],
        ['혈전제거', policy.surgTreat.혈전제거]
    ].filter(a => a[1] > 0);
    const dxB = policy.dx['뇌혈관질환'] || 0, dxH = policy.dx['허혈성심장질환'] || 0;
    const withDx = policy.maxTotal + Math.max(dxB, dxH);
    return `
    <div class="cc-max">
      <div class="cc-max-top">
        <span>최대 보장금액</span>
        <b class="num">${ccW(withDx > policy.maxTotal ? withDx : policy.maxTotal)}</b>
      </div>
      <p class="cc-max-sub">
        ${acts.map(a => `${a[0]} ${ccW(a[1])}`).join(' + ')}${policy.surgSum > 0 ? ` + 수술비 ${ccW(policy.surgSum)}` : ''}${withDx > policy.maxTotal ? ` + 진단비 ${ccW(Math.max(dxB, dxH))}` : ''}
        ${policy.capped ? `<br><strong>연 최대 한도 ${ccW(policy.cap)}가 적용된 금액입니다.</strong>` : ''}
      </p>
      <p class="cc-max-note">한 해에 <strong>세 가지 치료를 모두</strong> 받은 경우를 가정한 금액입니다.
        약관 지급표가 <strong>「수술(혈전제거술 제외)」</strong>로 정하고 있어 수술과 혈전제거는 함께 지급되지 않으며,
        실제로는 받은 치료 하나에 해당하는 금액이 지급됩니다.</p>
    </div>`;
}

function renderCirculatoryPanel(results) {
    const host = document.getElementById('circulatory-panel');
    if (!host || typeof CIRCULATORY_DATA === 'undefined') return false;
    const policy = buildCirculatoryPolicy(results);
    if (!policy) return false;

    // ── 동심원 기하 (아티팩트 확정값) ──
    const BRAIN = {
        label: '뇌 계열', cx: 196, cy: 196, size: 340, path: 'brain',
        actLine: '#C7CEF5', actInk: '#312E81',
        rings: [
            { k: '뇌혈관질환', base: true, s: 1.00, ty: -0.335, nf: 20, af: 36, c: 'var(--brain-3)', ink: '#312E81' },
            { k: '뇌졸중', s: 0.60, ty: -0.155, nf: 16, af: 19, c: 'var(--brain-2)', ink: '#fff' },
            { k: '뇌출혈', s: 0.33, ty: 0.000, nf: 14, af: 17, c: 'var(--brain-1)', ink: '#fff' }
        ]
    };
    const HEART = {
        label: '심장 계열', cx: 512, cy: 196, size: 322, path: 'heart',
        actLine: '#F5C2D6', actInk: '#9D174D',
        rings: [
            { k: '허혈성심장질환', base: true, s: 1.00, ty: -0.295, nf: 20, af: 36, c: 'var(--heart-3)', ink: '#9D174D' },
            { k: '급성심근경색증', s: 0.50, ty: -0.050, nf: 15, af: 18, c: 'var(--heart-2)', ink: '#fff' }
        ]
    };
    const SMALL = [
        { k: '기타 심장부정맥', kcd: 'I49', cx: 768, cy: 118, size: 122, c: 'var(--heart-2)', ink: '#fff' },
        { k: '특정3대심장질환', kcd: 'I46.0·I47·I48·I50', cx: 768, cy: 268, size: 122, c: 'var(--heart-1)', ink: '#fff' }
    ];

    // ── 진단비 막대 ──
    const dxMax = Math.max(...CIRCULATORY_DATA.DX.map(d => policy.dx[d.k] || 0), 1);
    const barsHtml = CIRCULATORY_DATA.DX.map(d => {
        const v = policy.dx[d.k] || 0;
        return `<div class="bar-row${v ? '' : ' off'}">
      <span class="bn">${d.k}<em>${d.kcd}</em></span>
      <span class="bar-track">${v ? `<span class="bar-fill" style="width:${(v / dxMax * 100).toFixed(1)}%;background:${d.c}"></span>` : ''}</span>
      <span class="bv">${ccW(v)}</span>
    </div>`;
    }).join('');

    // ── 수술비 구성 ──
    const sxMap = { 입원: policy.sx.입원, 종5: policy.sx.종5, 대질병: policy.sx.대질병, 종8: policy.sx.종8, 오대: policy.sx.오대 };
    const sxHtml = CIRCULATORY_DATA.SX.map(r => `
    <div class="sx-row${sxMap[r.k] ? '' : ' off'}"><span>${r.n}<em>${r.s}</em></span><b>${ccW(sxMap[r.k])}</b></div>`).join('')
        + `<div class="sx-sum"><span>수술비 합계</span><span class="num">${ccW(policy.surgSum)}</span></div>`
        + `<div class="sx-sum" style="border-top:0;padding-top:2px;color:var(--outer)">
       <span>+ 치료행위 중 가장 높은 하나</span><span class="num">${ccW(policy.treatBest)}</span></div>`
        + `<div class="sx-sum" style="font-size:13px"><span>동심원 안 금액</span><span class="num">${ccW(policy.ringTotal)}</span></div>`
        + inclHtml(policy)
        + maxHtml(policy);

    // ── 치료 경로 — 순환계 통합치료비(순통치) 가입자에게만 노출한다 ──
    // 특정치료비Ⅲ는 수술·혈전용해·혈전제거 시 가입금액 지급이 전부라 경로 차트가 없고,
    // 통합치료비는 검사~재활 전 경로를 연간 한도 내에서 보장하므로 가입금액(표준형/실속형)에
    // 맞는 지급표 단일 값으로 채운다.
    const tongName = policy.통합 ? (policy.통합.type === 'std' ? '표준형' : '실속형') : '';
    const journeyHtml = policy.통합
        ? CIRCULATORY_DATA.JOURNEY.map((g, i) => {
            return `<div class="jstep has">
    <div class="jcap"><span class="jnum">${i + 1}</span><b>${g.g}</b></div>
    ${g.items.map(x => `<div class="ji">
      <span>${x.n}</span><b>${ccW(policy.통합.type === 'std' ? x.std : x.stdL)}</b></div>`).join('')}
  </div>`;
        }).join('')
        : '';
    const journeySection = policy.통합 ? `
        <div class="journey">
          <div class="jhead">치료 경로 · 검사부터 재활까지 끊기지 않고 이어서 보장합니다</div>
          <div class="jsteps">${journeyHtml}</div>
          <p class="jnote">순환계 통합치료비(<strong>${tongName}</strong>) 가입 기준 지급 한도입니다(수술은 회당, 그 외 연간 1회한). 가입금액이 다르면 보장 범위는 같고 지급액만 달라집니다.</p>
        </div>` : '';

    // ── 분류표 41개 항목 ──
    const codesHtml = CIRCULATORY_DATA.CODES.map(([n, c], i) => {
        const hit = CIRCULATORY_DATA.HIT_RE.test(n);
        return `<div class="ci${hit ? ' hit' : ''}"><span>${i + 1}. ${n}</span><b>${c}</b></div>`;
    }).join('');

    host.innerHTML = `
    <div class="cc-card">
      <h2>치료비 · 수술비 보장 구조</h2>
      <p class="sub">가장 바깥 고리는 그 질환으로 <strong>치료·수술받았을 때 검토 가능한 치료비+수술비 총액</strong>입니다. 안쪽 고리는 전용 담보가 있을 때 추가됩니다.</p>

      <div class="circle-wrap">
        <div class="hero">
          <span class="hero-l">${policy.통합 ? '특정 순환계 질환 통합치료비' : '특정 순환계 질환 치료비'}
            <button type="button" class="qm" data-cc="qm" aria-expanded="false" aria-controls="cc-codes" title="보장 범위 보기">?</button>
          </span>
          <span class="hero-amt num">${policy.통합 ? ccW(policy.통합.amount) : ccW(policy.치료비)}</span>
          <span class="hero-tag">아래 모든 질환에 적용</span>
          <span class="hero-sub">${policy.통합
              ? `${tongName} · 연간 ${ccW(policy.통합.amount)} 한도<br>수술 · 혈전용해 · 혈전제거 · 중환자실 · 검사 · 약물 · 재활`
              : `중환자실 입원지원금 ${ccW(policy.중환자실)}<br>수술 · 혈전용해 · 혈전제거 시 지급`}</span>
        </div>
        <svg class="diagram" viewBox="0 0 900 400" role="img" aria-label="뇌·심장 치료비·수술비 동심원">
          <defs>
            <filter id="cc-soft" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0E1629" flood-opacity="0.10"></feDropShadow>
            </filter>
          </defs>
          ${ccOrgan(BRAIN, policy)}
          ${ccOrgan(HEART, policy)}
          ${SMALL.map(ccSmallHeart).join('')}
          <text x="450" y="396" text-anchor="middle" class="dia-note">
            오른쪽 두 하트는 허혈성심장질환의 안쪽 고리가 아니라, 특정순환계질환 안의 별개 집합입니다
          </text>
        </svg>
        ${journeySection}
      </div>
      <div class="codes" data-cc="codes" data-open="false">
        <h4>특정순환계질환 분류표 · ${CIRCULATORY_DATA.CODES.length}개 항목</h4>
        <p>[별표-질병관련55] 특정순환계질환Ⅱ 기준이며, <strong>Ⅱ와 Ⅲ의 보장 범위는 동일</strong>합니다
           (가입 담보는 특정치료비Ⅲ). 제9차 개정 한국표준질병·사인분류(통계청 고시 제2025-299호) 중 아래 질병을 말합니다.
           <strong style="color:var(--brain-2)">파란 항목</strong>이 위 동심원에 그려진 뇌·심장 계열입니다.</p>
        <div class="code-grid">${codesHtml}</div>
      </div>
      <div class="trap-box">${CIRCULATORY_DATA.TRAP}</div>
    </div>

    <div class="cc-duo">
      <div class="cc-card" style="margin:0">
        <h2>진단비</h2>
        <p class="sub">진단만으로 지급되는 담보입니다. 막대가 길수록 넓은 질환을 덮습니다.</p>
        <div class="bars">${barsHtml}</div>
      </div>
      <div class="cc-card" style="margin:0">
        <h2>수술비 구성</h2>
        <p class="sub">동심원 안 금액에 합산된 수술비 계열입니다.</p>
        <div class="sx">${sxHtml}</div>
      </div>
    </div>

    <div class="cc-disc">
      <b>반드시 확인해 주세요</b>
      <p>${CIRCULATORY_DATA.DISC}</p>
    </div>
    <p class="cc-src">${CIRCULATORY_DATA.SRC}</p>`;

    // onclick 대입 방식 — addEventListener는 재분석 시 핸들러가 중첩된다(수술비 때와 동일).
    host.onclick = e => {
        const qm = e.target.closest('[data-cc="qm"]');
        if (!qm) return;
        const codes = host.querySelector('[data-cc="codes"]');
        if (!codes) return;
        const open = codes.dataset.open === 'true';
        codes.dataset.open = String(!open);
        qm.setAttribute('aria-expanded', String(!open));
    };
    return true;
}
