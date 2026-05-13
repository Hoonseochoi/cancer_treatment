// ── Heungkuk Fire Insurance (흥국화재) Raw Coverage Extractor ──

function extractRawCoveragesHeungkuk(text) {
    if (!text || typeof text !== 'string') {
        console.warn('[흥국] extractRawCoveragesHeungkuk: invalid input');
        return [];
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];

    // ── 1. Find section boundaries ──
    // Start: "■ 가입담보 리스트"
    // End:   "보 장 보 험 료  합 계" (공백 포함) or "보장보험료합계"
    let startIdx = -1;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
        const norm = lines[i].replace(/\s+/g, '');
        if (startIdx === -1 && norm.includes('가입담보리스트')) {
            startIdx = i + 1; // skip the header line itself
        }
        if (startIdx !== -1 && (norm === '보장보험료합계' || norm.includes('보장보험료합계'))) {
            endIdx = i;
            // 마지막 합계 위치 사용 (다중 페이지 대비 break 제거)
        }
    }

    if (startIdx === -1) {
        console.warn('[흥국] ■ 가입담보 리스트 섹션 미발견');
        return [];
    }

    const sectionLines = lines.slice(startIdx, endIdx);
    console.log(`[흥국] 섹션 범위: lines ${startIdx}~${endIdx} (${sectionLines.length}줄)`);

    // ── 2. Skip patterns (page headers/footers) ──
    const SKIP_PATTERNS = [
        /^구분$/,
        /^담\s*보\s*명$/,
        /^납입\s*및\s*만기$/,
        /^가입금액$/,
        /^보험료\s*\(원\)$/,
        /^고객용$/,
        /^===\s*PAGE/,
        /^계약사항\s*및\s*보장사항$/,
        /^■\s*가입담보\s*리스트$/,
        /^※\s*상령일/,
        /^\d+\s*\/\s*\d+$/,            // 페이지 번호 "7 / 26"
        /^\(\s*\d+\s*\/\s*\d+\s*\)$/,  // "(7 / 26)"
        /^\[준법감시인/,
        /^\(설계번호\)/,
        /^\(발행일시\)/,
        /^무배당\s*흥Good/,
        /^피보험자\s*\(\d+\/\d+\)/,     // "피보험자(1/1)"
        /^[가-힣]{2,5}\(계약자와의\s*관계:/,  // "홍길동(계약자와의 관계:본인,...)"
        /^■\s*계약사항$/,
        /^흥국화재해상보험/,
        /^\d{4}-\d{2}-\d{2}/,          // 날짜
        /^\d{2}:\d{2}:\d{2}$/,         // 시간
        /^1688-1688$/,
        /^www\./,
    ];

    function shouldSkip(line) {
        return SKIP_PATTERNS.some(p => p.test(line));
    }

    // Category prefix lines (구분+카테고리 합쳐진 형태)
    // e.g. "기본기본", "선택납입면제", "선택암치료", "기본납입지원"
    const CATEGORY_PAT = /^(기본|선택)(기본|납입면제|납입지원|진단|치료|암진단|암치료|암수술|암|간병|상해수술|질병수술)?$/;

    function isCategory(line) {
        const norm = line.replace(/\s+/g, '');
        return CATEGORY_PAT.test(norm);
    }

    // Period line: "20년납 100세만기" / "10년갱신 100세만기" / "30년납 100세만기" / "전기납 100세만기"
    function isPeriod(line) {
        return /(\d+년납|전기납|단기납)\s*\d+(세|년)만기|\d+년갱신\s*\d+세만기/.test(line);
    }

    // Amount line: "5,000만원" / "1,000만원" / "10억원" / "500만원"
    function isAmount(line) {
        const norm = line.replace(/[\s,]/g, '');
        return /^(\d+)(만원|억원)$/.test(norm) || /^\d+억\d+만원$/.test(norm);
    }

    // Premium line (숫자+쉼표만): e.g. "66,500" or "1,234,567"
    function isPremium(line) {
        return /^\d{1,3}(,\d{3})*$/.test(line);
    }

    // ── 3. State Machine ──
    // States: WAITING → IN_NAME → AFTER_PERIOD → (emit on amount)
    const STATE = { WAITING: 0, IN_NAME: 1, AFTER_PERIOD: 2 };
    let state = STATE.WAITING;
    let nameBuffer = '';

    for (let i = 0; i < sectionLines.length; i++) {
        const line = sectionLines[i];

        if (shouldSkip(line)) continue;

        if (state === STATE.WAITING) {
            if (isCategory(line) || isPeriod(line) || isAmount(line) || isPremium(line)) continue;
            // Start accumulating name
            nameBuffer = line;
            state = STATE.IN_NAME;

        } else if (state === STATE.IN_NAME) {
            if (shouldSkip(line)) continue;
            if (isCategory(line)) {
                // New block started before we got a period → discard partial
                nameBuffer = '';
                state = STATE.WAITING;
                // re-process this line as WAITING next iteration? No, just move on
                continue;
            }
            if (isPeriod(line)) {
                state = STATE.AFTER_PERIOD;
                continue;
            }
            if (isAmount(line)) {
                // Amount appeared without period line (rare) → emit now
                const name = nameBuffer.trim();
                const amount = line.trim().replace(/\s/g, '');
                if (name && amount) {
                    results.push({ name, amount });
                    console.log(`[흥국] 추출(직접): ${name} | ${amount}`);
                }
                nameBuffer = '';
                state = STATE.WAITING;
                continue;
            }
            if (isPremium(line)) {
                // Skip premium without period (shouldn't happen, but defensive)
                continue;
            }
            // Continue accumulating name (multi-line names)
            nameBuffer += line;

        } else if (state === STATE.AFTER_PERIOD) {
            if (shouldSkip(line)) continue;
            if (isPremium(line)) continue; // skip standalone premium line before amount

            if (isAmount(line)) {
                const name = nameBuffer.trim();
                // Normalize amount: remove internal spaces
                const amount = line.trim().replace(/\s/g, '');
                if (name && amount) {
                    results.push({ name, amount });
                    console.log(`[흥국] 추출: ${name} | ${amount}`);
                }
                nameBuffer = '';
                state = STATE.WAITING;
            } else if (isPeriod(line)) {
                // Another period line (갱신형 중첩) → stay AFTER_PERIOD
                continue;
            } else if (isCategory(line)) {
                // Next category without amount found → discard
                nameBuffer = '';
                state = STATE.WAITING;
            } else {
                // Unexpected non-amount → treat as stray, discard and reset
                nameBuffer = '';
                state = STATE.WAITING;
            }
        }
    }

    console.log(`[흥국] 총 ${results.length}건 추출`);
    return results;
}
