// 자동고지AI 사용 기록을 Supabase(disclosure_logs)에 남긴다.
// 잘못 분류된 사례를 원문 그대로 되짚어 규칙·프롬프트를 고치려는 용도다.
// 누구인지는 식별하지 않고 브라우저마다 만드는 익명 ID만 붙인다.
// 이 키(publishable)로는 insert 정책만 열려 있어 기록을 남길 수만 있고 조회는 되지 않는다.
const LOG_SUPABASE_URL = 'https://omgwvnibssizmhovporl.supabase.co';
const LOG_SUPABASE_KEY = 'sb_publishable_RwpnmzYtRaskL8bNWxV2Cw_5FG05XJh';
const LOG_SESSION_KEY = 'surinsur-disclosure-session';

function disclosureSessionId() {
  try {
    let id = localStorage.getItem(LOG_SESSION_KEY);
    if (!id) {
      id = ([...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join(''));
      localStorage.setItem(LOG_SESSION_KEY, id);
    }
    return id;
  } catch (e) {
    return null; // 저장소가 막힌 브라우저에서는 세션 묶음 없이 남긴다
  }
}

// 화면에 보이는 분류 그대로 남긴다(문항별 분류완료/확인필요 + 어느 문항에도 없는 병력).
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

function logDisclosureRun({ source, rawText, histories = [], records = [], requests = null, retriedLines = [], missingLines = [], model = null, latencyMs = null, error = null, todayStr }) {
  const row = {
    session_id: disclosureSessionId(),
    source,
    raw_text: rawText,
    records,
    histories,
    classify: summarizeClassification(histories, todayStr),
    model,
    requests,
    retried_lines: retriedLines.length,
    missing_lines: missingLines.length,
    latency_ms: latencyMs,
    error,
  };

  // 기록이 실패해도 사용자 화면은 그대로 진행한다. 탭을 닫아도 전송되도록 keepalive를 쓴다.
  fetch(`${LOG_SUPABASE_URL}/rest/v1/disclosure_logs`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: LOG_SUPABASE_KEY,
      Authorization: `Bearer ${LOG_SUPABASE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  }).then(res => {
    if (!res.ok) console.warn('고지 기록 저장 실패:', res.status);
  }).catch(e => console.warn('고지 기록 저장 실패:', e));
}
