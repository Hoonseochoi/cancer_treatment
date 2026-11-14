// 자동고지AI 보조 — 정리가 끝난 뒤 AI(서버 함수 disclosure-assist)에게 세 가지를 따로 맡긴다.
//   ① 고객 확인 질문: 확인필요 병력마다 고객에게 카톡으로 물어볼 문장
//   ② AI 점검 메모: 원문과 정리 결과를 대조해 빠진 것·다른 것·병력이 아닌 것(참고용)
//   ③ 약 종류·U/W가이드 연결: 약 이름 → 약 종류 태그, 가이드 키워드로 못 찾은 입원·수술 병력 → 비슷한 가이드 항목(참고용)
// 셋 다 분류 결과(문항 판정·상품 판정)는 바꾸지 않는다. 이용 횟수도 깎지 않는다(서버가 정리 1번의 주인인지만 본다).
const DISCLOSURE_ASSIST_URL = 'https://omgwvnibssizmhovporl.supabase.co/functions/v1/disclosure-assist';

const DisclosureAssist = (function () {
  let state = null; // { runId, rawLines, questions: Map|null, notes: []|null, loading: Set, failed: Set }

  const clip = (v, n) => {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
  };

  // 확인필요가 된 까닭을 사람 말로 — AI가 이것만 묻게 한다
  function reviewReasons(h, qIds) {
    const r = [];
    if (h.원문확인필요) r.push('원문을 옮기지 못한 줄이라 입원·수술·투약 여부와 날짜');
    if (h.치료내용미상) r.push('입원·수술·통원 여부');
    if (!h.최근진료일 && !h.최초진단일) r.push('진단·치료 날짜(연·월)');
    else if (qIds.includes('Q1') || qIds.includes('Q3')) r.push('가장 최근 진료 날짜');
    if (qIds.includes('Q3')) r.push('추가검사(재검사)를 받았는지');
    if (h.통원횟수미상) r.push('같은 병으로 몇 번 통원했는지(7번 이상인지)');
    if (h.상시복용여부 && !h.입원여부 && !h.수술여부) r.push('약을 계속해서 30일 이상 먹었는지, 언제부터인지');
    if (h.입원여부 && h.입원일수 == null) r.push('입원 일수');
    if (h.수술여부 && !h.수술명) r.push('수술명');
    return [...new Set(r)];
  }

  function questionItems(histories, todayStr) {
    if (typeof classifyHistories !== 'function') return [];
    const result = classifyHistories(histories, todayStr);
    const byId = new Map();
    Q_DEFS.forEach(q => {
      result[q.id].review.forEach(h => {
        if (!byId.has(h.id)) byId.set(h.id, { h, qs: [] });
        byId.get(h.id).qs.push(q);
      });
    });
    // 간편 알릴의무 추천 상품에서 확인으로 남은 병력도 같이 묻는다
    if (typeof DisclosureAccess !== 'undefined' && DisclosureAccess.simpleState === 'allowed' && typeof evaluateSimpleProducts === 'function') {
      const { top } = evaluateSimpleProducts(histories, todayStr);
      (top ? top.variant.rows : []).forEach(row => row.reviews.forEach(x => {
        if (!byId.has(x.h.id)) byId.set(x.h.id, { h: x.h, qs: [], simple: x.reason });
      }));
    }
    return [...byId.values()].slice(0, 20).map(({ h, qs, simple }) => {
      const reasons = reviewReasons(h, qs.map(q => q.id));
      if (simple) reasons.push(simple);
      if (!reasons.length) reasons.push('날짜와 입원·수술·투약 여부');
      return {
        id: String(h.id),
        name: h.진단명 || '(이름없음)',
        reason: [...reasons, h.비고 ? `메모: ${clip(h.비고, 120)}` : ''].filter(Boolean).join(' / '),
        question: qs.map(q => `${q.title} ${q.trigger}`).join(' / '),
        source: clip(h.원본, 200),
      };
    });
  }

  const reviewHistories = histories => histories.map(h => ({
    name: h.진단명 || '(이름없음)',
    code: h.코드추정 ? '' : h.진단코드 || '',
    lines: Array.isArray(h.원문줄) ? h.원문줄 : [],
    first: h.최초진단일 || '',
    last: h.최근진료일 || '',
    admission: h.입원여부 ? `${h.입원일수 ?? '?'}일` : '',
    surgery: h.수술여부 ? h.수술명 || '수술함' : '',
    visits: h.통원횟수 || null,
    meds: h.약물명 || (h.상시복용여부 ? '복용 중' : ''),
    medDays: h.계속투약일수 || null,
  }));

  function matchItems(histories) {
    const guideOn = typeof DisclosureAccess !== 'undefined' && DisclosureAccess.simpleState === 'allowed' && typeof findUwEntry === 'function';
    return histories.filter(h => h.진단명 && (
      h.약물명 || (guideOn && (h.입원여부 || h.수술여부) && !findUwEntry(h, histories))
    )).slice(0, 20).map(h => ({
      id: String(h.id),
      name: h.진단명,
      code: h.코드추정 ? '' : h.진단코드 || '',
      surgery: h.수술여부 ? h.수술명 || '수술함' : '',
      drug: h.약물명 || '',
    }));
  }

  async function call(action, payload, accessToken) {
    const res = await fetch(DISCLOSURE_ASSIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: DisclosureAccess.anonKey },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `assist ${res.status}`);
    return Array.isArray(data.items) ? data.items : [];
  }

  function run({ runId, rawText, histories, todayStr, accessToken }) {
    if (!runId || !accessToken) return;
    const mine = { runId, rawLines: rawText.split('\n'), questions: null, notes: null, loading: new Set(), failed: new Set() };
    state = mine;
    const live = () => state === mine;
    const task = (key, promise, apply) => {
      mine.loading.add(key);
      promise.then(items => { if (live()) apply(items); })
        .catch(e => { console.warn(`AI 보조(${key}) 실패:`, e); mine.failed.add(key); })
        .finally(() => {
          mine.loading.delete(key);
          if (live()) window.dispatchEvent(new Event('disclosure:assist'));
        });
    };

    const qItems = questionItems(histories, todayStr);
    if (qItems.length) {
      task('questions', call('questions', { run_id: runId, today: todayStr, items: qItems }, accessToken), items => {
        mine.questions = new Map(items.map(x => [x.id, x.question]));
      });
    } else {
      mine.questions = new Map();
    }
    task('review', call('review', { run_id: runId, today: todayStr, raw_text: rawText, histories: reviewHistories(histories) }, accessToken), items => {
      mine.notes = items;
    });
    const mItems = matchItems(histories);
    if (mItems.length) {
      task('match', call('uw_match', { run_id: runId, items: mItems }, accessToken), items => {
        const byId = new Map(items.map(x => [x.id, x]));
        histories.forEach(h => {
          const m = byId.get(String(h.id));
          if (!m) return;
          if (m.drug) h.약종류 = m.drug;
          if (m.guide) h.uwHint = m.guide;
        });
      });
    }
    window.dispatchEvent(new Event('disclosure:assist'));
  }

  // ---- 화면 ----
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function copyText(text, btn) {
    const done = ok => {
      const before = btn.textContent;
      btn.textContent = ok ? '복사했어요' : '복사 실패';
      setTimeout(() => { btn.textContent = before; }, 1400);
    };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback);
    else fallback();
  }

  function card(title, lead) {
    const box = el('section', 'as-card');
    const head = el('div', 'as-head');
    head.appendChild(el('h3', 'as-title', title));
    box.appendChild(head);
    if (lead) box.appendChild(el('p', 'as-lead', lead));
    return { box, head };
  }

  const pending = text => el('div', 'as-pending', text);

  function questionsCard(histories) {
    const loading = state.loading.has('questions');
    const list = state.questions
      ? histories.filter(h => state.questions.has(String(h.id))).map(h => ({ h, q: state.questions.get(String(h.id)) }))
      : [];
    if (!loading && !list.length) return null;
    const { box, head } = card('고객 확인 질문', '확인필요로 남은 병력을 고객에게 물어볼 문장이에요. 복사해서 카톡으로 보내세요.');
    if (loading) {
      box.appendChild(pending('AI가 확인 질문을 만들고 있어요…'));
      return box;
    }
    const ol = el('ol', 'as-qlist');
    list.forEach(({ h, q }) => {
      const li = el('li', 'as-q');
      li.append(el('span', 'as-q-name', h.진단명 || '(이름없음)'), el('span', 'as-q-text', q));
      ol.appendChild(li);
    });
    box.appendChild(ol);
    const btn = el('button', 'btn-secondary as-copy', '질문 복사');
    btn.type = 'button';
    btn.addEventListener('click', () => copyText(list.map(({ q }, i) => `${i + 1}. ${q}`).join('\n'), btn));
    head.appendChild(btn);
    return box;
  }

  const NOTE_KIND = { missing: '빠진 듯', mismatch: '원문과 다름', not_history: '병력 아님' };
  function notesCard() {
    const loading = state.loading.has('review');
    const notes = state.notes || [];
    if (!loading && !notes.length) return null;
    const { box } = card('AI 점검 메모', '참고용 — 분류는 바뀌지 않아요. 맞는 지적이면 세부 수정에서 직접 고쳐주세요.');
    if (loading) {
      box.appendChild(pending('AI가 원문과 정리 결과를 대조하고 있어요…'));
      return box;
    }
    const ul = el('ul', 'as-notes');
    notes.forEach(n => {
      const li = el('li', 'as-note');
      li.appendChild(el('span', `as-kind as-kind-${n.kind}`, NOTE_KIND[n.kind] || '확인'));
      const body = el('div', 'as-note-body');
      body.appendChild(el('div', 'as-note-text', n.text));
      const src = n.line ? state.rawLines[n.line - 1] : '';
      if (src && src.trim()) body.appendChild(el('div', 'as-note-src', `원문 ${n.line}줄 · ${clip(src, 80)}`));
      li.appendChild(body);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  function render(histories) {
    const panel = document.getElementById('assist-panel');
    if (!panel) return;
    panel.innerHTML = '';
    if (!state) {
      panel.hidden = true;
      return;
    }
    const cards = [questionsCard(histories), notesCard()].filter(Boolean);
    panel.hidden = !cards.length;
    cards.forEach(c => panel.appendChild(c));
  }

  return {
    run,
    render,
    reset() { state = null; },
    // 테스트용
    _questionItems: questionItems,
    _matchItems: matchItems,
  };
})();

if (typeof module !== 'undefined') module.exports = { DisclosureAssist };
