// ── 수술비 분석기 ──
// 기존 암보장 분석 결과는 그대로 두고, 삼성화재 제안서에서 수술비 담보가 감지되면
// 토글로 전환해서 볼 수 있는 사이드 뷰. 암 9카드 렌더링에는 일절 관여하지 않는다.

// 제안서에서 추출한 수술비 담보(kind:'surgery')를 계열별로 정리한다.
function buildSurgeryPolicy(results) {
    const surg = (results || []).filter(r => r && r.kind === 'surgery');
    if (!surg.length) return null;

    const norm = s => (s || '').replace(/\s+/g, '');
    const find = re => surg.find(r => re.test(norm(r.name)));
    const val = r => (r ? parseKoAmount(r.amount) : 0);

    const p = {
        입원: val(find(/질병.*입원수술비/)),
        통원: val(find(/질병.*통원수술비/)),
        종5: {}, 종8: {}, 군: {}, 양성: {}, 전용: {},
        _raw: surg
    };
    for (let g = 1; g <= 5; g++) {
        p.종5[g] = val(find(new RegExp(`질병1[~-]5종수술비\\(${g}종\\)`)));
    }
    for (let g = 1; g <= 8; g++) {
        p.종8[g] = val(find(new RegExp(`질병1[~-]8종수술비\\(${g}종\\)`)));
    }
    // 111대/115대/119대 질병수술비 — 그룹명을 담보명에서 그대로 뽑는다
    surg.forEach(r => {
        const m = norm(r.name).match(/\d+대질병수술비\(([^)]+)\)/);
        if (m) p.군[m[1]] = parseKoAmount(r.amount);
        const b = norm(r.name).match(/양성신생물수술비\(([^)]+?)(?:\(|\))/);
        if (b) p.양성[b[1].replace(/양성신생물$/, '')] = parseKoAmount(r.amount);
    });
    ['충수염', '인공관절치환', '조혈모세포이식', '각막이식', '5대장기이식'].forEach(k => {
        const r = find(new RegExp(k + '수술비'));
        if (r) p.전용[k] = parseKoAmount(r.amount);
    });
    return p;
}

// 111대 그룹 담보명은 상품마다 표기가 달라(5대주요기관관혈 / 5대주요기관 등) 유연하게 찾는다.
function matchGroupKey(policy, group, gwan) {
    const keys = Object.keys(policy.군);
    if (!keys.length || !group) return null;
    const base = group.replace(/\s+/g, '');
    const wan = gwan ? '관혈' : '비관혈';
    return keys.find(k => k.includes(base) && k.includes(wan))
        || keys.find(k => k.includes(base) && !/관혈/.test(k))
        || keys.find(k => k.includes(base))
        || null;
}

