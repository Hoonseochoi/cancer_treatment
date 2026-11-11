// 자동고지AI 정리 기록 — 실제로 맞게 분류했는지 주기적으로 검증하려고 남긴다.
// 서버(Edge Function disclosure-extract, action 'log')가 로그인을 확인하고 회원 ID와 함께 disclosure_logs에 저장한다.
// 같은 run_id로 AI 호출마다의 토큰·비용·AI 원문은 서버가 disclosure_ai_calls에 따로 남긴다(검증은 disclosure_runs 뷰로 본다).

// 어느 규칙(화면 스크립트 버전)으로 나온 결과인지 함께 남긴다 — index.html의 log.js?v=… 값
const LOG_APP_VERSION = (() => {
  try {
    return new URL(document.currentScript.src).searchParams.get('v');
  } catch (e) {
    return null;
  }
})();

// 화면에 보이는 표준 분류 그대로(문항별 분류완료/확인필요 + 어느 문항에도 없는 병력)
function summarizeClassification(histories, todayStr) {
  if (typeof classifyHistories !== 'function' || typeof Q_DEFS === 'undefined') return null;
  const result = classifyHistories(histories, todayStr);
  const classified = new Set();
  const summary = {};
  Q_DEFS.forEach(q => {
    const { included, review } = result[q.id];
    [...included, ...review].forEach(h => classified.add(h.id));
    summary[q.id] = {
      included: included.map(h => h.진단명),
      review: review.map(h => h.진단명),
    };
  });
  summary.미분류 = histories.filter(h => !classified.has(h.id)).map(h => h.진단명);
  return summary;
}

// 간편 알릴의무 결과: 추천·차선 + 상품마다 유형별 판정과 어느 질문에 무엇이 걸렸는지
function summarizeSimple(histories, todayStr) {
  if (typeof evaluateSimpleProducts !== 'function') return null;
  const simple = evaluateSimpleProducts(histories, todayStr);
  const brief = c => c && { product: c.product.id, name: c.product.name, variant: c.variant.label, status: c.variant.status, reviews: c.variant.reviews };
  const question = q => `${q.label} ${q.text.split(' · ')[0]}`;
  return {
    top: brief(simple.top),
    fallback: brief(simple.fallback),
    unrestricted: brief(simple.unrestricted),
    products: simple.products.map(({ product, variants, best }) => {
      const shown = best || variants[variants.length - 1];
      return {
        product: product.id,
        best: best ? best.label : null,
        status: best ? best.status : 'no',
        variants: Object.fromEntries(variants.map(v => [v.label, v.status])),
        hits: shown.rows.flatMap(r => [
          ...r.hits.map(x => ({
            q: question(r.q), name: x.h.진단명, reason: x.reason,
            result: x.freepass ? 'freepass' : x.uw && x.uw.ok ? 'uw' : 'hit',
            uw: x.uw ? { entry: x.uw.name, column: x.uw.column, ok: x.uw.ok, label: x.uw.label } : undefined,
          })),
          ...r.reviews.map(x => ({ q: question(r.q), name: x.h.진단명, reason: x.reason, result: 'review' })),
        ]),
      };
    }),
  };
}

async function logDisclosureRun({ runId, source, rawText, histories = [], records = [], requests = null, retriedLines = [], missingLines = [], model = null, latencyMs = null, error = null, todayStr }) {
  try {
    const token = typeof DisclosureAccess !== 'undefined' ? await DisclosureAccess.token() : null;
    if (!token || !runId) return;
    const body = JSON.stringify({
      action: 'log',
      run_id: runId,
      source,
      today: todayStr,
      raw_text: rawText,
      records,
      histories,
      classify: summarizeClassification(histories, todayStr),
      simple: summarizeSimple(histories, todayStr),
      model,
      requests,
      retried_lines: retriedLines.length,
      missing_lines: missingLines.length,
      latency_ms: latencyMs,
      error,
      app_version: LOG_APP_VERSION,
    });
    // 기록이 실패해도 화면은 그대로 진행한다. 탭을 닫아도 보내지게 keepalive를 쓰되, 브라우저 한도(64KB)를 넘는 큰 기록은 일반 요청으로 보낸다.
    const res = await fetch(DISCLOSURE_FUNCTION_URL, {
      method: 'POST',
      keepalive: body.length < 60000,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: DisclosureAccess.anonKey },
      body,
    });
    if (!res.ok) console.warn('고지 기록 저장 실패:', res.status);
  } catch (e) {
    console.warn('고지 기록 저장 실패:', e);
  }
}
