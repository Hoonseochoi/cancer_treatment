// 정리 결과를 돕는 AI 프롬프트 — 분류는 규칙이 하고, AI는 질문 만들기·점검·연결 제안만 한다.
// 서버(Edge Function disclosure-assist)와 로컬 주간 점검 스크립트가 같은 파일을 쓴다.

// AI 답에서 JSON 배열만 꺼낸다(코드블록·앞뒤 설명이 붙어도)
export function parseJsonArray(text) {
  const s = String(text || '');
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const v = JSON.parse(s.slice(start, end + 1));
    return Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// ① 확인필요 항목 → 고객에게 물어볼 질문
// items: [{ id, name, reason, question, source }]
export function buildQuestionsPrompt(items, todayStr) {
  const list = items.map(it => [
    `- id: ${it.id}`,
    `  병명: ${clip(it.name, 60)}`,
    `  확인할 점: ${clip(it.reason, 160)}`,
    it.question ? `  관련 알릴의무 질문: ${clip(it.question, 120)}` : '',
    it.source ? `  원문: ${clip(it.source, 160)}` : '',
  ].filter(Boolean).join('\n')).join('\n');
  return `너는 보험 설계사의 비서다. 아래 "확인 필요" 병력마다, 설계사가 고객에게 카카오톡으로 그대로 보낼 질문을 하나씩 만든다. 오늘: ${todayStr}

규칙
- 고지 판단에 필요한 사실만 묻는다: 정확한 진단·치료 날짜(연·월), 입원했는지와 며칠인지, 수술했는지와 수술명, 약을 얼마나 오래 먹었는지, 지금도 치료 중인지.
- "확인할 점"에 적힌 것을 묻는다. 이미 원문에 있는 사실은 다시 묻지 않는다.
- 존댓말 한 문장, 50자 안팎. 고객이 "예/아니오"나 날짜로 바로 답할 수 있게 묻는다.
- 의학적 설명·조언·가입 가능 여부 판단은 하지 않는다. 보험 용어(Q4, 고지 등)는 쓰지 않는다.
- 물어볼 게 없으면 그 id는 빼도 된다.

출력: JSON 배열만(설명·코드블록 없이)
[{"id":"...","question":"..."}]

병력
${list}`;
}

// ② 정리 결과 점검 — 원문과 대조해 빠진 것·다른 것·병력이 아닌 것만 짚는다(분류 판단은 하지 않는다)
// 한 병력은 같은 병의 여러 원문 줄(진료·처방·입원·수술)을 합친 것이라, 병력마다 합친 줄 번호(lines)를 같이 보낸다.
// histories: [{ name, code, lines, first, last, admission, surgery, visits, meds, medDays }]
// 어느 병력에도 안 들어간(빈 줄이 아닌) 원문 줄 번호를 같이 알려 줘 "빠진 것"은 그 줄에서만 찾게 한다.
// 병력에 든 줄 근처의 딸린 줄("ㄴ 수술", "• 통원 : 3일", 날짜 줄 바로 아래 진단명 등)도 그 병력에 든 것으로 본다.
const SUB_LINE_RE = /^\s*([•·\-ㄴ└→*※>(]|[가-힣A-Za-z ]{1,10}\s*[:：])/;
export function uncoveredLineNumbers(lines, histories) {
  const covered = new Set(histories.flatMap(h => h.lines || []));
  const blank = i => !String(lines[i - 1] ?? '').trim();
  const isCovered = n => {
    if (covered.has(n)) return true;
    // 같은 덩어리(빈 줄로 나뉜) 안에서 위아래 2줄 안에 병력 줄이 있으면 딸린 줄로 본다
    for (let d = 1; d <= 2; d++) {
      for (const m of [n - d, n + d]) {
        if (m < 1 || m > lines.length) continue;
        const between = m < n ? [m + 1, n] : [n + 1, m];
        let gap = false;
        for (let k = between[0]; k < between[1]; k++) if (blank(k)) gap = true;
        if (!gap && !blank(m) && covered.has(m)) return true;
      }
    }
    // 머리 줄이 병력에 든 딸린 줄(• · ㄴ 항목: 값)
    if (SUB_LINE_RE.test(lines[n - 1])) {
      for (let m = n - 1; m >= 1 && !blank(m); m--) {
        if (!SUB_LINE_RE.test(lines[m - 1])) return covered.has(m) || (m > 1 && covered.has(m - 1));
      }
    }
    return false;
  };
  return lines.map((_, i) => i + 1).filter(n => !blank(n) && !isCovered(n));
}

export function buildReviewPrompt(numberedText, histories, todayStr) {
  const textLines = numberedText.split('\n').map(l => l.replace(/^\d+: /, ''));
  const uncovered = uncoveredLineNumbers(textLines, histories);
  const list = histories.map((h, i) => [
    `${i + 1}. ${clip(h.name, 60)}${h.code ? ` (${h.code})` : ''}`,
    h.lines && h.lines.length ? `원문 ${h.lines.join(',')}줄` : '',
    h.first || h.last ? `기간 ${h.first || '?'}~${h.last || '?'}` : '날짜 없음',
    h.admission ? `입원 ${h.admission}` : '입원 없음',
    h.surgery ? `수술 ${clip(h.surgery, 40)}` : '수술 없음',
    h.visits ? `통원 ${h.visits}회` : '',
    h.meds ? `투약 ${clip(h.meds, 50)}${h.medDays ? ` ${h.medDays}일` : ''}` : '',
  ].filter(Boolean).join(' | ')).join('\n');
  return `너는 보험 병력 정리 결과를 검수한다. 원문과 정리 결과를 비교해 사실이 어긋난 곳만 짚는다. 오늘: ${todayStr}

정리 방식(이건 지적하지 않는다)
- 한 병력은 같은 병의 여러 원문 줄(진료·처방·입원·수술·"ㄴ" 줄)을 하나로 합친 것이다. "원문 N줄"에 든 줄은 빠진 게 아니다.
- 기간은 그 병의 가장 이른 날짜~가장 늦은 날짜다. 하루짜리면 시작=끝이다. 입원 N일이어도 원문에 입원 시작일만 있으면 기간은 하루로 보인다(입원일수가 맞으면 지적하지 않는다). 통원·처방 세부 날짜, 주사·검사 같은 처치 이름, 코드 표기 차이는 옮기지 않아도 된다.

짚을 것(이 세 가지만)
- missing: "어느 병력에도 안 들어간 줄" 가운데 실제 병·진료·입원·수술·투약 기록인 줄(그 내용이 다른 병력에 이미 들어 있으면 빼고)
- mismatch: 정리 결과의 입원 여부·입원일수·수술 여부가 원문과 분명히 다른 것, 또는 기간이 원문 날짜 범위를 벗어난 것
- not_history: 정리 결과의 병력 이름 자체가 병이 아닌 문장(설계 요청, 알릴의무 질문, "입원 없음" 같은 안내·부인 문구)인 것. 그 병력의 원문 줄 번호를 line에 쓴다.
  원문에 그런 줄이 있어도 정리 결과에 병력으로 안 들어갔으면 짚지 않는다.
짚지 말 것: 어느 알릴의무 문항에 해당하는지·고지해야 하는지 같은 판단, 표현·순서 차이, 위 "정리 방식"대로 된 것.
알릴의무 질문 문장·제목·인사·"입원 없음" 같은 안내 줄은 병력이 아니므로 빠져 있는 게 맞다(missing 아님).
확실한 것만, 많아야 8개. 없으면 [].

출력: JSON 배열만(설명·코드블록 없이)
[{"kind":"missing|mismatch|not_history","line":원문 줄번호 또는 null,"text":"40자 안팎 설명"}]

원문
${numberedText}

정리 결과
${list || '(없음)'}

어느 병력에도 안 들어간 줄: ${uncovered.length ? uncovered.join(', ') : '없음'}`;
}

// AI 점검 메모 걸러내기: "병력 아님"은 실제로 병력에 들어간 줄만, 같은 줄·같은 지적 중복은 하나만
export function filterReviewNotes(notes, histories, lineCount) {
  const inHistory = new Set(histories.flatMap(h => h.lines || []));
  const seen = new Set();
  return notes
    .filter(n => ['missing', 'mismatch', 'not_history'].includes(String(n.kind)) && typeof n.text === 'string' && n.text.trim())
    .map(n => ({
      kind: String(n.kind),
      line: Number.isInteger(n.line) && n.line >= 1 && n.line <= lineCount ? n.line : null,
      text: clip(n.text, 160),
    }))
    .filter(n => n.kind !== 'not_history' || (n.line && inHistory.has(n.line)))
    .filter(n => {
      const key = `${n.kind}:${n.line ?? n.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

// ③ 병명 → U/W가이드 항목, 약 이름 → 약 종류
// items: [{ id, name, code, surgery, drug }], groups: [{ key, name }]
export const DRUG_CLASSES = ['혈압강하제', '신경안정제', '수면제', '각성제', '진통제', '그외'];
export function buildMatchPrompt(items, groups) {
  const list = items.map(it => [
    `- id: ${it.id}`,
    `  병명: ${clip(it.name, 60)}${it.code ? ` (${it.code})` : ''}`,
    it.surgery ? `  수술: ${clip(it.surgery, 50)}` : '',
    it.drug ? `  약: ${clip(it.drug, 50)}` : '',
  ].filter(Boolean).join('\n')).join('\n');
  const groupList = groups.map(g => `${g.key}: ${g.name}`).join('\n');
  return `아래 병력마다 두 가지를 고른다.
1) guide: "항목 목록"에서 같은 병(같은 부위·같은 질환)에 해당하는 항목의 key 하나. 비슷해 보여도 다른 병이면 null. 확실하지 않으면 null.
2) drug: "약"이 있으면 그 약의 종류를 ${DRUG_CLASSES.join(', ')} 중 하나로. 약이 없으면 null.

출력: JSON 배열만(설명·코드블록 없이)
[{"id":"...","guide":"key 또는 null","drug":"종류 또는 null"}]

항목 목록
${groupList}

병력
${list}`;
}