// 한 술기(variant)에 대해 검토 가능한 담보를 분해한다.
// 질병 수술비 특별약관 제6조②의 KCD 면책은 질병 입원/통원 수술비와 N대질병 수술비에만
// 적용된다. 1~5종·1~8종은 각각 별도 특약이라 이 면책을 받지 않으므로 그대로 지급된다.
function calcSurgeryVariant(policy, s, v) {
    const rows = [];
    const ex = s.excl || null;
    const blocked = t => !!(ex && ex.tiers && ex.tiers.indexOf(t) >= 0);
    const exWhy = ex ? `제6조②${ex.ho} ${ex.why}(${ex.kcd}) — 면책` : '';

    const base = Math.max(policy.입원, policy.통원);
    if (base > 0) {
        const name = policy.입원 >= policy.통원 ? '질병 입원 수술비' : '질병 통원 수술비';
        if (blocked('base')) rows.push({ k: name, s: exWhy, v: 0, on: false });
        else rows.push({ k: name, s: '입원·통원 중 택일', v: base, on: true });
    }
    // g5/g8이 null이면 분류표에 대응 항목이 없다는 뜻이다(하이푸 등 비수술 시술).
    // 지급 대상이 아니라는 사실 자체가 상담에서 중요하므로 0원 줄로 남겨 보여준다.
    if (v.g5 == null) {
        rows.push({ k: '질병 1~5종 수술비', s: '1~5종 분류표에 해당 항목 없음', v: 0, on: false });
    } else {
        const a5 = policy.종5[v.g5];
        if (a5 > 0) rows.push({ k: `질병 1~5종 수술비(${v.g5}종)`, s: v.n5, v: a5, on: true });
        else rows.push({ k: `1~5종 분류: ${v.g5}종`, s: '이 상품에 해당 담보 없음', v: 0, on: false });
    }

    if (v.g8 == null) {
        rows.push({ k: '질병 1~8종 수술비', s: '1~8종 분류표에 해당 항목 없음', v: 0, on: false });
    } else {
        const a8 = policy.종8[v.g8];
        if (a8 > 0) rows.push({ k: `질병 1~8종 수술비(${v.g8}종)`, s: v.n8, v: a8, on: true });
        else rows.push({ k: `1~8종 분류: ${v.g8}종`, s: '이 상품에 해당 담보 없음', v: 0, on: false });
    }

    if (s.cancer) {
        rows.push({ k: '질병군 수술비', s: '분류표에 악성신생물 미포함 — 해당 없음', v: 0, on: false });
    } else {
        // N대질병 수술비는 그룹 간 중복 지급되지 않는다. 한 질병이 여러 그룹에 해당해도
        // 가입금액이 가장 높은 그룹 하나만 지급하고, 나머지는 미지급으로 남겨 보여준다.
        const gs = Array.isArray(s.g111) ? s.g111 : (s.g111 ? [s.g111] : []);
        const cands = gs
            .map(g => matchGroupKey(policy, g, v.gwan))
            .filter(Boolean)
            .map(key => ({ key, amt: policy.군[key] || 0 }))
            .sort((a, b) => b.amt - a.amt);
        cands.forEach((c, i) => {
            if (blocked('group')) {
                rows.push({ k: `질병군 수술비(${c.key})`, s: exWhy, v: 0, on: false });
            } else if (i === 0) {
                rows.push({ k: `질병군 수술비(${c.key})`, s: v.gwan ? '관혈' : '비관혈',
                            v: c.amt, on: true });
            } else {
                rows.push({ k: `질병군 수술비(${c.key})`,
                            s: '그룹 간 중복 미지급 — 최고 금액 1개만 지급', v: 0, on: false });
            }
        });
    }
    if (s.benign && policy.양성[s.benign] != null) {
        rows.push({ k: `통합 양성신생물 수술비(${s.benign})`, s: '가입 후 1년 이내 감액',
                    v: policy.양성[s.benign], on: true });
    }
    if (s.special && policy.전용[s.special] != null) {
        rows.push({ k: `${s.special} 수술비`, s: '전용 담보', v: policy.전용[s.special], on: true });
    }
    return { rows, total: rows.reduce((a, b) => a + (b.on ? b.v : 0), 0) };
}

// 지급액이 같은 술기끼리 묶는다. 술기가 갈려도 금액이 같으면 카드를 여러 장 보여줄
// 이유가 없다. 라벨은 공통 접두·접미를 살리고 다른 부분만 "/"로 합친다.
//   위전절제술(복강경) + 위전절제술(개복) → 위전절제술(복강경/개복)
//   복강경 담낭절제술 + 개복 담낭절제술   → 복강경/개복 담낭절제술
// 공통부가 없어 합친 결과가 길어지면 "○○ 외 N가지"로 떨어뜨린다.
function isParenBalanced(s) {
    let d = 0;
    for (const c of s) {
        if (c === '(') d++;
        else if (c === ')') { d--; if (d < 0) return false; }
    }
    return d === 0;
}

