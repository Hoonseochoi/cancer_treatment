const assert = require('assert');
const path = require('path');
const fs = require('fs');

const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const dataModule = { exports: {} };
new Function('module', 'exports', dataSrc)(dataModule, dataModule.exports);
Object.assign(global, dataModule.exports);

const { parseRecordLines, collectRecords, recordsToHistories, resolveRecordDate, buildHistoriesWithAI, classifyHistories } = require('../app.js');
const TODAY = '2026-09-15';

// 날짜: YYMMDD, YYYYMMDD, 연도 없는 MMDD는 오늘 이전 가장 가까운 날짜
{
  assert.strictEqual(resolveRecordDate('240311', TODAY), '2024-03-11');
  assert.strictEqual(resolveRecordDate('20240311', TODAY), '2024-03-11');
  assert.strictEqual(resolveRecordDate('0802', TODAY), '2026-08-02');
  assert.strictEqual(resolveRecordDate('1220', TODAY), '2025-12-20');
  assert.strictEqual(resolveRecordDate('241399', TODAY), null);
  console.log('PASS: 기록 날짜 해석');
}

// 설명문/잡음 줄은 무시하고 기록 줄만 읽음
{
  const records = parseRecordLines(`다음은 결과입니다
2|AM5116|요추 추간판장애|입원|240311||5일|
\`\`\`
5|AM5116||통원|231201|240520|14|`);
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].value, 5);
  console.log('PASS: 기록 줄만 파싱');
}

// 같은 코드 병합 + 똑같은 입원기록 중복 제거 + 서로 다른 입원 합산 + A 접두/양방 표기 정리 + 원문 줄 연결
{
  const source = ['입원', '2024-3-11 5일', '(양방)요추 추간판장애-AM5116', '2024-3-11 5일', '(양방)요추 추간판장애-AM5116', '2025-1-02 3일', '통원 2023-12-01~2024-05-20 14일'];
  const records = parseRecordLines(`2|AM5116|(양방)요추 추간판장애|입원|240311||5|
4|AM5116||입원|240311||5|
6|AM5116||입원|250102||3|
7|AM5116||통원|231201|240520|14|`);
  const [h, ...rest] = recordsToHistories(records, TODAY, source);
  assert.strictEqual(rest.length, 0);
  assert.strictEqual(h.진단코드, 'M5116');
  assert.strictEqual(h.진단명, '요추 추간판장애');
  assert.strictEqual(h.입원일수, 8, '중복 5일은 한 번만, 3일은 합산');
  assert.strictEqual(h.통원횟수, 14);
  assert.strictEqual(h.최초진단일, '2023-12-01');
  assert.strictEqual(h.최근진료일, '2025-01-02');
  assert.ok(h.비고.includes('중복기록 1건 제외'));
  assert.ok(h.원본.includes('2025-1-02 3일'));
  console.log('PASS: 병합·중복제거·합산·원문연결');
}

// AI가 "수술"로 옮겨도 신경차단술 등은 시술로 보고 수술에서 제외(비고에는 남김)
{
  const [h] = recordsToHistories(parseRecordLines(`1|M5116|요추 추간판장애|수술|240520||2|신경차단술
2|M5116||수술|240601|||추간판절제술`), TODAY);
  assert.strictEqual(h.수술여부, true);
  assert.strictEqual(h.수술명, '추간판절제술');
  assert.ok(h.비고.includes('시술(수술 아님) 신경차단술'));
  const [onlyProcedure] = recordsToHistories(parseRecordLines('1|M5116|요추 추간판장애|시술|240520||2|신경차단술'), TODAY);
  assert.strictEqual(onlyProcedure.수술여부, false);
  console.log('PASS: 수술/시술 구분');
}

// 진단명과 수술명이 같아도(원문에 수술명만 적힌 경우) 수술명을 지우지 않음
{
  const [h] = recordsToHistories(parseRecordLines('7|T15|결막이물제거술|수술|220530|||결막이물제거술'), TODAY);
  assert.strictEqual(h.수술명, '결막이물제거술');
  console.log('PASS: 수술명 보존');
}

