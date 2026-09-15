// 실제 OpenRouter를 호출해 자유양식 병력 → AI 기록 추출(+빠뜨린 줄 재요청) → 규칙 병합 → Q1~Q6 분류까지 보여주는 수동 평가 스크립트.
// 사용: node disclosure/test/eval_ai.js "<샘플.md>" [기준일 YYYY-MM-DD] [--raw]
// 샘플 파일은 "---" 줄로 케이스를 구분한다. 케이스는 한 건씩 순서대로 돌려 실제 체감 시간을 잰다.
const fs = require('fs');
const path = require('path');

function loadScript(file) {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(__dirname, '..', file), 'utf8'))(m, m.exports);
  return m.exports;
}

Object.assign(global, loadScript('data.js'));
const { OPENROUTER_API_KEY } = loadScript('config.js');
const { extractRecordsWithAI, OPENROUTER_MODEL } = require('../ai.js');
const { buildHistoriesWithAI, classifyHistories } = require('../app.js');

const args = process.argv.slice(2);
const showRaw = args.includes('--raw');
const [samplePath, today = new Date().toISOString().slice(0, 10)] = args.filter(a => a !== '--raw');
const cases = fs.readFileSync(samplePath, 'utf8').split(/^-{3,}\s*$/m).map(s => s.trim()).filter(Boolean);

function summarize(h) {
  const parts = [`${h.진단명}/${h.진단코드}`, `최근 ${h.최근진료일 || '?'}`];
  if (h.최초진단일 && h.최초진단일 !== h.최근진료일) parts.push(`최초 ${h.최초진단일}`);
  if (h.입원일수 !== null) parts.push(`입원 ${h.입원일수}일`);
  else if (h.입원여부) parts.push('입원');
  if (h.수술명) parts.push(`수술 ${h.수술명}`);
  if (h.통원횟수 !== null) parts.push(`통원 ${h.통원횟수}회`);
  if (h.계속투약일수 !== null) parts.push(`투약 ${h.계속투약일수}일`);
  if (h.약물명) parts.push(`약물 ${h.약물명}`);
  if (h.상시복용여부) parts.push('상시복용');
  if (h.재검사여부) parts.push('재검사');
  if (h.비고) parts.push(`비고 ${h.비고}`);
  if (h.원문확인필요) parts.push(`원문 "${h.원본}"`);
  return parts.join(' | ');
}

(async () => {
  console.log(`model=${OPENROUTER_MODEL} today=${today} cases=${cases.length}\n`);
  let totalMs = 0;
  for (const [i, raw] of cases.entries()) {
    const t0 = Date.now();
    const requestLog = [];
    const extract = onlyLines => {
      const pending = extractRecordsWithAI(raw, OPENROUTER_API_KEY, { today, onlyLines });
      return pending.then(out => { requestLog.push(...out.chunks.map(c => `${c.provider || '?'} ${c.ms}ms`)); return out; });
    };
    try {
      const { histories, records, retriedLines, missingLines } = await buildHistoriesWithAI(extract, today);
      const ms = Date.now() - t0;
      totalMs += ms;
      console.log(`=============== CASE ${i + 1} (${ms}ms, 요청 ${requestLog.length}개, 기록 ${records.length}줄, 재요청줄 ${retriedLines.length}, 미반영 ${missingLines.length}) ===============`);
      console.log(`요청: ${requestLog.join(' / ')}`);
      if (showRaw) {
        console.log(`${raw}\n--------------- 기록(줄번호 재확인 후) ---------------`);
        records.forEach(r => console.log([r.lineNo, r.code, r.name, r.type, r.start, r.end, r.value ?? '', r.detail].join('|')));
        if (retriedLines.length) console.log(`재요청한 줄: ${retriedLines.join(', ')}`);
      }
      console.log(`--------------- 병력 ${histories.length}건 ---------------`);
      histories.forEach(h => console.log(`- ${summarize(h)}`));
      const result = classifyHistories(histories, today);
      const classified = new Set();
      console.log('--------------- 분류 ---------------');
      Q_DEFS.forEach(q => {
        const { included, review } = result[q.id];
        [...included, ...review].forEach(h => classified.add(h.id));
        if (included.length || review.length) {
          console.log(`${q.id}: ${included.map(h => h.진단명).join(', ')}${review.length ? ` [확인필요: ${review.map(h => h.진단명).join(', ')}]` : ''}`);
        }
      });
      const rest = histories.filter(h => !classified.has(h.id));
      if (rest.length) console.log(`미분류: ${rest.map(h => h.진단명).join(', ')}`);
      console.log('');
    } catch (e) {
      console.log(`=============== CASE ${i + 1} ERROR (${Date.now() - t0}ms) ===============\n${e.message}\n`);
    }
  }
  console.log(`총 ${totalMs}ms, 평균 ${Math.round(totalMs / cases.length)}ms`);
})();
