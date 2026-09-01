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
import { gate, normalize, digitsOf, sha } from './gate.ts';

const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY');
const MODEL = Deno.env.get('CLAUSE_MODEL') ?? 'deepseek/deepseek-chat';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// 지침과 담보 카탈로그(6천 자)는 사이트에서 가져온다.
// 함수에 넣어 두면 문구 한 줄 고칠 때마다 재배포해야 하고, Secret에 넣으면
// 대시보드에 6천 자를 붙여 넣어야 하는 데다 git으로도 관리되지 않는다.
// 이렇게 두면 prompts/clause_system.md를 고쳐 push하는 것으로 끝난다.
const PROMPT_URL = Deno.env.get('CLAUSE_PROMPT_URL') ??
  'https://surinsur.com/prompts/clause_system.md';
const PROMPT_OVERRIDE = Deno.env.get('CLAUSE_SYSTEM_PROMPT') ?? '';

// 인스턴스가 살아 있는 동안만 들고 있는다. 프롬프트를 고치면 잠시 뒤 자연히 갈린다.
let _prompt = '';
let _promptAt = 0;
const PROMPT_TTL = 10 * 60 * 1000;

async function systemPrompt(): Promise<string> {
  if (PROMPT_OVERRIDE) return PROMPT_OVERRIDE;
  const now = Date.now();
  if (_prompt && now - _promptAt < PROMPT_TTL) return _prompt;
  try {
    const res = await fetch(PROMPT_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`프롬프트 ${res.status}`);
    const text = (await res.text()).trim();
    if (text.length < 500) throw new Error('프롬프트가 너무 짧습니다');
    _prompt = text;
    _promptAt = now;
  } catch (e) {
    // 가져오지 못했는데 예전 것이 남아 있으면 그걸 쓴다. 아무것도 없을 때만 실패시킨다.
    if (!_prompt) throw e;
  }
  return _prompt;
}
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

