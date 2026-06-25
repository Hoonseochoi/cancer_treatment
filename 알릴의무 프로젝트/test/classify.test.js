const assert = require('assert');
const path = require('path');
const fs = require('fs');

// data.js를 전역(global)에 주입 (app.js가 브라우저 전역 변수처럼 Q_DEFS/DISEASE_11을 참조하므로)
const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const dataModule = { exports: {} };
new Function('module', 'exports', dataSrc)(dataModule, dataModule.exports);
global.Q_DEFS = dataModule.exports.Q_DEFS;
global.DISEASE_11 = dataModule.exports.DISEASE_11;

const { classifyHistories } = require('../app.js');

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

console.log('전체 통과: classify.test.js');
