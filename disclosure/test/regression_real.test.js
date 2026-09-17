// 실제 사용 기록(disclosure_logs)에서 잘못 분류된 사례를 이름을 지우고 재생한다.
// AI가 당시 실제로 낸 기록 줄을 그대로 넣어, 규칙이 AI의 빈틈을 메우는지 확인한다.
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const dataSrc = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const dataModule = { exports: {} };
new Function('module', 'exports', dataSrc)(dataModule, dataModule.exports);
Object.assign(global, dataModule.exports);

const { buildHistoriesWithAI, classifyHistories } = require('../app.js');

async function replay(source, today, aiOutput, retryOutput = '') {
  const calls = [];
  const extract = async onlyLines => {
    calls.push(onlyLines || null);
    return onlyLines
      ? { sourceLines: source, chunks: [{ from: Math.min(...onlyLines), to: Math.max(...onlyLines), lines: onlyLines, text: retryOutput }] }
      : { sourceLines: source, chunks: [{ from: 1, to: source.length, text: aiOutput.join('\n') }] };
  };
  const { histories } = await buildHistoriesWithAI(extract, today);
  const result = classifyHistories(histories, today);
  const names = list => list.map(h => h.진단명);
  return {
    calls,
    histories,
    result,
    names,
    has: (list, word) => names(list).some(n => n.includes(word)),
    find: word => histories.find(h => h.진단명.includes(word)),
    classified: new Set(Object.values(result).flatMap(b => [...b.included, ...b.review]).map(h => h.id)),
  };
}

// 2026-09-17 사례: 코드 없는 자유양식 + "ㄴ" 치료내용 줄 + 날짜 없는 "약 복용중" + "5년전" 암
const SOURCE_0917 = [
  '고객 병력',
  '',
  '3개월이내 병력 ',
  '',
  '고혈압 / 고지혈 / 당뇨 약 복용중',
  '',
  '2026-06-26 중추기원의 현기증',
  'ㄴ투약/외래 완치',
  '',
  '2026-06-20~2026-06-24 좌골신경통,요추부',
  'ㄴ침술',
  '',
  '5년 이내 병력 ',
  '',
  '2024-06-14 혈당조절이 되지않은 2형 당뇨병 / 입원3일',
  'ㄴ투약 및 검사',
  '',
  '2026-01-19 상세불명의 백내장,오른쪽',
  '2026-01-12 상세불명의 백내장,왼쪽',
  'ㄴ인공수정체삽입술',
  '',
  '5년전 유방암 좌측 진단 / 완치',
];