// 정기처방: 3개월 이내면 상시복용(Q2), 오래됐으면 아님, 날짜 모르면 놓치지 않게 상시복용
{
  const [recent] = recordsToHistories(parseRecordLines('1|I10|본태성 고혈압|정기|0802|||혈압약'), TODAY);
  assert.strictEqual(recent.상시복용여부, true);
  assert.strictEqual(recent.약물명, '혈압약');
  assert.strictEqual(classifyHistories([recent], TODAY).Q2.included.length, 1);
  const [old] = recordsToHistories(parseRecordLines('1|M161|고관절증|정기|0528|||고관절 주사'), TODAY);
  assert.strictEqual(old.상시복용여부, false);
  const [undated] = recordsToHistories(parseRecordLines('1|K703|알코올성 간경변|정기||||간약'), TODAY);
  assert.strictEqual(undated.상시복용여부, true);
  assert.ok(undated.비고.includes('날짜 미상'));
  console.log('PASS: 정기처방 3개월 판단');
}

// AI 추정 코드(~) 표시, 코드 없는 기록은 같은 이름 병력에 합침, 코드·이름 없는 기록도 버리지 않음
{
  const histories = recordsToHistories(parseRecordLines(`1|~B07|사마귀|시술|260813|||냉동치료
2|C220|간세포암종의 악성신생물|입원|250317|250710|35|
3||간세포암종의 악성신생물|수술|250710|||간이식술
4|||진단|260715|||`), TODAY);
  assert.strictEqual(histories.length, 3);
  const [wart, liver, unknown] = histories;
  assert.strictEqual(wart.진단코드, 'B07');
  assert.ok(wart.비고.includes('코드는 AI 추정'));
  assert.strictEqual(liver.수술명, '간이식술');
  assert.strictEqual(unknown.진단명, '진단명 미상');
  assert.strictEqual(unknown.최근진료일, '2026-07-15');
  console.log('PASS: 추정코드·이름연결·미상기록 보존');
}

// AI가 "시술"로 봤어도 규칙 목록에 없는 처치는 수술로 두고 원문 확인 표시(수술 섹션의 소작술이 Q4에서 빠지는 것 방지)
{
  const [h] = recordsToHistories(parseRecordLines('9|K123|구강점막염(궤양성)|시술|240520|||인,후두소작술'), TODAY);
  assert.strictEqual(h.수술여부, true);
  assert.ok(h.비고.includes('원문 확인'));
  assert.strictEqual(classifyHistories([h], TODAY).Q4.included.length, 1);
  console.log('PASS: 목록 밖 시술은 수술로 보존');
}

// "기간 (7)"처럼 횟수가 붙은 진단 기록은 통원으로 보고 원문 확인 표시(Q4 7회 이상 통원 누락 방지)
{
  const [h] = recordsToHistories(parseRecordLines('3|J0190|급성 부비동염|진단|210924|250501|7|'), TODAY);
  assert.strictEqual(h.통원횟수, 7);
  assert.ok(h.비고.includes('원문 확인'));
  assert.strictEqual(classifyHistories([h], TODAY).Q4.included.length, 1);
  console.log('PASS: 횟수 붙은 진단 기록은 통원으로');
}

