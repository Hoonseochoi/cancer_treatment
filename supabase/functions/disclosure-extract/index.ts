// 자동고지AI 서버: 로그인 회원 확인 → 이용 횟수 확인(승인 회원 무제한, 그 외 평생 3회) → 프롬프트 생성 → AI 호출.
// OpenRouter 키는 여기(Edge Function 비밀값 OPENROUTER_API_KEY)에만 있고 브라우저에는 없다.
// 프롬프트도 여기서 만들어, 이 함수를 우리 키로 아무 질문이나 보내는 통로로 쓸 수 없게 한다.
//
// 요청: POST { action: 'status' }
//       POST { action: 'extract', run_id, raw_text, today, target_lines? }
//   run_id는 정리 1번마다 브라우저가 만든다. 같은 run_id로 나눠 보낸 요청·재요청은 이용 1회로 센다.

import { buildRecordPrompt, numberLines } from '../../../disclosure/shared/prompt.mjs';
import { OPENROUTER_MODEL, requestCompletion } from '../../../disclosure/shared/openrouter.mjs';

const OPENROUTER_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SB_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const FREE_LIMIT = 3;
// 원문 1건이 많아야 8조각 + 빠뜨린 줄 재요청 1번이다. 그보다 많이 오면 같은 run_id로 계속 부르는 남용으로 본다.
const MAX_CALLS_PER_RUN = 12;
const MAX_CHARS = 20000;
const MAX_LINES = 600;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// 게이트웨이(verify_jwt)는 공개 anon 키도 통과시키므로, 실제 로그인 회원인지는 여기서 다시 확인한다.
async function currentUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON_KEY } });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ?? null;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name} ${res.status} ${await res.text()}`);
  return res.json();
}

const remainingOf = (approved: boolean, used: number) => (approved ? null : Math.max(0, FREE_LIMIT - used));

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

  try {
    if (body.action === 'status') {
      const [s] = await rpc('disclosure_status', { p_user: userId });
      return json({ approved: s.approved, used: s.used, limit: FREE_LIMIT, remaining: remainingOf(s.approved, s.used) });
    }
    if (body.action !== 'extract') return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);

    const rawText = String(body.raw_text ?? '');
    const runId = String(body.run_id ?? '');
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today)) ? String(body.today) : new Date().toISOString().slice(0, 10);
    const lines = rawText.split('\n');
    if (!rawText.trim() || rawText.length > MAX_CHARS || lines.length > MAX_LINES) {
      return json({ error: '병력은 2만 자·600줄 안으로 입력해주세요', code: 'BAD' }, 400);
    }
    if (!/^[A-Za-z0-9-]{8,64}$/.test(runId)) return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);
    let target: number[] | null = null;
    if (Array.isArray(body.target_lines)) {
      target = (body.target_lines as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= lines.length);
      if (!target.length) return json({ error: '잘못된 요청이에요', code: 'BAD' }, 400);
    }

    const [claim] = await rpc('claim_disclosure_run', {
      p_user: userId, p_run: runId, p_free_limit: FREE_LIMIT, p_max_calls: MAX_CALLS_PER_RUN,
    });
    if (!claim.allowed) {
      if (claim.reason === 'limit') {
        return json({ error: '승인된 회원만 이용가능합니다', code: 'LIMIT', used: claim.used, limit: FREE_LIMIT }, 403);
      }
      return json({ error: '요청이 너무 많아요. 다시 정리해주세요', code: 'TOO_MANY' }, 429);
    }

    try {
      const targetText = target ? target.map((n) => `${n}: ${lines[n - 1]}`).join('\n') : '';
      const prompt = buildRecordPrompt(numberLines(lines), today, targetText);
      const { text, provider } = await requestCompletion(prompt, OPENROUTER_KEY, OPENROUTER_MODEL);
      return json({ text, provider, model: OPENROUTER_MODEL, approved: claim.approved, used: claim.used, remaining: remainingOf(claim.approved, claim.used) });
    } catch (e) {
      // AI 호출이 실패하면 이번 호출을 되돌린다 — 실패로 무료 이용이 깎이지 않게
      await rpc('release_disclosure_run', { p_user: userId, p_run: runId }).catch(() => {});
      console.error('AI 호출 실패:', e);
      return json({ error: 'AI 호출에 실패했어요', code: 'AI' }, 502);
    }
  } catch (e) {
    console.error('disclosure-extract 오류:', e);
    return json({ error: '서버 오류가 났어요', code: 'SERVER' }, 500);
  }
});
