// 슈린슈 AI — 약관 질의 프록시
// ─────────────────────────────────────────────────────────────
// 브라우저에서 OpenRouter를 직접 부르면 키가 소스 보기로 그대로 노출된다.
// GitHub Pages는 정적이라 숨길 서버가 없으므로 이 함수가 그 자리를 맡는다.
//
// 흐름: 질문 + (브라우저 규칙 검색이 만든) 힌트 → DeepSeek
//       → 모델이 read_clause 도구로 원문을 요청 → Supabase에서 꺼내 돌려줌
//       → 모델이 근거를 달아 답변 → 로그 적재
//
// 검색까지 모델에 맡기지 않는 이유는 반대다. 힌트는 규칙이 만들지만 무엇을 읽고
// 무엇이 답인지는 모델이 정한다. 규칙으로 답을 정하려 들면 질문 유형마다 예외가 생긴다.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SYSTEM_PROMPT as BUILT_PROMPT } from './system_prompt.ts';

const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY');
const MODEL = Deno.env.get('CLAUSE_MODEL') ?? 'deepseek/deepseek-chat';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// 지침과 담보 카탈로그는 함수와 함께 배포된다(scripts/build_clause_index.py가 생성).
// 환경변수를 두면 그쪽이 이긴다 — 배포 없이 급히 문구를 고쳐야 할 때를 위한 뒷문이다.
const SYSTEM_PROMPT = Deno.env.get('CLAUSE_SYSTEM_PROMPT') || BUILT_PROMPT;
// 유료 기능이라 아는 사람만 쓴다. 코드를 브라우저에 두면 소스 보기로 그대로 읽히므로
// 검증은 여기서만 한다 — 프런트는 입력값을 넘길 뿐 정답을 모른다.
const ACCESS_CODE = Deno.env.get('CLAUSE_ACCESS_CODE') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const sb = createClient(SB_URL, SB_KEY);

// ── 남용 차단 ──
// 브라우저에서도 한 번 거르지만 그건 우회할 수 있다. 실제 차단은 여기서 한다.
// 서버에는 색인이 없어 정규식만 쓰므로, 명백한 것만 막고 애매하면 통과시킨다 —
// 진짜 약관 질문을 막는 쪽이 잡담 몇 개를 통과시키는 것보다 나쁘다.
const OTHER_INSURER =
  /메리츠|현대해상|디비손해|DB손해|KB손해|한화손해|롯데손해|MG손해|농협|NH손해|흥국|AXA|악사|하나손해|캐롯|라이나|AIA|처브|동양생명|교보|신한라이프|삼성생명|미래에셋생명|푸본|ABL|KDB생명/i;
const GREETING =
  /^\s*(안녕|하이|헬로|ㅎㅇ|hi|hello|테스트|test|ㅋㅋ+|ㅎㅎ+|\?+|\.+|ㅇㅇ|ㄴㄴ)\s*[!?.~]*\s*$/i;
const OFFTASK = /(코드|파이썬|자바스크립트|번역|시 ?써|소설|레시피|요리|주식|코인|비트코인|로또|운세|게임|영화 ?추천|노래)/;
const CHITCHAT = /(날씨|점심|저녁|밥 ?먹|커피|기분|심심|뭐해|뭐할|누구야|이름이|사랑|시간 ?몇|몇 ?시)/i;
const DOMAIN =
  /담보|특약|약관|보험|보장|진단비|수술비|치료비|입원|통원|일당|면책|감액|보험금|지급|청구|가입금액|갱신|보장개시|[0-9]\s*종|분류표|별표|암|뇌|심장|수술|시술|질병|상해|후유장해|간병|검사비|지원금|한도|소멸|골절|화상|진단|절제|이식|제거술|성형술|치환/;

function gate(q: string): { kind: string; message: string } | null {
  if (OTHER_INSURER.test(q)) {
    return { kind: 'other_insurer',
      message: '이 도구는 삼성화재 New내돈내삼(1640) 약관만 담고 있어, 다른 보험사 약관은 답해드릴 수 없습니다.' };
  }
  if (GREETING.test(q)) {
    return { kind: 'greeting', message: '약관에서 궁금한 것을 물어봐 주세요.' };
  }
  const dom = DOMAIN.test(q);
  if (!dom && OFFTASK.test(q)) {
    return { kind: 'offtask', message: '약관에 대한 질문만 답해드릴 수 있어요.' };
  }
  if (!dom && CHITCHAT.test(q)) {
    return { kind: 'chitchat', message: '약관에서 궁금한 것을 물어봐 주세요.' };
  }
  return null;
}

