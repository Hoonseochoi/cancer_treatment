const assert = require('assert');
const path = require('path');
const fs = require('fs');

// data.js를 전역(global)에 주입 (app.js가 브라우저 전역 변수처럼 Q_DEFS/DISEASE_11을 참조하므로)
const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const dataModule = { exports: {} };
new Function('module', 'exports', dataSrc)(dataModule, dataModule.exports);
global.Q_DEFS = dataModule.exports.Q_DEFS;
global.DISEASE_11 = dataModule.exports.DISEASE_11;
global.DISCLOSURE_EXCEPTIONS = dataModule.exports.DISCLOSURE_EXCEPTIONS;

const { classifyHistories, isExceptionDisease, yearsElapsed } = require('../app.js');

const TODAY = '2026-06-25'; // 고정 기준일 (테스트 결정론 확보용, classifyHistories 두번째 인자)

// Q5: 11대 질병(고혈압, I10)은 5년 이내 단발 진료라도 해당, 계속성 조건 없음
{
  const histories = [{
    진단명: '고혈압', 진단코드: 'I10',
    최초진단일: '2023-01-05', 최근진료일: '2023-01-05',
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  const q5Items = result.Q5.included;
  assert.strictEqual(q5Items.length, 1, '11대질병은 단발 진료라도 Q5에 포함되어야 함');
  console.log('PASS: Q5 11대질병 단발진료 포함');
}

// Q2: 상시복용 체크가 있으면 날짜와 무관하게 포함 (README 6장: 날짜 계산보다 체크 여부 신뢰)
{
  const histories = [{
    진단명: '고혈압', 진단코드: 'I10',
    최초진단일: '2010-01-01', 최근진료일: '2010-01-01',
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: true,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q2.included.length, 1, '상시복용 체크가 있으면 최초진단일이 오래돼도 Q2 포함');
  console.log('PASS: Q2 상시복용 체크 우선');
}

// Q1: 최근진료일이 3개월 이내가 아니면 미포함
{
  const histories = [{
    진단명: '감기', 진단코드: 'J00',
    최초진단일: '2024-01-01', 최근진료일: '2024-01-01',
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q1.included.length, 0);
  console.log('PASS: Q1 3개월 초과 시 미포함');
}

// 날짜 정보 불충분(최근진료일 null) → 자동 INCLUDE 금지, "확인필요"로 분리
{
  const histories = [{
    진단명: '협심증', 진단코드: 'I20',
    최초진단일: null, 최근진료일: null,
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q1.included.length, 0, '날짜 불충분 항목은 Q1.included에 자동 포함되면 안 됨');
  assert.strictEqual(result.Q1.review.length, 1, '날짜 불충분 항목은 Q1.review(확인필요)에 들어가야 함');
  console.log('PASS: 날짜 불충분 시 확인필요 처리, 자동포함 금지');
}

// Q4: 계속 7일 이상 입원이면 5년 이내 포함, 단발 입원(7일 미만)은 11대질병이 아니면 미포함
{
  const histories = [{
    진단명: '폐렴', 진단코드: 'J18',
    최초진단일: '2025-01-01', 최근진료일: '2025-01-01',
    입원여부: true, 입원일수: 10, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q4.included.length, 1, '7일 이상 입원은 Q4 포함');
  console.log('PASS: Q4 7일 이상 입원 포함');
}

// Q4: 같은 질병 7회 이상 통원도 트리거(입원/수술 없어도), 7회 미만은 미포함
{
  const histories = [{
    진단명: '기타 급성 기관지염', 진단코드: 'J209',
    최초진단일: '2023-06-08', 최근진료일: '2025-08-26',
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 통원횟수: 7, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q4.included.length, 1, '같은 질병 7회 이상 통원은 Q4 포함');
  console.log('PASS: Q4 통원 7회 이상 포함');
}
{
  const histories = [{
    진단명: '단순 감기', 진단코드: 'J00',
    최초진단일: '2025-01-01', 최근진료일: '2025-01-01',
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 통원횟수: 3, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q4.included.length, 0, '통원 7회 미만은 Q4 미포함');
  console.log('PASS: Q4 통원 7회 미만 미포함');
}

// Q6: 5년 초과~10년 이내(6-10년) 입원/수술은 Q6 포함, 5년 이내는 Q6 미포함
{
  const histories = [{
    진단명: '추간판탈출증', 진단코드: 'M51',
    최초진단일: '2018-06-01', 최근진료일: '2018-06-01', // 약 8년 전
    입원여부: true, 입원일수: 5, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q6.included.length, 1, '6-10년 이내 입원은 Q6 포함');
  assert.strictEqual(result.Q4.included.length, 0, '5년을 넘었으므로 Q4에는 포함되면 안 됨');
  console.log('PASS: Q6 6-10년 입원 포함, Q4 미포함');
}

// Q6: 11년 전 입원은 6-10년 범위를 벗어나므로 Q6 미포함
{
  const histories = [{
    진단명: '늑골골절', 진단코드: 'S22',
    최초진단일: '2014-01-01', 최근진료일: '2014-01-01', // 약 12년 전
    입원여부: true, 입원일수: 3, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q6.included.length, 0, '10년을 넘은 입원은 Q6 미포함');
  console.log('PASS: Q6 10년 초과 입원 미포함');
}

// isExceptionDisease: 예외질환 키워드가 진단명에 포함되면 true
{
  assert.strictEqual(isExceptionDisease('급성충수염'), true, '충수염 키워드 포함 시 예외질환으로 판단');
  assert.strictEqual(isExceptionDisease('급성위장염'), true, '위장염 키워드 포함 시 예외질환으로 판단');
  assert.strictEqual(isExceptionDisease('추간판탈출증'), false, '예외질환 키워드가 없으면 false');
  assert.strictEqual(isExceptionDisease(null), false, '진단명이 없으면 false');
  console.log('PASS: isExceptionDisease 키워드 매칭');
}

// Q5: 직장 또는 항문관련질환(K60)도 11대질병에 포함되어 단발 진료라도 Q5 해당
{
  const histories = [{
    진단명: '항문열창', 진단코드: 'K60',
    최초진단일: '2024-01-01', 최근진료일: '2024-01-01',
    입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
    계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
    현재상태: '', 비고: '', 원본: '',
  }];
  const result = classifyHistories(histories, TODAY);
  assert.strictEqual(result.Q5.included.length, 1, '직장/항문관련질환(K60)도 11대질병으로 Q5 포함');
  console.log('PASS: Q5 직장/항문관련질환 포함');
}

// yearsElapsed: 23년 2월 → 26년 6월(TODAY)이면 3년 4개월 지났으므로 만 3년경과
{
  assert.strictEqual(yearsElapsed('2023-02-15', TODAY), 3, '23년 2월 → 26년 6월(TODAY)은 3년경과');
  assert.strictEqual(yearsElapsed('2026-06-25', TODAY), 0, '하루 전 날짜는 0년경과');
  assert.strictEqual(yearsElapsed(null, TODAY), null, '날짜 없으면 null');
  console.log('PASS: yearsElapsed 만년수 계산');
}

console.log('전체 통과: classify.test.js');
