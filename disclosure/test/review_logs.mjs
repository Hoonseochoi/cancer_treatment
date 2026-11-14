// 주간 점검: 최근 실제 정리 기록(disclosure_runs)을 딥시크에게 다시 대조시켜 "빠진 것·다른 것·병력 아님" 보고서를 만든다.
// 화면의 "AI 점검 메모"와 같은 프롬프트(shared/assist_prompts.mjs)를 쓴다. 분류 규칙을 고칠 후보를 찾는 용도.
//
// 사용: node disclosure/test/review_logs.mjs [--days 7] [--limit 40]
//   - 기록 읽기: Supabase CLI(로그인 필요) 읽기 전용 조회 — 운영 DB에 쓰지 않는다
//   - AI 호출: disclosure/config.js의 OpenRouter 키(로컬 전용)
//   - 보고서: disclosure/private/reports/review_YYYY-MM-DD.md — 고객 병력 원문이 들어가므로 private(커밋 안 함)에만 둔다
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requestCompletion, OPENROUTER_MODEL } from '../shared/openrouter.mjs';
import { buildReviewPrompt, filterReviewNotes, parseJsonArray } from '../shared/assist_prompts.mjs';
import { numberLines } from '../shared/prompt.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'omgwvnibssizmhovporl';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const DAYS = arg('days', 7);
const LIMIT = arg('limit', 40);

function loadKey() {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'))(m, m.exports);
  return m.exports.OPENROUTER_API_KEY;
}

function fetchRuns() {
  const sql = `select id, created_at, today, member_name, run_id, raw_text, histories, app_version
    from public.disclosure_runs
    where source = 'ai' and created_at > now() - interval '${Math.max(1, Math.floor(DAYS))} days'
      and jsonb_typeof(histories) = 'array' and jsonb_array_length(histories) > 0
    order by created_at desc limit ${Math.max(1, Math.floor(LIMIT))}`;
  const out = execFileSync('npx', ['--yes', 'supabase@latest', 'db', 'query', `--remote=${PROJECT_REF}`, '--read-only', '--output-format', 'json', sql], {
    cwd: path.join(ROOT, '..'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const data = JSON.parse(out.slice(out.search(/[[{]/)));
  return Array.isArray(data) ? data : data.rows || [];
}

// 화면(assist.js)과 같은 모양으로 정리 결과를 넘긴다
const reviewHistories = histories => histories.map(h => ({
  name: h.진단명 || '(이름없음)',
  code: h.코드추정 ? '' : h.진단코드 || '',
  lines: Array.isArray(h.원문줄) ? h.원문줄 : [],
  first: h.최초진단일 || '',
  last: h.최근진료일 || '',
  admission: h.입원여부 ? `${h.입원일수 ?? '?'}일` : '',
  surgery: h.수술여부 ? h.수술명 || '수술함' : '',
  visits: h.통원횟수 || null,
  meds: h.약물명 || (h.상시복용여부 ? '복용 중' : ''),
  medDays: h.계속투약일수 || null,
}));

const KIND = { missing: '빠진 듯', mismatch: '원문과 다름', not_history: '병력 아님' };
const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

(async () => {
  const key = loadKey();
  const runs = fetchRuns();
  console.error(`최근 ${DAYS}일 정리 ${runs.length}건 점검 중…`);
  const results = [];
  let cost = 0;
  for (const run of runs) {
    const lines = String(run.raw_text || '').split('\n');
    // 예전 기록에는 원문줄이 없다 — 원본(합친 원문 줄 텍스트)으로 줄 번호를 되찾는다
    run.histories.forEach(h => {
      if (Array.isArray(h.원문줄)) return;
      const src = new Set(String(h.원본 || '').split('\n').map(t => t.trim()).filter(Boolean));
      h.원문줄 = lines.map((t, i) => (src.has(t.trim()) ? i + 1 : 0)).filter(Boolean);
    });
    const sent = reviewHistories(run.histories);
    const prompt = buildReviewPrompt(numberLines(lines), sent, String(run.today || run.created_at).slice(0, 10));
    try {
      const { text, usage } = await requestCompletion(prompt, key, OPENROUTER_MODEL);
      cost += usage.cost || 0;
      results.push({ run, lines, notes: filterReviewNotes(parseJsonArray(text), sent, lines.length) });
    } catch (e) {
      results.push({ run, lines, notes: [], error: String(e.message || e) });
    }
    process.stderr.write('.');
  }
  process.stderr.write('\n');

  const counts = { missing: 0, mismatch: 0, not_history: 0 };
  results.forEach(r => r.notes.forEach(n => { if (counts[n.kind] !== undefined) counts[n.kind]++; }));
  const flagged = results.filter(r => r.notes.length || r.error);
  const today = new Date().toISOString().slice(0, 10);
  const md = [
    `# 자동고지AI 주간 점검 — ${today}`,
    '',
    `- 기간: 최근 ${DAYS}일 · 정리 ${results.length}건 · 지적이 있는 정리 ${flagged.length}건`,
    `- 지적: 빠진 듯 ${counts.missing} · 원문과 다름 ${counts.mismatch} · 병력 아님 ${counts.not_history}`,
    `- 점검 비용: $${cost.toFixed(5)} (${OPENROUTER_MODEL})`,
    '- AI 지적은 틀릴 수 있어요. 원문과 대조해 규칙을 고칠 사례만 골라 regression_real.test.js에 넣어주세요.',
    '',
  ];
  flagged.forEach(({ run, lines, notes, error }) => {
    md.push(`## #${run.id} · ${String(run.created_at).slice(0, 16)} · ${run.member_name || '회원'} · v${run.app_version || '?'}`);
    md.push(`run_id \`${run.run_id}\` · 병력 ${run.histories.length}개`, '');
    if (error) md.push(`- AI 호출 실패: ${clip(error, 200)}`);
    notes.forEach(n => {
      const src = Number.isInteger(n.line) && lines[n.line - 1] ? ` — 원문 ${n.line}줄 \`${clip(lines[n.line - 1], 80).replace(/`/g, "'")}\`` : '';
      md.push(`- **${KIND[n.kind] || n.kind}** ${clip(n.text, 160)}${src}`);
    });
    md.push('');
  });

  const dir = path.join(ROOT, 'private', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `review_${today}.md`);
  fs.writeFileSync(file, md.join('\n'));
  console.log(file);
})();