(async () => {
  // ① 처음 운영에서 나온 출력: 코드 없이 옮기고, 5번 줄(약 복용중)을 통째로 빠뜨리고, ㄴ 줄 치료내용에 진단명을 안 붙였다.
  {
    const { calls, histories, result, names, has, find } = await replay(SOURCE_0917, '2026-09-17', [
      '7||중추기원의 현기증|진단|260626|||',
      '7|||투약|260626|||투약',
      '10||좌골신경통,요추부|진단|260620|260624||',
      '11|||시술|||1|침술',
      '15||혈당조절이 되지않은 2형 당뇨병|입원|240614||3|',
      '15|||투약|240614|||투약',
      '18||상세불명의 백내장,오른쪽|진단|260119|||',
      '19||상세불명의 백내장,왼쪽|진단|260112|||',
      '19|||수술|260112|||인공수정체삽입술',
      '22||유방암 좌측|진단||||',
    ]);

    assert.ok(!histories.some(h => h.진단명.startsWith('진단명 미상')), `진단명 미상 병력이 생기면 안 됨: ${names(histories)}`);
    assert.deepStrictEqual(calls[1], [5], '약 복용중 줄은 빠뜨린 줄로 재요청돼야 함');
    assert.ok(has(result.Q1.included, '현기증'));
    assert.ok(has(result.Q1.included, '좌골신경통'));
    assert.strictEqual(find('현기증').약물명, null, '"투약"은 약 이름이 아님');
    assert.strictEqual(find('좌골신경통').수술여부, false, '침술은 시술');
    assert.ok(!has([...result.Q4.included, ...result.Q4.review], '좌골신경통'));
    assert.ok(has(result.Q4.included, '백내장,왼쪽'));
    assert.ok(has(result.Q4.included, '백내장,오른쪽'));
    assert.ok(has(result.Q4.included, '2형 당뇨병'));
    assert.ok(has(result.Q5.included, '2형 당뇨병'));
    assert.ok(has(result.Q5.review, '유방암'));
    const leftover = histories.find(h => h.원문확인필요);
    assert.ok(leftover && leftover.진단명.includes('고혈압'), `원문 확인 필요 병력: ${names(histories)}`);
    assert.ok(result.Q2.review.includes(leftover));
    assert.ok(result.Q5.review.includes(leftover));
    console.log('PASS: ① 코드 없는 출력·ㄴ 치료줄·약 복용중 누락·5년전 암');
  }

  // ② 프롬프트 수정 후 출력: 약 복용중 기록의 줄번호를 7로 잘못 적었고, 날짜 범위만 있는 좌골신경통을 "입원 5일"로 지어냈다.
  {
    const { calls, histories, result, names, has, find } = await replay(SOURCE_0917, '2026-09-17', [
      '7|~I10|고혈압|정기||||',
      '7|~E78|고지혈|정기||||',
      '7|~E11|당뇨|정기||||',
      '7|~R42|중추기원의 현기증|진단|260626|||',
      '7|~R42||투약|260626|||',
      '10|~M544|좌골신경통,요추부|입원|260620|260624|5|',
      '11|~M544||시술|||1|침술',
      '15|~E11|혈당조절이 되지않은 2형 당뇨병|입원|240614||3|',
      '15|~E11||투약|240614|||',
      '18|~H269|상세불명의 백내장,오른쪽|진단|260119|||',
      '19|~H269|상세불명의 백내장,왼쪽|진단|260112|||',
      '20|~H269||수술||||인공수정체삽입술',
      '22|~C50|유방암 좌측|진단||||',
    ]);

    assert.strictEqual(calls.length, 1, `날짜 없는 기록도 진단명으로 줄을 찾아 재요청이 없어야 함: ${JSON.stringify(calls)}`);
    assert.ok(!histories.some(h => h.원문확인필요), `원문 확인 필요가 생기면 안 됨: ${names(histories)}`);
    assert.ok(!histories.some(h => (h.비고 || '').includes('중복기록')), '같은 기록을 중복으로 세면 안 됨');
    const sciatica = find('좌골신경통');
    assert.strictEqual(sciatica.입원여부, false, '원문에 입원 표기가 없는 입원은 빼야 함');
    assert.ok(sciatica.비고.includes('입원') && sciatica.비고.includes('원문 확인'));
    assert.ok(has(result.Q1.included, '좌골신경통'));
    assert.ok(!has([...result.Q4.included, ...result.Q4.review], '좌골신경통'));
    // 추정 코드(~H269)가 같아도 오른쪽·왼쪽은 따로, ㄴ인공수정체삽입술은 두 눈 모두에 붙는다
    assert.ok(has(result.Q4.included, '백내장,오른쪽'));
    assert.ok(has(result.Q4.included, '백내장,왼쪽'));
    assert.ok(has(result.Q2.included, '고혈압'));
    assert.ok(has(result.Q5.review, '고혈압'));
    assert.ok(has(result.Q4.review, '고혈압'));
    assert.ok(has(result.Q5.included, '당뇨'));
    assert.ok(has(result.Q4.included, '당뇨'));
    assert.ok(has(result.Q5.review, '유방암'));
    console.log('PASS: ② 입원 지어냄 제거·날짜 없는 기록 줄찾기·백내장 이름 합치기');
  }

  // ③ 2026-09-16 사례: 날짜 없는 "전립선 증식증 / 당뇨 ⏎ 고지혈 / 고혈압 약 복용중" — AI가 윗줄 병을 진단으로 옮겨 Q2에서 빠졌다.
  {
    const source = [
      '전립선 증식증 / 당뇨',
      '고지혈 / 고혈압 약 복용중',
      '',
      '2023-01-17 기타 명시된 추간판전위 / 입원4일',
      'ㄴ',
      '',
      '2023-01-08 기타 명시된 추가판전위 / 입원9일',
      'ㄴ척추후궁절제술-요추 / 투약',
      '',
      '2022-12-05 상세불명의 패혈증 / 입원12일',
      'ㄴ투약 및 검사',
      '',
      '2022-11-27 상세불명의 폐렴 / 입원6일',
      'ㄴ투약 및 검사',
      '',
      '2023-03-02 폐쇄에 대한 언급이 없는 급성 담낭염을 동반한 담낭의 결석 / 입원9일',
      'ㄴ담낭절제술 및 투약 ',
      '',
      '2023-02-24 폐쇄에 대한 언급이 없는 급성 담낭염을 동반한 담낭의 결석 / 입원7일',
      'ㄴ투약 및 검사',
    ];
    const { calls, histories, result, names, has } = await replay(source, '2026-09-16', [
      '1|~N40|전립선 증식증|진단||||',
      '1|~E11|당뇨|진단||||',
      '2|~E78|고지혈|정기||||',
      '2|~I10|고혈압|정기||||',
      '4|~M512|기타 명시된 추간판전위|입원|230117||4|',
      '5|~M512||입원|230117||4|',
      '7|~M512|기타 명시된 추가판전위|입원|230108||9|',
      '8|~M512||수술|230108|||척추후궁절제술-요추',
      '8|~M512||투약|230108|||',
      '10|~A419|상세불명의 패혈증|입원|221205||12|',
      '11|~A419||투약|221205|||',
      '11|~A419||진단|221205|||검사',
      '13|~J159|상세불명의 폐렴|입원|221127||6|',
      '14|~J159||투약|221127|||',
      '14|~J159||진단|221127|||검사',
      '16|~K802|폐쇄에 대한 언급이 없는 급성 담낭염을 동반한 담낭의 결석|입원|230302||9|',
      '17|~K802||수술|230302|||담낭절제술',
      '17|~K802||투약|230302|||',
      '19|~K802|폐쇄에 대한 언급이 없는 급성 담낭염을 동반한 담낭의 결석|입원|230224||7|',
      '20|~K802||투약|230224|||',
      '20|~K802||진단|230224|||검사',
    ]);

    assert.strictEqual(calls.length, 1);
    for (const disease of ['전립선 증식증', '당뇨', '고지혈', '고혈압']) {
      assert.ok(has(result.Q2.included, disease), `${disease}는 계속 복용 약(Q2): ${names(result.Q2.included)}`);
    }
    assert.ok(!histories.some(h => /복용/.test(h.진단명)), `진단명에 "약 복용중"이 붙으면 안 됨: ${names(histories)}`);
    for (const disease of ['추간판전위', '패혈증', '폐렴', '담낭의 결석']) assert.ok(has(result.Q4.included, disease), disease);
    assert.ok(!histories.some(h => h.진단명.startsWith('진단명 미상') || h.원문확인필요), names(histories));
    console.log('PASS: ③ 날짜 없는 병명 목록 + 약 복용중 → 문단 전체 상시복용');
  }

  // ④ 2026-09-17 사례: 한 줄에 코드 두 개(G47.0 / G47.9), 기간 제목 줄, 날짜 없는 "데소나크림 처방", "0일" 투약
  {
    const source = [
      '최근 3개월 이내 질병/치료 이력',
      '--------------------',
      '>2026-06-23~2026-06-29 3회통원',
      ' 장미색 비강진 (L42)',
      ' 내복약·외용약(데소나크림 등) 처방',
      '',
      '--------------------',
      '5년 내 입원 및 수술 이력',
      '--------------------',
      '>2025-08-26 ~ 2025-09-01 (7일간 입원)',
      '  M75.1 (회전근개증후군 수술)',
      '>2024-02-05',
      '  조갑거터시술 (L60.0, 내향성 손발톱)',
      '',
      '--------------------',
      '7일 이상 통원/치료',
      '--------------------',
      '>2022-08-08 ~ 2026-06-16(30회)',
      ' 수면장애 및 불면증  G47.0 / G47.9',
      '>2025-01-03 ~ 2026-02-20(19회)',
      ' 회전근개증후군  M75.1',
      '>2023-08-01 ~ 2024-01-04(10회)',
      ' 경추간판전위 (경추 목디스크)  M50.2',
      '>2022-03-14 ~ 2025-12-24(14회)',
      ' 손발톱디스트로피  L60.3',
      '>2022-06-03 ~ 2023-06-28(8회)',
      ' 흉추통증, 흉요추부 M54.65',
      '>2024-01-13 ~ 2024-01-22(7회)',
      ' 급성 방광염  N30.0',
    ];
    const { calls, histories, result, names, has, find } = await replay(source, '2026-09-17', [
      '3|L42|장미색 비강진|통원|260623|260629|3|',
      '4|L42||진단|260623|||',
      '5|L42||투약|||0|데소나크림',
      '10|M751|회전근개증후군|입원|250826|250901|7|',
      '11|M751||수술|250826|||회전근개증후군 수술',
      '12|L600|조갑거터시술|시술|240205|||조갑거터시술',
      '13|L600|내향성 손발톱|진단|240205|||',
      '18|G470|수면장애 및 불면증|통원|220808|260616|30|',
      '19|G470||진단|220808|||',
      '19|G479||진단|220808|||',
      '20|M751|회전근개증후군|통원|250103|260220|19|',
      '21|M751||진단|250103|||',
      '22|M502|경추간판전위|통원|230801|240104|10|',
      '23|M502||진단|230801|||',
      '24|L603|손발톱디스트로피|통원|220314|251224|14|',
      '25|L603||진단|220314|||',
      '26|M5465|흉추통증, 흉요추부|통원|220603|230628|8|',
      '27|M5465||진단|220603|||',
      '28|N300|급성 방광염|통원|240113|240122|7|',
      '29|N300||진단|240113|||',
    ]);

    assert.strictEqual(calls.length, 1, `제목 줄·처방 줄로 재요청이 생기면 안 됨: ${JSON.stringify(calls)}`);
    assert.ok(!histories.some(h => h.진단명.startsWith('진단명 미상') || h.원문확인필요), `빈 병력·원문 확인 필요가 생기면 안 됨: ${names(histories)}`);
    assert.strictEqual(histories.length, 8, names(histories).join(' / '));
    assert.ok(find('수면장애').비고.includes('G479'), '둘째 코드는 같은 병력 비고에 남김');
    assert.strictEqual(find('장미색').계속투약일수, null, '"0일"은 비움');
    assert.strictEqual(find('장미색').약물명, '데소나크림');
    assert.ok(has(result.Q1.included, '장미색'));
    for (const disease of ['회전근개', '수면장애', '경추간판전위', '손발톱디스트로피', '흉추통증', '급성 방광염']) {
      assert.ok(has(result.Q4.included, disease), `${disease} Q4: ${names(result.Q4.included)}`);
    }
    console.log('PASS: ④ 한 줄 여러 코드·기간 제목 줄·날짜 없는 처방·0일');
  }

  // ⑤ 2026-09-17 사례: 탭으로 나뉜 심사 결과표. AI가 코드 칸을 빼먹고 7줄 모두 "진단"이라는 이름으로 옮겨 전부 누락됐다.
  {
    const source = [
      '인대 및 건손상\t2026-06\t0\t0\t1\t인심사대상\t',
      '염좌(척추제외)\t2026-06\t11\t7\t1\t인심사대상\t',
      '염좌(척추)\t2020-06\t12\t14\t0\t인심사대상\t',
      '회전근개손상\t2021-05\t3\t33\t1\t인심사대상\t',
      '뇌손상(뇌출혈제외)\t2020-06\t8\t8\t0\t인심사대상\t',
      '갑상선암\t2020-02\t8\t3\t1\t인심사대상\t',
      '요실금\t2017-06\t0\t2\t1\t인심사대상',
    ];
    const { calls, histories, result, names, has, classified } = await replay(source, '2026-09-17', [
      '1|인대 및 건손상|진단|2606|||',
      '2|염좌(척추제외)|진단|2606|||',
      '3|염좌(척추)|진단|2006|||',
      '4|회전근개손상|진단|2105|||',
      '5|뇌손상(뇌출혈제외)|진단|2006|||',
      '6|갑상선암|진단|2002|||',
      '7|요실금|진단|1706|||',
    ]);

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(histories.length, 7, names(histories).join(' / '));
    assert.ok(histories.every(h => h.원문확인필요 && h.치료내용미상), '표 행은 모두 원문 확인 필요');
    assert.ok(histories.every(h => classified.has(h.id)), `어느 문항에도 안 걸린 표 행이 있으면 안 됨: ${names(histories.filter(h => !classified.has(h.id)))}`);
    assert.ok(Object.values(result).every(b => b.included.length === 0), '숫자 칸 뜻을 모르므로 확정(분류완료)은 없어야 함');
    // 2026-06: 3개월 경계에 걸침 → Q1 확인필요, 5년 이내 → Q4 확인필요
    for (const disease of ['인대 및 건손상', '염좌(척추제외)']) {
      assert.ok(has(result.Q1.review, disease), `${disease} Q1`);
      assert.ok(has(result.Q4.review, disease), `${disease} Q4`);
    }
    // 6~10년 전 → Q6 확인필요
    for (const disease of ['염좌(척추)', '회전근개손상', '뇌손상', '갑상선암', '요실금']) {
      assert.ok(has(result.Q6.review, disease), `${disease} Q6: ${names(result.Q6.review)}`);
    }
    console.log('PASS: ⑤ 탭 표 형식 → 규칙으로 행마다 병력, 연·월 경계는 확인필요');
  }

  // ⑥ 2026-09-17 사례 재실행 출력: "당뇨병 정기"를 "2형 당뇨병" 입원 줄(15)로 잘못 찾아 2024 날짜가 채워지고 Q2에서 빠졌다.
  {
    const { calls, histories, result, names, has } = await replay(SOURCE_0917, '2026-09-17', [
      '5|~I10|고혈압|정기||||',
      '5|~E78|고지혈증|정기||||',
      '5|~E11|당뇨병|정기||||',
      '7|~R42|중추기원의 현기증|진단|260626|||',
      '8|~R42||투약|260626|||',
      '10|~M544|좌골신경통,요추부|진단|260620|260624||',
      '11|~M544||시술|||1|침술',
      '15|~E119|혈당조절이 되지않은 2형 당뇨병|입원|240614||3|',
      '16|~E119||투약|240614|||',
      '18|~H269|상세불명의 백내장,오른쪽|진단|260119|||',
      '19|~H269|상세불명의 백내장,왼쪽|진단|260112|||',
      '20|~H269|상세불명의 백내장,오른쪽|수술||||인공수정체삽입술',
      '20|~H269|상세불명의 백내장,왼쪽|수술||||인공수정체삽입술',
    ], '22|~C509|유방암 좌측|진단||||');

    assert.deepStrictEqual(calls, [null, [22]], `약 복용중 줄은 찾고 유방암 줄만 재요청: ${JSON.stringify(calls)}`);
    const diabetesMeds = histories.find(h => h.진단명 === '당뇨병');
    assert.ok(diabetesMeds, names(histories).join(' / '));
    assert.strictEqual(diabetesMeds.최근진료일, null, '계속 복용 약에 다른 줄 날짜가 붙으면 안 됨');
    assert.strictEqual(diabetesMeds.상시복용여부, true);
    assert.ok(!(diabetesMeds.비고 || '').includes('E119'), 'AI 추정 코드로 병력을 합치면 안 됨');
    for (const disease of ['고혈압', '고지혈증', '당뇨병']) assert.ok(has(result.Q2.included, disease), `${disease} Q2`);
    assert.ok(has(result.Q4.included, '2형 당뇨병'));
    assert.ok(has(result.Q5.included, '2형 당뇨병'));
    assert.ok(has(result.Q4.included, '백내장'));
    assert.ok(has(result.Q5.review, '유방암'));
    console.log('PASS: ⑥ 계속 복용 약은 "복용중" 줄로 찾고 날짜를 붙이지 않음');
  }

  // ⑦ 2026-09-17 4번 사례 재실행 출력: 날짜·숫자 없는 "데소나크림 처방" 줄에 AI가 "30일"을 지어내 Q4에 잘못 들어갔다.
  {
    const source = [
      '최근 3개월 이내 질병/치료 이력',
      '--------------------',
      '>2026-06-23~2026-06-29 3회통원',
      ' 장미색 비강진 (L42)',
      ' 내복약·외용약(데소나크림 등) 처방',
      '',
      '--------------------',
      '7일 이상 통원/치료',
      '--------------------',
      '>2022-08-08 ~ 2026-06-16(30회)',
      ' 수면장애 및 불면증  G47.0 / G47.9',
    ];
    const { calls, result, has, find } = await replay(source, '2026-09-17', [
      '3|L42|장미색 비강진|통원|260623|260629|3|',
      '4|L42||진단||||',
      '5|L42||투약|||30|데소나크림',
      '10|G470|수면장애 및 불면증|통원|220808|260616|30|',
      '10|G479||통원|220808|260616|30|',
    ]);

    assert.strictEqual(calls.length, 1);
    const rash = find('장미색');
    assert.strictEqual(rash.계속투약일수, null, '원문에 없는 30일은 비움');
    assert.ok(rash.비고.includes('원문 확인'));
    assert.ok(has(result.Q1.included, '장미색'));
    assert.ok(!has([...result.Q4.included, ...result.Q4.review], '장미색'));
    assert.strictEqual(find('수면장애').통원횟수, 30, '원문에 있는 30회는 유지');
    assert.ok(find('수면장애').비고.includes('G479'));
    console.log('PASS: ⑦ 원문에 없는 일수는 비우고, 있는 횟수는 유지');
  }

  // ⑧ 2026-09-16 사례 재실행 출력: AI가 고지혈에도 고혈압 추정 코드(~I10)를 붙여 두 병이 한 병력으로 묶이고 고혈압이 사라졌다.
  {
    const source = ['전립선 증식증 / 당뇨', '고지혈 / 고혈압 약 복용중', '', '2023-01-17 기타 명시된 추간판전위 / 입원4일', 'ㄴ', '', '2023-01-08 기타 명시된 추가판전위 / 입원9일', 'ㄴ척추후궁절제술-요추 / 투약'];
    const { histories, result, names, has } = await replay(source, '2026-09-16', [
      '1|~N40|전립선 증식증|정기||||',
      '1|~E11|당뇨|정기||||',
      '2|~I10|고지혈|정기||||',
      '2|~I10|고혈압|정기||||',
      '4|~M511|기타 명시된 추간판전위|입원|230117||4|',
      '5|~M511||입원|230117||4|',
      '7|~M511|기타 명시된 추가판전위|입원|230108||9|',
      '8|~M511||수술|230108|||척추후궁절제술-요추',
    ]);

    for (const disease of ['전립선 증식증', '당뇨', '고지혈', '고혈압']) {
      assert.ok(histories.some(h => h.진단명 === disease), `${disease}가 따로 남아야 함: ${names(histories)}`);
      assert.ok(has(result.Q2.included, disease), `${disease} Q2`);
    }
    assert.ok(has(result.Q5.review, '고혈압'));
    assert.ok(!has([...result.Q5.included, ...result.Q5.review], '고지혈'), '고지혈은 10대질병이 아님');
    const surgeryEntry = histories.find(h => h.수술여부);
    assert.ok(surgeryEntry && surgeryEntry.진단명.includes('추가판전위'), `ㄴ 수술은 1/8 입원 병력에 붙어야 함: ${names(histories)}`);
    console.log('PASS: ⑧ 추정 코드가 같아도 진단명이 다르면 따로 묶음');
  }

  console.log('전체 통과: regression_real.test.js');
})().catch(e => { console.error(e); process.exit(1); });
