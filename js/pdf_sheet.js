// ─────────────────────────────────────────────────────────────
// PDF 전용 지면
//
// 화면을 찍어 A4에 욱여넣으면 본문이 4.6pt로 눌린다(약관 깨알글씨가 8pt).
// 화면 레이아웃은 1280px 폭을 전제로 짜여 있는데 A4 본문은 188mm이라,
// 1px이 0.147mm로 줄어들기 때문이다. 폭을 좁히면 글자는 커지지만 한 장에
// 담기는 양도 같이 줄어 결국 넘친다.
//
// 그래서 인쇄는 화면과 따로 그린다. A4 실제 치수(210×297mm)를 1240×1754px
// 좌표계로 두고, 활자를 pt로 지정한다. 1mm = 5.905px, 10pt = 20.8px.
// 이 파일이 만드는 것은 화면에 붙지 않는다 — 오프스크린에서 그려 캡처만 한다.
// ─────────────────────────────────────────────────────────────

const SHEET_W = 1240;
const SHEET_H = Math.round(SHEET_W * 297 / 210);   // 1754
const MM = SHEET_W / 210;                          // 5.905 px/mm
const PT = 0.3528 * MM;                            // 2.083 px/pt
const px = pt => (pt * PT).toFixed(1) + 'px';
const mm = v => (v * MM).toFixed(1) + 'px';

const SHEET_COLOR = {
    blue: '#003CDC', cyan: '#00B0E0',
    ink: '#0F1626', ink2: '#4B5768', muted: '#8D97A8',
    rule: '#E4E8F0', rule2: '#F0F3F8', wash: '#F7F9FD',
    gold: '#A8874B', goldSoft: '#FAF6EE',
    cancer: '#D64535', cancerSoft: '#FDF2F0',
    surgery: '#0E8C93', surgerySoft: '#EDF8F8',
    brain: '#2D6FB8', brainSoft: '#EFF5FC',
    heart: '#C2436B', heartSoft: '#FCF0F4'
};