// 줄번호 재확인 + 청크 범위 필터 + "입원 X" 오독 제거
{
  const source = [
    '입원',
    '2024-6-24 16일',
    '(양방)엉덩이 2도 화상-AT2420',
    '',
    '처방',
    '마지막처방일 2024-8-6 30일이상',
    '(양방)엉덩이 2도 화상-AT2420',
    '2023.01.25 / Z3483 정상임신 관리 / 입원 X ,자궁경부봉축해제술',
  ];
  const chunks = [
    { from: 1, to: 4, text: '1|AT2420|엉덩이 2도 화상|입원|240624||16|\n2|AT2420||투약|240806||30|' },
    { from: 5, to: 8, text: '6|AT2420||투약|240806||30|\n8|Z3483|정상임신 관리|입원|230125|||\n8|Z3483||수술|230125|||자궁경부봉축해제술' },
  ];
  const records = collectRecords(chunks, source);
  assert.deepStrictEqual(records.map(r => `${r.lineNo}${r.type}`), ['2입원', '6투약', '8수술']);
  const [burn, pregnancy] = recordsToHistories(records, TODAY, source);
  assert.strictEqual(burn.입원일수, 16);
  assert.strictEqual(burn.계속투약일수, 30);
  assert.ok(!burn.비고.includes('중복'));
  assert.ok(burn.원본.includes('2024-6-24 16일') && burn.원본.includes('AT2420'));
  assert.strictEqual(pregnancy.입원여부, false);
  assert.strictEqual(pregnancy.수술여부, true);
  console.log('PASS: 줄번호 재확인·범위필터·부정표기 제거');
}

// 투약 상세에 진단명을 넣어도 약물명으로 쓰지 않고, 같은 투약이 두 번 와도 한 번만 적음
{
  const [h] = recordsToHistories(parseRecordLines(`15|AT2420|엉덩이 2도 화상|투약|240806||30|엉덩이 2도 화상
46|AT2420||투약|240806||30|`), TODAY);
  assert.strictEqual(h.약물명, null);
  assert.strictEqual((h.비고.match(/24\.08\.06/g) || []).length, 1);
  console.log('PASS: 투약 상세 정리');
}

// 코드·이름 없는 수술들도 버리지 않고 처치명으로 이름을 달아 남김
{
  const [h] = recordsToHistories(parseRecordLines(`18|||수술|230921|241118|9|치근활택술
20|||수술|230727|||치조골성형술`), TODAY);
  assert.strictEqual(h.진단명, '진단명 미상(치근활택술·치조골성형술)');
  assert.strictEqual(h.수술여부, true);
  console.log('PASS: 진단명 미상 수술 보존');
}

// 코드 칸에 사람 이름·날짜만 온 잡음 줄은 버리고, 정상 기록은 남김
{
  const records = parseRecordLines(`1|서영승||진단||||
2|2026-07-15||진단||||
3|~B07|사마귀|시술|260813|||냉동치료`);
  assert.deepStrictEqual(records.map(r => r.code), ['~B07']);
  console.log('PASS: 코드 칸 잡음 제거');
}

// "~술"이 적힌 줄에 수술 기록이 없으면 빠뜨린 줄로 보고 재요청 대상, 끝내 없으면 규칙이 수술로 처리하고 원문 확인 표시
{
  const { findUncoveredLines } = require('../app.js');
  const source = ['2023.01.25 / Z3483 정상임신 관리 / 입원 X ,자궁경부봉축해제술', '(수술)', '2025-07-15/AZ526 간기증자 입원 11일'];
  const diagnosisOnly = parseRecordLines('1|Z3483|정상임신 관리|진단|230125|||\n3|AZ526|간기증자|입원|250715||11|');
  assert.deepStrictEqual(findUncoveredLines(diagnosisOnly, source), [1]);
  const withSurgery = parseRecordLines('1|Z3483|정상임신 관리|수술|230125|||자궁경부봉축해제술\n3|AZ526|간기증자|입원|250715||11|');
  assert.deepStrictEqual(findUncoveredLines(withSurgery, source), []);
  const [pregnancy] = recordsToHistories(diagnosisOnly, TODAY, source);
  assert.strictEqual(pregnancy.수술여부, true);
  assert.strictEqual(pregnancy.수술명, '자궁경부봉축해제술');
  assert.ok(pregnancy.비고.includes('원문 확인'));
  assert.strictEqual(classifyHistories([pregnancy], TODAY).Q4.included.length, 1);
  console.log('PASS: 원문 수술명 누락 안전장치');
}

