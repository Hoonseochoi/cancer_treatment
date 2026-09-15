// 자유양식 병력 원문에서 "기록"만 옮겨 적게 하는 LLM 추출기(OpenRouter 경유 DeepSeek).
// AI는 판단·합산·요약을 하지 않고 기록 줄만 출력한다. 줄번호 검증·병력 묶기·합산·시술 구분·고지 분류는 app.js 규칙이 한다.

const OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';
// 같은 모델도 제공사별 속도 차이가 크다(장문 실측: Parasail·Alibaba ~110tok/s, 기본 라우팅 OpenInference ~20tok/s).
const OPENROUTER_PROVIDER_ORDER = ['Parasail', 'Alibaba', 'Baidu', 'Novita', 'GMICloud'];
const BACKUP_PROVIDER_ORDER = ['Alibaba', 'Baidu', 'Parasail', 'Novita', 'GMICloud'];
// 빠른 제공사도 가끔 수십 초씩 멈춘다. 이 시간 안에 안 끝나면 다른 제공사로 한 번 더 보내 먼저 온 답을 쓴다.
const BACKUP_AFTER_MS = 8000;

function buildRecordPrompt(numberedText, todayStr, targetText) {
  return `너는 보험 병력 원문에서 기록을 옮겨 적는 추출기다. 판단·합산·요약·중복제거는 하지 말고 원문 기록을 한 줄에 하나씩 옮겨라. 오늘: ${todayStr}

출력 형식(설명·머리말·코드블록 없이 이 줄들만):
줄번호|코드|진단명|종류|시작일|종료일|수치|상세

- 줄번호: 원문 각 줄 왼쪽에 붙은 번호를 그대로 쓴다(기록 순번이 아니다). 날짜가 적힌 줄의 번호.
- 코드: 진단코드만 쓴다(사람 이름·날짜 금지). 원문 코드에서 점만 뺀다(M23.2→M232, AE14.41→AE1441). 숫자·앞글자를 바꾸지 마라.
  원문에 코드가 없으면 추정 코드 앞에 ~를 붙인다(~B07). 모르면 비운다.
- 진단명: 원문 진단명. 복사하다 글자 중간에 잘못 끼어든 공백만 붙이고("간 세포암종 의"→"간세포암종의") 단어 사이 띄어쓰기는 원문대로 둔다.
  같은 코드로 앞에서 적었으면 비워도 된다.
- 종류: 진단|입원|통원|수술|시술|투약|정기|재검 중 하나
  입원=입원 1건(수치=입원일수) / 통원=통원(수치=횟수·일수)
  투약=약 처방 기록("마지막처방일 … 30일이상", "N일치 처방" 포함, 수치=처방일수) / 정기=원문에 "정기처방", "계속 복용 중"이라고 적힌 약만
  수술=원문이 수술이라고 했거나 수술 섹션·수술명 칸에 적힌 것, "~술"로 끝나는 처치 전부(소작술·절제술·봉합술·해제술 포함, 상세=수술명, 수치=횟수)
  시술=원문이 수술이라 하지 않은 주사·신경차단·물리치료·냉동치료 등(상세=처치명)
  재검=추가검사·재검사 / 진단=그 밖의 진료·진단·날짜만 있는 기록
- 투약·정기의 상세에는 약 이름만 쓴다. 약 이름이 없으면 비운다(진단명을 쓰지 마라).
- 시작일·종료일: YYMMDD. 하루짜리는 시작일만. 연도가 없으면 MMDD("5월 28일"→0528).
- 수치: 숫자만("30일 이상"→30). 모르면 비운다.
- "입원x", "입원 X", "입원없음"이면 입원 기록만 만들지 않는다. 같은 줄의 수술·진단 등 다른 기록은 그대로 적는다("수술x"도 같다).
- 입원이 여러 번이면 합치지 말고 한 줄씩. 똑같은 기록이 반복돼도 반복된 만큼 적는다.
- 코드·진단명 없이 적힌 수술·처방·최근진료("간이식술", "간약 정기처방")는 원문 맥락상 연결되는 병력의 코드·진단명을 적는다.
  연결할 병력이 없으면 코드·진단명을 비운다.
- 고객 이름, 인사, 설계 요청, "입원/통원/처방" 같은 제목 줄은 기록이 아니다. 원문에 없는 내용은 절대 쓰지 마라.

예시
원문:
6: 김철수 고객님
7: 2024-3-11 5일
8: (양방)신 경뿌리병 증을 동반한 요추 추간판장애-AM5116
9:
10: 2023-12-01 ~ 2024-05-20/AM5116 통원 14일, 신경차단술 2회
11: 25.01.21 M50.2 경추간판전위 입원3일 / 수술o 경추유합술
12: 23.06.02 J209 급성 기관지염 / 입원x / 수술x
13: 23.01.25 / Z34.83 정상임신 관리 / 입원 X ,자궁경부봉축해제술
14: 3개월이내 병력 / 8월 2일 허리 진통제 정기처방
출력:
7|AM5116|신경뿌리병증을 동반한 요추 추간판장애|입원|240311||5|
10|AM5116||통원|231201|240520|14|
10|AM5116||시술|||2|신경차단술
11|M502|경추간판전위|입원|250121||3|
11|M502||수술|250121|||경추유합술
12|J209|급성 기관지염|진단|230602|||
13|Z3483|정상임신 관리|수술|230125|||자궁경부봉축해제술
14|AM5116||정기|0802|||진통제

원문:
${numberedText}${targetText ? `\n\n출력 대상 줄(아래 줄들에 적힌 기록만 출력하고, 나머지 원문은 맥락 참고용):\n${targetText}` : ''}`;
}

