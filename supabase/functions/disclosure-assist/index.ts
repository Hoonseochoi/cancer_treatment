// 자동고지AI 보조 기능 서버 — 분류는 화면의 규칙이 하고, 여기서는 AI가 "질문·점검·연결 제안"만 한다.
//   questions: 확인필요 병력마다 고객에게 카톡으로 보낼 확인 질문
//   review:    원문과 정리 결과를 대조해 빠진 것·다른 것·병력이 아닌 것 짚기(참고용)
//   uw_match:  가이드에 안 걸린 입원·수술 병력 → U/W가이드 항목 후보, 약 이름 → 약 종류
// 이용 횟수는 깎지 않는다. 대신 이미 이용 1회를 차지한 정리(run_id)의 주인만, 정리 1번에 몇 번까지만 부를 수 있다
// (우리 키로 아무 질문이나 보내는 통로가 되지 않게 프롬프트도 여기서 만든다).
// U/W가이드 항목 이름은 삼성 회원에게만 쓰이고 화면으로 내려보내지 않는다(대외비 — 키만 돌려준다).
//
// 요청: POST { action: 'questions', run_id, today, items: [{ id, name, reason, question?, source? }] }
//       POST { action: 'review', run_id, today, raw_text, histories: [{ name, code, lines, first, last, admission, surgery, visits, meds, medDays }] }
//       POST { action: 'uw_match', run_id, items: [{ id, name, code?, surgery?, drug? }] }

import { OPENROUTER_MODEL, requestCompletion } from '../../../disclosure/shared/openrouter.mjs';
import {
  buildMatchPrompt, buildQuestionsPrompt, buildReviewPrompt, DRUG_CLASSES, filterReviewNotes, parseJsonArray,
} from '../../../disclosure/shared/assist_prompts.mjs';

const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SB_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// 정리 1번에 질문·점검·연결 각 1번 + 세부 수정 후 다시 부르기 몇 번
const MAX_ASSIST_PER_RUN = 10;
const MAX_ITEMS = 20;
const MAX_CHARS = 20000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function currentUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON_KEY } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ?? null;
}

