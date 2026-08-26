// ── 수술비 백과사전 ──
// 질병명·수술명·수가코드로 검색하면 1~8종 분류(ADRG)와 종을 찾아준다.
// 데이터: surgery_dict_data.js (옵시디언 KDRG 위키에서 생성)
//
// 검색이 어려운 이유: 고객이 쓰는 말과 약관 용어가 다르다.
//   "백내장" → 약관은 "수정체", "대장용종" → 약관은 "결장경 … 폴립 절제술"
// 그래서 동의어 사전을 한 겹 두고, 관련율로 순위를 매긴다.
const DICT_SYNONYM = {
    '백내장': ['수정체'],
    '대장용종': ['결장경', '폴립'],
    '위용종': ['위내시경', '폴립'],
    '용종': ['폴립'],
    '디스크': ['추간판'],
    '허리디스크': ['추간판'],
    '목디스크': ['추간판', '경추'],
    '맹장': ['충수'],
    '담석': ['담낭'],
    '치질': ['치핵'],
    '축농증': ['부비동'],
    '탈장': ['헤르니아'],
    '오십견': ['견관절', '유착'],
    '자궁근종': ['자궁', '근종'],
    '갑상선혹': ['갑상선'],
    '결절': ['종양'],
    '스텐트': ['스텐트', '삽입'],
    '제왕절개': ['제왕'],
    '인공관절': ['인공관절', '치환'],
    '무릎': ['슬관절', '반월상'],
    '어깨': ['견관절', '회전근개'],
    '요로결석': ['체외충격파', '요관'],
    '전립선비대': ['전립선'],
    '맘모톰': ['유방', '진공'],
    '하지정맥류': ['정맥류'],
    '심근경색': ['관상동맥'],
    '뇌경색': ['뇌혈관', '혈전'],
    '뇌출혈': ['두개내', '혈종']
};

// 검색어를 약관 용어까지 넓힌다. ['대장용종'] → ['대장용종','결장경','폴립']
function dictExpand(q) {
    const raw = q.trim().replace(/\s+/g, ' ');
    const out = [raw];
    Object.keys(DICT_SYNONYM).forEach(k => {
        if (raw.includes(k)) DICT_SYNONYM[k].forEach(s => out.push(s));
    });
    // 붙여 쓴 복합어를 쪼갠다 — "대장용종" → "대장" + "용종"
    if (raw.length >= 4 && !/\s/.test(raw)) {
        for (let i = 2; i <= raw.length - 2; i++) {
            out.push(raw.slice(0, i), raw.slice(i));
        }
    }
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
    if (hitProc.length) s += 25 + Math.min(15, hitProc.length * 3);
    // 수가코드를 그대로 친 경우
    if (/^[A-Z]{1,2}\d{3,4}$/i.test(terms[0])) {
        const up = terms[0].toUpperCase();
        if (procs.some(p => p[0] === up)) s += 80;
        if (code === up) s += 100;
    }
    return { s, hitProc };
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
    res.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
    const top = res.slice(0, limit);
    const max = top.length ? top[0].score : 1;
    top.forEach(r => { r.rel = Math.max(5, Math.round(r.score / max * 100)); });
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

    const hits = dictSearch(q);
    if (!hits.length) {
        box.innerHTML = `<div class="sd-empty">
            <b>‘${q}’에 해당하는 항목을 찾지 못했어요.</b>
            <p>수술명은 약관 용어로 적혀 있어요. 예를 들어 백내장은 <em>수정체</em>,
               대장용종은 <em>결장경</em>으로 검색해 보세요.
               수가코드(예: <em>Q7701</em>)로도 찾을 수 있습니다.</p>
          </div>`;
        return;
    }
    const policy = dictPolicy();
    box.innerHTML = `
      <div class="sd-count">${hits.length}건 · 관련율 높은 순</div>
      ${hits.map(h => `
        <div class="sd-card">
          <div class="sd-top">
            <span class="sd-rel" style="--w:${h.rel}%"><i></i><b>${h.rel}%</b></span>
            <span class="sd-name">${h.n}</span>
            <span class="sd-tier t${h.tier}">${h.tier}종</span>
          </div>
          <div class="sd-sub">${h.g} · <code>${h.code}</code></div>
          ${h.procs.length ? `<ul class="sd-procs">${h.procs.slice(0, 5).map(p =>
              `<li><code>${p[0]}</code> ${p[1]}</li>`).join('')}</ul>` : ''}
          ${dictAmountHtml(h.tier, policy)}
        </div>`).join('')}
      <p class="sd-disc">KDRG v4.6 기준으로 정리한 <strong>참조용</strong> 자료입니다.
        약관은 가입 시점의 KDRG 버전을 적용하며, 실제 지급은 진단명·수술행위·급여 여부에 따라 결정됩니다.
        1~8종 수술비는 <strong>급여항목이 발생한 경우</strong>에만 대상이 됩니다.</p>`;
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
          <span>‘대장용종’ 검색 — 결장경 시술(1종)과 폴립 절제술 수가코드가 함께 나옵니다.</span>
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