function mergeVariantLabels(labels) {
    if (labels.length === 1) return labels[0];
    const uniq = [...new Set(labels)];
    if (uniq.length === 1) return uniq[0];

    const min = Math.min(...uniq.map(s => s.length));
    let p = 0;
    while (p < min && uniq.every(s => s[p] === uniq[0][p])) p++;
    let q = 0;
    while (q < min - p && uniq.every(s => s[s.length - 1 - q] === uniq[0][uniq[0].length - 1 - q])) q++;

    // "동반"과 "미동반"처럼 한쪽이 다른 쪽의 부분집합이면 접두·접미가 같은 글자를 두고
    // 겹쳐 잡아 "동/미동반" 같이 낱말 중간에서 잘린다. 공통부가 한글 낱말 안에서
    // 시작·끝나지 않도록 경계까지 물러선다. 조금 길어져도 잘못 읽히는 것보다 낫다.
    const midsAt = (pp, qq) => uniq.map(s => s.slice(pp, s.length - qq));
    const han = c => /[가-힣]/.test(c || '');
    while (q > 0 && (midsAt(p, q).some(m => !m) ||
           uniq.some(s => han(s[s.length - q]) && han(s[s.length - q - 1])))) q--;
    while (p > 0 && (midsAt(p, q).some(m => !m) ||
           uniq.some(s => han(s[p]) && han(s[p - 1])))) p--;

    const mids = midsAt(p, q).filter(Boolean);
    if (mids.length === uniq.length && mids.length <= 3) {
        const merged = uniq[0].slice(0, p) + mids.join('/') + (q ? uniq[0].slice(uniq[0].length - q) : '');
        // 중간 토막에 여는 괄호만 들어가면 "…절제술(복강경/…절제술(개복)" 처럼 괄호가 깨진다.
        if (merged.length <= 42 && isParenBalanced(merged)) return merged;
    }
    return `${uniq[0]} 외 ${uniq.length - 1}가지`;
}

// [{v, r}] → 금액이 같은 것끼리 묶은 [{total, label, rows, variants}]
function groupVariantsByAmount(cs) {
    const byTotal = new Map();
    cs.forEach(c => {
        const k = String(c.r.total);
        if (!byTotal.has(k)) byTotal.set(k, []);
        byTotal.get(k).push(c);
    });
    return [...byTotal.values()]
        .map(items => ({
            total: items[0].r.total,
            rows: items[0].r.rows,               // 금액이 같으므로 내역도 동일
            label: mergeVariantLabels(items.map(x => x.v.label)),
            variants: items.map(x => x.v)
        }))
        .sort((a, b) => a.total - b.total);
}

