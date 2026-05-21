// ── mirae_analyzer.js ──
// 미래에셋생명 가입제안서 PDF 텍스트에서 담보 목록을 추출
// pdfjs 추출 형식: 각 담보행이 "[담보명 피보험자 가입금액 나이]" 행과 "전기납 월납 보험료" 행으로 분리됨

function extractRawCoveragesMirae(text) {
    const items = [];

    // 1. 담보 테이블 섹션 추출
    const startIdx = text.search(/■\s*보험계약의\s*개요/);
    if (startIdx === -1) {
        console.warn('[mirae] 보험계약의 개요 섹션을 찾을 수 없습니다.');
        return items;
    }
    const sub = text.slice(startIdx);

    // 끝 감지: "합계 숫자" 또는 줄 시작의 "합계" (pdfjs는 숫자가 다음 줄에 올 수 있음)
    let endIdx = sub.search(/합계\s+[\d,]+/);
    if (endIdx === -1) endIdx = sub.search(/\n합계/);
    const tableText = endIdx !== -1 ? sub.slice(0, endIdx) : sub;

    const lines = tableText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // ── pdfjs 행 구조 ──
    // 담보행A: "[담보명(suffix)] 피보험자 가입금액(만원) 나이" ← PERSON_AMT_RE 매칭
    // 노이즈행: "최초계약 20년", "갱신계약 5년 갱신", "(최대 100세 만기)"
    // 담보행B: "전기납 월납 보험료" ← 이 행을 경계로 다음 담보 시작

    // 피보험자+금액+나이 패턴 (담보 데이터 행 식별자)
    // (\s+|$) : 나이 뒤에 공백이 없고 줄 끝인 경우도 매칭
    const PERSON_AMT_RE = /([가-힣]{2,4})\s+([\d,]+)\s+(\d{2})(?:\s+|$)/;

    // 노이즈 행 패턴 (nameBuffer에 추가하지 않음)
    const NOISE_LINE_RE = /^(?:최초계약|갱신계약|보험종류|피보험자|보험가입금액|가입나이?|보험기간|납입기간|납입주기|보험료|FC:|Page|할인|실납입|■|●|〔|\[|특약가입개요|\(최대\s*\d+|합계|공시이율|나이\s*보험|주피보험|상령일|보험상품명|보험회사|발행일|본 자료|내용을|소속|\(만원\)|미래에셋|1588|어센틱|준법감시|심의필|가입$)/;

    // suffix 제거 (pdfjs는 괄호 안에 공백 추가: "(4), 갱신형)" 형태)
    function cleanSuffix(raw) {
        return raw
            .replace(/\(간편고지형\(\d+\),\s*갱신형\)\s*최초계약/g, '')
            .replace(/\(간편고지형\(\d+\),\s*갱신형\)/g, '')
            .replace(/\(355간편고지고당,\s*갱신형\)\s*최초계약/g, '')
            .replace(/\(355간편고지고당,\s*갱신형\)/g, '')
            .replace(/\(갱신형\)\s*최초계약/g, '')
            .replace(/\(갱신형\)/g, '')
            .replace(/갱신형\)\s*최초계약/g, '')   // 줄 분리로 앞괄호 없는 케이스
            .replace(/신형\)\s*최초계약/g, '')       // "갱신형)" 이 분리된 케이스
            .replace(/신형\)/g, '')
            .replace(/최초계약\s*\d*\s*년?/g, '')
            .replace(/\(맞춤간편고지\)/g, '')
            .replace(/[,\s]+$/, '')                  // 끝 쉼표/공백 제거
            .replace(/^[,\s]+/, '')                  // 앞 쉼표/공백 제거
            .trim();
    }

    // 디버그: 전체 라인과 매칭 여부 출력
    console.log('[mirae-debug] 섹션 내 라인 수:', lines.length);
    lines.slice(0, 60).forEach((l, idx) => {
        const m = l.match(PERSON_AMT_RE);
        console.log(`[mirae-debug] L${idx}: [${m ? 'MATCH' : '    '}] ${l}`);
    });

    let nameBuffer = ''; // 담보명 조각 누적

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const paMatch = line.match(PERSON_AMT_RE);

        if (paMatch) {
            // ── 담보 데이터 행: "[담보명 조각] 피보험자 금액 나이" ──
            const amountMan = parseInt(paMatch[2].replace(/,/g, ''), 10);

            // 현재 행에서 피보험자 앞부분 = 담보명 꼬리 (또는 전체)
            const personIdx = line.indexOf(paMatch[0]);
            const nameOnLine = personIdx > 0 ? line.slice(0, personIdx) : '';

            // 전체 담보명 조합
            const rawName = (nameBuffer + nameOnLine).trim();
            const cleanName = cleanSuffix(rawName);

            if (cleanName && amountMan > 0) {
                items.push({ name: cleanName, amount: `${amountMan}만원` });
            }

            nameBuffer = ''; // 리셋

        } else if (/월납/.test(line)) {
            // 보험료 납입 행 → 다음 담보 시작을 위해 버퍼 리셋
            nameBuffer = '';

        } else if (NOISE_LINE_RE.test(line)) {
            // 노이즈 행 → 버퍼 유지 (갱신하지 않음)

        } else {
            // 담보명 조각 행 → 누적
            nameBuffer += line;
        }
    }

    console.log(`[mirae] ${items.length}건 추출`);
    console.log('[mirae] 추출 목록:', items.map((it, i) => `[${i+1}] ${it.name} / ${it.amount}`).join('\n'));
    return items;
}
