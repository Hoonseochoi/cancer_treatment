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
function calcSurgeryVariant(policy, s, v) {
    const rows = [];
    const base = Math.max(policy.입원, policy.통원);
    if (base > 0) {
        rows.push({ k: policy.입원 >= policy.통원 ? '질병 입원 수술비' : '질병 통원 수술비',
                    s: '입원·통원 중 택일', v: base, on: true });
    }
    const a5 = policy.종5[v.g5];
    if (a5 > 0) rows.push({ k: `질병 1~5종 수술비(${v.g5}종)`, s: v.n5, v: a5, on: true });

    const a8 = policy.종8[v.g8];
    if (a8 > 0) rows.push({ k: `질병 1~8종 수술비(${v.g8}종)`, s: v.n8, v: a8, on: true });
    else rows.push({ k: `1~8종 분류: ${v.g8}종`, s: '이 상품에 해당 담보 없음', v: 0, on: false });

    if (s.cancer) {
        rows.push({ k: '질병군 수술비', s: '분류표에 악성신생물 미포함 — 해당 없음', v: 0, on: false });
    } else if (s.g111) {
        const key = matchGroupKey(policy, s.g111, v.gwan);
        if (key) rows.push({ k: `질병군 수술비(${key})`, s: v.gwan ? '관혈' : '비관혈',
                             v: policy.군[key], on: true });
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
        if (hi === 0) return '';
        const g5 = [...new Set(s.variants.map(v => v.g5))].sort((a, b) => a - b);
        const g8 = [...new Set(s.variants.map(v => v.g8))].sort((a, b) => a - b);

        const detail = cs.map(({ v, r }) => `
            <div class="sg-v">
              <div class="sg-vh"><span>${v.label}</span><b>${fmt(r.total)}</b></div>
              ${r.rows.map(x => `<div class="sg-r${x.on ? '' : ' off'}">
                  <span>${x.k}<em>${x.s}</em></span><b>${x.on ? fmt(x.v) : '—'}</b></div>`).join('')}
              <div class="sg-src">1~8종 ${v.c8} ${v.g8}종 「${v.n8}」 · 1~5종 ${v.n5no}항 ${v.g5}종</div>
            </div>`).join('');

        return `<div class="sg-row" data-open="false">
            <button class="sg-btn" aria-expanded="false">
              <span class="sg-l">
                <span class="sg-name">${s.name}</span>
                <span class="sg-tags">
                  ${policy.입원 || policy.통원 ? '<span class="sg-chip sg-base">질수</span>' : ''}
                  ${g5.map(grade).join('')}
                  <span class="sg-chip sg-cls">1~8종 ${g8.join('·')}종</span>
                  ${s.cancer ? '<span class="sg-chip sg-cancer">암</span>' : ''}
                  ${s.benign ? '<span class="sg-chip sg-etc">양성신생물</span>' : ''}
                  ${s.special ? `<span class="sg-chip sg-etc">${s.special}</span>` : ''}
                </span>
              </span>
              <span class="sg-money"><b>${lo === hi ? fmt(lo) : fmt(lo) + '~' + fmt(hi)}</b>
                <em>검토 가능${s.variants.length > 1 ? ` · 술기 ${s.variants.length}가지` : ''}</em></span>
            </button>
            <div class="sg-d">${detail}
              ${s.note ? `<div class="sg-note"><b>확인 포인트</b>${s.note}</div>` : ''}
            </div></div>`;
    }).filter(Boolean).join('');

    host.innerHTML = `
      <div class="sg-head">
        <h3>수술비 검토</h3>
        <p>가입한 수술비 담보 기준으로 각 수술에서 검토 가능한 금액입니다.</p>
      </div>
      <div class="sg-list">${cards}</div>
      <div class="sg-disc"><b>반드시 확인해 주세요</b>
        <ol>
          <li>표시 금액은 <strong>가입금액 기준 검토 가능한 최대 범위</strong>이며 지급을 확정하는 값이 아닙니다. 보상 여부는 <strong>청구 시 제출된 정확한 수술행위</strong>와 약관에 따라 결정됩니다.</li>
          <li>같은 수술도 <strong>개복·복강경·내시경, 림프절절제 동반 여부, 병원 등급</strong>에 따라 수술 종류(종)와 금액이 달라집니다.</li>
          <li><strong>1~5종 수술비는 두 종류 이상 수술을 받아도 가장 높은 가입금액 한 종류만</strong> 지급됩니다. 낮은 금액을 먼저 지급한 경우 차액만 지급됩니다.</li>
          <li><strong>질병 입원 수술비와 통원 수술비는 배타적</strong>이며, 본 화면은 둘 중 큰 금액 하나만 반영했습니다.</li>
          <li>동일 질병으로 두 종류 이상 또는 같은 종류의 수술을 2회 이상 받은 경우 <strong>1회에 한하여</strong> 지급되며, 일부 담보는 <strong>수술개시일부터 60일 이내 2회 이상을 1회로 간주</strong>합니다.</li>
          <li><strong>미용·성형 목적, 피임 목적의 수술은 면책</strong>입니다. 1~5종 수술비는 다수 항목이 <strong>「근본수술」·「근치수술」</strong>을 요건으로 합니다.</li>
          <li><strong>111대·115대·119대 질병 수술비 분류표에는 악성신생물(암)이 없습니다.</strong> 양성신생물은 포함됩니다.</li>
          <li>양성신생물 수술비 등 일부 담보는 <strong>가입 후 1년 이내 감액 지급</strong>됩니다.</li>
        </ol>
      </div>`;

    host.addEventListener('click', e => {
        const b = e.target.closest('.sg-btn');
        if (!b) return;
        const row = b.closest('.sg-row');
        const open = row.dataset.open === 'true';
        row.dataset.open = String(!open);
        b.setAttribute('aria-expanded', String(!open));
    });
    return true;
}

// 암 ↔ 수술비 토글. 수술비 담보가 감지된 경우에만 토글 자체를 노출한다.
function setupSurgeryToggle(results, insurer) {
    const wrap = document.getElementById('surgery-toggle');
    const panel = document.getElementById('surgery-panel');
    const grid = document.getElementById('summary-grid');
    if (!wrap || !panel || !grid) return;

    const count = (results || []).filter(r => r && r.kind === 'surgery').length;
    if (insurer !== 'samsung' || count === 0 || !renderSurgeryPanel(results)) {
        wrap.classList.add('hidden');
        panel.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <button type="button" data-v="cancer" aria-selected="true">암 보장</button>
      <button type="button" data-v="surgery" aria-selected="false">수술비 <span class="sg-badge">${count}</span></button>`;
    wrap.onclick = e => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        const surgery = b.dataset.v === 'surgery';
        wrap.querySelectorAll('button[data-v]').forEach(x =>
            x.setAttribute('aria-selected', String((x.dataset.v === 'surgery') === surgery)));
        panel.classList.toggle('hidden', !surgery);
        grid.classList.toggle('hidden', surgery);
        const other = document.getElementById('other-panel-container');
        if (other) other.classList.toggle('hidden', surgery);
        const header = document.getElementById('result-header');
        if (header) header.textContent = surgery ? '수술비 한눈에 보기' : '보장 내역 한눈에 보기';
    };
}
