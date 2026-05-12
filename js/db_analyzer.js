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
        if (startIdx !== -1 && (norm.includes('보장보험료합계'))) {
            endIdx = i;
            break;
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

    // Amount line: contains 만원 or 억원 (Korean amount notation)
    function isAmount(line) {
        return /만원|억원/.test(line);
    }

    // Premium line: just digits with commas (e.g. "45,800")
    function isPremium(line) {
        return /^\d{1,3}(,\d{3})*$/.test(line);
    }

    // Period line: contains 년 with /
    function isPeriod(line) {
        return /\d+년.*\//.test(line);
    }

    // ── 3. State machine: parse 4-line blocks ──
    let i = 0;
    while (i < sectionLines.length) {
        const line = sectionLines[i];

        if (shouldSkip(line)) { i++; continue; }

        // Coverage item starts with: "16. 암진단비Ⅱ..."
        const itemMatch = line.match(/^(\d{1,3})\.\s+(.+)/);
        if (!itemMatch) { i++; continue; }

        let name = itemMatch[2].trim();
        i++;

        // Collect continuation lines (OCR may wrap long names)
        while (i < sectionLines.length) {
            const next = sectionLines[i];
            if (shouldSkip(next)) { i++; continue; }
            // Stop if this is a structured line
            if (isAmount(next) || /^\d{1,3}\.\s/.test(next) || isPremium(next) || isPeriod(next)) break;
            // It's a continuation fragment — append directly (no space, mid-word wrap)
            name += next;
            i++;
        }

        // Find amount line (skip any boilerplate in between)
        let amount = '';
        while (i < sectionLines.length && !amount) {
            const next = sectionLines[i];
            if (shouldSkip(next)) { i++; continue; }
            if (isAmount(next)) { amount = next; i++; break; }
            // Unexpected line — skip it
            if (!isPremium(next) && !isPeriod(next) && !/^\d{1,3}\.\s/.test(next)) { i++; continue; }
            break;
        }

        if (!amount) continue;

        results.push({ name: name.trim(), amount: amount.trim() });
        console.log(`[DB] 추출: ${name.trim()} | ${amount.trim()}`);

        // Skip premium + period (2 lines)
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