function sheetCss() {
    const C = SHEET_COLOR;
    return `
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    .sheet{width:${SHEET_W}px;height:${SHEET_H}px;background:#fff;color:${C.ink};
      font-family:'Noto Sans KR','Plus Jakarta Sans',sans-serif;
      display:flex;flex-direction:column;overflow:hidden;position:relative}
    .num{font-family:'Plus Jakarta Sans','Outfit',sans-serif;font-variant-numeric:tabular-nums}

    .hd{height:${mm(16)};flex:none;background:${C.blue};color:#fff;
      display:flex;align-items:center;justify-content:space-between;padding:0 ${mm(14)}}
    .hd .mark{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(8.5)};
      font-weight:800;letter-spacing:.2em}
    .hd .who{font-size:${px(8)};font-weight:500;opacity:.8}

    .top{padding:${mm(11)} ${mm(14)} 0;flex:none;display:flex;
      align-items:flex-end;justify-content:space-between;gap:${mm(8)}}
    h2{font-size:${px(19)};font-weight:800;letter-spacing:-.04em;line-height:1.18}
    h2 span{color:var(--ac)}
    .kind{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(8)};font-weight:700;
      letter-spacing:.16em;color:${C.muted};text-transform:uppercase;padding-bottom:${mm(1.5)}}

    .body{padding:${mm(7)} ${mm(14)} 0;flex:1 1 auto;min-height:0;
      display:flex;flex-direction:column;gap:${mm(6)}}
    h3{font-size:${px(10.5)};font-weight:700;letter-spacing:-.02em;
      display:flex;align-items:center;gap:${mm(2.5)};margin-bottom:${mm(3)}}
    h3::before{content:"";width:${mm(1.4)};height:${mm(1.4)};border-radius:50%;
      background:var(--ac);flex:none}
    h3 .hint{font-size:${px(7.5)};font-weight:400;color:${C.muted};margin-left:auto;letter-spacing:0}

    .meta{margin:${mm(6)} ${mm(14)} 0;border-radius:${mm(3.6)};background:${C.wash};
      display:flex;overflow:hidden;border:1px solid ${C.rule}}
    .meta .m{padding:${mm(3.2)} ${mm(5)};flex:1}
    .meta .m + .m{border-left:1px solid ${C.rule}}
    .meta .fee{background:${C.blue};color:#fff;flex:none;min-width:${mm(52)};
      text-align:right;border-left:0}
    .meta .k{font-size:${px(7)};font-weight:600;color:${C.muted};
      letter-spacing:.06em;margin-bottom:${mm(1.2)}}
    .meta .fee .k{color:rgba(255,255,255,.66)}
    .meta .v{font-size:${px(9.5)};font-weight:600;line-height:1.35}
    .meta .fee .v{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(15)};
      font-weight:800;letter-spacing:-.04em;color:#fff}
    .meta .fee .v small{font-size:${px(9)};font-weight:600;opacity:.82}

    .cov{margin:${mm(7)} ${mm(14)} 0;padding:${mm(4)} ${mm(5)} ${mm(3.4)};
      border-radius:${mm(3.6)};background:${C.wash};border:1px solid ${C.rule}}
    .cov-hd{display:flex;align-items:baseline;gap:${mm(3)};margin-bottom:${mm(3)}}
    .cov-hd .t{font-size:${px(9)};font-weight:700;letter-spacing:-.02em}
    .cov-hd .n{font-size:${px(7)};font-weight:600;color:${C.muted};margin-left:auto}
    .cov ul{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
      gap:${mm(1.2)} ${mm(6)}}
    .cov li{display:flex;align-items:baseline;justify-content:space-between;gap:${mm(2)};
      font-size:${px(7.5)};color:${C.ink2};padding:${mm(0.9)} 0;border-bottom:1px dotted ${C.rule}}
    .cov li b{flex:none;font-weight:800;color:${C.ink};letter-spacing:-.03em}
    .cov li.off,.cov li.off b{color:${C.muted}}

    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${mm(3.4)}}
    .cards.c4{grid-template-columns:repeat(4,minmax(0,1fr));gap:${mm(3.2)}}
    .card{border-radius:${mm(3.6)};padding:${mm(4.2)} ${mm(4.5)} ${mm(3.8)};
      background:#fff;border:1px solid ${C.rule};display:flex;flex-direction:column;
      box-shadow:0 1px 2px rgba(15,22,38,.04),0 4px 10px rgba(15,22,38,.05)}
    .card.lead{background:var(--acs);border-color:transparent}
    .card.off{background:${C.wash};border-style:dashed;box-shadow:none}
    .card .chd{display:flex;align-items:flex-start;justify-content:space-between;gap:${mm(2)}}
    .card .ico{width:${mm(13)};height:${mm(13)};object-fit:contain;margin:${mm(-1)} 0 ${mm(1.5)} ${mm(-1.2)}}
    .card .v{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(13)};font-weight:800;
      letter-spacing:-.045em;line-height:1.02;color:var(--ac);font-variant-numeric:tabular-nums}
    .card.off .v{color:${C.muted};font-weight:700}
    .card .nm{font-size:${px(8)};font-weight:600;line-height:1.35;margin-top:${mm(1.4)};
      letter-spacing:-.015em}
    .card .sub{font-size:${px(6.5)};color:${C.muted};margin-top:${mm(1)};line-height:1.5}

    .cyc{display:inline-block;font-size:${px(6)};font-weight:700;
      padding:${mm(0.6)} ${mm(1.8)};border-radius:999px;margin-bottom:${mm(1.6)};
      background:${C.rule2};color:${C.ink2};white-space:nowrap}
    .cyc.ev{background:${C.gold};color:#fff}
    .cyc.yr{background:var(--ac);color:#fff}
    .cyc.on{background:transparent;color:${C.muted};box-shadow:inset 0 0 0 1px ${C.rule}}
    .cyc.mix{background:${C.ink};color:#fff}

    .src{margin-top:${mm(2)};padding-top:${mm(2)};border-top:1px solid ${C.rule2};
      font-size:${px(7)};line-height:1.5;color:${C.ink2}}
    .src .row{display:flex;align-items:baseline;gap:${mm(2)};padding:${mm(0.7)} 0}
    .src .row + .row{border-top:1px dotted ${C.rule2}}
    .src .n2{flex:1;min-width:0;overflow:hidden;white-space:nowrap}
    .src .a2{flex:none;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;
      color:${C.ink};letter-spacing:-.02em;white-space:nowrap}
    .src .c2{flex:none;font-size:${px(6)};font-weight:700;color:${C.muted};
      min-width:${mm(9)};text-align:right}

    table{width:100%;border-collapse:separate;border-spacing:0;font-size:${px(8.5)};
      border:1px solid ${C.rule};border-radius:${mm(3.6)};overflow:hidden}
    th{background:${C.wash};font-size:${px(7.5)};font-weight:600;color:${C.ink2};
      padding:${mm(2.2)} ${mm(3)};text-align:center;border-bottom:1px solid ${C.rule}}
    th + th{border-left:1px solid ${C.rule}}
    th span{display:block;font-weight:400;font-size:${px(6.5)};color:${C.muted}}
    td{padding:${mm(2.2)} ${mm(3)};text-align:right;border-bottom:1px solid ${C.rule2};
      font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:${C.ink};
      letter-spacing:-.02em;white-space:nowrap;font-variant-numeric:tabular-nums}
    td + td{border-left:1px solid ${C.rule2}}
    tr:last-child td{border-bottom:0}
    td.lbl{text-align:left;font-family:'Noto Sans KR',sans-serif;font-weight:600;
      color:${C.ink2};background:${C.wash};font-size:${px(8)};letter-spacing:-.01em}
    td.z{color:${C.muted};font-weight:500}
    td small{display:block;font-size:${px(6.5)};color:${C.muted};font-weight:400;
      margin-top:${mm(0.5)};letter-spacing:0}

    .span{display:flex;align-items:center;gap:${mm(4)};padding:${mm(3.2)} ${mm(5)};
      border-radius:${mm(3.6)};background:${C.goldSoft};
      border:1px solid rgba(168,135,75,.28);margin-bottom:${mm(3)}}
    .span .path{flex:1;display:flex;align-items:center;gap:${mm(2.5)};flex-wrap:wrap}
    .span .st{font-size:${px(8)};font-weight:700;color:${C.gold};white-space:nowrap}
    .span .sep{color:${C.gold};opacity:.45;font-size:${px(7)}}
    .span .tail{font-size:${px(7.5)};color:${C.ink2};margin-left:${mm(2)}}
    .span .hosp{font-size:${px(8)};font-weight:700;white-space:nowrap;
      padding-left:${mm(4)};border-left:1px solid rgba(168,135,75,.3)}
    .span .hosp em{font-style:normal;color:${C.gold}}

    .pair{display:grid;grid-template-columns:1fr 1fr;gap:${mm(3.2)}}
    .col{border-radius:${mm(3.6)};overflow:hidden;border:1px solid ${C.rule}}
    .col .ch{padding:${mm(3)} ${mm(4.5)};display:flex;align-items:baseline;
      justify-content:space-between;gap:${mm(2)}}
    .col.b .ch{background:${C.brainSoft}}
    .col.h .ch{background:${C.heartSoft}}
    .col.b .ch .t{color:${C.brain}}
    .col.h .ch .t{color:${C.heart}}
    .col .ch .t{font-size:${px(8.5)};font-weight:700;letter-spacing:-.015em}
    .col .ch .v{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(12.5)};
      font-weight:800;letter-spacing:-.045em;font-variant-numeric:tabular-nums}
    .col ul{list-style:none;padding:${mm(3)} ${mm(4.5)} ${mm(3.5)};
      font-size:${px(8.5)};color:${C.ink2};line-height:2}
    .col li{display:flex;justify-content:space-between;gap:${mm(2)};
      border-bottom:1px solid ${C.rule2};padding:${mm(0.8)} 0}
    .col li:last-child{border-bottom:0}
    .col li b{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;color:${C.ink};
      letter-spacing:-.02em}
    .col li em{font-style:normal;color:${C.muted};font-size:${px(7)}}
    .col li.off,.col li.off b{color:${C.muted};font-weight:500}

    .mini{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:${mm(2.2)}}
    .mini .m{border:1px solid ${C.rule};border-radius:${mm(2.6)};
      padding:${mm(2.4)} ${mm(3)};display:flex;justify-content:space-between;
      align-items:baseline;gap:${mm(2)}}
    .mini .n3{flex:1;min-width:0;overflow:hidden;white-space:nowrap;
      font-size:${px(7)};color:${C.ink2}}
    .mini .a3{flex:none;font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(8.5)};
      font-weight:800;letter-spacing:-.035em;white-space:nowrap}

    .case{border-radius:${mm(5)};overflow:hidden;border:1px solid ${C.rule}}
    .case .ch{padding:${mm(2.8)} ${mm(5)};font-size:${px(8.5)};font-weight:700;
      color:#fff;background:var(--ac);display:flex;justify-content:space-between;
      align-items:baseline;gap:${mm(3)};letter-spacing:-.015em}
    .case .ch em{font-style:normal;font-size:${px(7)};font-weight:400;color:rgba(255,255,255,.82)}
    .flow{display:flex;align-items:stretch;padding:${mm(4)} ${mm(5)};background:var(--acs)}
    .flow .step{flex:1;text-align:center;padding:0 ${mm(1)}}
    .flow .step .s{font-size:${px(7)};font-weight:600;color:${C.ink2};margin-bottom:${mm(1.4)}}
    .flow .step .a{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(11.5)};
      font-weight:800;letter-spacing:-.045em;font-variant-numeric:tabular-nums}
    .flow .step .d{font-size:${px(6.5)};color:${C.muted};margin-top:${mm(1)};line-height:1.4}
    .flow .arw{flex:none;width:${mm(5)};display:flex;align-items:center;justify-content:center;
      color:var(--ac);font-size:${px(9)};font-weight:700;padding-bottom:${mm(3.5)};opacity:.45}
    .flow .sum{flex:none;padding-left:${mm(5)};margin-left:${mm(3)};text-align:right;
      display:flex;flex-direction:column;justify-content:center;min-width:${mm(32)};
      border-left:2px solid var(--ac)}
    .flow .sum .s{font-size:${px(7)};font-weight:700;color:var(--ac);margin-bottom:${mm(1.2)}}
    .flow .sum .a{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(16)};
      font-weight:800;letter-spacing:-.05em;color:var(--ac);font-variant-numeric:tabular-nums}

    .ft{flex:none;margin:0 ${mm(14)};padding:${mm(3.5)} 0 ${mm(9)};
      border-top:1px solid ${C.rule};display:flex;justify-content:space-between;
      align-items:center;gap:${mm(6)}}
    .ft .src2{font-size:${px(7)};color:${C.muted}}
    .pg{font-family:'Plus Jakarta Sans',sans-serif;font-size:${px(8)};font-weight:700;
      color:${C.muted};flex:none;font-variant-numeric:tabular-nums}
    .pg b{color:${C.blue}}
  `;
}