function renderSurgeryPanel(results) {
    const host = document.getElementById('surgery-panel');
    if (!host || typeof SURGERY_DATA === 'undefined') return false;
    const policy = buildSurgeryPolicy(results);
    if (!policy) return false;

    const fmt = n => formatKoAmount(n);
    const grade = g => `<span class="sg-chip sg-g${g}">${g}종</span>`;

    const cards = SURGERY_DATA.map((s, i) => {
        const cs = s.variants.map(v => ({ v, r: calcSurgeryVariant(policy, s, v) }));
        const tot = cs.map(c => c.r.total);
        const lo = Math.min(...tot), hi = Math.max(...tot);
        // 손해율 TOP10은 금액이 0이어도 숨기지 않는다. "이 시술은 수술비가 안 나온다"는
        // 사실 자체가 상담에서 가장 중요한 정보라서다(하이푸·고주파절제 등).
        if (hi === 0 && !s.hot) return '';
        // 분류표에 대응 항목이 없으면 g5/g8이 null이다 — 뱃지에서 제외한다.
        const g5 = [...new Set(s.variants.map(v => v.g5))].filter(g => g != null).sort((a, b) => a - b);
        const g8 = [...new Set(s.variants.map(v => v.g8))].filter(g => g != null).sort((a, b) => a - b);

        const groups = groupVariantsByAmount(cs);
        const detail = groups.map(g => `
            <div class="sg-v">
              <div class="sg-vh"><span>${g.label}</span><b>${fmt(g.total)}</b></div>
              ${g.rows.map(x => `<div class="sg-r${x.on ? '' : ' off'}">
                  <span>${x.k}<em>${x.s}</em></span><b>${x.on ? fmt(x.v) : '—'}</b></div>`).join('')}
              <div class="sg-src">${g.variants.map(v =>
                  [v.c8 ? `1~8종 ${v.c8} ${v.g8}종 「${v.n8}」` : '1~8종 분류표에 해당 항목 없음',
                   v.n5no ? `1~5종 ${v.n5no}항 ${v.g5}종` : '1~5종 분류표에 해당 항목 없음'
                  ].join(' · ')).join('<br>')}</div>
            </div>`).join('');

        // 1~5종·1~8종 어디에도 대응 항목이 없는 행위는 "수술"이 아니라 시술로 볼 여지가 커
        // 질병수술비조차 분쟁이 된다(하이푸 등). 금액은 보여주되 반드시 짚어준다.
        const noTier = s.variants.every(v => v.g5 == null && v.g8 == null);
        const none = hi === 0;   // 표준 수술비로는 지급되지 않는 시술
        return `<div class="sg-row${s.hot ? ' hot' : ''}${none ? ' none' : ''}" data-open="false">
            <button class="sg-btn" aria-expanded="false">
              <span class="sg-l">
                <span class="sg-name">${s.hot ? `<i class="sg-rank">${s.hot}</i>` : ''}${s.name}</span>
                <span class="sg-tags">
                  ${none ? '' : (policy.입원 || policy.통원 ? '<span class="sg-chip sg-base">질수</span>' : '')}
                  ${g5.map(grade).join('')}
                  ${g8.length ? `<span class="sg-chip sg-cls">1~8종 ${g8.join('·')}종</span>` : ''}
                  ${s.cancer ? '<span class="sg-chip sg-cancer">암</span>' : ''}
                  ${s.benign ? '<span class="sg-chip sg-etc">양성신생물</span>' : ''}
                  ${s.special ? `<span class="sg-chip sg-etc">${s.special}</span>` : ''}
                  ${none ? '<span class="sg-chip sg-none">수술비 미해당</span>'
                         : (noTier ? '<span class="sg-chip sg-warn">지급 분쟁 소지</span>' : '')}
                </span>
              </span>
              <span class="sg-money">${none
                  ? '<b class="zero">해당 없음</b><em>전용 특약이 있어야 보장</em>'
                  : `<b>${lo === hi ? fmt(lo) : fmt(lo) + '~' + fmt(hi)}</b>
                     <em>검토 가능${groups.length > 1 ? ` · 술기에 따라 ${groups.length}구간` : ''}</em>`}</span>
            </button>
            <div class="sg-d">${detail}
              ${s.note ? `<div class="sg-note"><b>확인 포인트</b>${s.note}</div>` : ''}
            </div></div>`;
    }).filter(Boolean).join('');

    // ── 다빈도 수술 TOP 5 요약 ──
    // 수술비는 진단비처럼 "최초 1회한"이 아니라 수술받을 때마다 검토되므로
    // 5년 합계보다 "이 수술 받으면 얼마"가 상담에서 훨씬 잘 통한다.
    // 아래 30종 중 실제로 많이 하는 5종을 뽑아 연간 기준 금액으로 먼저 보여준다.
    const topList = (typeof SURGERY_TOP5 !== 'undefined' ? SURGERY_TOP5 : [])
        .map(nm => {
            const s = SURGERY_DATA.find(x => x.name === nm);
            if (!s) return null;
            const tot = s.variants.map(v => calcSurgeryVariant(policy, s, v).total);
            const lo = Math.min(...tot), hi = Math.max(...tot);
            return hi > 0 ? { name: nm, lo, hi } : null;
        })
        .filter(Boolean);

    host.innerHTML = `
      <div class="sg-head">
        <h3>수술비 검토</h3>
        <p>가입한 수술비 담보 기준으로 각 수술에서 검토 가능한 금액입니다.</p>
      </div>
      ${topList.length ? `
      <div class="sg-top5">
        <div class="sg-top5-head">많이 하는 수술 TOP ${topList.length} · 연간 검토 가능 금액</div>
        <div class="sg-top5-grid">
          ${topList.map(t => `
          <div class="sg-top5-item">
            <span class="t5n">${t.name}</span>
            <b class="num">${t.lo === t.hi ? fmt(t.lo) : fmt(t.lo) + '~' + fmt(t.hi)}</b>
          </div>`).join('')}
        </div>
        <p class="sg-top5-note">수술비는 진단비와 달리 <strong>최초 1회한이 아니라</strong> 수술받을 때마다 검토됩니다(질병수술비는 매회지급, 1~5종은 동일사고당 1회). 위 금액은 <strong>해당 수술 1회 기준</strong>이며, 아래 목록에서 ${SURGERY_DATA.length}종 전체와 술기별 상세를 확인하실 수 있습니다.</p>
      </div>` : ''}
      <p class="sg-hot-legend"><i>1</i>~<i>10</i> 번호가 붙은 항목은 <strong>보험사 손해율이 급등한 수술 TOP 10</strong>입니다. 청구가 많은 만큼 상담에서도 가장 자주 나옵니다.</p>
      <div class="sg-list">${cards}</div>
      <div class="sg-disc" data-open="false">
        <button class="sg-disc-btn" aria-expanded="false">
          <span class="sg-disc-head">
            <b>반드시 확인해 주세요</b>
            <p class="sg-disc-lead">표시 금액은 <strong>가입금액 기준 검토 가능한 최대 범위</strong>이며 지급을 확정하는 값이 아닙니다. 보상 여부는 <strong>청구 시 제출된 정확한 수술행위</strong>와 약관에 따라 결정됩니다.</p>
          </span>
          <span class="sg-disc-caret"></span>
        </button>
        <ol class="sg-disc-rest">
          <li>같은 수술도 <strong>개복·복강경·내시경, 림프절절제 동반 여부</strong>에 따라 수술 종류(종)와 금액이 달라집니다.</li>
          <li><strong>질병 입원 수술비·통원 수술비 및 N대질병 수술비는 아래 질병에 대해 보상하지 않습니다</strong>(질병 수술비 특별약관 제6조②).
            정신 및 행동장애(F04~F99) / 습관성 유산·불임·인공수정 관련 합병증(N96~N98, 단 계약일로부터 2년 경과 후 발생 시 지급) /
            임신·출산(<strong>제왕절개 포함</strong>)·산후기(O00~O99) / 선천기형·변형 및 염색체이상(Q00~Q99) / 비만(E66) /
            요실금(N39.3, N39.4, R32) / <strong>치핵 및 직장·항문관련질환(I84, K60~K62, K64)</strong> / 치아우식증·치아·치주질환(K00~K08).
            <em>1~5종·1~8종 수술비는 별도 특약이라 이 면책의 적용을 받지 않습니다.</em></li>
          <li><strong>질병 1~5종 수술비</strong>는 동시에 두 종류 이상의 수술을 받은 경우 <strong>가장 높은 가입금액에 해당하는 한 종류만</strong> 지급합니다.
            다만 <strong>동일한 신체부위가 아니면서 의학적으로 치료목적이 다른 독립적인 수술</strong>이면 각각 지급합니다(제3조①).
            신체부위는 눈·귀·코·씹어먹거나 말하는 기능 관련 부위·머리·목·경추·체간골·흉부장기·복부장기·비뇨생식기·팔·다리·손가락·발가락으로 구분하며, <strong>눈·귀·팔·다리는 좌우를 각각 다른 부위</strong>로 봅니다(제3조②).</li>
          <li><strong>질병 1~8종 수술비</strong>는 1회의 입원 또는 통원 중 2가지 이상의 수술을 받아도 <strong>하나의 수술시술코드에 한하여</strong> 지급하며, 2가지 이상의 코드가 부여되면 <strong>수술시술종류가 높은 하나</strong>를 지급합니다(제4조①②).
            <em>예: 유방재건술(J051, 3종)과 유방절제술(J061, 7종)을 동시에 받으면 7종으로 지급</em></li>
          <li><strong>1~8종 수술비는 국민건강보험 요양급여(또는 의료급여) 절차를 거쳐 급여항목이 발생</strong>해야 하며, 계약 시점에 급여였다가 <strong>비급여로 변경되면 보장에서 제외</strong>됩니다(제3조②④).</li>
          <li><strong>다음은 「수술」로 보지 않아 1~5종 수술비가 지급되지 않습니다</strong>(제4조③): 흡인 / 천자 / 신경 BLOCK / <strong>미용성형 목적</strong> / <strong>피임 목적</strong> / <strong>검사 및 진단을 위한 수술(생검, 복강경검사 등)</strong> / 기타 수술의 정의에 해당하지 않는 시술.</li>
          <li>동일 질병으로 두 종류 이상 또는 같은 종류의 수술을 2회 이상 받은 경우 <strong>1회에 한하여</strong> 지급되며, 일부 담보는 <strong>수술개시일부터 60일 이내 2회 이상을 1회로 간주</strong>합니다.</li>
          <li><strong>N대질병 수술비는 그룹 간 중복 지급되지 않습니다.</strong> 한 질병이 5대주요기관·22대·62대생활 등 여러 그룹에 해당하더라도 <strong>가입금액이 가장 높은 그룹 하나만</strong> 지급됩니다.</li>
          <li><strong>N대질병 수술비 분류표에는 악성신생물(암)이 없습니다.</strong> 양성신생물은 포함됩니다. 1~5종 수술비는 다수 항목이 <strong>「근본수술」·「근치수술」</strong>을 요건으로 합니다.</li>
          <li>양성신생물 수술비 등 일부 담보는 <strong>가입 후 1년 이내 감액 지급</strong>됩니다. 고의·자해, 수익자·계약자의 고의, 전쟁·외국의 무력행사·혁명·내란·사변·폭동으로 인한 경우도 면책입니다(제6조①).</li>
        </ol>
      </div>`;

    // onclick 으로 대입한다. addEventListener 를 쓰면 제안서를 다시 분석할 때마다
    // 핸들러가 중첩되어 클릭 한 번에 토글이 여러 번 뒤집힌다.
    host.onclick = e => {
        const rowBtn = e.target.closest('.sg-btn');
        if (rowBtn) {
            const row = rowBtn.closest('.sg-row');
            const open = row.dataset.open === 'true';
            row.dataset.open = String(!open);
            rowBtn.setAttribute('aria-expanded', String(!open));
            return;
        }
        const discBtn = e.target.closest('.sg-disc-btn');
        if (discBtn) {
            const disc = discBtn.closest('.sg-disc');
            const open = disc.dataset.open === 'true';
            disc.dataset.open = String(!open);
            discBtn.setAttribute('aria-expanded', String(!open));
        }
    };
    return true;
}

