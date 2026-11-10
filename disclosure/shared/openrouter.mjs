// OpenRouter 호출. 서버(Edge Function disclosure-extract)와 로컬 평가 스크립트가 같은 파일을 쓴다.

// 2026-11 실측: 샘플 11건 기준 정확도·비용·속도가 가장 고르다(Qwen 3.x flash는 더 싸지만 암·당뇨를 빠뜨렸다).
export const OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';
// 같은 모델도 제공사별 속도 차이가 크다(장문 실측: Parasail·Alibaba ~110tok/s, 기본 라우팅 OpenInference ~20tok/s).
export const OPENROUTER_PROVIDER_ORDER = ['Parasail', 'Alibaba', 'Baidu', 'Novita', 'GMICloud'];
const BACKUP_PROVIDER_ORDER = ['Alibaba', 'Baidu', 'Parasail', 'Novita', 'GMICloud'];
// 빠른 제공사도 가끔 수십 초씩 멈춘다. 이 시간 안에 안 끝나면 다른 제공사로 한 번 더 보내 먼저 온 답을 쓴다.
const BACKUP_AFTER_MS = 8000;

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
      // 토큰 수·비용(USD)을 응답에 받아 기록한다
      usage: { include: true },
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
  const u = data.usage || {};
  return {
    text,
    provider: data.provider || '',
    generationId: data.id || '',
    usage: {
      promptTokens: u.prompt_tokens ?? null,
      completionTokens: u.completion_tokens ?? null,
      cachedTokens: u.prompt_tokens_details?.cached_tokens ?? null,
      cost: u.cost ?? null,
    },
  };
}

// 첫 요청이 BACKUP_AFTER_MS 안에 안 끝나거나 실패하면 다른 제공사 순서로 한 번 더 보내고, 먼저 성공한 답을 쓴다.
// 돌려주는 usage는 쓴 답의 것이다. 예비 요청을 보냈으면(backupFired) 중간에 끊은 요청도 일부 과금됐을 수 있다.
export async function requestCompletion(prompt, apiKey, model = OPENROUTER_MODEL) {
  if (!apiKey) throw new Error('OpenRouter 키가 설정되지 않았습니다');
  const controllers = [];
  let settled = false;
  let backupFired = false;
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
      backupFired = true;
      send(BACKUP_PROVIDER_ORDER).then(resolve, reject);
    };
    timer = setTimeout(fire, BACKUP_AFTER_MS);
    primary.catch(fire);
  });
  try {
    const out = await Promise.any([primary, backup]);
    return { ...out, backupFired };
  } catch (e) {
    throw e.errors ? e.errors[0] : e;
  } finally {
    settled = true;
    clearTimeout(timer);
    controllers.forEach(c => c.abort());
  }
}
