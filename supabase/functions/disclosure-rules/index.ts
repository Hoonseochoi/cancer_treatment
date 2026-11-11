// 간편 알릴의무 규칙(삼성화재 간편보험 U/W가이드·경증 프리패스 목록) 내려주기.
// 이 내용은 삼성화재 대외비라 사이트 파일에 두지 않고, 로그인한 "삼성 회원"에게만 준다:
//   - 주로 삼성 가입제안서를 분석하는 회원(profiles.main_insurer = 'samsung'), 또는
//   - 자동고지AI 승인 회원(disclosure_approved)
// 요청: POST {} (Authorization: 로그인 세션 토큰)
// 응답: { allowed, insurer, rules? }  — allowed가 false면 rules 없음(화면은 insurer로 "메리츠는 아직 지원이 안 돼요" 등 안내)
// 자동고지AI 이용 자체도 같은 기준이다(서버 claim_disclosure_run이 새 정리를 막음).

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SB_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

async function select(path: string) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_SERVICE_KEY, Authorization: `Bearer ${SB_SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST 요청만 받습니다' }, 405);
  const userId = await currentUserId(req);
  if (!userId) return json({ error: '로그인이 필요해요', code: 'LOGIN' }, 401);
  try {
    const [profile] = await select(`profiles?id=eq.${userId}&select=main_insurer,insurer_counts`);
    const [approved] = await select(`disclosure_approved?user_id=eq.${userId}&select=user_id`);
    const allowed = profile?.main_insurer === 'samsung' || !!approved;
    if (!allowed) return json({ allowed: false, insurer: profile?.main_insurer ?? null });
    const [row] = await select('disclosure_uw_rules?id=eq.samsung-simple&select=data,updated_at');
    return json({ allowed: true, insurer: profile?.main_insurer ?? null, rules: row?.data ?? null, updated_at: row?.updated_at ?? null });
  } catch (e) {
    console.error('disclosure-rules 오류:', e);
    return json({ error: '서버 오류가 났어요', code: 'SERVER' }, 500);
  }
});
