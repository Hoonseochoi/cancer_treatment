// ── DB Insurance (DB손해보험) Raw Coverage Extractor ──

function extractRawCoveragesDB(text) {
    if (!text || typeof text !== 'string') {
        console.warn('[DB] extractRawCoveragesDB: invalid input');
        return [];
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];

    // ── 1. Find section boundaries ──
    // Start: 가입담보요약 page
    // End:   보장보험료 합계
    let startIdx = -1;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
        const norm = lines[i].replace(/\s+/g, '');
        if (startIdx === -1 && norm === '가입담보요약') {
            startIdx = i;
        }
        if (startIdx !== -1 && norm.includes('보장보험료합계')) {
            endIdx = i;
            // break 제거: 다중 페이지 표에서 페이지마다 소계가 있으므로 마지막 합계 위치를 사용
        }
    }

    // Fallback: look for first numbered coverage item
    if (startIdx === -1) {
        for (let i = 0; i < lines.length; i++) {
            if (/^\d{1,3}\.\s/.test(lines[i])) {
                startIdx = Math.max(0, i - 2);
                break;
            }
        }
    }
    if (startIdx === -1) {
        console.warn('[DB] 가입담보요약 섹션 미발견');
        return [];
    }

    const sectionLines = lines.slice(startIdx, endIdx);
    console.log(`[DB] 섹션 범위: lines ${startIdx}~${endIdx} (${sectionLines.length}줄)`);

    // ── 2. Skip patterns (page headers/footers interspersed across pages) ──
    const SKIP = [
        /^No\.$/, /^가입담보$/, /^가입금액$/, /^보험료\s*\(원\)/,
        /^납기\/만기/, /^가입담보요약$/, /^고객보관용$/,
        /^LAAA/, /^\d+\s*\/\s*\d+$/, /^설계번호/,
        /^계약사항/, /^담당자$/, /^홈페이지$/, /^www\./,
        /^준법감시인/, /^그 이외의/, /^보장내용 및/, /^※/,
        /^\d{4}\.\d{2}\.\d{2}/, /^\d{2}:\d{2}:\d{2}$/,
        /님\s*보장내용$/, /^\d{3}-\d{3,4}-\d{4}$/
    ];

    function shouldSkip(line) {
        return SKIP.some(p => p.test(line));
    }

    // Premium line: just digits with commas (e.g. "45,800")
    function isPremium(line) {
        return /^\d{1,3}(,\d{3})*$/.test(line);
    }

    // Period line: 줄이 \d+년으로 시작해야만 매칭 (e.g. "20년/100세")
    // 주의: 커버리지 줄 끝에 "20년/100세"가 포함되어도 줄 시작이 아니면 무시
    function isPeriod(line) {
        return /^\d+년/.test(line);
    }

    // Korean amount pattern: e.g. 2천만원, 6백만원, 30만원, 5억원
    const AMT_PAT = /(\d+[천백]?만원|\d+억원)/;

    // ── 3. Unified state machine (handles both pdfjs single-line and pdftotext multi-line) ──
    // Strategy: accumulate rawText for each numbered item until it contains an amount,
    // then split name / amount from rawText directly.
    let i = 0;
    while (i < sectionLines.length) {
        const line = sectionLines[i];

        if (shouldSkip(line)) { i++; continue; }

        // Coverage item starts with: "20. (맞춤_간편고지Ⅱ)..." OR just "20." (번호만 있는 줄)
        const itemMatch = line.match(/^(\d{1,3})\.\s+(.+)/) ||
                          (line.match(/^(\d{1,3})\.\s*$/) ? ['', '', ''] : null);
        if (!itemMatch) { i++; continue; }

        // rawText accumulates name + possibly embedded amount (pdfjs single-line or merged)
        let rawText = itemMatch[2].trim();
        i++;

        // Append continuation lines until rawText contains a Korean amount
        // Stop also at next numbered item, premium-only line, or period line
        while (i < sectionLines.length && !AMT_PAT.test(rawText)) {
            const next = sectionLines[i];
            if (shouldSkip(next)) { i++; continue; }
            if (/^\d{1,3}\.\s/.test(next) || isPremium(next) || isPeriod(next)) break;
            rawText += next;
            i++;
        }

        // Extract amount from rawText
        const amountMatch = rawText.match(AMT_PAT);
        if (!amountMatch) continue;

        const amount = amountMatch[1];
        const amountIdx = rawText.indexOf(amountMatch[0]);
        const name = rawText.substring(0, amountIdx).replace(/\s+$/, '').trim();

        if (!name) continue;

        results.push({ name, amount });
        console.log(`[DB] 추출: ${name} | ${amount}`);

        // Skip following premium / period lines (pdftotext format has them as separate lines)
        let skipped = 0;
        while (i < sectionLines.length && skipped < 2) {
            const next = sectionLines[i];
            if (shouldSkip(next)) { i++; continue; }
            if (isPremium(next) || isPeriod(next)) { i++; skipped++; }
            else break;
        }
    }

    console.log(`[DB] 총 ${results.length}건 추출`);
    return results;
}