const serviceHeaders = { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` };

async function select(path: string, extra: Record<string, string> = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { ...serviceHeaders, ...extra } });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return res;
}
const rows = async (path: string) => (await select(path)).json();
// PostgREST 개수 세기(본문 없이 Content-Range로)
async function count(path: string): Promise<number> {
  const res = await select(path, { Prefer: 'count=exact', Range: '0-0' });
  const range = res.headers.get('content-range') ?? '';
  await res.body?.cancel();
  return Number(range.split('/')[1] ?? 0) || 0;
}

async function insertRow(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) console.error(`${table} 기록 실패:`, res.status, await res.text());
}

const numberLines = (lines: string[]) => lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const idOf = (v: unknown) => s(v, 40);

// 가이드 항목을 AI에게 보낼 목록으로: 수술/비수술·양측/일측처럼 조건(when)으로만 나뉜 항목은 하나로 묶는다
// (어느 쪽인지는 화면 규칙이 병력으로 고른다). key = 그 묶음의 첫 항목 id
function guideGroups(guide: Array<{ id: string; name: string; when?: string }>) {
  const base = (n: string) => n.replace(/\(.*$/, '').trim();
  const groups: Array<{ key: string; name: string }> = [];
  const seen = new Map<string, string>();
  for (const e of guide) {
    if (e.when) {
      const b = base(e.name);
      if (seen.has(b)) continue;
      seen.set(b, e.id);
      groups.push({ key: e.id, name: b });
    } else {
      groups.push({ key: e.id, name: e.name });
    }
  }
  return groups;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST 요청만 받습니다', code: 'BAD' }, 405);

  const userId = await currentUserId(req);
  if (!userId) return json({ error: '로그인이 필요해요', code: 'LOGIN' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);
  }
  const action = String(body.action ?? '');
  if (!['questions', 'review', 'uw_match'].includes(action)) return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);
  const runId = String(body.run_id ?? '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(runId)) return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today)) ? String(body.today) : new Date().toISOString().slice(0, 10);

  try {
    // 이 회원이 이용 1회를 차지한 정리인지
    const owned = await rows(`disclosure_usage?user_id=eq.${userId}&run_id=eq.${encodeURIComponent(runId)}&select=run_id`);
    if (!owned.length) return json({ error: '정리를 먼저 해주세요', code: 'RUN' }, 403);
    const used = await count(`disclosure_ai_calls?run_id=eq.${encodeURIComponent(runId)}&kind=like.assist-*&select=id`);
    if (used >= MAX_ASSIST_PER_RUN) return json({ error: '요청이 너무 많아요', code: 'TOO_MANY' }, 429);

    let prompt = '';
    let finish: (list: Record<string, unknown>[]) => unknown[];

    if (action === 'questions') {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS).map((it: any) => ({
        id: idOf(it?.id), name: s(it?.name, 80), reason: s(it?.reason, 300), question: s(it?.question, 200), source: s(it?.source, 300),
      })).filter(it => it.id && it.name);
      if (!items.length) return json({ items: [] });
      const ids = new Set(items.map(it => it.id));
      prompt = buildQuestionsPrompt(items, today);
      finish = list => list
        .filter(x => ids.has(idOf(x.id)) && typeof x.question === 'string' && x.question.trim())
        .map(x => ({ id: idOf(x.id), question: s(x.question, 200).trim() }));
    } else if (action === 'review') {
      const rawText = String(body.raw_text ?? '');
      const lines = rawText.split('\n');
      if (!rawText.trim() || rawText.length > MAX_CHARS || lines.length > 600) return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);
      const num = (v: unknown) => (Number.isFinite(v) && (v as number) > 0 ? Math.min(Math.round(v as number), 9999) : null);
      const histories = (Array.isArray(body.histories) ? body.histories : []).slice(0, 80).map((h: any) => ({
        name: s(h?.name, 80), code: s(h?.code, 12), first: s(h?.first, 12), last: s(h?.last, 12),
        lines: (Array.isArray(h?.lines) ? h.lines : []).filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= lines.length).slice(0, 60),
        admission: s(h?.admission, 30), surgery: s(h?.surgery, 60), visits: num(h?.visits),
        meds: s(h?.meds, 80), medDays: num(h?.medDays),
      }));
      prompt = buildReviewPrompt(numberLines(lines), histories, today);
      finish = list => filterReviewNotes(list, histories, lines.length);
    } else {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, MAX_ITEMS).map((it: any) => ({
        id: idOf(it?.id), name: s(it?.name, 80), code: s(it?.code, 12), surgery: s(it?.surgery, 60), drug: s(it?.drug, 60),
      })).filter(it => it.id && it.name);
      if (!items.length) return json({ items: [] });
      // 가이드 연결은 삼성 회원(주 사용 삼성 또는 승인 회원)만 — 아니면 약 종류만 고른다
      const [profile] = await rows(`profiles?id=eq.${userId}&select=main_insurer`);
      const approved = await rows(`disclosure_approved?user_id=eq.${userId}&select=user_id`);
      const entitled = profile?.main_insurer === 'samsung' || approved.length > 0;
      let groups: Array<{ key: string; name: string }> = [];
      if (entitled) {
        const [rule] = await rows('disclosure_uw_rules?id=eq.samsung-simple&select=data');
        groups = guideGroups(rule?.data?.guide ?? []);
      }
      if (!groups.length && !items.some(it => it.drug)) return json({ items: [] });
      const keys = new Set(groups.map(g => g.key));
      const ids = new Set(items.map(it => it.id));
      prompt = buildMatchPrompt(items, groups);
      finish = list => list
        .filter(x => ids.has(idOf(x.id)))
        .map(x => ({
          id: idOf(x.id),
          guide: typeof x.guide === 'string' && keys.has(x.guide) ? x.guide : null,
          drug: typeof x.drug === 'string' && DRUG_CLASSES.includes(x.drug) ? x.drug : null,
        }))
        .filter(x => x.guide || x.drug);
    }

    const kind = `assist-${action === 'uw_match' ? 'match' : action}`;
    const startedAt = Date.now();
    const callRow = { user_id: userId, run_id: runId, kind, model: OPENROUTER_MODEL };
    try {
      const { text, provider, usage, generationId, backupFired } = await requestCompletion(prompt, OPENROUTER_KEY, OPENROUTER_MODEL);
      await insertRow('disclosure_ai_calls', {
        ...callRow,
        provider,
        generation_id: generationId,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        cached_tokens: usage.cachedTokens,
        cost_usd: usage.cost,
        backup_fired: backupFired,
        latency_ms: Date.now() - startedAt,
        ai_text: text,
      });
      return json({ items: finish(parseJsonArray(text)) });
    } catch (e) {
      console.error('AI 보조 호출 실패:', e);
      await insertRow('disclosure_ai_calls', { ...callRow, latency_ms: Date.now() - startedAt, error: String(e instanceof Error ? e.message : e).slice(0, 2000) });
      return json({ error: 'AI 호출에 실패했어요', code: 'AI' }, 502);
    }
  } catch (e) {
    console.error('disclosure-assist 오류:', e);
    return json({ error: '서버 오류가 났어요', code: 'SERVER' }, 500);
  }
});
