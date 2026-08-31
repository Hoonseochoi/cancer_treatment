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

    // ── 질환 전용 치료비·수술비 ──
    // 치료행위·수술비 담보는 대부분 순환계 전체에 공통으로 붙어 뇌혈관과 허혈성의
    // 금액이 같아진다. 다만 "뇌혈관질환 수술비"처럼 특정 질환에만 붙는 담보가
    // 따로 들어오는 제안서가 있어, 그 경우에는 두 질환의 금액이 갈린다.
    // 진단비는 dx에서 이미 따로 잡으므로 여기서는 제외한다.
    p.own = {};
    CIRCULATORY_DATA.DX.forEach(d => {
        // 검증된 DX 패턴에서 "…진단비" 꼬리만 떼어 질환명 부분을 그대로 재사용한다.
        const stem = d.re.source.replace(/\.\*진단비$/, '');
        let ownRe;
        try { ownRe = new RegExp(stem + '.*(치료비|수술비)'); } catch (e) { p.own[d.k] = 0; return; }
        const seen = new Set();
        p.own[d.k] = (circ.length ? circ : all).reduce((acc, r) => {
            const n = norm(r.name);
            if (seen.has(n) || !ownRe.test(n)) return acc;
            // 순환계 전체 공통 담보(특정치료비·중환자실)는 질환 전용이 아니다.
            if (CIRCULATORY_DATA.TREAT_RE.test(n) || CIRCULATORY_DATA.ICU_RE.test(n)) return acc;
            seen.add(n);
            return acc + parseKoAmount(r.amount);
        }, 0);
    });

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

    // 이 화면의 목적이 "이 제안서로 최대 얼마까지 검토 가능한가"이므로 동심원에는 최대치를 싣는다.
    // 다만 수술과 혈전제거는 약관상 함께 지급되지 않으므로, 근거·주의 문구를 반드시 함께 보여준다.
    p.treatSum = p.treatAll;                     // 치료행위 최대 합
    p.maxTotal = p.treatAll + p.surgSum;         // 세 행위 + 수술비
    p.ringTotal = p.maxTotal;                    // 질환 카드에 싣는 금액 = 최대 보장금액
    return p;
}

// 뇌·심장 실루엣 path — 지금은 쓰는 곳이 없지만 카드에 도형을 다시 넣을 때를 위해 남긴다.
const CC_PATHS = {
    brain: 'M50,11 C61,6 74,10 79,19 C88,21 93,30 90,39 C95,46 93,56 86,61 C85,71 77,78 67,78 C62,84 52,86 45,82 C37,86 28,83 24,76 C15,75 8,67 9,58 C3,52 3,42 9,36 C7,27 13,18 22,16 C28,9 41,7 50,11 Z',
    heart: 'M50,88 C50,88 12,62 12,37 C12,22 24,13 36,13 C44,13 49,18 50,22 C51,18 56,13 64,13 C76,13 88,22 88,37 C88,62 50,88 50,88 Z'
};
// 동심원 렌더 코드는 카드 레이아웃으로 대체되면서 통째로 제거했다.

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
    if (policy.maxTotal <= 0) return '';
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

// 카드 한 장. 미가입이면 회색으로 비활성화한다.
// rows = 카드 안에 나열할 세부 담보 [{n, v}] — 이 금액이 어디서 나왔는지 보여주는 근거다.
function ccCard(o) {
    const on = o.v > 0;
    const rows = (o.rows || []).filter(r => r.v > 0);
    return `<div class="ccc${on ? '' : ' off'}" style="--ink:${on ? o.ink : 'var(--cc-off)'}">
        <div class="ccc-h">
          <span class="ccc-ico">${o.icon || ''}</span>
          <span class="ccc-n">${o.name}</span>
        </div>
        <p class="ccc-amt">${on ? ccW(o.v) : '미가입'}</p>
        ${o.kcd ? `<p class="ccc-kcd">${o.kcd}</p>` : ''}
        ${rows.length ? `<ul class="ccc-rows">${rows.map(r =>
            `<li><span>${r.n}</span><b>${ccW(r.v)}</b></li>`).join('')}</ul>` : ''}
        ${o.note ? `<p class="ccc-note">${o.note}</p>` : ''}
      </div>`;
}

