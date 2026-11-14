// AI 보조(확인 질문·점검 메모·가이드/약 연결)의 규칙 부분 테스트 — AI 호출 없이
// 가이드 항목은 실제 U/W가이드가 아닌 테스트용 가짜 항목만 쓴다(실제 내용은 private/uw.test.js)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseJsonArray, uncoveredLineNumbers, filterReviewNotes, buildReviewPrompt, buildMatchPrompt } from '../shared/assist_prompts.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const m = { exports: {} };
new Function('module', 'exports', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(m, m.exports);
Object.assign(globalThis, m.exports);
const app = require('../app.js');
Object.assign(globalThis, app);
globalThis.DisclosureAccess = { simpleState: 'denied' };
const { DisclosureAssist } = require('../assist.js');
const TODAY = '2026-11-14';

// AI 답에서 JSON 배열만 꺼냄(코드블록·설명이 붙어도, 깨지면 빈 배열)
{
  assert.deepStrictEqual(parseJsonArray('```json\n[{"id":"1","question":"언제?"}]\n```'), [{ id: '1', question: '언제?' }]);
  assert.deepStrictEqual(parseJsonArray('결과: [1, {"a":2}, null]'), [{ a: 2 }]);
  assert.deepStrictEqual(parseJsonArray('[{"id":'), []);
  assert.deepStrictEqual(parseJsonArray(''), []);
  console.log('PASS: JSON 배열 꺼내기');
}

// 병력에 든 줄의 딸린 줄(• 항목 : 값, ㄴ 수술, 바로 아래 줄)은 빠진 줄로 보지 않는다
{
  const lines = [
    '1. 치아상실 2026-09-01', '• 통원 : 3일', '• 입원 : 없음', '• 수술 : 없음', '',
    '2026-10-01', '노년백내장', 'ㄴ 수정체유화술', '', '2025-03-02 위염', '', '설계 부탁드립니다',
  ];
  const histories = [{ lines: [1] }, { lines: [6] }];
  assert.deepStrictEqual(uncoveredLineNumbers(lines, histories), [10, 12]);
  const prompt = buildReviewPrompt(lines.map((l, i) => `${i + 1}: ${l}`).join('\n'), [{ name: '치아상실', lines: [1] }, { name: '노년백내장', lines: [6] }], TODAY);
  assert.ok(prompt.includes('어느 병력에도 안 들어간 줄: 10, 12'));
  assert.ok(prompt.includes('1. 치아상실 | 원문 1줄'));
  console.log('PASS: 점검 메모 — 빠진 줄 후보');
}

// 점검 메모 걸러내기: "병력 아님"은 병력에 실제로 든 줄만, 중복·이상한 값은 버림
{
  const notes = filterReviewNotes([
    { kind: 'not_history', line: 5, text: '설계 요청이 병력으로' },
    { kind: 'not_history', line: 9, text: '병력에 안 든 줄' },
    { kind: 'missing', line: 7, text: '위염 빠짐' },
    { kind: 'missing', line: 7, text: '위염 빠짐(중복)' },
    { kind: 'mismatch', line: 99, text: '줄번호 범위 밖' },
    { kind: 'advice', line: 1, text: '고지하세요' },
    { kind: 'missing', line: 2, text: '' },
  ], [{ lines: [5] }], 10);
  assert.deepStrictEqual(notes, [
    { kind: 'not_history', line: 5, text: '설계 요청이 병력으로' },
    { kind: 'missing', line: 7, text: '위염 빠짐' },
    { kind: 'mismatch', line: null, text: '줄번호 범위 밖' },
  ]);
  console.log('PASS: 점검 메모 걸러내기');
}

// 확인 질문 대상: 문항에서 확인필요가 된 병력만, 까닭(날짜·통원 횟수 등)을 붙여서
{
  const base = { 진단코드: '', 최초진단일: null, 최근진료일: null, 입원여부: false, 입원일수: null, 수술여부: false, 수술명: null, 계속치료일수: null, 계속투약일수: null, 통원횟수: null, 약물명: null, 재검사여부: false, 상시복용여부: false, 비고: '', 원본: '' };
  const histories = [
    { ...base, id: 1, 진단명: '허리 염좌' }, // 날짜 없음 → Q1 확인필요
    { ...base, id: 2, 진단명: '위염', 최초진단일: '2026-10-20', 최근진료일: '2026-10-20' }, // 분류완료 → 질문 없음
    { ...base, id: 3, 진단명: '아토피성 피부염', 최초진단일: '2023-01-25', 최근진료일: '2024-09-21', 통원횟수미상: true },
  ];
  const items = DisclosureAssist._questionItems(histories, TODAY);
  assert.deepStrictEqual(items.map(x => x.id), ['1', '3']);
  assert.ok(items[0].reason.includes('날짜'));
  assert.ok(items[1].reason.includes('몇 번 통원'));
  assert.ok(items[1].question.startsWith('Q4.'));
  console.log('PASS: 확인 질문 대상·까닭');
}

// 약·가이드 연결 대상: 간편 규칙이 없으면(삼성 회원 아님) 약 이름이 있는 병력만
{
  const histories = [
    { id: 1, 진단명: '고혈압', 약물명: '암로디핀', 입원여부: false, 수술여부: false },
    { id: 2, 진단명: '사타구니 탈장', 약물명: null, 입원여부: true, 수술여부: true, 수술명: '탈장교정술' },
  ];
  assert.deepStrictEqual(DisclosureAssist._matchItems(histories).map(x => x.id), ['1']);
  const prompt = buildMatchPrompt([{ id: '1', name: '고혈압', drug: '암로디핀' }], []);
  assert.ok(prompt.includes('약: 암로디핀') && prompt.includes('혈압강하제'));
  console.log('PASS: 약·가이드 연결 대상');
}

// AI가 고른 가이드 항목: 조건으로만 나뉜 묶음(수술/비수술)은 병력에 맞는 쪽, 없는 id는 무시 — 판정(status)은 그대로
{
  globalThis.SIMPLE_UW_GUIDE = [
    { id: 't-surg', name: '테스트병(수술)', when: 'surgery', keywords: ['테스트병'], recent: { coverage: '' }, later: { coverage: '' } },
    { id: 't-nosurg', name: '테스트병(비수술)', when: 'nosurgery', keywords: ['테스트병'], recent: { coverage: '' }, later: { coverage: '' } },
    { id: 't-other', name: '다른병', keywords: ['다른병'], recent: null, later: { coverage: '' } },
  ];
  const h = { 진단명: '이름이 다른 병', 수술여부: false, uwHint: 't-surg' };
  assert.strictEqual(app.findUwHintEntry(h, [h]).id, 't-nosurg');
  assert.strictEqual(app.findUwHintEntry({ ...h, 수술여부: true }, []).id, 't-surg');
  assert.strictEqual(app.findUwHintEntry({ ...h, uwHint: 't-other' }, []).id, 't-other');
  assert.strictEqual(app.findUwHintEntry({ ...h, uwHint: 'nope' }, []), null);
  assert.strictEqual(app.findUwHintEntry({ ...h, uwHint: undefined }, []), null);
  const forced = app.uwDecision({ ...h, 입원여부: true, 최근진료일: '2026-11-01' }, TODAY, [], app.findUwHintEntry(h, [h]));
  assert.strictEqual(forced.entry.id, 't-nosurg');
  console.log('PASS: AI 추천 가이드 항목 고르기');
}

console.log('전체 통과: assist.test.mjs');
