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

const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY');
const MODEL = Deno.env.get('CLAUSE_MODEL') ?? 'deepseek/deepseek-chat';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SYSTEM_PROMPT = Deno.env.get('CLAUSE_SYSTEM_PROMPT') ?? '';

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
    question = String(body.question ?? '').trim();
    sessionId = String(body.session_id ?? 'anon');
    hint = body.hint ?? null;
    const history = Array.isArray(body.history) ? body.history.slice(-4) : [];
    if (!question) return json({ error: '질문이 비어 있습니다.' }, 400);
    if (question.length > 500) return json({ error: '질문이 너무 깁니다.' }, 400);

    const userMsg = hint
      ? `${question}\n\n[검색 힌트]\n${JSON.stringify(hint)}`
      : question;

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
    await sb.from('chat_logs').insert({
      session_id: sessionId, question, answer,
      cited: [...new Set(cited)], cards: [...new Set(usedNos)],
      hint, model: MODEL, tokens_in: tin, tokens_out: tout, latency_ms: latency,
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