// ── 지면 한 장을 캡처한다 ──
// 화면에 붙이지 않는다. 왼쪽 밖에 세워 두고 찍은 뒤 바로 걷어낸다.
async function renderSheetCanvas(innerHtml, accent, accentSoft) {
    const host = document.createElement('div');
    host.setAttribute('style',
        `position:fixed;left:-99999px;top:0;width:${SHEET_W}px;height:${SHEET_H}px;` +
        'z-index:-1;pointer-events:none');
    host.innerHTML =
        `<style>${sheetCss()}</style>` +
        `<div class="sheet" style="--ac:${accent};--acs:${accentSoft}">${innerHtml}</div>`;
    document.body.appendChild(host);
    try {
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return await html2canvas(host.querySelector('.sheet'), {
            scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
            width: SHEET_W, height: SHEET_H, windowWidth: SHEET_W, windowHeight: SHEET_H
        });
    } finally {
        host.remove();
    }
}

function sheetHead(who) {
    return `<div class="hd"><span class="mark">SURINSUR</span>` +
           `<span class="who">스마트가입제안서${who ? ' · ' + who : ''}</span></div>`;
}

function sheetTop(title, accentWord, kind) {
    return `<div class="top"><h2>${title} <span>${accentWord}</span></h2>` +
           `<span class="kind">${kind}</span></div>`;
}

