const assert = require('assert');
const { extractRecords } = require('../ai.js');

// 원문을 나눠 보낼 때 각 요청의 출력 대상 줄, 빠뜨린 줄 재요청
(async () => {
  const calls = [];
  const fake = async targetLines => { calls.push(targetLines); return { text: '', provider: 'test' }; };

  await extractRecords('2024-01-01 고혈압\n약 복용중', fake);
  assert.deepStrictEqual(calls, [null], '짧은 원문은 한 번, 원문 전체가 출력 대상');

  calls.length = 0;
  const long = Array.from({ length: 40 }, (_, i) => (i % 3 === 2 ? '' : `2024-01-01 병력 ${i}`)).join('\n');
  const out = await extractRecords(long, fake);
  assert.ok(out.chunks.length > 1, '긴 원문은 나눠 보냄');
  out.chunks.forEach((c, i) => {
    assert.deepStrictEqual(calls[i], Array.from({ length: c.to - c.from + 1 }, (_, k) => c.from + k), '조각마다 자기 범위 줄만 출력 대상');
  });

  calls.length = 0;
  const retry = await extractRecords(long, fake, { onlyLines: [3, 7] });
  assert.deepStrictEqual(calls, [[3, 7]]);
  assert.deepStrictEqual(retry.chunks[0].lines, [3, 7]);
  console.log('PASS: 원문 나눠 보내기·재요청 대상 줄');
  console.log('전체 통과: ai.test.js');
})().catch(e => { console.error(e); process.exit(1); });