// 모델에게 주는 유일한 도구. 카탈로그에서 고른 특약의 원문을 꺼내 온다.
const TOOLS = [{
  type: 'function',
  function: {
    name: 'read_clause',
    description:
      '약관 원문을 가져온다. 담보를 특정했으면 답하기 전에 반드시 호출할 것. ' +
      '수술비는 여러 담보가 겹쳐 지급되므로 해당하는 특약을 한 번에 넣어 확인하라. ' +
      '면책·감액을 물었다면 section에 면책과 보상범위를 함께 넣어라 — ' +
      '면책기간(보장개시일 90일)과 감액은 면책 대목이 아니라 보상범위 제1~2조에 있다.',
    parameters: {
      type: 'object',
      properties: {
        no: {
          type: 'array', items: { type: 'string' }, maxItems: 8,
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

// 원문 상한. 토큰을 아끼려고 1,500자로 조였더니 조항이 중간에 잘려 모델이
// 확인할 근거가 모자랐다. 약관 섹션은 대부분 2,000~2,500자라 3,000자면
// 사실상 전문이 넘어간다. 답이 맞는 편이 비용보다 먼저다.
const MAX_CHARS = 3000;

async function readClause(args: { no: string[]; section: string[] }) {
  const nos = (args.no ?? []).slice(0, 8);
  const secs = (args.section ?? []).slice(0, 5);
  if (!nos.length) return { error: '특약번호가 비어 있습니다.' };

  const { data, error } = await sb
    .from('clause_chunks')
    .select('id,no,title,section,content')
    .in('no', nos)
    .in('section', secs.length ? secs : ['담보정의', '보상범위'])
    .limit(14);
  if (error) return { error: error.message };

  const rows = data ?? [];

  // 특약의 '분류표' 대목은 [[별표-…]] 링크 목록일 뿐이라 등급이 없다.
  // 실측: "1~8종에서 몇 종?"에 모델이 2-109의 분류표를 요청했지만 174자짜리
  // 링크만 돌아왔고, 등급을 알 길이 없자 근거 없이 "6종"이라고 지어냈다.
  // 링크를 따라 별표 본문까지 가져다줘야 한다 — 모델은 별표 번호를 모른다.
  const wantTable = !secs.length || secs.includes('분류표');
  if (wantTable) {
    const links = new Set<string>();
    rows.filter((r) => r.section === '분류표').forEach((r) => {
      for (const m of String(r.content).matchAll(/\[\[별표-([^\]|#]+)/g)) {
        links.add(m[1].trim());
      }
    });
    const already = new Set(rows.map((r) => r.no));
    const todo = [...links].filter((x) => !already.has(x)).slice(0, 3);
    if (todo.length) {
      const { data: tbl } = await sb
        .from('clause_chunks')
        .select('id,no,title,section,content')
        .in('no', todo)
        .eq('section', '분류표')
        .limit(10);
      (tbl ?? []).forEach((r) => rows.push(r));
    }
  }

  if (!rows.length) {
    return { found: false, note: `${nos.join(', ')}의 ${secs.join('/')} 대목을 찾지 못했습니다.` };
  }
  return {
    found: true,
    clauses: rows.map((r) => ({
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
      max_tokens: 1800,        // 담보를 여럿 나열하면 답이 길어진다
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
  let question = '', sessionId = '', hint: unknown = null, isTest = false;

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
    isTest = body.test === true;
    // 채팅이라 이어서 묻는 게 보통이다. 두 턴만 남기면 세 번째 질문에서 앞이 잘려
    // 무엇을 이야기하던 중인지 모르게 된다.
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    if (!question) return json({ error: '질문이 비어 있습니다.' }, 400);
    if (question.length > 300) return json({ error: '질문이 너무 깁니다.' }, 400);

    // ── 1. 걸러내기 (모델을 부르지 않는다) ──
    const blocked = gate(question);
    if (blocked) {
      await sb.from('chat_logs').insert({
        session_id: sessionId, question, blocked: true, is_test: isTest,
        block_kind: blocked.kind, latency_ms: Date.now() - t0,
      });
      return json({ blocked: true, kind: blocked.kind, answer: blocked.message });
    }

    // ── 2. 같은 질문을 이미 받았나 ──
    const sysPrompt = await systemPrompt();
    // 지침이 바뀌면 이전 답은 더 이상 그 지침의 산물이 아니다. 캐시 키에 지침
    // 지문을 섞어 두면 프롬프트를 고치는 것만으로 캐시가 자연히 갈린다 —
    // 실측: 지침을 고친 뒤에도 예전 답이 그대로 나와 고친 효과가 보이지 않았다.
    const promptTag = (await sha(sysPrompt)).slice(0, 8);
    const norm = normalize(question);
    const qHash = await sha(promptTag + '|' + norm);
    const { data: sim } = await sb.rpc('match_cached_question', { q: promptTag + '|' + norm });
    const best = Array.isArray(sim) ? sim[0] : null;

    // 아주 비슷하고 숫자도 같으면 그대로 돌려준다. 모델을 부르지 않아 즉시 나오고
    // 비용도 없다. 숫자가 다르면(2-109 vs 2-110) 아무리 비슷해도 새로 답한다.
    const sameDigits = best ? digitsOf(question) === digitsOf(best.question) : false;
    if (best && best.sim >= 0.80 && sameDigits) {
      await sb.rpc('touch_cache', { h: await sha(promptTag + '|' + normalize(best.question)) });
      await sb.from('chat_logs').insert({
        session_id: sessionId, question, answer: best.answer, is_test: isTest,
        cards: best.cards ?? [], cache_sim: best.sim, latency_ms: Date.now() - t0,
      });
      return json({ answer: best.answer, cards: best.cards ?? [], cached: true, sim: best.sim });
    }

    // 어중간하게 비슷하면 답을 재활용하지 않고 참고로만 넘긴다.
    // 비슷해 보여도 담보가 다르면 답이 달라지기 때문이다.
    const prior = best && best.sim >= 0.60
      ? `\n\n[비슷한 이전 질문]\nQ: ${best.question}\nA: ${String(best.answer).slice(0, 700)}\n` +
        `(같은 질문인지 확인하고, 다르면 무시하고 새로 답하세요)`
      : '';

    const userMsg = (hint
      ? `${question}\n\n[검색 힌트]\n${JSON.stringify(hint)}`
      : question) + prior;

    const messages: Record<string, unknown>[] = [
      { role: 'system', content: sysPrompt },
      ...history,
      { role: 'user', content: userMsg },
    ];

    // 도구 왕복. 두 번으로 묶었더니 모델이 한 번 읽고 부족해도 더 못 물었다.
    // 수술비처럼 담보가 여럿 겹치는 질문은 나눠 확인해야 해서 세 번까지 열어 둔다.
    // 왕복마다 앞선 메시지가 다시 실리는 비용은 있지만, 반쪽짜리 답보다 낫다.
    let answer = '', cited: string[] = [], usedNos: string[] = [];
    let tin = 0, tout = 0;
    // 무엇을 어떻게 골랐는지 남긴다. 답이 이상할 때 힌트가 빗나간 건지,
    // 모델이 엉뚱한 대목을 읽은 건지 구분하려면 이 기록이 있어야 한다.
    const trace: Record<string, unknown>[] = [];
    let hops = 0, evidenceChars = 0;

    for (let hop = 0; hop < 3; hop++) {
      hops = hop + 1;
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
        const chars = result.found
          ? result.clauses.reduce((n, c) => n + c.content.length, 0) : 0;
        evidenceChars += chars;
        trace.push({
          hop: hops, no: args.no ?? [], section: args.section ?? [],
          found: !!result.found, chars,
          got: result.found ? result.clauses.map((c) => `${c.no}/${c.section}`) : [],
        });
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

    // 근거를 못 찾고 답한 것은 캐시에 넣지 않는다. 넣어 두면 잘못된 답이 계속
    // 재사용된다 — 실측: 별표를 못 읽어 "확인할 수 없다"고 한 답이 캐시에 남아,
    // 원인을 고친 뒤에도 같은 답이 그대로 나왔다.
    const grounded = usedNos.length > 0 && evidenceChars >= 200 &&
      !/확인할 수 없|찾지 못|제공해 주시면|알 수 없습니다/.test(answer);

    if (answer && grounded) {
      await sb.from('clause_cache').upsert({
        q_hash: qHash, question, norm: promptTag + '|' + norm, answer,
        cards: [...new Set(usedNos)], model: MODEL, tokens_in: tin, used_at: new Date().toISOString(),
      }, { onConflict: 'q_hash' });
    }
    // 힌트가 실제로 도움이 됐는지 — 규칙 검색이 넘긴 후보와 모델이 고른 담보가 겹쳤는가.
    const hintCards: string[] = Array.isArray((hint as { 담보?: string[] })?.담보)
      ? (hint as { 담보: string[] }).담보.map((x) => String(x).split(' ')[0])
      : [];
    const picked = [...new Set(usedNos)];
    const hintHit = hintCards.length && picked.length
      ? picked.some((p) => hintCards.includes(p))
      : null;

    await sb.from('chat_logs').insert({
      session_id: sessionId, question, answer, is_test: isTest,
      cited: [...new Set(cited)], cards: picked,
      hint, hint_cards: hintCards, hint_hit: hintHit,
      hops, tool_calls: trace, evidence_chars: evidenceChars,
      prompt_chars: sysPrompt.length,
      model: MODEL, tokens_in: tin, tokens_out: tout, latency_ms: latency,
      cache_sim: best?.sim ?? null,
    });

    return json({
      answer, cited: [...new Set(cited)], cards: picked,
      tokens: { in: tin, out: tout }, latency_ms: latency,
      ...(isTest ? { trace: { hops, tool_calls: trace, hint_cards: hintCards,
                              hint_hit: hintHit, evidence_chars: evidenceChars,
                              prompt_chars: sysPrompt.length,
                              cache_sim: best?.sim ?? null } } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sb.from('chat_logs').insert({
      session_id: sessionId, question, error: message, is_test: isTest,
      model: MODEL, latency_ms: Date.now() - t0,
    }).catch(() => {});
    return json({ error: '답변을 만들지 못했습니다.', detail: message }, 500);
  }
});