function sheetFoot(note, no, total) {
    return `<div class="ft"><span class="src2">${note}</span>` +
           `<span class="pg"><b>${String(no).padStart(2, '0')}</b> / ${String(total).padStart(2, '0')}</span></div>`;
}

// ── 공통 조각 ──
const sFmt = n => (typeof formatKoAmount === 'function' ? formatKoAmount(n) : String(n));
const sClip = (t, n) => (typeof clipName === 'function' ? clipName(t, n)
    : String(t || '').slice(0, n));

function covBlock(list, label) {
    if (!list || !list.length) return '';
    const li = list.slice(0, 15).map(x =>
        `<li class="${x.v ? '' : 'off'}"><span>${sClip(x.nm, 24)}</span>` +
        `<b>${x.v ? sFmt(x.v) : '미가입'}</b></li>`).join('');
    return `<div class="cov">
      <div class="cov-hd"><span class="t">가입한 담보 쉽게보기</span>
        <span class="n">${label} ${list.length}개</span></div>
      <ul>${li}</ul></div>`;
}

function cardBlock(c) {
    const rows = (c.rows || []).filter(r => r.v > 0).slice(0, 3).map(r =>
        `<div class="row"><span class="n2">${sClip(r.n, 14)}</span>` +
        `<span class="a2">${sFmt(r.v)}</span>` +
        `<span class="c2">${r.c || ''}</span></div>`).join('');
    return `<div class="card${c.lead ? ' lead' : ''}${c.v > 0 ? '' : ' off'}">
      <div class="chd">${c.icon ? `<img class="ico" src="${c.icon}" alt="">` : '<span></span>'}
        ${c.cyc ? `<span class="cyc ${c.cycCls || 'yr'}">${c.cyc}</span>` : ''}</div>
      <div class="v">${c.v > 0 ? sFmt(c.v) : '0원'}</div>
      <div class="nm">${sClip(c.nm, 16)}</div>
      ${rows ? `<div class="src">${rows}</div>` : (c.sub ? `<div class="sub">${c.sub}</div>` : '')}
    </div>`;
}

function caseBlock(title, desc, steps, accent) {
    if (!steps || steps.length < 2) return '';
    const tot = steps.reduce((n, x) => n + x.a, 0);
    return `<div class="case"${accent ? ` style="--ac:${accent.c};--acs:${accent.s}"` : ''}>
      <div class="ch"><span>${title}</span><em>${desc}</em></div>
      <div class="flow">
        ${steps.map((x, i) => (i ? '<div class="arw">→</div>' : '') +
          `<div class="step"><div class="s">${x.s}</div>` +
          `<div class="a">${sFmt(x.a)}</div><div class="d">${x.d || ''}</div></div>`).join('')}
        <div class="sum"><div class="s">합계</div><div class="a">${sFmt(tot)}</div></div>
      </div></div>`;
}

