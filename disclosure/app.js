let nextHistoryId = 1;

// 심평원 내진료정보는 양방 코드 앞에 "A"를 붙인다(AC220 → C220). A00~A99 감염병 코드는 A 뒤가 숫자라 영향 없다.
function normalizeDiseaseCode(code) {
  const c = (code || '').replace(/[.\s]/g, '').toUpperCase();
  return /^A[A-Z]\d/.test(c) ? c.slice(1) : c;
}

// "26.08.06", "2025-03-17", "2024-6-19" 형태 날짜를 모두 ISO(YYYY-MM-DD)로 뽑는다.
function extractDates(text) {
  const out = [];
  for (const m of (text || '').matchAll(/(?<!\d)(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?!\d)|(?<!\d)(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g)) {
    const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [`20${m[4]}`, m[5], m[6]];
    out.push(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`);
  }
  return out;
}

// 긴 심평원 복사본은 AI가 같은 진단코드를 입원/통원/수술 섹션별로 여러 블록으로 쪼개곤 한다.
// 알릴의무는 병명 단위로 판단하므로 같은 코드는 한 병력으로 합친다.
function mergeSameCode(entries) {
  const byCode = new Map();
  const merged = [];
  const sum = (a, b) => (a === null && b === null ? null : (a || 0) + (b || 0));
  const maxNum = (a, b) => (a === null ? b : b === null ? a : Math.max(a, b));
  const pickDate = (a, b, later) => (!a ? b : !b ? a : (a > b) === later ? a : b);
  const joinUnique = (a, b, sep) => [...new Set([a, b].filter(Boolean))].join(sep);

  for (const e of entries) {
    const base = e.진단코드 && byCode.get(e.진단코드);
    if (!base) {
      if (e.진단코드) byCode.set(e.진단코드, e);
      merged.push(e);
      continue;
    }
    if (e.최근진료일 && (!base.최근진료일 || e.최근진료일 > base.최근진료일)) base.현재상태 = e.현재상태;
    base.진단명 = base.진단명 || e.진단명;
    base.최초진단일 = pickDate(base.최초진단일, e.최초진단일, false);
    base.최근진료일 = pickDate(base.최근진료일, e.최근진료일, true);
    base.입원여부 = base.입원여부 || e.입원여부;
    base.입원일수 = sum(base.입원일수, e.입원일수);
    base.수술여부 = base.수술여부 || e.수술여부;
    base.수술명 = joinUnique(base.수술명, e.수술명, ', ') || null;
    base.계속치료일수 = maxNum(base.계속치료일수, e.계속치료일수);
    base.계속투약일수 = maxNum(base.계속투약일수, e.계속투약일수);
    base.통원횟수 = sum(base.통원횟수, e.통원횟수);
    base.약물명 = joinUnique(base.약물명, e.약물명, ', ') || null;
    base.재검사여부 = base.재검사여부 || e.재검사여부;
    base.상시복용여부 = base.상시복용여부 || e.상시복용여부;
    base.비고 = joinUnique(base.비고, e.비고, ' / ');
    base.원본 = joinUnique(base.원본, e.원본, '\n\n');
  }
  return merged;
}

function parseHistoryText(text) {
  if (!text || !text.trim()) return [];

  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const results = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const headerLine = lines.find(l => l.startsWith('🔴'));
    if (!headerLine) continue;

    const headerBody = headerLine.replace('🔴', '').trim();
    const [namePart, codePart] = headerBody.split('/').map(s => (s || '').trim());

    const dates = [];
    const entry = {
      id: nextHistoryId++,
      진단명: (namePart || '').replace(/\((양방|한방)\)/g, '').trim(),
      진단코드: normalizeDiseaseCode(codePart),
      최초진단일: null,
      최근진료일: null,
      입원여부: false,
      입원일수: null,
      수술여부: false,
      수술명: null,
      계속치료일수: null,
      계속투약일수: null,
      통원횟수: null,
      약물명: null,
      재검사여부: false,
      상시복용여부: false,
      현재상태: '',
      비고: '',
      원본: block,
    };

    for (const line of lines) {
      if (line.startsWith('입원:')) {
        const v = line.replace('입원:', '').trim();
        if (v && v !== '없음') {
          entry.입원여부 = true;
          const m = v.match(/(\d+)\s*일/);
          if (m) entry.입원일수 = parseInt(m[1], 10);
        }
      } else if (line.startsWith('수술:')) {
        const v = line.replace('수술:', '').trim();
        if (v && v !== '없음') {
          entry.수술여부 = true;
          entry.수술명 = v;
        }
      } else if (line.startsWith('통원:')) {
        const v = line.replace('통원:', '').trim();
        if (v && v !== '없음') {
          const m = v.match(/(\d+)\s*회/);
          if (m) entry.통원횟수 = parseInt(m[1], 10);
        }
      } else if (line.startsWith('투약:')) {
        const v = line.replace('투약:', '').trim();
        if (v && v !== '없음') {
          const m = v.match(/(\d+)\s*일/);
          if (m) entry.계속투약일수 = parseInt(m[1], 10);
        }
      } else if (line.startsWith('약물:')) {
        const v = line.replace('약물:', '').trim();
        if (v && v !== '없음') entry.약물명 = v;
      } else if (line.startsWith('상시복용:')) {
        entry.상시복용여부 = line.replace('상시복용:', '').trim() === '예';
      } else if (line.startsWith('재검사:')) {
        entry.재검사여부 = line.replace('재검사:', '').trim() === '예';
      } else if (line.startsWith('비고:')) {
        entry.비고 = line.replace('비고:', '').trim();
        dates.push(...extractDates(entry.비고));
      } else if (line.startsWith('치료/현상태:')) {
        const v = line.replace('치료/현상태:', '').trim();
        entry.현재상태 = v;
        // "~"로 끝나면 진행중 표기이지만 최근진료일을 자동으로 채우지 않는다
        // (README 5장: 과거에 오늘 날짜로 자동완성 → 완치 사례 오분류 버그 발생)
        if (!v.endsWith('~')) dates.push(...extractDates(v));
      }
    }

    // 첫 날짜가 아니라 상태·비고에 적힌 날짜 중 가장 최근/가장 이른 날짜를 쓴다
    // (AI가 오래된 날짜를 먼저 적어도 3개월/1년/5년 판정이 틀어지지 않게).
    if (dates.length) {
      dates.sort();
      entry.최초진단일 = dates[0];
      entry.최근진료일 = dates[dates.length - 1];
    }

    results.push(entry);
  }

  return mergeSameCode(results);
}

if (typeof module !== 'undefined') {
  module.exports = { parseHistoryText };
}

// ---------------------------------------------------------------------------
// AI 기록 줄 → 병력
// AI는 원문의 기록을 "줄번호|코드|진단명|종류|시작일|종료일|수치|상세" 한 줄씩 옮겨 적기만 한다.
// 중복 제거·합산·병력 묶기·시술 구분·상시복용 기간 판단은 전부 아래 규칙으로 결정한다.
// ---------------------------------------------------------------------------
const RECORD_TYPES = ['진단', '입원', '통원', '수술', '시술', '투약', '정기', '재검'];

// 인수지침 24(심사 TIP): 수술이 아닌 시술·보존치료. 이 키워드면 AI가 "수술"로 옮겨도 시술로 본다.
// 목록에 없는 처치를 AI가 "시술"로 판단한 경우는 놓치지 않게 수술로 두고 "원문 확인" 표시를 붙인다.
const PROCEDURE_KEYWORDS = ['신경차단', '신경근차단', '경막외', '신경성형', '신경감압', '주사', '물리치료', '도수치료', '체외충격파', '프롤로', '약침', '침치료', '깁스', '보조기', '냉동치료', '압박스타킹'];

const compactText = s => (s || '').replace(/[\s.]/g, '').toUpperCase();

// "240806" → 원문 "2024-8-6", "24.08.06", "2024년 8월 6일" 등에 맞는 정규식. 연도 없는 "0723"은 "7월 23일"에도 맞는다.
function recordDateRegexes(r) {
  const sep = '\\s*[-./년월]\\s*';
  return [r.start, r.end].map(s => (s || '').replace(/\D/g, '')).filter(d => [4, 6, 8].includes(d.length)).map(d => {
    const digits = d.length === 8 ? d.slice(2) : d;
    const year = digits.length === 6 ? digits.slice(0, 2) : null;
    const md = digits.slice(-4);
    return new RegExp(`(?<!\\d)${year ? `(?:20)?${year}${sep}` : ''}0?${Number(md.slice(0, 2))}${sep}0?${Number(md.slice(2))}(?!\\d)`);
  });
}

// AI가 적은 줄번호는 틀릴 수 있어(기록 순번을 적거나 옆 기록 줄을 가리킴) 날짜·코드로 원문 줄을 다시 찾는다.
// 날짜가 맞는 줄(+2)에 코드가 같은 줄·바로 위아래 줄에 있으면(+1) 가장 확실하고, 동점이면 AI가 적은 줄에 가까운 쪽.
function locateRecordLine(r, sourceLines) {
  const dateRes = recordDateRegexes(r);
  const code = normalizeDiseaseCode(r.code.replace(/^~/, ''));
  const checkCode = code.length >= 3;
  if (!dateRes.length && !checkCode) return r.lineNo;
  const hasCode = i => checkCode && i >= 0 && i < sourceLines.length && compactText(sourceLines[i]).includes(code);
  const claimed = r.lineNo - 1;
  let best = -1;
  let bestScore = 0;
  sourceLines.forEach((line, i) => {
    const dateHit = dateRes.some(re => re.test(line));
    const codeHit = hasCode(i) || (dateRes.length > 0 && (hasCode(i - 1) || hasCode(i + 1)));
    const score = (dateHit ? 2 : 0) + (codeHit ? 1 : 0);
    if (score > bestScore || (score > 0 && score === bestScore && Math.abs(i - claimed) < Math.abs(best - claimed))) {
      best = i;
      bestScore = score;
    }
  });
  return best >= 0 ? best + 1 : r.lineNo;
}

// "입원x", "수술 X", "입원없음"이 적힌 줄에서 나온 입원/수술 기록은 AI 오독이므로 버린다.
function isNegatedRecord(r, line = '') {
  if (r.type !== '입원' && r.type !== '수술') return false;
  const negated = new RegExp(`${r.type}\\s*[:：]?\\s*(?:x|X|×|없음|무)(?![가-힣A-Za-z])`).test(line);
  const affirmed = new RegExp(`${r.type}\\s*[:：]?\\s*(?:\\d|[oO○](?![가-힣A-Za-z]))`).test(line);
  return negated && !affirmed && r.value === null;
}

// 청크별 AI 출력 → 줄번호 재확인 → 자기 범위 밖 기록(옆 청크 담당) 제거 → 부정 표기 오독 제거
// chunk.lines가 있으면(빠뜨린 줄 재요청) 그 줄에서 나온 기록만 받는다.
function collectRecords(chunks, sourceLines) {
  const records = [];
  for (const chunk of chunks) {
    for (const r of parseRecordLines(chunk.text)) {
      const lineNo = locateRecordLine(r, sourceLines);
      const inScope = chunk.lines ? chunk.lines.includes(lineNo) : lineNo >= chunk.from && lineNo <= chunk.to;
      if ((chunks.length > 1 || chunk.lines) && !inScope) continue;
      if (isNegatedRecord(r, sourceLines[lineNo - 1])) continue;
      records.push({ ...r, lineNo });
    }
  }
  return records;
}

const CODE_TOKEN_RE = /(?<![A-Za-z0-9])A?[A-Z]\d{2,5}(?!\d)/;
const MONTH_DAY_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/;

// 원문 줄에 적힌 "~술" 처치명(시술 키워드 제외). 진단명의 "수술후"처럼 뒤에 글자가 붙은 것은 제외된다.
function surgeryWordsIn(line) {
  return ((line || '').match(/[가-힣]{2,}술(?![가-힣])/g) || []).filter(w => !PROCEDURE_KEYWORDS.some(k => w.includes(k)));
}

// AI가 빠뜨렸을 수 있는 줄:
// - "~술"이 적혔는데 그 줄·바로 위아래 줄에 수술/시술 기록이 없는 줄
// - 날짜가 적혔는데 어떤 기록에도 쓰이지 않은 줄
// - 코드만 있는 줄인데 알려진 병력·기록 줄과 무관한 줄
function findUncoveredLines(records, sourceLines) {
  const covered = new Set(records.map(r => r.lineNo));
  const codes = [...new Set(records.map(r => normalizeDiseaseCode(r.code.replace(/^~/, ''))).filter(c => c.length >= 3))];
  const treatments = records.filter(r => r.type === '수술' || r.type === '시술');
  const treatmentLines = treatments.map(r => r.lineNo);
  const treatmentTexts = treatments.map(r => compactText(`${r.detail}${r.name}`));
  const uncovered = [];
  sourceLines.forEach((line, i) => {
    const n = i + 1;
    // 수술명이 날짜 줄과 떨어진 줄에 있어도 같은 수술명이 담긴 수술/시술 기록이 있으면 반영된 것으로 본다
    const missedWords = surgeryWordsIn(line).filter(w => !treatmentTexts.some(t => t.includes(compactText(w))));
    if (missedWords.length && !treatmentLines.some(t => Math.abs(t - n) <= 1)) {
      uncovered.push(n);
      return;
    }
    if (covered.has(n)) return;
    if (extractDates(line).length > 0 || MONTH_DAY_RE.test(line)) {
      uncovered.push(n);
      return;
    }
    if (!CODE_TOKEN_RE.test(line.replace(/\./g, ''))) return;
    // 날짜 없이 진단명·코드만 있는 줄은 이미 잡힌 병력의 코드 줄이거나 기록 줄 바로 옆(진단명 줄)이면 반영된 것으로 본다
    if (codes.some(c => compactText(line).includes(c)) || covered.has(n - 1) || covered.has(n + 1)) return;
    uncovered.push(n);
  });
  return uncovered;
}

// 재요청 후에도 옮겨지지 않은 원문 줄은 지우지 않고 "원문 확인 필요" 병력으로 남긴다(분류는 항상 확인필요로).
function uncoveredLineHistories(lineNos, sourceLines, todayStr) {
  return lineNos.map(n => {
    const line = sourceLines[n - 1].trim();
    const md = line.match(MONTH_DAY_RE);
    const monthDay = md ? resolveRecordDate(`${md[1].padStart(2, '0')}${md[2].padStart(2, '0')}`, todayStr) : null;
    const dates = [...extractDates(line), monthDay].filter(Boolean).sort();
    const code = line.replace(/\./g, '').match(CODE_TOKEN_RE);
    return {
      id: nextHistoryId++,
      진단명: '원문 확인 필요',
      진단코드: code ? normalizeDiseaseCode(code[0]) : '',
      최초진단일: dates[0] || null,
      최근진료일: dates[dates.length - 1] || null,
      입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
      계속치료일수: null, 계속투약일수: null, 통원횟수: null, 약물명: null,
      재검사여부: false, 상시복용여부: false,
      현재상태: '',
      비고: 'AI가 이 원문 줄을 옮기지 못했어요. 입원·수술·투약 여부를 직접 확인해 세부 수정에 입력해주세요',
      원본: line,
      원문확인필요: true,
    };
  });
}

// AI 기록 추출 → 규칙 병합. 빠뜨린 원문 줄은 그 줄만 한 번 더 요청하고, 그래도 없으면 "원문 확인 필요"로 남긴다.
// extract(onlyLines?)는 { chunks, sourceLines }를 돌려주는 함수(브라우저에선 extractRecordsWithAI, 테스트에선 가짜).
async function buildHistoriesWithAI(extract, todayStr) {
  const { chunks, sourceLines } = await extract();
  let records = collectRecords(chunks, sourceLines);
  const firstMissing = findUncoveredLines(records, sourceLines);
  let missing = firstMissing;
  if (firstMissing.length) {
    const retry = await extract(firstMissing);
    records = records.concat(collectRecords(retry.chunks, sourceLines));
    missing = findUncoveredLines(records, sourceLines);
  }
  // 기록이 하나라도 나온 줄(수술명만 빠진 줄)은 recordsToHistories의 수술 안전장치가 처리하므로 별도 병력으로 만들지 않는다.
  const leftoverLines = missing.filter(n => !records.some(r => r.lineNo === n));
  return {
    histories: [...recordsToHistories(records, todayStr, sourceLines), ...uncoveredLineHistories(leftoverLines, sourceLines, todayStr)],
    records,
    retriedLines: firstMissing,
    missingLines: missing,
  };
}

if (typeof module !== 'undefined') {
  module.exports.findUncoveredLines = findUncoveredLines;
  module.exports.buildHistoriesWithAI = buildHistoriesWithAI;
}

function parseRecordLines(text) {
  const records = [];
  for (const rawLine of (text || '').split('\n')) {
    const line = rawLine.trim();
    if (!/^\d+\s*\|/.test(line)) continue;
    const [lineNo, rawCode = '', name = '', type = '', start = '', end = '', value = '', ...detail] = line.split('|').map(s => s.trim());
    const num = value.match(/\d+/);
    // 코드 칸에 사람 이름·날짜 같은 코드 아닌 값이 오면 코드로 쓰지 않는다. 그 외 내용도 전혀 없으면 잡음 줄이라 버린다
    // (날짜가 있던 원문 줄이면 findUncoveredLines가 다시 잡는다).
    const code = /^~?[A-Z]{1,2}\d{2,6}[A-Z]?$/i.test(rawCode.replace(/[.\s]/g, '')) ? rawCode : '';
    if (!code && !name && !start && !end && !num && !detail.join('').trim()) continue;
    records.push({
      lineNo: Number(lineNo),
      code,
      name,
      type: RECORD_TYPES.includes(type) ? type : '진단',
      start,
      end,
      value: num ? Number(num[0]) : null,
      detail: detail.join('|').trim(),
    });
  }
  return records;
}

// YYMMDD / YYYYMMDD / MMDD(연도 없음 → 오늘 이전의 가장 가까운 날짜)
function resolveRecordDate(s, todayStr) {
  const d = (s || '').replace(/\D/g, '');
  let iso = null;
  if (d.length === 6) iso = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  else if (d.length === 8) iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  else if (d.length === 4) {
    const year = Number(todayStr.slice(0, 4));
    iso = `${year}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
    if (iso > todayStr) iso = `${year - 1}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
  }
  if (!iso) return null;
  const [, mo, day] = iso.split('-').map(Number);
  return mo >= 1 && mo <= 12 && day >= 1 && day <= 31 ? iso : null;
}

function toShortDate(iso) {
  return iso ? iso.slice(2).replace(/-/g, '.') : '';
}

function recordsToHistories(records, todayStr, sourceLines = []) {
  const cleanName = n => (n || '').replace(/\((양방|한방)\)/g, '').trim();

  // 코드 없이 이름만 온 기록은 같은 이름의 코드 있는 병력에 붙인다.
  const codeByName = new Map();
  for (const r of records) {
    const code = normalizeDiseaseCode(r.code.replace(/^~/, ''));
    if (code && cleanName(r.name)) codeByName.set(cleanName(r.name), code);
  }

  const groups = new Map();
  for (const r of records) {
    const code = normalizeDiseaseCode(r.code.replace(/^~/, '')) || codeByName.get(cleanName(r.name)) || '';
    const key = code || `name:${cleanName(r.name)}`;
    if (!groups.has(key)) groups.set(key, { code, records: [], lineNos: new Set(), estimated: true, duplicates: 0, seen: new Map() });
    const g = groups.get(key);
    g.lineNos.add(r.lineNo);
    if (r.code && !r.code.startsWith('~')) g.estimated = false;
    // 내용이 같은 기록: 같은 원문 줄이면 AI가 두 번 적은 것(조용히 무시), 다른 줄이면 원문의 중복기록(비고에 표시).
    // 입원·통원·투약은 상세 문구가 달라도 날짜·수치가 같으면 같은 기록으로 본다(두 번 합산 방지).
    const detailPart = ['수술', '시술', '정기'].includes(r.type) ? compactText(r.detail) : '';
    const signature = [r.type, r.start.replace(/\D/g, ''), r.end.replace(/\D/g, ''), r.value, detailPart].join('|');
    if (g.seen.has(signature)) {
      if (!g.seen.get(signature).has(r.lineNo)) g.duplicates++;
      g.seen.get(signature).add(r.lineNo);
      continue;
    }
    g.seen.set(signature, new Set([r.lineNo]));
    g.records.push(r);
  }

  const histories = [];
  for (const g of groups.values()) {
    const rs = g.records;
    const ofType = t => rs.filter(r => r.type === t);
    const name = rs.map(r => cleanName(r.name)).find(Boolean) || '';
    // 투약·정기의 상세에 AI가 약 이름 대신 진단명을 넣는 경우만 걸러낸다(수술명은 진단명과 같아도 그대로 둔다).
    const detailOf = r => (['투약', '정기'].includes(r.type) && compactText(r.detail) === compactText(name) ? '' : r.detail);
    const sumValues = list => (list.some(r => r.value !== null) ? list.reduce((s, r) => s + (r.value || 0), 0) : null);
    const range = r => {
      const s = resolveRecordDate(r.start, todayStr);
      const e = resolveRecordDate(r.end, todayStr);
      return s && e ? `${toShortDate(s)}~${toShortDate(e)}` : toShortDate(s || e);
    };
    const withCount = (r, unit) => [detailOf(r), range(r), r.value !== null ? `${r.value}${unit}` : ''].filter(Boolean).join(' ');

    const dates = rs.flatMap(r => [resolveRecordDate(r.start, todayStr), resolveRecordDate(r.end, todayStr)]).filter(Boolean).sort();
    const admissions = ofType('입원');
    const matchesProcedure = r => PROCEDURE_KEYWORDS.some(k => r.detail.includes(k));
    const treatments = rs.filter(r => r.type === '수술' || r.type === '시술');
    const procedures = treatments.filter(matchesProcedure);
    const surgeries = treatments.filter(r => !matchesProcedure(r));
    const doubtfulSurgeries = surgeries.filter(r => r.type === '시술');
    // AI가 수술 기록을 끝내 빠뜨려도 이 병력의 원문 줄에 "~술"이 적혀 있으면 수술로 처리한다(비고에 원문 확인 표시).
    const missedSurgeryWords = treatments.length ? [] : [...new Set([...g.lineNos].flatMap(n => surgeryWordsIn(sourceLines[n - 1])))];
    // "21.09.24~25.05.01 (7)"처럼 횟수가 붙은 진단 기록은 통원 횟수로 본다(7회 이상 통원 Q4 누락 방지, 비고에 원문 확인 표시).
    const countedDiagnoses = ofType('진단').filter(r => r.value !== null);
    const visits = [...ofType('통원'), ...countedDiagnoses];
    const medications = ofType('투약');
    const regulars = ofType('정기');
    // AI가 처방일수를 빠뜨리면 원문 줄의 "30일이상", "28일치"를 읽어 채운다. 정기처방에 적힌 일수도 계속투약으로 본다.
    const prescribedDays = r => {
      if (r.value !== null) return r.value;
      const m = (sourceLines[r.lineNo - 1] || '').match(/(\d+)\s*일\s*(?:이상|치|분)/);
      return m ? Number(m[1]) : null;
    };
    const medicationDays = [...medications, ...regulars].map(prescribedDays).filter(v => v !== null);

    // 정기처방은 가장 최근 처방일이 3개월 이내일 때만 "상시복용"으로 본다. 날짜를 모르면 놓치지 않게 상시복용으로 두고 비고에 표시한다.
    const regularDates = regulars.map(r => resolveRecordDate(r.end, todayStr) || resolveRecordDate(r.start, todayStr));
    const regularUndated = regularDates.some(d => !d);
    const regularRecent = regularDates.some(d => d && withinMonths(d, todayStr, 3));

    const unknownDetails = [...new Set(rs.map(r => r.detail).filter(Boolean))].slice(0, 3).join('·');
    const notes = [
      admissions.length && `입원 ${admissions.map(r => withCount(r, '일')).join(', ')}`,
      visits.length && `통원 ${visits.map(r => withCount(r, '회')).join(', ')}`,
      medications.length && `투약 ${medications.map(r => withCount(r, '일')).join(', ')}`,
      procedures.length && `시술(수술 아님) ${procedures.map(r => withCount(r, '회')).join(', ')}`,
      doubtfulSurgeries.length && `수술로 처리(AI는 시술로 봄 — 원문 확인) ${doubtfulSurgeries.map(r => withCount(r, '회')).join(', ')}`,
      missedSurgeryWords.length && `원문에 수술명이 있어 수술로 처리(AI 누락 — 원문 확인) ${missedSurgeryWords.join(', ')}`,
      countedDiagnoses.length && `횟수를 통원으로 처리(원문 확인) ${countedDiagnoses.map(r => withCount(r, '회')).join(', ')}`,
      regulars.length && `정기처방 ${regulars.map(r => withCount(r, '')).join(', ')}${regularUndated ? '(날짜 미상)' : ''}`,
      g.duplicates && `중복기록 ${g.duplicates}건 제외`,
      g.code && g.estimated && '코드는 AI 추정',
    ].filter(Boolean);

    // 원문: 기록이 나온 줄 + 같은 코드가 적힌 줄(날짜 줄과 진단명 줄이 나뉜 복사본 대비)
    const sourceLineNos = new Set(g.lineNos);
    if (g.code.length >= 3) sourceLines.forEach((line, i) => { if (compactText(line).includes(g.code)) sourceLineNos.add(i + 1); });

    histories.push({
      id: nextHistoryId++,
      진단명: name || (g.code ? '' : `진단명 미상${unknownDetails ? `(${unknownDetails})` : ''}`),
      진단코드: g.code,
      최초진단일: dates[0] || null,
      최근진료일: dates[dates.length - 1] || null,
      입원여부: admissions.length > 0,
      입원일수: sumValues(admissions),
      수술여부: surgeries.length > 0 || missedSurgeryWords.length > 0,
      // 코드 없이 처치명만 진단명 칸에 온 수술(치근활택술 등)은 그 이름을 수술명으로 쓴다.
      수술명: [...surgeries.map(r => [detailOf(r) || (g.code ? '' : cleanName(r.name)) || '수술명 미상', r.value > 1 ? `${r.value}회` : ''].filter(Boolean).join(' ')), ...missedSurgeryWords].join(', ') || null,
      계속치료일수: null,
      계속투약일수: medicationDays.length ? Math.max(...medicationDays) : null,
      통원횟수: sumValues(visits),
      약물명: [...new Set([...medications, ...regulars].map(detailOf).filter(Boolean))].join(', ') || null,
      재검사여부: ofType('재검').length > 0,
      상시복용여부: regularRecent || regularUndated,
      현재상태: '',
      비고: notes.join(' / '),
      원본: [...sourceLineNos].sort((a, b) => a - b).map(n => sourceLines[n - 1]).filter(s => s && s.trim()).map(s => s.trim()).join('\n'),
    });
  }
  return histories;
}

if (typeof module !== 'undefined') {
  module.exports.parseRecordLines = parseRecordLines;
  module.exports.collectRecords = collectRecords;
  module.exports.recordsToHistories = recordsToHistories;
  module.exports.resolveRecordDate = resolveRecordDate;
}

function daysBetween(dateStr, todayStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date(todayStr);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

// 날짜로부터 만으로 몇 년이 지났는지(달/일까지 고려한 만 나이 방식) 계산.
// 정보 부족(날짜 없음)이면 null — 간편보험 3·5년 고지 등에도 재사용 가능.
function yearsElapsed(dateStr, todayStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date(todayStr);
  let years = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) years--;
  return years < 0 ? null : years;
}

// 입원/수술/통원 여부로 치료유형 라벨을 만든다. 정보가 전혀 없으면 null(태그 생략).
function getTreatmentTypeLabel(h) {
  const hasAdmission = !!h.입원여부;
  const hasSurgery = !!h.수술여부;
  const hasOutpatient = h.통원횟수 !== null && h.통원횟수 !== undefined && h.통원횟수 > 0;

  if (hasAdmission && hasSurgery) return '입원 및 수술';
  if (hasAdmission) return '입원';
  if (hasSurgery && hasOutpatient) return '통원 및 수술';
  if (hasSurgery) return '수술';
  if (hasOutpatient) return '통원';
  return null;
}

// 코드가 틀리거나 비어 있어도(AI가 코드를 바꾸는 경우) 진단명 키워드로 한 번 더 잡는다 — 10대질병 누락이 과잉 포함보다 위험하다.
function matchesDisease11(code, name) {
  if (code && Object.values(DISEASE_11).some(prefixes => prefixes.some(p => code.startsWith(p)))) return true;
  const compactName = (name || '').replace(/\s/g, '');
  return DISEASE_11_KEYWORDS.some(k => compactName.includes(k));
}

function withinMonths(dateStr, todayStr, months) {
  const days = daysBetween(dateStr, todayStr);
  if (days === null) return null; // 정보 불충분
  return days <= months * 30.44 && days >= 0;
}

// minMonths 초과 ~ maxMonths 이내 (예: 5년 초과~10년 이내인 "6-10년" 구간)
function withinRangeMonths(dateStr, todayStr, minMonths, maxMonths) {
  const days = daysBetween(dateStr, todayStr);
  if (days === null) return null; // 정보 불충분
  return days > minMonths * 30.44 && days <= maxMonths * 30.44;
}

function isExceptionDisease(name) {
  if (!name) return false;
  return DISCLOSURE_EXCEPTIONS.some(keyword => name.includes(keyword));
}

// 간편보험 경증상병 예외인수 키워드 매칭 — Q1/Q4 전용 "경증프리패스" 힌트 태그에 사용
function isLightInsuranceException(name) {
  if (!name) return false;
  return LIGHT_INSURANCE_EXCEPTIONS.some(keyword => name.includes(keyword));
}

function classifyHistories(histories, todayStr) {
  const result = {};
  for (const q of Q_DEFS) {
    result[q.id] = { included: [], review: [] };
  }

  for (const h of histories) {
    // Q1: 최근 3개월 진찰/검사
    {
      const within = withinMonths(h.최근진료일, todayStr, 3);
      if (within === null) result.Q1.review.push(h);
      else if (within) result.Q1.included.push(h);
    }

    // Q2: 상시복용 - 날짜 계산보다 체크 여부 신뢰 (README 6장)
    if (h.상시복용여부) {
      result.Q2.included.push(h);
    }

    // Q3: 최근 1년 재검사 - 체크 여부로만 판단(원문 자동추출은 1차 범위 제외)
    if (h.재검사여부) {
      const within = withinMonths(h.최근진료일, todayStr, 12);
      if (within === null) result.Q3.review.push(h);
      else if (within) result.Q3.included.push(h);
    }

    // Q4: 5년 이내 입원/수술/계속 7일↑치료/계속 30일↑투약, 질병종류 무관
    {
      const within = withinMonths(h.최근진료일, todayStr, 60);
      const hasQ4Trigger =
        h.입원여부 ||
        h.수술여부 ||
        (h.계속치료일수 !== null && h.계속치료일수 >= 7) ||
        (h.계속투약일수 !== null && h.계속투약일수 >= 30) ||
        (h.입원일수 !== null && h.입원일수 >= 7) ||
        (h.통원횟수 !== null && h.통원횟수 >= 7); // 같은 질병 7회 이상 통원 (현장 알릴의무 관행 - "계속 치료" 대체 지표)
      if (hasQ4Trigger) {
        if (within === null) result.Q4.review.push(h);
        else if (within) result.Q4.included.push(h);
      }
    }

    // Q5: 11대 질병이면 계속성 조건 없이 5년 이내 단발 진료도 포함
    if (matchesDisease11(h.진단코드, h.진단명)) {
      const within = withinMonths(h.최근진료일, todayStr, 60);
      if (within === null) result.Q5.review.push(h);
      else if (within) result.Q5.included.push(h);
    }

    // Q6: 고지건강체 전용 - 5년 초과~10년 이내(6-10년) 입원/수술. 표준알릴의무 Q1~Q5와 별개 제도.
    if (h.입원여부 || h.수술여부) {
      const within = withinRangeMonths(h.최근진료일, todayStr, 60, 120);
      if (within === null) result.Q6.review.push(h);
      else if (within) result.Q6.included.push(h);
    }
  }

  // AI가 옮기지 못한 원문 줄로 만든 병력은 날짜로 문항에 걸리더라도 항상 확인필요로 둔다.
  for (const q of Q_DEFS) {
    const bucket = result[q.id];
    bucket.review.push(...bucket.included.filter(h => h.원문확인필요));
    bucket.included = bucket.included.filter(h => !h.원문확인필요);
  }

  return result;
}

if (typeof module !== 'undefined') {
  module.exports.classifyHistories = classifyHistories;
  module.exports.isExceptionDisease = isExceptionDisease;
  module.exports.yearsElapsed = yearsElapsed;
  module.exports.getTreatmentTypeLabel = getTreatmentTypeLabel;
  module.exports.isLightInsuranceException = isLightInsuranceException;
}

if (typeof document !== 'undefined') {
  // 새로고침하면 항상 빈 상태로 시작한다 — 고지 내용을 화면/저장소에 남기지 않는다.
  let histories = [];

  const HISTORY_FIELDS = [
    { key: '진단명', label: '진단명', type: 'text' },
    { key: '진단코드', label: '진단코드', type: 'text' },
    { key: '최초진단일', label: '최초진단일', type: 'date' },
    { key: '최근진료일', label: '최근진료일', type: 'date' },
    { key: '입원일수', label: '입원일수', type: 'number' },
    { key: '수술명', label: '수술명', type: 'text' },
    { key: '계속치료일수', label: '계속치료일수', type: 'number' },
    { key: '계속투약일수', label: '계속투약일수', type: 'number' },
    { key: '통원횟수', label: '통원횟수', type: 'number' },
    { key: '약물명', label: '약물명(상시복용)', type: 'text' },
    { key: '비고', label: '비고', type: 'text' },
  ];

  const CHECKBOX_FIELDS = [
    { key: '입원여부', label: '입원' },
    { key: '수술여부', label: '수술' },
    { key: '재검사여부', label: '재검사' },
    { key: '상시복용여부', label: '상시복용' },
  ];

  // 병력 세부는 기본으로 닫혀 있고, 연 상태는 다시 그려도(세부 수정 → renderAll) 유지한다.
  const openDetailKeys = new Set();

  function buildHistoryEditor(h) {
    const fragment = document.createDocumentFragment();

    const fields = document.createElement('div');
    fields.className = 'history-fields';
    HISTORY_FIELDS.forEach(f => {
      const label = document.createElement('label');
      label.textContent = f.label;
      const input = document.createElement('input');
      input.type = f.type;
      input.value = h[f.key] === null || h[f.key] === undefined ? '' : h[f.key];
      input.addEventListener('change', () => {
        h[f.key] = f.type === 'number'
          ? (input.value === '' ? null : Number(input.value))
          : (input.value === '' ? (f.type === 'date' ? null : '') : input.value);
        renderAll();
      });
      label.appendChild(input);
      fields.appendChild(label);
    });
    fragment.appendChild(fields);

    const toggleRow = document.createElement('div');
    toggleRow.className = 'history-toggle-row';
    CHECKBOX_FIELDS.forEach(({ key, label: labelText }) => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!h[key];
      label.classList.toggle('checked', cb.checked);
      cb.addEventListener('change', () => { h[key] = cb.checked; renderAll(); });
      label.appendChild(document.createTextNode(labelText));
      label.appendChild(cb);
      toggleRow.appendChild(label);
    });
    fragment.appendChild(toggleRow);
    return fragment;
  }

  // 청약서 알릴의무처럼 이 병력이 Q1~Q6 중 어디에 체크되는지 보여준다(전산 입력 참고용).
  function buildDisclosureChecks(h, result) {
    const row = document.createElement('div');
    row.className = 'disclosure-checks';
    Q_DEFS.forEach(q => {
      const included = result[q.id].included.includes(h);
      const review = result[q.id].review.includes(h);
      const chip = document.createElement('span');
      chip.className = `dc-chip${included ? ' on' : review ? ' review' : ''}`;
      chip.title = `${q.title} — ${q.trigger}`;
      const box = document.createElement('span');
      box.className = 'dc-box';
      box.textContent = included ? '✓' : review ? '?' : '';
      chip.append(box, q.id);
      row.appendChild(chip);
    });
    return row;
  }

  function buildHistoryDetail(h, result, key, toggleBtn) {
    const detail = document.createElement('div');
    detail.className = 'h-detail';
    const addSection = (labelText, content) => {
      const label = document.createElement('div');
      label.className = 'h-detail-label';
      label.textContent = labelText;
      detail.append(label, content);
    };
    const textBlock = (className, text) => {
      const el = document.createElement('div');
      el.className = className;
      el.textContent = text;
      return el;
    };

    addSection('고지 체크표시', buildDisclosureChecks(h, result));
    if (h.비고) addSection('정리 근거', textBlock('h-note', h.비고));
    if (h.원본) addSection('원문', textBlock('h-source', h.원본));
    addSection('세부 수정', buildHistoryEditor(h));

    const actions = document.createElement('div');
    actions.className = 'h-detail-actions';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-link-danger';
    delBtn.textContent = '이 병력 삭제';
    delBtn.addEventListener('click', () => { histories = histories.filter(x => x !== h); renderAll(); });
    actions.appendChild(delBtn);
    detail.appendChild(actions);

    const setOpen = open => {
      detail.classList.toggle('open', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
      if (open) openDetailKeys.add(key); else openDetailKeys.delete(key);
    };
    setOpen(openDetailKeys.has(key));
    toggleBtn.addEventListener('click', () => setOpen(!detail.classList.contains('open')));
    return detail;
  }

  function buildHistoryToggle(h) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'q-item-name h-toggle';
    btn.textContent = h.진단명 || '(이름없음)';
    return btn;
  }

  function appendHistoryTags(row, h) {
    // 입원/수술/통원 여부를 진단명 바로 옆에 태그로 표시
    const treatmentType = getTreatmentTypeLabel(h);
    if (treatmentType) {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'cat-badge cat-type';
      typeBadge.textContent = treatmentType;
      row.appendChild(typeBadge);
    }

    // 계속 투약 중인 건은 "몇 년 지났는지"가 의미가 없으므로 N년경과 대신 계속투약중 태그로 표시
    const isOngoingMedication = h.상시복용여부 || (h.계속투약일수 !== null && h.계속투약일수 > 0);
    const elapsed = yearsElapsed(h.최근진료일, TODAY_ISO);
    if (isOngoingMedication || elapsed !== null) {
      const badge = document.createElement('span');
      badge.className = 'cat-badge cat-elapsed';
      badge.textContent = isOngoingMedication ? '계속투약중' : `${elapsed}년경과`;
      row.appendChild(badge);
    }
  }

  // 어느 문항에도 들지 않은 병력도 지우지 않고 사이드에 모아 점검하게 한다.
  function renderUnclassified(result) {
    const list = document.getElementById('unclassified-list');
    if (!list) return;
    const classified = new Set(Q_DEFS.flatMap(q => [...result[q.id].included, ...result[q.id].review]));
    const rest = histories.filter(h => !classified.has(h));
    const count = document.getElementById('unclassified-count');
    if (count) count.textContent = rest.length;
    list.innerHTML = '';

    if (rest.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'side-empty';
      empty.textContent = '모든 병력이 문항에 분류됐어요';
      list.appendChild(empty);
      return;
    }

    rest.forEach(h => {
      const item = document.createElement('div');
      item.className = 'side-item';
      const row = document.createElement('div');
      row.className = 'q-item-row';
      const toggleBtn = buildHistoryToggle(h);
      row.appendChild(toggleBtn);
      appendHistoryTags(row, h);
      item.append(row, buildHistoryDetail(h, result, `side::${h.id}`, toggleBtn));
      list.appendChild(item);
    });
  }

  function updateResultsMode() {
    const content = document.getElementById('al-content');
    if (!content) return;
    content.classList.toggle('landing-mode', histories.length === 0);
  }

  // 세부 수정으로 병력이 다른 문항(또는 분류 안 됨)으로 옮겨가도, 보고 있던 펼침 상태를 새 자리에서 이어간다.
  function carryOverOpenDetails(result) {
    for (const key of [...openDetailKeys]) {
      const [location, id] = key.split('::');
      const h = histories.find(x => String(x.id) === id);
      if (!h) {
        openDetailKeys.delete(key);
        continue;
      }
      const locations = Q_DEFS.filter(q => result[q.id].included.includes(h) || result[q.id].review.includes(h)).map(q => q.id);
      if (!locations.length) locations.push('side');
      if (!locations.includes(location)) {
        openDetailKeys.delete(key);
        openDetailKeys.add(`${locations[0]}::${id}`);
      }
    }
  }

  function renderAll() {
    updateResultsMode();
    const result = classifyHistories(histories, TODAY_ISO);
    carryOverOpenDetails(result);
    renderClassifyResult(result);
    renderUnclassified(result);
  }

  // 3개월/1년/5년 경계 판단은 날짜 하루 차이도 결과가 바뀌므로 UTC가 아닌 사용자 현지 날짜를 쓴다.
  const TODAY_ISO = (() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();
  // `${qId}::${historyId}` 형태로 "명시적으로 체크 해제한" 항목만 저장한다.
  // 기본값은 체크됨(분류된 항목은 기본적으로 고지 대상으로 간주) — 사용자가
  // 직접 체크를 해제한 것만 이 Set에 들어가므로, 다른 필드를 수정해 화면이
  // 다시 그려져도 사용자가 해제한 상태가 의도치 않게 되돌아가지 않는다.
  const uncheckedKeys = new Set();

  function renderClassifyResult(result) {
    const container = document.getElementById('classify-result');
    if (!container) return;
    container.innerHTML = '';

    Q_DEFS.forEach(q => {
      const block = document.createElement('div');
      block.className = 'q-block';

      const title = document.createElement('div');
      title.className = 'q-title';
      title.textContent = q.title;
      block.appendChild(title);

      const oneliner = document.createElement('div');
      oneliner.className = 'q-oneliner';
      oneliner.textContent = q.trigger;
      block.appendChild(oneliner);

      const included = result[q.id].included;
      const review = result[q.id].review;

      if (included.length === 0 && review.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'q-empty';
        empty.textContent = '해당 항목 없음';
        block.appendChild(empty);
      }

      [...included.map(h => ({ h, cat: 's' })), ...review.map(h => ({ h, cat: 'r' }))].forEach(({ h, cat: baseCat }) => {
        // Q6는 예외질환 키워드 매칭 시 분류완료/확인필요와 무관하게 "예외질환" 배지를 우선 노출
        // (부가조건은 사람이 직접 확인해야 하므로 자동으로 빼지 않음)
        const cat = q.id === 'Q6' && isExceptionDisease(h.진단명) ? 'e' : baseCat;

        const wrap = document.createElement('div');
        wrap.className = 'q-item-wrap';

        const row = document.createElement('div');
        row.className = 'q-item-row';

        const checkLabel = document.createElement('label');
        checkLabel.className = 'q-item-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const key = `${q.id}::${h.id}`;
        cb.checked = !uncheckedKeys.has(key);
        cb.addEventListener('change', () => {
          if (cb.checked) uncheckedKeys.delete(key); else uncheckedKeys.add(key);
        });
        checkLabel.appendChild(cb);
        const badge = document.createElement('span');
        badge.className = `cat-badge cat-${cat}`;
        badge.textContent = cat === 'e' ? '예외질환(확인필요)' : (cat === 'r' ? '확인필요' : '분류완료');
        checkLabel.appendChild(badge);

        // Q1·Q4에서 간편보험 경증상병 예외인수 키워드와 매칭되면 빨간 "경증프리패스" 힌트 태그 추가
        if ((q.id === 'Q1' || q.id === 'Q4') && isLightInsuranceException(h.진단명)) {
          const lightBadge = document.createElement('span');
          lightBadge.className = 'cat-badge cat-light';
          lightBadge.textContent = '경증프리패스';
          checkLabel.appendChild(lightBadge);
        }

        row.appendChild(checkLabel);

        const toggleBtn = buildHistoryToggle(h);
        row.appendChild(toggleBtn);
        appendHistoryTags(row, h);

        wrap.append(row, buildHistoryDetail(h, result, key, toggleBtn));
        block.appendChild(wrap);
      });

      container.appendChild(block);
    });
  }

  // 체크된 항목만 모아 Q1~Q6 문항별로 읽기 좋은 텍스트 보고서를 만든다.
  function buildCopyText(result) {
    const lines = ['[표준알릴의무 자동분류 결과 - 초안, 최종 기재 전 직접 확인 필수]', ''];
    Q_DEFS.forEach(q => {
      lines.push(q.title);
      const checkedItems = [...result[q.id].included, ...result[q.id].review]
        .filter(h => !uncheckedKeys.has(`${q.id}::${h.id}`));

      if (checkedItems.length === 0) {
        lines.push('- 해당사항 없음');
      } else {
        checkedItems.forEach(h => {
          const detailParts = [];
          if (h.입원일수 !== null) detailParts.push(`입원 ${h.입원일수}일`);
          if (h.수술명) detailParts.push(`수술: ${h.수술명}`);
          if (h.통원횟수 !== null) detailParts.push(`통원 ${h.통원횟수}회`);
          if (h.계속투약일수 !== null) detailParts.push(`투약 ${h.계속투약일수}일`);
          if (h.약물명) detailParts.push(`약물: ${h.약물명}`);
          if (q.id === 'Q6' && isExceptionDisease(h.진단명)) detailParts.push('예외질환(확인필요)');
          const detail = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
          lines.push(`- ${h.진단명 || '(이름없음)'}${detail}`);
        });
      }
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  // navigator.clipboard가 막혀있거나(포커스/권한 등) 실패하는 환경을 위한 폴백.
  function copyTextFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const result = classifyHistories(histories, TODAY_ISO);
      const text = buildCopyText(result);

      const handleFailure = () => {
        if (copyTextFallback(text)) {
          showToast('결과가 복사되었습니다');
        } else {
          showToast('복사에 실패했습니다. 직접 선택해 복사해주세요');
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => showToast('결과가 복사되었습니다'))
          .catch(handleFailure);
      } else {
        handleFailure();
      }
    });
  }

  const addRowBtn = document.getElementById('add-row-btn');
  if (addRowBtn) {
    addRowBtn.addEventListener('click', () => {
      const row = emptyHistoryRow();
      histories.push(row);
      // 날짜 없는 새 병력은 Q1 확인필요에 들어가므로, 바로 입력할 수 있게 그 자리를 펼쳐 둔다.
      openDetailKeys.add(`Q1::${row.id}`);
      renderAll();
    });
  }

  const parseBtn = document.getElementById('parse-btn');
  const historyInput = document.getElementById('history-input');
  if (!parseBtn || !historyInput) {
    console.error('필수 DOM 요소를 찾을 수 없습니다: parse-btn 또는 history-input');
  } else {
    // 채팅 입력창처럼 내용에 맞춰 높이가 자동으로 늘어나게 한다.
    function autoResize() {
      historyInput.style.height = 'auto';
      historyInput.style.height = `${Math.min(historyInput.scrollHeight, 160)}px`;
      parseBtn.disabled = !historyInput.value.trim();
    }
    autoResize();
    historyInput.addEventListener('input', autoResize);

    // Enter로 전송, Shift+Enter는 줄바꿈 (채팅 입력창과 동일한 동작)
    historyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        parseBtn.click();
      }
    });

    function setLoading(isLoading) {
      parseBtn.classList.toggle('is-loading', isLoading);
      parseBtn.disabled = isLoading;
      historyInput.disabled = isLoading;
    }

    parseBtn.addEventListener('click', async () => {
      const text = historyInput.value;
      if (!text.trim()) return;

      setLoading(true);

      const finishWithHistories = (newHistories) => {
        histories = newHistories;
        uncheckedKeys.clear();
        renderAll();
        historyInput.value = '';
        autoResize();
        setLoading(false);
        const resultsArea = document.getElementById('results-area');
        if (resultsArea) {
          setTimeout(() => resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        }
      };

      // 잘못 분류된 사례를 되짚으려고 원문·정리결과를 남긴다(익명 기록, log.js가 실패해도 화면은 그대로 진행).
      const startedAt = Date.now();
      const logRun = payload => {
        if (typeof logDisclosureRun === 'function') {
          logDisclosureRun({ rawText: text, todayStr: TODAY_ISO, latencyMs: Date.now() - startedAt, ...payload });
        }
      };

      const parsed = parseHistoryText(text);

      if (parsed.length > 0) {
        // 짧은 지연을 두어 "정리 중" 상태가 느껴지게 한 뒤 결과로 전환한다.
        // 새로 변환한 결과로 교체한다 — 이전에 표로 변환했던 병력은 비운다.
        // (병력을 계속 추가하고 싶으면 "+ 병력 추가" 버튼을 쓴다.)
        logRun({ source: 'manual', histories: parsed });
        setTimeout(() => finishWithHistories(parsed), 350);
        return;
      }

      // 우리 포맷(🔴...)으로 바로 안 읽히면, 텍스트가 비어있지 않은 경우에만
      // AI(OpenRouter)에게 우리 포맷으로 변환을 맡긴다 (config.js에 키가 있을 때만).
      const hasApiKey = typeof OPENROUTER_API_KEY !== 'undefined' && OPENROUTER_API_KEY;
      if (hasApiKey && typeof extractRecordsWithAI === 'function') {
        try {
          // AI는 원문 기록만 옮겨 적고, 병력 묶기·합산·분류는 규칙(recordsToHistories/classifyHistories)이 한다.
          let requests = 0;
          const extract = onlyLines => extractRecordsWithAI(text, OPENROUTER_API_KEY, { today: TODAY_ISO, onlyLines })
            .then(out => { requests += out.chunks.length; return out; });
          const { histories: aiHistories, records, retriedLines, missingLines } = await buildHistoriesWithAI(extract, TODAY_ISO);
          logRun({ source: 'ai', histories: aiHistories, records, requests, retriedLines, missingLines, model: OPENROUTER_MODEL });
          if (aiHistories.length > 0) {
            finishWithHistories(aiHistories);
            showToast('병력을 정리했어요. 병력명을 눌러 원문과 꼭 대조해주세요');
          } else {
            // 입력을 지우지 않고 남겨 다시 시도하거나 고칠 수 있게 한다.
            setLoading(false);
            showToast('원문에서 병력 기록을 찾지 못했어요. 내용을 확인해 다시 시도해주세요');
          }
        } catch (e) {
          console.error('AI 추출 실패:', e);
          logRun({ source: 'ai', histories: [], error: String(e && e.message ? e.message : e) });
          setLoading(false);
          showToast('AI 호출에 실패했어요. 입력은 그대로 두었으니 다시 시도해주세요');
        }
        return;
      }

      showToast('인식된 병력이 없습니다. 빈 행을 추가했습니다');
      finishWithHistories([...histories, emptyHistoryRow()]);
    });
  }

  function emptyHistoryRow() {
    return {
      id: nextHistoryId++,
      진단명: '', 진단코드: '', 최초진단일: null, 최근진료일: null,
      입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
      계속치료일수: null, 계속투약일수: null, 통원횟수: null, 약물명: null, 재검사여부: false, 상시복용여부: false,
      현재상태: '', 비고: '', 원본: '',
    };
  }

  function showToast(message) {
    let toast = document.getElementById('al-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'al-toast';
      toast.className = 'toast';
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  renderAll();

  const resetAllBtn = document.getElementById('reset-all-btn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      if (!confirm('입력한 모든 병력과 분류결과를 초기화합니다. 계속할까요?')) return;
      histories = [];
      uncheckedKeys.clear();
      renderAll();
      if (historyInput) {
        historyInput.value = '';
        historyInput.style.height = 'auto';
      }
      showToast('전체 초기화되었습니다');
    });
  }
}
