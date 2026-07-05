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

        // 담보 번호가 단독 줄로 떨어진 경우(예: "4"만 있는 줄, 다음 줄부터 [건강]... 내용 시작)는
        // 항상 새 그룹의 경계이므로, 금액을 못 찾아 계속 이어붙이던 pending(예: 상해사망처럼
        // 끝까지 금액 패턴이 없는 항목)이 있어도 여기서 강제로 끊어낸다.
        if (/^\d{1,4}$/.test(trimmed)) {
            if (pending) { mergedLines.push(pending); pending = ''; }
            mergedLines.push(trimmed);
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

    // ── 3. 관심 담보 화이트리스트 (암 + 온통보장류 타 질환군, 기타 사이드바용) ──
    const cancerWhitelist = [
        "암", "항암", "중입자", "양성자", "표적", "면역", "다빈치", "로봇", "중환자실", "호르몬",
        "뇌혈관", "허혈성심장", "순환계", "신장질환", "근골격"
    ];

    // ── 4. Parse each merged line ──
    const results = [];
    // 온통보장류 그룹 추적: 번호(id)가 있는 줄이 그룹 시작, 이후 번호 없는 연속 줄들은 같은 그룹에 속함
    // (이름 문자열 비교는 원문 공백/문구가 tier별로 미묘하게 달라 신뢰 불가 → 번호 기반 추적이 안전)
    let lastGroupId = null;
    // 온[ON]통보장류 그룹의 "공유 보험료": 여러 tier 줄(복합치료 회복지원금Ⅱ 등) + 상해사망 줄이
    // 금액 패턴(원/만원/억원 접미사) 없이 끝까지 이어붙여지다 보니 fallback 파싱에서 금액을 못 찾아
    // 그대로 버려지는데, 그 버려지는 줄 안에 그룹 전체가 공유하는 보험료 숫자(예: "13,800")가
    // 콤마 숫자 형태로 섞여 있다. groupId별로 이 값을 잡아두었다가 5단계 압축 단계에서 대표 항목에 붙인다.
    const pendingGroupPremium = {};

    mergedLines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 담보 번호가 단독 줄로 떨어져 나오는 경우 (예: "4"만 있는 줄, 다음 줄부터 [건강]... 내용 시작)
        // → 그룹 시작 신호로만 사용하고 결과에는 포함하지 않음
        if (/^\d{1,4}$/.test(trimmed)) {
            lastGroupId = trimmed;
            return;
        }

        // Coverage line signature: leading 번호 + content, OR a [bracket] prefix somewhere
        // (일부 상품은 [갱신형] 등 접두어 없이 "번호 담보명 금액 보험료 기간" 형태로만 표기됨)
        const looksLikeCoverageLine = /^\s*\d{1,4}\s+\S/.test(trimmed) || trimmed.includes('[');
        if (!looksLikeCoverageLine) return;

        // Try to match: (번호)  [prefix]? (name)  (amount)  (premium or (공통))  (period)
        //번호 is optional at start, [prefix]는 있을 수도 없을 수도 있음
        // Pattern:
        //   ^(\d{1,4})\s+      — optional 번호
        //   (\[[^\]]+\]\s*)?   — bracket prefix like [건강] (optional)
        //   (.+?)              — coverage name (non-greedy)
        //   \s+([\d억만천백십원,]+원|세부보장참조)   — 가입금액
        //   \s+(\d[\d,]*원|\(공통\))   — 보험료
        //   \s+(\d+년[^\n]*)   — 납입기간
        const fullPattern = /^(\d{1,4})\s+(\[[^\]]+\]\s*)?(.+?)\s+(\d[\d,]*억\s*(?:\d[\d,]*만)?원|\d[\d,]*만원|\d[\d,]*원|세부보장참조)\s+(\d[\d,]*원?|\(공통\))\s+(\d+년.*)/;
        // Also try without leading 번호:
        const noIdPattern = /^(\[[^\]]+\]\s*)?(.+?)\s+(\d[\d,]*억\s*(?:\d[\d,]*만)?원|\d[\d,]*만원|\d[\d,]*원|세부보장참조)\s+(\d[\d,]*원?|\(공통\))\s+(\d+년.*)/;

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
            bracketPrefix = m[2] || '';
            rawName = m[3];
            amountStr = m[4];
            premiumStr = m[5];
            periodStr = m[6];
            matched = true;
        } else {
            m = trimmed.match(noIdPattern);
            if (m) {
                bracketPrefix = m[1] || '';
                rawName = m[2];
                amountStr = m[3];
                premiumStr = m[4];
                periodStr = m[5];
                matched = true;
            }
        }

        // Fallback: more lenient parse — find amount anywhere in line
        if (!matched) {
            // Extract bracket prefix (있으면 사용, 없으면 번호 뒤부터 바로 파싱)
            const bm = trimmed.match(/(\[[^\]]+\]\s*)/);
            let afterBracket;
            let beforeBracket;
            if (bm) {
                bracketPrefix = bm[0];
                // Use bm.index for safe positional extraction (avoids indexOf collision)
                afterBracket = trimmed.substring(bm.index + bm[0].length);
                beforeBracket = trimmed.substring(0, bm.index).trim();
            } else {
                // 대괄호 접두어 없음: 선행 번호만 분리하고 나머지 전체를 이름+금액 영역으로 취급
                const noBracketM = trimmed.match(/^(\d{1,4})\s+(.*)$/);
                if (noBracketM) {
                    beforeBracket = noBracketM[1];
                    afterBracket = noBracketM[2];
                } else {
                    beforeBracket = '';
                    afterBracket = trimmed;
                }
            }

            // Extract id (번호) from before the bracket
            const idM = beforeBracket.match(/^(\d{1,4})$/);
            if (idM) id = idM[1];

            // Find amount
            const amountM = afterBracket.match(/(\d[\d,]*억\s*(?:\d[\d,]*만)?원|\d[\d,]*만원|\d[\d,]*원|세부보장참조)/);
            if (!amountM) {
                // 온통보장류 그룹의 "상해사망" 줄은 금액이 %(잔액의 10% 등)로만 표기되어 원/만원/억원
                // 접미사가 있는 금액 패턴이 끝내 나타나지 않는다. 이 줄에 그룹 공유 보험료
                // (예: "13,800", 콤마 포함 순수 숫자, 원/만원/억원 접미사 없음)가 섞여 있는지 확인해서
                // groupId 기준으로 잡아둔다 (담보8류처럼 그룹이 나중에 비압축되더라도, 5단계에서
                // 첫 항목에만 붙여 중복 합산을 피한다).
                const premCandidateM = afterBracket.match(/(?:^|\s)(\d{1,3}(?:,\d{3})+)(?!\s*(?:원|만원|억원|만|억))(?:\s+(\d+년[^\n]*))?/);
                if (premCandidateM && lastGroupId) {
                    if (!pendingGroupPremium[lastGroupId]) {
                        pendingGroupPremium[lastGroupId] = premCandidateM[1].replace(/,/g, '');
                    }
                }
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

        // 그룹 id 갱신/상속: 번호가 있으면 새 그룹 시작, 없으면 직전 그룹에 속함
        if (id) {
            lastGroupId = id;
        } else {
            id = lastGroupId || '';
        }
        const groupId = lastGroupId;

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
            groupId: groupId || String(lineIdx),
            name: name,
            amount: amountStr,
            premium: premium,
            period: period,
            original: trimmed
        });
    });

    // ── 5. 그룹형 통합보장(온통보장류) 압축 ──
    // 같은 groupId(담보 번호) 안에서 금액이 전부 동일한 연속 항목들은
    // "N회 이상" 누적 임계값 지급구조 → 실제로는 단가(가입금액) 1건만 지급되는 개념이므로
    // 대표 1건 + tierCount(몇 단계였는지, 배지용)로 압축한다.
    // 금액이 서로 다른 그룹(치료 종류별로 별도 금액인 경우)은 압축하지 않고 그대로 둔다.
    const compacted = [];
    let i = 0;
    while (i < results.length) {
        const cur = results[i];
        let j = i + 1;
        while (j < results.length && results[j].groupId === cur.groupId) {
            j++;
        }
        const groupLen = j - i;
        const groupPremium = pendingGroupPremium[cur.groupId] || '';
        if (groupLen > 1) {
            const sameAmount = results.slice(i, j).every(r => r.amount === cur.amount);
            if (sameAmount) {
                // 동일 금액 압축: 그룹 전체가 공유하는 보험료 1건을 대표 항목에 그대로 붙인다.
                const repItem = Object.assign({}, cur, { tierCount: groupLen });
                if (groupPremium && !repItem.premium) repItem.premium = groupPremium;
                compacted.push(repItem);
                console.log(`[Samsung] 그룹 압축: groupId=${cur.groupId} ${groupLen}건 → 1건(단가 ${cur.amount}, 연${groupLen}회, 보험료 ${repItem.premium || '(미확인)'})`);
            } else {
                // 금액이 서로 다른 그룹(담보8류: 이식수술비/절제수술비/특정수술비 등 실제로 별개 항목)은
                // 압축하지 않고 그대로 둔다. 다만 이 경우에도 그룹 전체가 보험료를 공유하므로,
                // 모든 항목에 붙이면 후속 "보험료 합산" 로직에서 그룹 보험료가 항목 수만큼 중복 합산된다.
                // → 첫 항목에만 그룹 공유 보험료를 붙이고, 나머지는 premium: '' 로 두어
                //   합산 시 정확히 1회만 카운트되도록 한다.
                for (let k = i; k < j; k++) {
                    const item = results[k];
                    if (k === i && groupPremium && !item.premium) {
                        compacted.push(Object.assign({}, item, { premium: groupPremium }));
                    } else {
                        compacted.push(item);
                    }
                }
            }
        } else {
            // 단일 항목 그룹이라도, 상해사망 등 무금액 후속 줄에 공유 보험료가 남아있었을 수 있으니
            // 비어있는 premium을 채워준다 (없으면 그대로 '').
            if (groupPremium && !cur.premium) {
                compacted.push(Object.assign({}, cur, { premium: groupPremium }));
            } else {
                compacted.push(cur);
            }
        }
        i = j;
    }

    console.log(`[Samsung] extractRawCoveragesSamsung: ${compacted.length}건 추출 완료 (${mergedLines.length}줄 분석, 그룹압축 전 ${results.length}건)`);
    return compacted;
}
