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
const DICT_SYNONYM = {
    '백내장': ['수정체'],
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
    '편도절제술': ['편도'],
    '유방수술': ['유방'],
    '유방암수술': ['유방'],
    '전립선수술': ['전립선'],
    // '위절제'는 쓰지 않는다 — "광범위절제술"(범위+절제) 안에 우연히 끼어들어
    // 위암과 무관한 골종양 항목이 1위로 뜨는 사고가 났다(실측). 더 긴 정식
    // 명칭을 쓰면 이런 우연한 끼임이 생기지 않는다.
    '위암수술': ['위전절제', '위아전절제'],
    '대장암수술': ['결장'],
    '폐암수술': ['폐 수술'],
    '간암수술': ['간 절제술'],
    '갑상선암수술': ['갑상선']
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
            <p>둘 중 하나예요 — ① 수술명이 약관 용어로 적혀 있어서일 수 있어요.
               예를 들어 백내장은 <em>수정체</em>, 대장용종은 <em>결장경</em>으로 검색해 보세요.
               수가코드(예: <em>Q7701</em>)도 바로 찾을 수 있습니다.<br><br>
               ② 이 검색 결과가 없다면 <strong>절단·절제 등을 동반하는 수술로 분류되지 않는
               질환</strong>일 가능성이 높아요. 감기·고혈압·당뇨병처럼 약물로 치료하는
               질환은 애초에 1~8종 수술비 대상이 아닙니다.</p>
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