// 동심원을 대신하는 카드 묶음.
//   1열 치료행위(수술·혈전용해·혈전제거) / 2열 질환별 진단비 / 3열 수술비·중환자실
// 특정순환계 치료비는 질환이 아니라 "치료행위"에 붙는 담보라, 하나로 뭉쳐 두는 것보다
// 행위별로 쪼개는 편이 실제 지급 구조와 맞는다.
function ccCardsHtml(policy, tongName) {
    const jFlat = policy.통합 ? CIRCULATORY_DATA.JOURNEY.flatMap(g => g.items) : [];
    const jVal = key => {
        if (!policy.통합) return 0;
        const it = jFlat.find(x => x.n.startsWith(key));
        return it ? (policy.통합.type === 'std' ? it.std : it.stdL) || 0 : 0;
    };
    const ACTS = [
        { k: '수술', icon: '<i class="cci cci-scalpel"></i>', ink: 'var(--brain-2)' },
        { k: '혈전용해', icon: '<i class="cci cci-drop"></i>', ink: 'var(--heart-2)' },
        { k: '혈전제거', icon: '<i class="cci cci-pulse"></i>', ink: 'var(--outer)' }
    ];
    const actHtml = ACTS.map(a => ccCard({
        name: a.k, v: policy.surgTreat[a.k] || 0, ink: a.ink, icon: a.icon,
        rows: [
            { n: '특정순환계 특정치료비', v: policy.치료비 },
            { n: `통합치료비${tongName ? '(' + tongName + ')' : ''}`, v: jVal(a.k) }
        ]
    })).join('');

    // 질환별 진단비 — 어떤 담보가 합쳐진 값인지 카드 안에 그대로 편다.
    // 뇌 계열 / 심장 계열을 각각 색 테두리 상자로 묶어, 어느 장기 쪽 보장인지 한눈에 갈리게 한다.
    const dxCard = d => ccCard({
        name: d.k, kcd: d.kcd, v: policy.dx[d.k] || 0, ink: d.c,
        icon: `<i class="cci ${/뇌/.test(d.k) ? 'cci-brain' : 'cci-heart'}"></i>`,
        // 담보명에서 카드 제목과 겹치는 앞부분은 떼어낸다("뇌졸중 진단비(1년50%)" → "진단비(1년50%)")
        rows: (policy.dxParts[d.k] || []).map(x => ({ n: x.name.replace(d.k, '').trim() || x.name, v: x.v })),
        note: (policy.own[d.k] > 0) ? `이 질환 전용 치료·수술비 ${ccW(policy.own[d.k])} 별도` : ''
    });
    const dxGroup = (cls, label, list) => `
      <section class="ccgrp ${cls}">
        <h5 class="ccgrp-h">${label}<em>${list.length}개 담보</em></h5>
        <div class="ccg g2">${list.map(dxCard).join('')}</div>
      </section>`;
    const brainDx = CIRCULATORY_DATA.DX.filter(d => /뇌/.test(d.k));
    const heartDx = CIRCULATORY_DATA.DX.filter(d => !/뇌/.test(d.k));
    const dxHtml = dxGroup('brain', '뇌 계열', brainDx) + dxGroup('heart', '심장 계열', heartDx);

    const sxMap = { 입원: policy.sx.입원, 종5: policy.sx.종5, 대질병: policy.sx.대질병, 종8: policy.sx.종8, 오대: policy.sx.오대 };
    const sxRows = CIRCULATORY_DATA.SX.map(r => ({ n: r.n, v: sxMap[r.k] }));

    return `
    <div class="ccx">
      <p class="ccx-cap2">치료행위 — 특정순환계질환으로 아래 치료를 받으면 각각 지급됩니다</p>
      <div class="ccg g3">${actHtml}</div>

      <p class="ccx-cap2">질환별 진단비 — 진단만으로 지급되는 담보입니다</p>
      <div class="ccgrps">${dxHtml}</div>

      <p class="ccx-cap2">수술비 · 중환자실</p>
      <div class="ccg g2">
        ${ccCard({
            name: '수술비', v: policy.surgSum, ink: 'var(--brain-2)',
            icon: '<i class="cci cci-scalpel"></i>', rows: sxRows,
            note: policy.surgSum > 0 ? '수술 시 치료행위 금액에 더해 함께 지급됩니다' : ''
        })}
        ${ccCard({
            name: '중환자실 입원지원금', v: policy.중환자실, ink: 'var(--warn)',
            icon: '<i class="cci cci-bed"></i>',
            note: '수술 · 혈전용해 · 혈전제거로 중환자실에 입원했을 때'
        })}
      </div>
    </div>`;
}

function renderCirculatoryPanel(results) {
    const host = document.getElementById('circulatory-panel');
    if (!host || typeof CIRCULATORY_DATA === 'undefined') return false;
    const policy = buildCirculatoryPolicy(results);
    if (!policy) return false;

    // ── 수술비 구성 ──
    const sxMap = { 입원: policy.sx.입원, 종5: policy.sx.종5, 대질병: policy.sx.대질병, 종8: policy.sx.종8, 오대: policy.sx.오대 };
    // 개별 수술비 담보는 위 수술비 카드에 이미 펼쳐 두었으므로, 여기서는 합계만 이어 붙인다.
    const sxHtml = (policy.surgSum > 0
            ? `<div class="sx-sum"><span>수술비 합계</span><span class="num">${ccW(policy.surgSum)}</span></div>`
            : '')
        + `<div class="sx-sum" style="border-top:0;padding-top:2px;color:var(--outer)">
       <span>치료행위 합계 <em style="font-style:normal;color:var(--cc-muted)">(수술·혈전용해·혈전제거)</em></span><span class="num">${ccW(policy.treatAll)}</span></div>`
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
      <p class="sub">카드 큰 금액은 <strong>그 항목으로 검토 가능한 금액</strong>이고, 아래 목록은 그 금액을 이루는 <strong>세부 담보</strong>입니다. 회색으로 흐린 카드는 가입되지 않은 담보입니다.</p>

      ${ccCardsHtml(policy, tongName)}
      ${journeySection}
      <div class="codes" data-cc="codes" data-open="false">
        <h4>특정순환계질환 분류표 · ${CIRCULATORY_DATA.CODES.length}개 항목</h4>
        <p>[별표-질병관련55] 특정순환계질환Ⅱ 기준이며, <strong>Ⅱ와 Ⅲ의 보장 범위는 동일</strong>합니다
           (가입 담보는 특정치료비Ⅲ). 제9차 개정 한국표준질병·사인분류(통계청 고시 제2025-299호) 중 아래 질병을 말합니다.
           <strong style="color:var(--brain-2)">파란 항목</strong>이 위 카드에 나온 뇌·심장 계열입니다.</p>
        <div class="code-grid">${codesHtml}</div>
      </div>
      <div class="trap-box">${CIRCULATORY_DATA.TRAP}</div>
    </div>

    <div class="cc-card">
      <h2>보장금액 합계</h2>
      <p class="sub">위 카드 금액을 합쳐, 한 번의 사고에서 검토 가능한 금액을 정리한 것입니다.</p>
      <div class="sx">${sxHtml}</div>
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