// ── 02 한장요약 ──
function sheetSummary(d) {
    const row = (lbl, cells) =>
        `<tr><td class="lbl">${lbl}</td>${cells.map(c =>
            `<td class="${c.v ? '' : 'z'}">${c.v ? sFmt(c.v) : '0원'}` +
            `${c.s ? `<small>${c.s}</small>` : ''}</td>`).join('')}</tr>`;
    const s = d.summary;
    return sheetHead(d.who) + sheetTop('삼성화재', '한장요약', 'Summary') +
    `<div class="meta">
       <div class="m"><div class="k">상품</div><div class="v">${sClip(d.product, 22)}</div></div>
       <div class="m"><div class="k">피보험자</div><div class="v">${d.person || '—'}</div></div>
       <div class="m"><div class="k">분석 담보</div><div class="v">${d.total}개</div></div>
       <div class="m fee"><div class="k">월 보험료</div>
         <div class="v">${d.premium ? d.premium.toLocaleString('ko-KR') : '—'}<small>원</small></div></div>
     </div>
     <div class="body" style="gap:${mm(4.5)}">
       <div><h3>암 보장<span class="hint">진단부터 치료까지</span></h3>
         <table><tr><th style="width:20%"></th><th>진단<span>최초 1회</span></th>
           <th>수술<span>매회</span></th><th>항암약물<span>연간 1회</span></th>
           <th>항암방사선<span>연간 1회</span></th></tr>
           ${row('암 보장', [{ v: s.cancerDx }, { v: s.cancerSx }, { v: s.cancerDrug }, { v: s.cancerRad }])}
         </table></div>
       <div><h3>뇌 · 심장 보장<span class="hint">범위가 넓은 담보 기준</span></h3>
         <table><tr><th style="width:20%"></th><th>진단</th><th>치료 · 수술</th>
           <th>중환자실</th><th>재활</th></tr>
           ${row('뇌 계열', [{ v: s.brainDx }, { v: s.circTreat }, { v: s.icu }, { v: s.rehab }])}
           ${row('심장 계열', [{ v: s.heartDx }, { v: s.circTreat }, { v: s.icu }, { v: s.rehab }])}
         </table></div>
       ${d.etc && d.etc.length ? `<div><h3>입원 · 기타<span class="hint">그 밖에 가입한 담보</span></h3>
         <table><tr>${d.etc.slice(0,5).map(x => `<th>${sClip(x.nm, 10)}</th>`).join('')}</tr>
           <tr>${d.etc.slice(0,5).map(x => `<td>${sFmt(x.v)}</td>`).join('')}</tr></table></div>` : ''}
       <div><h3>다빈도 수술<span class="hint">담보가 겹쳐 지급되는 합계</span></h3>
         <table><tr>${(d.topSurg || []).slice(0, 6).map(x =>
             `<th>${sClip(x.nm, 9)}</th>`).join('')}</tr>
           <tr>${(d.topSurg || []).slice(0, 6).map(x =>
             `<td>${sFmt(x.v)}${x.g ? `<small>${x.g}</small>` : ''}</td>`).join('')}</tr>
         </table></div>
     </div>` +
    sheetFoot('삼성화재 가입제안서 기준 · 0원은 미가입', 2, 5);
}

// ── 03 암 ──
function sheetCancer(d) {
    return sheetHead(d.who) + sheetTop('삼성화재', '암 치료비', 'Cancer') +
        covBlock(d.cancerCov, '암 관련') +
        `<div class="body">
           <div><h3>치료비<span class="hint">어느 담보에서 얼마가 나오는지</span></h3>
             <div class="cards">${(d.cancerCards || []).slice(0, 6).map(cardBlock).join('')}</div></div>
           ${caseBlock('사례로 보는 보장', d.cancerCaseDesc, d.cancerCase)}
         </div>` +
        sheetFoot('삼성화재 가입제안서 기준 · 0원은 미가입', 3, 5);
}

// ── 04 수술비 ──
function sheetSurgery(d) {
    const mini = (d.miniSurg || []).slice(0, 12).map(x =>
        `<div class="m"><span class="n3">${sClip(x.nm, 11)}</span>` +
        `<span class="a3">${sFmt(x.v)}</span></div>`).join('');
    return sheetHead(d.who) + sheetTop('삼성화재', '수술비', 'Surgery') +
        covBlock(d.surgCov, '수술비') +
        `<div class="body">
           <div><h3>다빈도 수술<span class="hint">어느 담보에서 얼마가 나오는지</span></h3>
             <div class="cards">${(d.surgCards || []).slice(0, 6).map(cardBlock).join('')}</div></div>
           ${mini ? `<div><h3>그 밖의 수술<span class="hint">가입금액 기준 검토 가능액</span></h3>
             <div class="mini">${mini}</div></div>` : ''}
         </div>` +
        sheetFoot('삼성화재 가입제안서 기준 · 종 구분은 별표16 · 별표17', 4, 5);
}

// ── 05 뇌·심장 ──
function sheetCirc(d) {
    const col = (cls, label, list) => {
        const tot = list.reduce((n, x) => n + x.v, 0);
        return `<div class="col ${cls}">
          <div class="ch"><span class="t">${label}</span>
            <span class="v">${tot ? sFmt(tot) : '미가입'}</span></div>
          <ul>${list.map(x => `<li class="${x.v ? '' : 'off'}"><span>${sClip(x.nm, 14)}` +
            `${x.kcd ? ` <em>${x.kcd}</em>` : ''}</span>` +
            `<b>${x.v ? sFmt(x.v) : '미가입'}</b></li>`).join('')}</ul></div>`;
    };
    return sheetHead(d.who) + sheetTop('삼성화재', '뇌·심장 보장', 'Cerebro · Cardio') +
        covBlock(d.circCov, '뇌·심장') +
        `<div class="body">
           ${d.hasTong ? `<div class="span">
             <div class="path">
               <span class="st">검사</span><span class="sep">▸</span>
               <span class="st">약물</span><span class="sep">▸</span>
               <span class="st">치료</span><span class="sep">▸</span>
               <span class="st">수술</span><span class="sep">▸</span>
               <span class="st">재활</span><span class="tail">전 과정을 한 담보로</span>
             </div>
             <div class="hosp"><em>모든 종합병원</em>에서 보장</div>
           </div>` : ''}
           <div><h3>진단비<span class="hint">범위가 넓은 담보부터</span></h3>
             <div class="pair">${col('b', '뇌 계열', d.brainDx || [])}
               ${col('h', '심장 계열', d.heartDx || [])}</div></div>
           <div><h3>치료비<span class="hint">어느 담보에서 얼마가 나오는지</span></h3>
             <div class="cards">${(d.circCards || []).slice(0, 6).map(cardBlock).join('')}</div></div>
           ${caseBlock('사례로 보는 보장', d.circCaseDesc, d.circCase,
               { c: SHEET_COLOR.heart, s: SHEET_COLOR.heartSoft })}
         </div>` +
        sheetFoot('삼성화재 가입제안서 기준', 5, 5);
}

