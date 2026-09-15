const assert = require('assert');
const path = require('path');
const fs = require('fs');

const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const dataModule = { exports: {} };
new Function('module', 'exports', dataSrc)(dataModule, dataModule.exports);
Object.assign(global, dataModule.exports);

const { parseHistoryText, classifyHistories } = require('../app.js');

// 심평원 "A" 접두 코드와 (양방) 표기가 정규화되어 10대질병(Q5) 매칭이 살아나야 함
{
  const [h] = parseHistoryText(`🔴(양방)간세포암종의 악성 신생물/AC22.0
입원: 35일
수술: 없음
치료/현상태: 26.04.23 통원`);
  assert.strictEqual(h.진단코드, 'C220');
  assert.strictEqual(h.진단명, '간세포암종의 악성 신생물');
  assert.strictEqual(classifyHistories([h], '2026-09-15').Q5.included.length, 1);
  console.log('PASS: A 접두 코드/양방 표기 정규화 → Q5 매칭');
}

// A00~A99 감염병 코드는 그대로 둬야 함
{
  const [h] = parseHistoryText(`🔴위장염/A099
입원: 1일
수술: 없음
치료/현상태: 23.08.23 입원`);
  assert.strictEqual(h.진단코드, 'A099');
  console.log('PASS: 감염병 A코드 보존');
}

// 알코올성 간경변(K70.3)도 10대질병 간경화증에 포함
{
  const [h] = parseHistoryText(`🔴복수를 동반한 알코올성 간경변증/K7031
입원: 8일
수술: 없음
치료/현상태: 25.04.29 통원`);
  assert.strictEqual(classifyHistories([h], '2026-09-15').Q5.included.length, 1);
  console.log('PASS: K703 알코올성 간경변 Q5 포함');
}

// "상시복용: 예", "재검사: 예" 줄이 체크 필드로 반영되어 Q2/Q3 분류로 이어져야 함
{
  const [h] = parseHistoryText(`🔴본태성 고혈압/I10
입원: 없음
수술: 없음
상시복용: 예
재검사: 예
치료/현상태: 26.08.06 정기 약처방`);
  assert.strictEqual(h.상시복용여부, true);
  assert.strictEqual(h.재검사여부, true);
  const result = classifyHistories([h], '2026-09-15');
  assert.strictEqual(result.Q2.included.length, 1);
  assert.strictEqual(result.Q3.included.length, 1);
  console.log('PASS: 상시복용/재검사 줄 → Q2/Q3');
}

// 치료/현상태에 오래된 날짜가 먼저 와도, 비고에 더 최근 날짜가 있어도 가장 최근 날짜를 최근진료일로
{
  const [h] = parseHistoryText(`🔴최근 진료(진단명 미상)/R69
입원: 없음
수술: 없음
치료/현상태: 26.07.24 정기적 약처방
비고: 26.06.15 간약 정기처방, 2026-08-06 정기약처방`);
  assert.strictEqual(h.최근진료일, '2026-08-06');
  assert.strictEqual(h.최초진단일, '2026-06-15');
  console.log('PASS: 상태·비고 날짜 중 최신/최초 선택');
}

// 같은 코드가 섹션별로 쪼개져 오면 한 병력으로 합침(입원·통원 합산, 수술명 합치기, 최신 날짜)
{
  const histories = parseHistoryText(`🔴간세포암종의 악성신생물/C220
입원: 35일
수술: 없음
치료/현상태: 25.07.10 입원

🔴간세포암종의 악성신생물/C220
입원: 없음
수술: 없음
통원: 35회
치료/현상태: 26.04.23 통원

🔴간세포암종의 악성신생물/C220
입원: 없음
수술: 간이식술-생체(변형우엽)
치료/현상태: 25.07.10 수술`);
  assert.strictEqual(histories.length, 1);
  const [h] = histories;
  assert.strictEqual(h.입원일수, 35);
  assert.strictEqual(h.통원횟수, 35);
  assert.strictEqual(h.수술여부, true);
  assert.strictEqual(h.수술명, '간이식술-생체(변형우엽)');
  assert.strictEqual(h.최근진료일, '2026-04-23');
  assert.strictEqual(h.현재상태, '26.04.23 통원');
  console.log('PASS: 같은 코드 블록 병합');
}

// AI가 코드를 바꿔도(당뇨병성 신경병증 E1441 → G632) 진단명 키워드로 Q5를 잡아야 함
{
  const [h] = parseHistoryText(`🔴당 뇨병성 다발신경병증/G632
입원: 1일
수술: 없음
치료/현상태: 22.11.09 입원`);
  assert.strictEqual(classifyHistories([h], '2026-09-15').Q5.included.length, 1);
  console.log('PASS: 진단명 키워드로 10대질병 보조 매칭');
}

console.log('전체 통과: normalize.test.js');
