const assert = require('assert');
const { parseHistoryText } = require('../app.js');

// 기본 블록 파싱: 진단명/코드/입원/수술/현상태 추출
{
  const input = `🔴고혈압/I10
입원: 없음
수술: 없음
치료/현상태: 24.01.05 진단, 현재 약물치료중`;
  const result = parseHistoryText(input);
  assert.strictEqual(result.length, 1, '병력 1건이 인식되어야 함');
  assert.strictEqual(result[0].진단명, '고혈압');
  assert.strictEqual(result[0].진단코드, 'I10');
  assert.strictEqual(result[0].입원여부, false);
  assert.strictEqual(result[0].수술여부, false);
  assert.strictEqual(result[0].현재상태, '24.01.05 진단, 현재 약물치료중');
  console.log('PASS: 기본 블록 파싱');
}

// "~"로 끝나는 날짜는 최근진료일을 자동으로 오늘로 채우지 않음 (README 5장 버그 재발 방지)
{
  const input = `🔴협심증/I20
입원: 없음
수술: 없음
치료/현상태: 22.03.10~`;
  const result = parseHistoryText(input);
  assert.strictEqual(result[0].최근진료일, null, '"~"로 끝나는 표기는 최근진료일을 비워둬야 함(자동완치/진행중 추정 금지)');
  console.log('PASS: 미완결 날짜("~") 자동완성 금지');
}

// 입원/수술 일수·명 추출
{
  const input = `🔴급성충수염/K35
입원: 7일
수술: 충수절제술
치료/현상태: 25.02.01 수술 후 완치`;
  const result = parseHistoryText(input);
  assert.strictEqual(result[0].입원여부, true);
  assert.strictEqual(result[0].입원일수, 7);
  assert.strictEqual(result[0].수술여부, true);
  assert.strictEqual(result[0].수술명, '충수절제술');
  console.log('PASS: 입원/수술 정보 추출');
}

// 여러 블록(여러 병력) 동시 인식
{
  const input = `🔴고혈압/I10
입원: 없음
수술: 없음
치료/현상태: 24.01.05 진단

🔴당뇨병/E11
입원: 없음
수술: 없음
치료/현상태: 23.05.10 진단`;
  const result = parseHistoryText(input);
  assert.strictEqual(result.length, 2, '두 블록이 각각 병력으로 인식되어야 함');
  console.log('PASS: 다중 블록 파싱');
}

// 빈 입력은 빈 배열
{
  const result = parseHistoryText('');
  assert.strictEqual(result.length, 0);
  console.log('PASS: 빈 입력 처리');
}

// 통원/투약/비고 줄 추출 (Gemini 변환 출력에서 사용)
{
  const input = `🔴기타 급성 기관지염/J209
입원: 없음
수술: 없음
통원: 7회
투약: 30일
비고: 23.06.08~25.08.26 사이 반복 통원, 현상태 이상없음
치료/현상태: 25.08.26 통원, 이상없음`;
  const result = parseHistoryText(input);
  assert.strictEqual(result[0].통원횟수, 7, '통원: 줄에서 횟수 추출');
  assert.strictEqual(result[0].계속투약일수, 30, '투약: 줄에서 일수 추출');
  assert.strictEqual(result[0].비고, '23.06.08~25.08.26 사이 반복 통원, 현상태 이상없음', '비고: 줄 그대로 추출');
  console.log('PASS: 통원/투약/비고 줄 추출');
}

// 통원/투약 줄이 "없음"이면 null 유지
{
  const input = `🔴감기/J00
입원: 없음
수술: 없음
통원: 없음
투약: 없음
치료/현상태: 25.01.01 통원, 완치`;
  const result = parseHistoryText(input);
  assert.strictEqual(result[0].통원횟수, null);
  assert.strictEqual(result[0].계속투약일수, null);
  console.log('PASS: 통원/투약 "없음" 처리');
}

console.log('전체 통과: parser.test.js');
