const assert = require('assert');
const path = require('path');
const fs = require('fs');

const dataModule = { exports: {} };
new Function('module', 'exports', fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'))(dataModule, dataModule.exports);
Object.assign(global, dataModule.exports);
const { evaluateSimpleProducts, evaluateSimpleQuestion } = require('../app.js');

const TODAY = '2026-11-10';
const base = { 진단코드: '', 코드추정: true, 최초진단일: null, 최근진료일: null, 입원여부: false, 입원일수: null, 수술여부: false, 수술명: null, 상시복용여부: false, 계속투약일수: null, 계속치료일수: null, 재검사여부: false };
const H = (o) => ({ ...base, ...o });

// 실제 예시 병력(AI 정리 결과를 그대로 옮김, 2026-11-10 기준)
const example = [
  H({ 진단명: '고혈압', 진단코드: 'I10', 상시복용여부: true, 원본: '고혈압 / 고지혈 / 당뇨 약 복용중' }),
  H({ 진단명: '고지혈증', 진단코드: 'E78', 상시복용여부: true, 원본: '고혈압 / 고지혈 / 당뇨 약 복용중' }),
  H({ 진단명: '당뇨병', 진단코드: 'E11', 상시복용여부: true, 원본: '고혈압 / 고지혈 / 당뇨 약 복용중' }),
  H({ 진단명: '중추기원의 현기증', 진단코드: 'R42', 최초진단일: '2026-06-26', 최근진료일: '2026-06-26', 원본: '2026-06-26 중추기원의 현기증' }),
  H({ 진단명: '좌골신경통,요추부', 진단코드: 'M544', 최초진단일: '2026-06-20', 최근진료일: '2026-06-24', 원본: '2026-06-20~2026-06-24 좌골신경통,요추부\nㄴ침술' }),
  H({ 진단명: '혈당조절이 되지않은 2형 당뇨병', 진단코드: 'E119', 최초진단일: '2024-06-14', 최근진료일: '2024-06-14', 입원여부: true, 입원일수: 3, 원본: '2024-06-14 혈당조절이 되지않은 2형 당뇨병 / 입원3일' }),
  H({ 진단명: '상세불명의 백내장,오른쪽', 진단코드: 'H269', 최초진단일: '2026-01-19', 최근진료일: '2026-01-19', 수술여부: true, 수술명: '인공수정체삽입술' }),
  H({ 진단명: '상세불명의 백내장,왼쪽', 진단코드: 'H269', 최초진단일: '2026-01-12', 최근진료일: '2026-01-12', 수술여부: true, 수술명: '인공수정체삽입술' }),
  H({ 진단명: '유방암 좌측', 진단코드: 'C50', 원본: '5년전 유방암 좌측 진단 / 완치' }),
];

{
  const r = evaluateSimpleProducts(example, TODAY);
  const byId = id => r.products.find(x => x.product.id === id);
  const statuses = id => Object.fromEntries(byId(id).variants.map(v => [v.label, v.status]));

  // 24.06 당뇨 입원(2년 5개월 전) → N이 3 이상이면 걸림. 26.01 백내장 수술은 경증상병 프리패스로 넘어감.
  assert.deepStrictEqual(statuses('refresh-3n5'), { '3.1.5': 'freepass', '3.2.5': 'freepass', '3.3.5': 'no', '3.4.5': 'no', '3.5.5': 'no' });
  // N=0이면 입원·수술을 안 물어 백내장도 안 걸리고, "5년전" 유방암만 확인필요
  assert.strictEqual(statuses('thefit1680')['3.0.5'], 'check');
  // 고혈압·당뇨·고지혈 계속 복용 → 당당·고고 유형은 모두 불가, 10년 입원수술 묻는 3.10.5도 불가
  ['gogo3655', 'refresh3105', 'dangdang-gd', 'dangdang-dj', 'dangdang-all'].forEach(id => assert.strictEqual(byId(id).best, null, id));
  // 311-5는 1년 이내 5대질병만 물어 "5년전" 유방암은 확인할 필요 없음
  assert.strictEqual(byId('refresh3115').best.status, 'freepass');
  assert.strictEqual(byId('refresh3115').best.reviews, 0);

  assert.strictEqual(r.top.product.id, 'refresh-3n5');
  assert.strictEqual(r.top.variant.label, '3.2.5');
  assert.strictEqual(r.fallback.product.id, 'refresh3115', '유방암이 5년 이내면 311-5');
  console.log('PASS: 예시 병력 — 추천 새로고침 3.2.5(백내장 프리패스, 유방암 5년 확인), 차선 311-5');
}

// 3개월 질문은 투약을 묻지 않는다: 원래 앓던 병의 정기 처방은 해당 없음, 3개월 안에 처음 진단받았으면 해당
{
  const q = { kind: 'recent3m', months: 3 };
  assert.strictEqual(evaluateSimpleQuestion(q, H({ 진단명: '고혈압', 상시복용여부: true }), TODAY), null);
  assert.strictEqual(evaluateSimpleQuestion(q, H({ 진단명: '고혈압', 상시복용여부: true, 최초진단일: '2026-10-01', 최근진료일: '2026-11-01' }), TODAY).status, 'hit');
  assert.strictEqual(evaluateSimpleQuestion(q, H({ 진단명: '위염', 최근진료일: '2026-10-20' }), TODAY).status, 'hit');
  assert.strictEqual(evaluateSimpleQuestion(q, H({ 진단명: '위염', 최근진료일: '2026-07-20' }), TODAY), null);
  console.log('PASS: 간편 3개월 질문 — 정기 처방 제외');
}

// 이상지질혈증 질문은 입원·수술·7일↑치료·30일↑투약만 묻는다(진단만 받은 건 해당 없음)
{
  const q = { kind: 'diseaseHeavy', months: 60, diseases: ['dyslipidemia'] };
  assert.strictEqual(evaluateSimpleQuestion(q, H({ 진단명: '고지혈증', 최근진료일: '2025-03-01' }), TODAY), null);
  assert.strictEqual(evaluateSimpleQuestion(q, H({ 진단명: '고지혈증', 최근진료일: '2025-03-01', 계속투약일수: 90 }), TODAY).status, 'hit');
  console.log('PASS: 이상지질혈증 — 진단만은 해당 없음');
}

// 경증 목록이 아닌 병의 수술은 프리패스가 안 된다. 입원 30일 넘으면 경증이어도 안 된다.
{
  const r = evaluateSimpleProducts([H({ 진단명: '추간판탈출증', 최근진료일: '2026-03-01', 입원여부: true, 입원일수: 40 })], TODAY);
  assert.strictEqual(r.products.find(x => x.product.id === 'refresh3115').variants[0].status, 'no');
  const r2 = evaluateSimpleProducts([H({ 진단명: '추간판탈출증', 최근진료일: '2026-03-01', 입원여부: true, 입원일수: 10 })], TODAY);
  assert.strictEqual(r2.products.find(x => x.product.id === 'refresh3115').variants[0].status, 'freepass');
  console.log('PASS: 경증 프리패스 — 입원 30일 한도');
}

// 병력이 없으면 가장 까다로운 유형(당당 고당지뇌심)이 추천
{
  const r = evaluateSimpleProducts([], TODAY);
  assert.strictEqual(r.top.product.id, 'dangdang-all');
  assert.strictEqual(r.top.variant.status, 'ok');
  console.log('PASS: 병력 없음 — 고당지뇌심 유형 추천');
}

console.log('전체 통과: simple.test.js');