// ── 지면에 쓸 값을 한곳에서 모은다 ──
// 화면 렌더러들이 이미 계산해 둔 것을 그대로 쓴다. 같은 숫자를 두 번 구하면
// 화면과 인쇄가 어긋나기 시작한다.
function buildSheetData(results, meta, customerName) {
    const R = results || [];
    const M = meta || {};
    const val = r => (r ? parseKoAmount(r.amount) : 0);
    const findAll = re => R.filter(r => r && re.test((r.name || '').replace(/\s+/g, '')));
    const sum = re => findAll(re).reduce((n, r) => n + val(r), 0);

    const d = {
        who: customerName && customerName !== '고객' ? customerName + '님' : '',
        product: M.productName || '',
        person: [M.age ? M.age + '세' : '', M.gender || '', M.job || ''].filter(Boolean).join(' · '),
        premium: M.premium || 0,
        total: R.length
    };

    // ── 암 ──
    const sm = (typeof calculateHierarchicalSummarySamsung === 'function')
        ? calculateHierarchicalSummarySamsung(R) : new Map();
    const CYC = { '최초1회': ['최초 1회', 'on'], '연간1회': ['연간 1회', 'yr'],
                  '매회': ['매회', 'ev'], '일당': ['1일당', ''] };
    const ORDER = ['최초1회', '연간1회', '매회', '일당'];
    const usedSrc = new Map();
    d.cancerCards = [...sm.entries()].map(([nm, g]) => {
        const bySrc = new Map();
        const cyc = {};
        (g.items || []).forEach(it => {
            const s = (it.source || '').trim();
            if (s) {
                if (!bySrc.has(s)) bySrc.set(s, { v: 0, c: it.cycle || '' });
                bySrc.get(s).v += parseKoAmount(it.amount);
                if (!usedSrc.has(s)) usedSrc.set(s, 0);
                usedSrc.set(s, usedSrc.get(s) + parseKoAmount(it.amount));
            }
            if (it.cycle) cyc[it.cycle] = (cyc[it.cycle] || 0) + parseKoAmount(it.amount);
        });
        const keys = ORDER.filter(k => cyc[k] > 0);
        return {
            nm, v: g.totalMin || 0,
            icon: (typeof getSheetIcon === 'function') ? getSheetIcon(nm) : '',
            cyc: keys.length === 1 ? CYC[keys[0]][0]
               : keys.length > 1 ? keys.map(k => k.replace(/1회|간/g, '')).join('+') : '',
            cycCls: keys.length === 1 ? CYC[keys[0]][1] : (keys.length > 1 ? 'mix' : 'yr'),
            rows: [...bySrc.entries()].map(([n, o]) =>
                ({ n, v: o.v, c: o.c ? CYC[o.c][0].replace(' 1회', '') : '' }))
        };
    }).sort((a, b) => b.v - a.v);
    d.cancerCov = [...usedSrc.entries()].map(([nm, v]) => ({ nm, v }));

    const dxSum = R.filter(r => r && /진단비/.test(r.name || '') &&
        !/뇌|심장|순환계|허혈|부정맥|치매|간병|납입|상해|골절|화상/.test(r.name || ''))
        .reduce((n, r) => n + val(r), 0);
    // 칸마다 이름으로 고른다. 금액순 1위를 '수술'로 쓰면 표적항암이 수술 칸에 앉고,
    // 느슨하게 고르면 '다빈치로봇수술비'가 암수술비 자리를 차지한다(실측).
    // 제 이름을 먼저 찾고, 없을 때만 비슷한 것으로 물러선다.
    const pickCard = (exact, loose) =>
        d.cancerCards.find(c => exact.test(c.nm)) ||
        (loose ? d.cancerCards.find(c => loose.test(c.nm)) : null) ||
        { v: 0, nm: '' };
    const topCard = pickCard(/^암\s*수술비/, /수술비/);
    const drug = pickCard(/^항암약물|^표적항암/, /표적|면역|항암약물/);
    const rad = pickCard(/^항암방사선/, /방사선/);
    d.cancerCase = [
        dxSum > 0 && { s: '진단', a: dxSum, d: '진단비 합계' },
        topCard.v > 0 && { s: '수술', a: topCard.v, d: sClip(topCard.nm, 8) },
        drug.v > 0 && { s: '항암약물', a: drug.v, d: '연 1회 한도' }
    ].filter(Boolean);
    d.cancerCaseDesc = '암 진단 후 수술 · 항암치료';

    // ── 수술비 ──
    if (typeof buildSurgeryPolicy === 'function' && typeof SURGERY_DATA !== 'undefined') {
        const sp = buildSurgeryPolicy(R);
        if (sp) {
            d.surgCov = (sp._raw || []).map(r => ({ nm: (r.name || '').trim(), v: val(r) }))
                .filter(x => x.nm).sort((a, b) => b.v - a.v);
            const calc = SURGERY_DATA.map(s => {
                const cs = s.variants.map(v => ({ v, r: calcSurgeryVariant(sp, s, v) }));
                const tot = cs.map(c => c.r.total);
                const hi = Math.max(...tot);
                const g = groupVariantsByAmount(cs)[0];
                return { s, hi, rows: g ? g.rows.filter(x => x.on) : [] };
            }).filter(x => x.hi > 0);
            d.surgCards = calc.filter(x => x.s.hot).sort((a, b) => a.s.hot - b.s.hot)
                .slice(0, 6).map(x => ({
                    nm: x.s.name, v: x.hi, lead: x.s.hot === 1,
                    cyc: '수술 1회', cycCls: 'yr',
                    rows: x.rows.slice(0, 3).map(r => ({ n: r.k, v: r.v }))
                }));
            d.miniSurg = calc.filter(x => !x.s.hot).sort((a, b) => b.hi - a.hi)
                .slice(0, 12).map(x => ({ nm: x.s.name, v: x.hi }));
            d.topSurg = calc.filter(x => x.s.hot).sort((a, b) => a.s.hot - b.s.hot)
                .slice(0, 6).map(x => ({ nm: x.s.name, v: x.hi }));
        }
    }

    // ── 뇌·심장 ──
    if (typeof buildCirculatoryPolicy === 'function' && typeof CIRCULATORY_DATA !== 'undefined') {
        const cp = buildCirculatoryPolicy(R);
        if (cp) {
            d.circCov = (cp._raw || []).map(r => ({ nm: (r.name || '').trim(), v: val(r) }))
                .filter(x => x.nm).sort((a, b) => b.v - a.v);
            d.hasTong = !!cp.통합;
            const dxOf = list => list.map(x => ({ nm: x.k, kcd: x.kcd, v: cp.dx[x.k] || 0 }));
            d.brainDx = dxOf(CIRCULATORY_DATA.DX.filter(x => /뇌/.test(x.k)));
            d.heartDx = dxOf(CIRCULATORY_DATA.DX.filter(x => !/뇌/.test(x.k)));
            const jF = cp.통합 ? CIRCULATORY_DATA.JOURNEY.flatMap(g => g.items) : [];
            const jV = k => {
                if (!cp.통합) return 0;
                const it = jF.find(x => x.n.startsWith(k));
                return it ? (cp.통합.type === 'std' ? it.std : it.stdL) || 0 : 0;
            };
            const mk = (nm, v, rows, o) => Object.assign({ nm, v, rows }, o || {});
            // 내역은 제안서에 적힌 담보명을 그대로 쓴다. '특정치료비Ⅲ' 같은 통칭만
            // 넣어 두면, 행위 하나만 따로 파는 담보('혈전용해치료비(급성심근경색증)')를
            // 가진 제안서에서 내역이 통째로 빈다(실측).
            const rawRows = re => (cp._raw || [])
                .filter(r => re.test((r.name || '').replace(/\s+/g, '')))
                .map(r => ({ n: (r.name || '').trim(), v: val(r) }))
                .filter(x => x.v > 0);
            const withTong = (re, key) => {
                const rows = rawRows(re);
                if (cp.통합 && jV(key)) rows.push({ n: '특정순환계 통합치료비', v: jV(key) });
                return rows;
            };
            d.circCards = [
                mk('주요 치료 수술', cp.surgTreat.수술 || 0,
                   withTong(/특정치료비|순환계.*수술비/, '수술'),
                   { lead: true, cyc: '수술 매회', cycCls: 'ev' }),
                mk('혈전용해치료', cp.surgTreat.혈전용해 || 0,
                   withTong(/혈전용해|특정치료비/, '혈전용해'), { cyc: '연간 1회' }),
                mk('혈전제거술', cp.surgTreat.혈전제거 || 0,
                   withTong(/혈전제거|특정치료비/, '혈전제거'), { cyc: '연간 1회' }),
                mk('중환자실 입원', cp.중환자실 || 0,
                   rawRows(/중환자실/), { cyc: '연간 1회' })
            ];
            if (cp.통합) {
                d.circCards.push(mk('검사 · 영상진단', jV('MRI') + jV('CT') + jV('양전자'),
                    [{ n: 'MRI촬영(급여)', v: jV('MRI') },
                     { n: 'CT · PET촬영', v: jV('CT') + jV('양전자') }], { cyc: '각 연 1회' }));
                d.circCards.push(mk('약물 · 재활치료', jV('항응고') + jV('항혈소판') + jV('전문재활'),
                    [{ n: '항응고·항혈소판제', v: jV('항응고') + jV('항혈소판') },
                     { n: '전문재활치료(급여)', v: jV('전문재활') }], { cyc: '연간 1회' }));
            }
            const hDx = Math.max(...d.heartDx.map(x => x.v), 0);
            // 수술 담보가 없어도 사례는 만든다. 혈전용해·혈전제거만 가입한 제안서가
            // 흔한데, 그 경우에도 "진단 → 치료" 흐름은 보여줄 값어치가 있다.
            const op = cp.통합 ? (cp.통합.type === 'std' ? 2000 : 1000) : (cp.surgTreat.수술 || 0);
            const lyse = cp.surgTreat.혈전용해 || 0;
            const remove = cp.surgTreat.혈전제거 || 0;
            if (op > 0) {
                d.circCase = [
                    hDx > 0 && { s: '진단', a: hDx, d: '심장 계열' },
                    { s: '수술', a: op, d: cp.통합 ? '통합치료비' : '특정치료비' },
                    (cp.중환자실 > 0) && { s: '중환자실', a: cp.중환자실, d: '연 1회' },
                    { s: '재수술', a: op, d: '수술은 매회 보장' }
                ].filter(Boolean);
                d.circCaseDesc = '심장질환 수술 후 1년 뒤 재발로 재수술';
            } else {
                d.circCase = [
                    hDx > 0 && { s: '진단', a: hDx, d: '심장 계열' },
                    lyse > 0 && { s: '혈전용해', a: lyse, d: '연 1회' },
                    remove > 0 && { s: '혈전제거', a: remove, d: '연 1회' },
                    (cp.중환자실 > 0) && { s: '중환자실', a: cp.중환자실, d: '연 1회' }
                ].filter(Boolean);
                d.circCaseDesc = '급성심근경색으로 혈전 치료를 받은 경우';
            }

            d.summary = {
                brainDx: d.brainDx.reduce((n, x) => n + x.v, 0),
                heartDx: d.heartDx.reduce((n, x) => n + x.v, 0),
                _hasCirc: true,
                circTreat: cp.treatBest || 0, icu: cp.중환자실 || 0,
                rehab: jV('전문재활')
            };
        }
    }
    d.summary = Object.assign({
        cancerDx: dxSum,
        cancerSx: topCard.v,
        cancerDrug: drug.v,
        cancerRad: rad.v,
        brainDx: 0, heartDx: 0, circTreat: 0, icu: 0, rehab: 0
    }, d.summary || {});
    // 어느 장에도 실리지 않는 담보 — 입원일당·통원 같은 것들
    const shown = new Set([...(d.cancerCov || []), ...(d.surgCov || []), ...(d.circCov || [])]
        .map(x => x.nm));
    d.etc = R.filter(r => r && r.name && !shown.has(r.name.trim()) && val(r) > 0 &&
            /일당|통원|입원|간병/.test(r.name) &&
            !/진단비/.test(r.name))
        .map(r => ({ nm: r.name.trim(), v: val(r) }))
        .sort((a, b) => b.v - a.v).slice(0, 5);
    return d;
}