// 캐시 조회 기준. 조사·공백·기호를 털어 "암 진단비 면책기간은?"과 "암진단비 면책 기간"을
// 같은 질문으로 본다.
function normalize(q: string): string {
  return q.toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[?!.,·…"'()\[\]{}~\-]/g, '')
    .replace(/(입니까|인가요|일까요|은요|알려줘|알려주세요|궁금해|해줘|해주세요|되나요|나요|나와|있어|있나|뭐야|뭔가요)$/g, '')
    .replace(/(은|는|이|가|을|를|의|에|도|만)$/g, '');
}

async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// 모델에게 주는 유일한 도구. 카탈로그에서 고른 특약의 원문을 꺼내 온다.
const TOOLS = [{
  type: 'function',
  function: {
    name: 'read_clause',
    description:
      '약관 원문을 가져온다. 담보를 특정했으면 답하기 전에 반드시 호출할 것. ' +
      '면책·감액을 물었다면 section에 면책과 보상범위를 함께 넣어라 — ' +
      '보장개시일과 감액 규정은 보상범위 제1조에 있는 경우가 많다.',
    parameters: {
      type: 'object',
      properties: {
        no: {
          type: 'array', items: { type: 'string' }, maxItems: 4,
          description: '카탈로그의 특약번호. 예: ["2-109","1-28"]',
        },
        section: {
          type: 'array',
          items: { type: 'string', enum: ['담보정의', '보상범위', '면책', '한도', '분류표'] },
          description: '읽을 대목',
        },
      },
      required: ['no', 'section'],
    },
  },
}];

// 원문이 길어 통째로 넘기면 답변 여지가 줄어든다. 섹션당 상한을 두고 자른다.
const MAX_CHARS = 2600;

async function readClause(args: { no: string[]; section: string[] }) {
  const nos = (args.no ?? []).slice(0, 4);
  const secs = (args.section ?? []).slice(0, 5);
  if (!nos.length) return { error: '특약번호가 비어 있습니다.' };

  const { data, error } = await sb
    .from('clause_chunks')
    .select('id,no,title,section,content')
    .in('no', nos)
    .in('section', secs.length ? secs : ['담보정의', '보상범위'])
    .limit(12);
  if (error) return { error: error.message };
  if (!data?.length) {
    return { found: false, note: `${nos.join(', ')}의 ${secs.join('/')} 대목을 찾지 못했습니다.` };
  }
  return {
    found: true,
    clauses: data.map((r) => ({
      id: r.id, no: r.no, title: r.title, section: r.section,
      content: r.content.length > MAX_CHARS
        ? r.content.slice(0, MAX_CHARS) + '\n…(이하 생략)'
        : r.content,
    })),
  };
}

async function callModel(messages: unknown[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://surinsur.com',
      'X-Title': 'Surinsur AI',
    },
    body: JSON.stringify({
      model: MODEL, messages, tools: TOOLS, tool_choice: 'auto',
      temperature: 0.2,        // 약관 인용이라 흔들리면 안 된다
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST만 받습니다.' }, 405);
  if (!OPENROUTER_KEY) return json({ error: 'OPENROUTER_API_KEY가 설정되지 않았습니다.' }, 500);

  const t0 = Date.now();
  let question = '', sessionId = '', hint: unknown = null;

  try {
    const body = await req.json();

    // 입장 확인. 채팅 창을 열 때 한 번 부르고, 이후 모든 질문에도 함께 온다.
    if (ACCESS_CODE) {
      const given = String(body.access_code ?? '');
      if (given !== ACCESS_CODE) {
        return json({ error: '이용 코드가 올바르지 않습니다.', code: 'AUTH' }, 401);
      }
    }
    if (body.verify_only) return json({ ok: true });

    question = String(body.question ?? '').trim();
    sessionId = String(body.session_id ?? 'anon');
    hint = body.hint ?? null;
    const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
    if (!question) return json({ error: '질문이 비어 있습니다.' }, 400);
    if (question.length > 300) return json({ error: '질문이 너무 깁니다.' }, 400);

    // ── 1. 걸러내기 (모델을 부르지 않는다) ──
    const blocked = gate(question);
    if (blocked) {
      await sb.from('chat_logs').insert({
        session_id: sessionId, question, blocked: true,
        block_kind: blocked.kind, latency_ms: Date.now() - t0,
      });
      return json({ blocked: true, kind: blocked.kind, answer: blocked.message });
    }

    // ── 2. 같은 질문을 이미 받았나 ──
    const norm = normalize(question);
    const qHash = await sha(norm);
    const { data: sim } = await sb.rpc('match_cached_question', { q: norm });
    const best = Array.isArray(sim) ? sim[0] : null;

    // 아주 비슷하면 그대로 돌려준다. 모델을 부르지 않아 즉시 나오고 비용도 없다.
    if (best && best.sim >= 0.90) {
      await sb.rpc('touch_cache', { h: await sha(normalize(best.question)) });
      await sb.from('chat_logs').insert({
        session_id: sessionId, question, answer: best.answer,
        cards: best.cards ?? [], cache_sim: best.sim, latency_ms: Date.now() - t0,
      });
      return json({ answer: best.answer, cards: best.cards ?? [], cached: true, sim: best.sim });
    }

    // 어중간하게 비슷하면 답을 재활용하지 않고 참고로만 넘긴다.
    // 비슷해 보여도 담보가 다르면 답이 달라지기 때문이다.
    const prior = best && best.sim >= 0.72
      ? `\n\n[비슷한 이전 질문]\nQ: ${best.question}\nA: ${String(best.answer).slice(0, 700)}\n` +
        `(같은 질문인지 확인하고, 다르면 무시하고 새로 답하세요)`
      : '';

    const userMsg = (hint
      ? `${question}\n\n[검색 힌트]\n${JSON.stringify(hint)}`
      : question) + prior;

    const messages: Record<string, unknown>[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMsg },
    ];

    // 도구 왕복. 모델이 원문을 더 달라고 하면 최대 세 번까지 받아 준다.
    let answer = '', cited: string[] = [], usedNos: string[] = [];
    let tin = 0, tout = 0;

    for (let hop = 0; hop < 3; hop++) {
      const out = await callModel(messages);
      const msg = out.choices?.[0]?.message;
      tin += out.usage?.prompt_tokens ?? 0;
      tout += out.usage?.completion_tokens ?? 0;
      if (!msg) throw new Error('모델 응답이 비어 있습니다.');

      const calls = msg.tool_calls ?? [];
      if (!calls.length) { answer = msg.content ?? ''; break; }

      messages.push(msg);
      for (const call of calls) {
        let args: { no: string[]; section: string[] };
        try { args = JSON.parse(call.function.arguments || '{}'); }
        catch { args = { no: [], section: [] }; }
        const result = await readClause(args);
        if (result.found) {
          cited.push(...result.clauses.map((c) => c.id));
          usedNos.push(...(args.no ?? []));
        }
        messages.push({
          role: 'tool', tool_call_id: call.id, name: call.function.name,
          content: JSON.stringify(result),
        });
      }
    }

    const latency = Date.now() - t0;
    if (answer) {
      await sb.from('clause_cache').upsert({
        q_hash: qHash, question, norm, answer,
        cards: [...new Set(usedNos)], model: MODEL, tokens_in: tin, used_at: new Date().toISOString(),
      }, { onConflict: 'q_hash' });
    }
    await sb.from('chat_logs').insert({
      session_id: sessionId, question, answer,
      cited: [...new Set(cited)], cards: [...new Set(usedNos)],
      hint, model: MODEL, tokens_in: tin, tokens_out: tout, latency_ms: latency,
      cache_sim: best?.sim ?? null,
    });

    return json({ answer, cited: [...new Set(cited)], cards: [...new Set(usedNos)],
                  tokens: { in: tin, out: tout }, latency_ms: latency });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sb.from('chat_logs').insert({
      session_id: sessionId, question, error: message,
      model: MODEL, latency_ms: Date.now() - t0,
    }).catch(() => {});
    return json({ error: '답변을 만들지 못했습니다.', detail: message }, 500);
  }
});