// 코드·진단명·날짜·수치·상세가 모두 빈 기록은 버림
{
  assert.strictEqual(parseRecordLines('1|||진단||||').length, 0);
  console.log('PASS: 빈 기록 제거');
}

// 수술명이 날짜 줄과 떨어진 줄에 있어도 같은 수술명의 기록이 있으면 빠뜨린 줄로 보지 않음
{
  const { findUncoveredLines } = require('../app.js');
  const source = ['2025-12-04 ~ 2025-12-06', '진단명 : K317 위 및 십이지장의 용종', '수술명 : 수술-점막절제술 및 점막 하종양절제술'];
  const records = parseRecordLines('1|K317|위 및 십이지장의 용종|수술|251204|251206||점막절제술 및 점막하종양절제술');
  assert.deepStrictEqual(findUncoveredLines(records, source), []);
  console.log('PASS: 떨어진 수술명 줄 반영 인정');
}

// 코드 없이 처치명만 진단명 칸에 온 수술은 그 이름을 수술명으로 씀
{
  const [h] = recordsToHistories(parseRecordLines('18||치근활택술|수술|230921|241118|9|'), TODAY);
  assert.strictEqual(h.수술명, '치근활택술 9회');
  console.log('PASS: 코드 없는 처치명 수술명 사용');
}

// AI가 처방일수를 빠뜨려도 원문 줄의 "30일이상"을 읽어 계속투약으로 반영(정기로 옮겨도 동일) → Q4 누락 방지
{
  const source = ['마지막처방일 2025-1-3 30일이상', '(양방)관절통, 골반 부분 및 대퇴-AM2555'];
  const [h] = recordsToHistories(parseRecordLines('1|AM2555|관절통, 골반 부분 및 대퇴|정기|250103|||'), TODAY, source);
  assert.strictEqual(h.계속투약일수, 30);
  assert.strictEqual(h.상시복용여부, false);
  assert.strictEqual(classifyHistories([h], TODAY).Q4.included.length, 1);
  console.log('PASS: 원문 처방일수 보완');
}

// AI가 원문 줄을 빠뜨리면 그 줄만 재요청하고, 그래도 없으면 "원문 확인 필요"로 남기며 분류는 항상 확인필요
(async () => {
  const source = [
    '2022.09.20 / O3430 자궁경부부전 / 입원 3일 / 자궁경관봉축술',
    '2023.01.25 / Z3483 정상임신 관리 / 입원 X ,자궁경부봉축해제술',
    '2026-07-15',
  ];
  const calls = [];
  const extract = async onlyLines => {
    calls.push(onlyLines || null);
    if (!onlyLines) {
      return { sourceLines: source, chunks: [{ from: 1, to: 3, text: '1|O3430|자궁경부부전|입원|220920||3|\n1|O3430||수술|220920|||자궁경관봉축술' }] };
    }
    return { sourceLines: source, chunks: [{ from: 2, to: 3, lines: onlyLines, text: '2|Z3483|정상임신 관리|수술|230125|||자궁경부봉축해제술' }] };
  };
  const { histories, retriedLines, missingLines } = await buildHistoriesWithAI(extract, TODAY);
  assert.deepStrictEqual(calls, [null, [2, 3]]);
  assert.deepStrictEqual(retriedLines, [2, 3]);
  assert.deepStrictEqual(missingLines, [3]);
  assert.strictEqual(histories.find(h => h.진단코드 === 'Z3483').수술여부, true);
  const leftover = histories.find(h => h.원문확인필요);
  assert.strictEqual(leftover.원본, '2026-07-15');
  assert.strictEqual(leftover.최근진료일, '2026-07-15');
  const result = classifyHistories(histories, TODAY);
  assert.ok(result.Q1.review.includes(leftover) && !result.Q1.included.includes(leftover));
  console.log('PASS: 빠뜨린 줄 재요청·원문 확인 필요 보존');
  console.log('전체 통과: records.test.js');
})().catch(e => { console.error(e); process.exit(1); });