// 치료 종류별 아이콘 — 화면 카드와 같은 그림을 쓴다
function getSheetIcon(name) {
    const M = {
        '표적항암약물치료비': typeof ICON_A_B64 !== 'undefined' ? ICON_A_B64 : '',
        '면역항암약물치료비': typeof ICON_B_B64 !== 'undefined' ? ICON_B_B64 : '',
        '양성자방사선치료비': typeof ICON_C_B64 !== 'undefined' ? ICON_C_B64 : '',
        '암수술비': typeof ICON_D_B64 !== 'undefined' ? ICON_D_B64 : '',
        '다빈치로봇수술비': typeof ICON_E_B64 !== 'undefined' ? ICON_E_B64 : '',
        '항암약물치료비': typeof ICON_F_B64 !== 'undefined' ? ICON_F_B64 : '',
        '항암방사선치료비': typeof ICON_G_B64 !== 'undefined' ? ICON_G_B64 : '',
        '중입자방사선치료비': typeof ICON_H_B64 !== 'undefined' ? ICON_H_B64 : '',
        '세기조절방사선치료비': typeof ICON_I_B64 !== 'undefined' ? ICON_I_B64 : ''
    };
    return M[name] || (typeof ICON_A_B64 !== 'undefined' ? ICON_A_B64 : '');
}

// ── 지면 다섯 장을 순서대로 그린다 ──
// 표지는 기존 renderCoverCanvas가 맡고, 나머지 넷은 이 파일이 그린다.
async function renderSheetPages(results, meta, customerName) {
    const d = buildSheetData(results, meta, customerName);
    const C = SHEET_COLOR;
    const pages = [];
    pages.push({ html: sheetSummary(d), ac: C.blue, acs: '#EDF2FE' });
    if ((d.cancerCards || []).length) {
        pages.push({ html: sheetCancer(d), ac: C.cancer, acs: C.cancerSoft });
    }
    if ((d.surgCards || []).length) {
        pages.push({ html: sheetSurgery(d), ac: C.surgery, acs: C.surgerySoft });
    }
    if ((d.circCards || []).some(c => c.v > 0)) {
        pages.push({ html: sheetCirc(d), ac: C.brain, acs: C.brainSoft });
    }
    const out = [];
    for (const p of pages) out.push(await renderSheetCanvas(p.html, p.ac, p.acs));
    return out;
}
