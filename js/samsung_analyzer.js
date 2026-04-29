// ── Samsung Fire Insurance (삼성화재) Raw Coverage Extractor ──

function extractRawCoveragesSamsung(text) {
    if (!text || typeof text !== 'string') {
        console.warn("extractRawCoveragesSamsung: Invalid text input", text);
        return [];
    }

    // ── 1. Find section boundaries ──
    const lines = text.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    // Start keywords: 담보가입현황 or 담보 가입 현황 (with optional spaces)
    const startKeywords = ["담보가입현황", "담보 가입 현황"];
    // End keywords: 보장보험료 합계, 총보험료, 주의사항, 유의사항
    const endKeywords = ["보장보험료합계", "보장보험료 합계", "총보험료합계", "총보험료 합계", "주의사항", "유의사항"];

    for (let i = 0; i < lines.length; i++) {
        const lineNorm = lines[i].replace(/\s+/g, '');
        if (startIndex === -1) {
            if (lineNorm.length < 50 && startKeywords.some(k => lineNorm.includes(k.replace(/\s+/g, '')))) {
                startIndex = i;
                console.log(`[Samsung] Start index found at line ${i}: ${lines[i]}`);
            }
        } else if (endIndex === -1) {
            if (endKeywords.some(k => lineNorm.includes(k.replace(/\s+/g, '')))) {
                endIndex = i;
                console.log(`[Samsung] End index found at line ${i}: ${lines[i]}`);
                break;
            }
        }
    }

    let targetLines;
    if (startIndex !== -1) {
        if (endIndex === -1) endIndex = lines.length;
        targetLines = lines.slice(startIndex, endIndex);
        console.log(`[Samsung] Range filtering: lines ${startIndex}~${endIndex} (${targetLines.length} lines)`);
        // Fallback: if section is too small, scan full document
        if (targetLines.length < 5) {
            console.warn("[Samsung] Section too small, falling back to full document scan.");
            targetLines = lines;
            startIndex = -1;
        }
    } else {
        console.warn("[Samsung] Start keyword not found. Scanning entire document.");
        targetLines = lines;
    }

    // ── 2. Merge continuation lines (OCR may split long coverage names across lines) ──
    // A coverage line starts with: optional number + [bracket prefix] e.g. "57  [건강]..."
    // OR just a bracket prefix at the start of a line continuing the previous
    const amountPattern = /(?:[0-9,]+\s*(?:억원|만원|억|만|천|백|십|원)\s*)+/;
    const coverageLineStart = /^\s*\d{1,4}\s+\[/;  // "57  [건강]"
    const bracketPrefixOnly = /^\s*\[[^\]]+\]/;       // "[건강]" at line start (rare)

    const mergedLines = [];
    let pending = '';

    for (let i = 0; i < targetLines.length; i++) {
        const trimmed = targetLines[i].trim();
        if (!trimmed) {
            if (pending) { mergedLines.push(pending); pending = ''; }
            continue;
        }

        const hasAmount = amountPattern.test(trimmed);
        const isNewCoverageLine = coverageLineStart.test(trimmed) || bracketPrefixOnly.test(trimmed);

        if (pending) {
            if (isNewCoverageLine) {
                // Flush pending and start fresh
                mergedLines.push(pending);
                pending = '';
            }
            // Append to pending
            if (!pending) {
                // Was flushed above — start new pending if no amount yet
                if (hasAmount) {
                    mergedLines.push(trimmed);
                } else {
                    pending = trimmed;
                }
            } else {
                pending += ' ' + trimmed;
                if (hasAmount || amountPattern.test(pending)) {
                    mergedLines.push(pending);
                    pending = '';
                }
            }
        } else {
            if (hasAmount) {
                mergedLines.push(trimmed);
            } else if (isNewCoverageLine || trimmed.includes('[')) {
                // Potential start of a coverage line without amount yet — hold it
                pending = trimmed;
            } else {
                // Plain line, push as-is
                mergedLines.push(trimmed);
            }
        }
    }
    if (pending) mergedLines.push(pending);

    console.log(`[Samsung] After line merge: ${mergedLines.length} lines`);

    // ── 3. Cancer-related whitelist keywords ──
    const cancerWhitelist = [
        "암", "항암", "중입자", "양성자", "표적", "면역", "다빈치", "로봇", "중환자실", "호르몬"
    ];

    // ── 4. Parse each merged line ──
    const results = [];

    mergedLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Must contain a [bracket] prefix to be a coverage line
        if (!trimmed.includes('[')) return;

        // Try to match: (번호)  [prefix] (name)  (amount)  (premium or (공통))  (period)
        //번호 is optional at start
        // Pattern:
        //   ^(\d{1,4})\s+      — optional 번호
        //   (\[[^\]]+\]\s*)    — bracket prefix like [건강]
        //   (.+?)              — coverage name (non-greedy)
        //   \s+([\d억만천백십원,]+원|세부보장참조)   — 가입금액
        //   \s+(\d[\d,]*원|\(공통\))   — 보험료
        //   \s+(\d+년[^\n]*)   — 납입기간
        const fullPattern = /^(\d{1,4})\s+(\[[^\]]+\]\s*)(.+?)\s+(\d[\d,]*억\s*(?:\d[\d,]*만)?원|\d[\d,]*만원|\d[\d,]*원|세부보장참조)\s+(\d[\d,]*원?|\(공통\))\s+(\d+년.*)/;
        // Also try without leading 번호:
        const noIdPattern = /^(\[[^\]]+\]\s*)(.+?)\s+(\d[\d,]*억\s*(?:\d[\d,]*만)?원|\d[\d,]*만원|\d[\d,]*원|세부보장참조)\s+(\d[\d,]*원?|\(공통\))\s+(\d+년.*)/;

        let id = '';
        let bracketPrefix = '';
        let rawName = '';
        let amountStr = '';
        let premiumStr = '';
        let periodStr = '';
        let matched = false;

        let m = trimmed.match(fullPattern);
        if (m) {
            id = m[1];
            bracketPrefix = m[2];
            rawName = m[3];
            amountStr = m[4];
            premiumStr = m[5];
            periodStr = m[6];
            matched = true;
        } else {
            m = trimmed.match(noIdPattern);
            if (m) {
                bracketPrefix = m[1];
                rawName = m[2];
                amountStr = m[3];
                premiumStr = m[4];
                periodStr = m[5];
                matched = true;
            }
        }

        // Fallback: more lenient parse — find amount anywhere in line
        if (!matched) {
            // Extract bracket prefix
            const bm = trimmed.match(/(\[[^\]]+\]\s*)/);
            if (!bm) return;
            bracketPrefix = bm[0];
            // Use bm.index for safe positional extraction (avoids indexOf collision)
            const afterBracket = trimmed.substring(bm.index + bm[0].length);

            // Extract id (번호) from before the bracket
            const beforeBracket = trimmed.substring(0, bm.index).trim();
            const idM = beforeBracket.match(/^(\d{1,4})$/);
            if (idM) id = idM[1];

            // Find amount
            const amountM = afterBracket.match(/(\d[\d,]*억\s*(?:\d[\d,]*만)?원|\d[\d,]*만원|\d[\d,]*원|세부보장참조)/);
            if (!amountM) {
                console.warn(`[Samsung] Fallback parse failed (no amount found): ${trimmed.substring(0, 80)}`);
                return;
            }
            amountStr = amountM[1];
            rawName = afterBracket.substring(0, amountM.index).trim();
            const afterAmount = afterBracket.substring(amountM.index + amountM[0].length).trim();

            // Find premium
            const premM = afterAmount.match(/^(\d[\d,]*원?|\(공통\))/);
            if (premM) {
                premiumStr = premM[1];
                const afterPrem = afterAmount.substring(premM[0].length).trim();
                const perM = afterPrem.match(/(\d+년.*)/);
                if (perM) periodStr = perM[1];
            } else {
                const perM = afterAmount.match(/(\d+년.*)/);
                if (perM) periodStr = perM[1];
            }
            matched = true;
        }

        if (!matched || !rawName) return;

        // Clean name: strip any remaining bracket prefixes, leading numbers, leading/trailing spaces
        let name = rawName
            .replace(/\[[^\]]+\]\s*/g, '')   // strip all [xxx] prefixes
            .replace(/^[\d]+\s+/, '')           // strip leading 번호 if merged in
            .replace(/[.\s]+$/, '')             // trailing dots/spaces
            .trim();

        if (!name) return;

        // Only keep cancer-related coverages (whitelist)
        const nameNorm = name.replace(/\s+/g, '');
        const isCancerRelated = cancerWhitelist.some(kw => nameNorm.includes(kw));
        if (!isCancerRelated) {
            console.log(`[Samsung] Skipped (not cancer-related): ${name}`);
            return;
        }

        // Parse premium
        let premium = '';
        if (premiumStr && premiumStr !== '(공통)') {
            // Strip trailing 원, keep digits and commas
            premium = premiumStr.replace(/원$/, '').replace(/,/g, '');
        }
        // (공통) → premium stays ""

        // Parse period: trim to essential (e.g. "20년" or "20년납 100세만기")
        let period = periodStr ? periodStr.trim() : '-';

        // Validity: name length
        if (name.length < 2 || name.length > 120) {
            console.log(`[Samsung] Skipped (name length ${name.length}): ${name}`);
            return;
        }

        const lineIdx = (startIndex === -1 ? 0 : startIndex) + idx;
        results.push({
            id: id || String(lineIdx),
            name: name,
            amount: amountStr,
            premium: premium,
            period: period,
            original: trimmed
        });
    });

    console.log(`[Samsung] extractRawCoveragesSamsung: ${results.length}건 추출 완료 (${mergedLines.length}줄 분석)`);
    return results;
}