// 긴 원문은 빈 줄 경계로 나눠 동시에 요청한다(출력 토큰 생성이 병목이라 나눈 만큼 빨라진다).
// 각 요청에는 전체 원문을 맥락으로 주고 자기 범위의 기록만 출력하게 한다. 범위 밖 기록은 app.js가 버린다.
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

async function requestOnce(prompt, apiKey, model, providerOrder, signal) {
  const request = () => fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Title': 'Surinsur Disclosure Helper',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4000,
      reasoning: { enabled: false },
      provider: { order: providerOrder, allow_fallbacks: true },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  // 제공사 쪽 일시 속도제한(429)·오류(5xx)는 몇 번 재시도한다.
  let res = await request();
  for (let attempt = 1; attempt <= 3 && (res.status === 429 || res.status >= 500); attempt++) {
    await new Promise(r => setTimeout(r, 1000 * attempt));
    res = await request();
  }
  if (!res.ok) {
    throw new Error(`OpenRouter API 오류: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error('OpenRouter 응답에서 결과를 찾을 수 없습니다');
  }
  return { text, provider: data.provider || '' };
}

// 첫 요청이 BACKUP_AFTER_MS 안에 안 끝나거나 실패하면 다른 제공사 순서로 한 번 더 보내고, 먼저 성공한 답을 쓴다.
async function requestCompletion(prompt, apiKey, model) {
  const controllers = [];
  let settled = false;
  let timer;
  const send = order => {
    const controller = new AbortController();
    controllers.push(controller);
    return requestOnce(prompt, apiKey, model, order, controller.signal);
  };
  const primary = send(OPENROUTER_PROVIDER_ORDER);
  const backup = new Promise((resolve, reject) => {
    let fired = false;
    const fire = () => {
      if (settled || fired) return;
      fired = true;
      send(BACKUP_PROVIDER_ORDER).then(resolve, reject);
    };
    timer = setTimeout(fire, BACKUP_AFTER_MS);
    primary.catch(fire);
  });
  try {
    return await Promise.any([primary, backup]);
  } catch (e) {
    throw e.errors ? e.errors[0] : e;
  } finally {
    settled = true;
    clearTimeout(timer);
    controllers.forEach(c => c.abort());
  }
}

// onlyLines를 주면(규칙이 찾은 "빠뜨린 줄" 재요청) 그 줄들만 출력 대상으로 한 번 요청한다.
async function extractRecordsWithAI(rawText, apiKey, { model = OPENROUTER_MODEL, today = new Date().toISOString().slice(0, 10), onlyLines } = {}) {
  const sourceLines = rawText.split('\n');
  const numbered = (from, to) => sourceLines.slice(from - 1, to).map((line, i) => `${from + i}: ${line}`).join('\n');
  const whole = numbered(1, sourceLines.length);
  const run = async (range, targetText) => {
    const t0 = Date.now();
    const { text, provider } = await requestCompletion(buildRecordPrompt(whole, today, targetText), apiKey, model);
    return { ...range, text, provider, ms: Date.now() - t0 };
  };

  if (onlyLines) {
    const targetText = onlyLines.map(n => `${n}: ${sourceLines[n - 1]}`).join('\n');
    const chunk = await run({ from: Math.min(...onlyLines), to: Math.max(...onlyLines), lines: onlyLines }, targetText);
    return { chunks: [chunk], sourceLines };
  }
  const ranges = splitIntoChunks(sourceLines);
  const chunks = await Promise.all(ranges.map(range => run(range, ranges.length > 1 ? numbered(range.from, range.to) : '')));
  return { chunks, sourceLines };
}

if (typeof module !== 'undefined') {
  module.exports = { buildRecordPrompt, splitIntoChunks, extractRecordsWithAI, OPENROUTER_MODEL, OPENROUTER_PROVIDER_ORDER };
}
