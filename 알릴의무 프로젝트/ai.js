// 자유양식 병력 텍스트를 우리 파서 포맷(🔴진단명/코드 + 입원/수술/치료현상태)으로
// 변환하는 Gemini 전처리기. parseHistoryText 자체는 건드리지 않고, 그 앞단에서
// "우리 포맷이 아닌 것 같은 텍스트"를 우리 포맷으로 바꿔주는 역할만 한다.

const GEMINI_MODEL = 'gemini-2.5-flash';

function buildConversionPrompt(rawText) {
  return `너는 보험 알릴의무 작성 보조 도구의 입력 전처리기다.
아래 "원문"을 다음 형식으로 변환해라. 다른 설명 없이 변환된 텍스트만 출력해라.

형식 규칙:
- 병력 한 건마다 "🔴진단명/진단코드" 줄로 시작한다. 진단코드는 점(.) 없이 붙여쓴다(예: K291).
- 다음 줄들은 정확히 이 라벨로 시작해야 한다: "입원:", "수술:", "치료/현상태:"
- 입원: 입원하지 않았으면 "없음", 입원했으면 "N일" (숫자+일)
- 수술: 수술하지 않았으면 "없음", 수술했으면 수술명을 적는다
- 치료/현상태: 반드시 YY.MM.DD 형식의 날짜를 한 번 포함해야 한다(가장 최근/중요한 날짜 하나만, 기간이면 종료일 또는 더 최근 날짜 사용). 진행중인 치료라도 날짜 뒤에 "~"를 붙이지 말고, 알고 있는 가장 최근 날짜를 그대로 적어라. 완치/통원중/투약중 등 상태도 함께 적어라.
- 병력이 여러 건이면 각 블록을 빈 줄 하나로 구분한다.
- 원문에 진단코드가 없으면 네가 알고 있는 일반적인 ICD-10 코드로 추정해 채워라(불확실하면 가장 근접한 코드).

원문:
${rawText}`;
}

async function convertFreeTextWithGemini(rawText, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: buildConversionPrompt(rawText) }] }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini 응답에서 변환 결과를 찾을 수 없습니다');
  }
  return text.trim();
}

if (typeof module !== 'undefined') {
  module.exports = { buildConversionPrompt, convertFreeTextWithGemini };
}
