// 자유양식 병력 원문을 AI에 보내 "기록 줄"을 받는다.
// 프롬프트 생성·AI 호출·로그인·이용 횟수 확인은 서버(Edge Function disclosure-extract)가 하고, 여기서는 원문을 나눠 보내기만 한다.
// 줄번호 검증·병력 묶기·합산·시술 구분·고지 분류는 app.js 규칙이 한다.

const DISCLOSURE_FUNCTION_URL = 'https://omgwvnibssizmhovporl.supabase.co/functions/v1/disclosure-extract';

// 긴 원문은 빈 줄 경계로 나눠 동시에 요청한다(출력 토큰 생성이 병목이라 나눈 만큼 빨라진다).
// 각 요청은 전체 원문을 맥락으로 쓰고 자기 범위의 기록만 출력한다. 범위 밖 기록은 app.js가 버린다.
function splitIntoChunks(lines, maxChunks = 8) {
  const nonEmpty = lines.filter(l => l.trim()).length;
  const target = Math.max(14, Math.ceil(nonEmpty / maxChunks));
  const chunks = [];
  let from = 1;
  let count = 0;
  lines.forEach((line, i) => {
    if (line.trim()) count++;
    else if (count >= target) {
      chunks.push({ from, to: i + 1 });
      from = i + 2;
      count = 0;
    }
  });
  if (from <= lines.length) chunks.push({ from, to: lines.length });
  return chunks.filter(c => lines.slice(c.from - 1, c.to).some(l => l.trim()));
}

// requestChunk(targetLines | null) → { text, provider }. targetLines가 null이면 원문 전체가 출력 대상이다.
// onlyLines를 주면(규칙이 찾은 "빠뜨린 줄" 재요청) 그 줄들만 출력 대상으로 한 번 요청한다.
async function extractRecords(rawText, requestChunk, { onlyLines } = {}) {
  const sourceLines = rawText.split('\n');
  const run = async (range, targetLines) => {
    const t0 = Date.now();
    const { text, provider } = await requestChunk(targetLines);
    return { ...range, text, provider, ms: Date.now() - t0 };
  };
  if (onlyLines) {
    const chunk = await run({ from: Math.min(...onlyLines), to: Math.max(...onlyLines), lines: onlyLines }, onlyLines);
    return { chunks: [chunk], sourceLines };
  }
  const ranges = splitIntoChunks(sourceLines);
  const lineNumbers = r => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i);
  const chunks = await Promise.all(ranges.map(r => run(r, ranges.length > 1 ? lineNumbers(r) : null)));
  return { chunks, sourceLines };
}

// 로그인 세션 토큰으로 서버 함수를 부르는 requestChunk. 같은 runId로 보낸 요청(나눠 보낸 것·재요청)은 이용 1회로 센다.
// 서버가 돌려준 남은 횟수 등은 requester.meta에 남긴다. 실패하면 err.code(LOGIN·LIMIT·AI 등)를 붙여 던진다.
function functionRequester({ rawText, today, runId, accessToken, anonKey }) {
  const requester = async targetLines => {
    const res = await fetch(DISCLOSURE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: anonKey },
      body: JSON.stringify({ action: 'extract', run_id: runId, raw_text: rawText, today, target_lines: targetLines }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `서버 오류 ${res.status}`);
      err.code = data.code || 'SERVER';
      throw err;
    }
    requester.meta = { approved: data.approved, remaining: data.remaining, model: data.model };
    return { text: data.text || '', provider: data.provider || '' };
  };
  requester.meta = null;
  return requester;
}

if (typeof module !== 'undefined') {
  module.exports = { splitIntoChunks, extractRecords, functionRequester, DISCLOSURE_FUNCTION_URL };
}