// 암 ↔ 수술비 ↔ 뇌·심장 3탭 토글. 수술비 또는 뇌·심장 담보가 감지된 경우에만 노출한다.
function setupSurgeryToggle(results, insurer) {
    const wrap = document.getElementById('surgery-toggle');
    const panel = document.getElementById('surgery-panel');
    const ccPanel = document.getElementById('circulatory-panel');
    const grid = document.getElementById('summary-grid');
    if (!wrap || !panel || !grid || !ccPanel) return;

    const count = (results || []).filter(r => r && r.kind === 'surgery').length;
    const ccCount = (results || []).filter(r => r && r.kind === 'circulatory').length;
    const hasSurgery = insurer === 'samsung' && count > 0 && renderSurgeryPanel(results);
    const hasCirc = insurer === 'samsung' && ccCount > 0 && renderCirculatoryPanel(results);
    if (!hasSurgery && !hasCirc) {
        wrap.classList.add('hidden');
        panel.classList.add('hidden');
        ccPanel.classList.add('hidden');
        return;
    }

    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <button type="button" data-v="cancer" aria-selected="true">암 보장</button>
      ${hasSurgery ? `<button type="button" data-v="surgery" aria-selected="false">수술비 <span class="sg-badge">${count}</span></button>` : ''}
      ${hasCirc ? `<button type="button" data-v="circulatory" aria-selected="false">뇌·심장 <span class="sg-badge">${ccCount}</span></button>` : ''}`;
    wrap.onclick = e => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        const v = b.dataset.v;
        wrap.querySelectorAll('button[data-v]').forEach(x =>
            x.setAttribute('aria-selected', String(x.dataset.v === v)));
        panel.classList.toggle('hidden', v !== 'surgery');
        ccPanel.classList.toggle('hidden', v !== 'circulatory');
        grid.classList.toggle('hidden', v !== 'cancer');
        const other = document.getElementById('other-panel-container');
        if (other) other.classList.toggle('hidden', v !== 'cancer');
        // 상단 인사이트 카드는 "5년간 받을 암 치료비"라 암 탭 전용이다.
        // 수술비·뇌심 탭에는 각 패널이 자체 요약을 갖고 있으므로 같이 띄우면
        // 뇌심 금액인 줄 오해하게 된다.
        const insight = document.getElementById('insight-section');
        if (insight) insight.classList.toggle('hidden', v !== 'cancer');
        const header = document.getElementById('result-header');
        if (header) header.textContent = v === 'surgery' ? '수술비 한눈에 보기'
            : v === 'circulatory' ? '뇌·심장 한눈에 보기' : '보장 내역 한눈에 보기';
    };
}
