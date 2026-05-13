// ── Heungkuk Fire Insurance (흥국화재) Raw Coverage Extractor ──
// pdfjs 브라우저 추출: 테이블 행 전체가 한 줄로 합쳐짐
// e.g. "선택 암치료 항암약물치료비(감액없음)(건강고지형) 20년납 100세만기 1,000만원 4,340"
// → 금액(AMT_PAT)을 기준으로 이름을 추출하는 방식 사용

function extractRawCoveragesHeungkuk(text) {
    if (!text || typeof text !== 'string') {
        console.warn('[흥국] extractRawCoveragesHeungkuk: invalid input');
        return [];
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];

    // ── 1. Find section boundaries ──
    // Start: ■ 가입담보 리스트
    // End:   보 장 보 험 료  합 계 (공백 포함) or 보장보험료합계
    let startIdx = -1;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
        const norm = lines[i].replace(/\s+/g, '');
        if (startIdx === -1 && norm.includes('가입담보리스트')) {
            startIdx = i + 1;
        }
        if (startIdx !== -1 && norm.includes('보장보험료합계')) {
            endIdx = i;
        }
    }

    if (startIdx === -1) {
        console.warn('[흥국] ■ 가입담보 리스트 섹션 미발견');
        return [];
    }

    const sectionLines = lines.slice(startIdx, endIdx);
    console.log(`[흥국] 섹션 범위: lines ${startIdx}~${endIdx} (${sectionLines.length}줄)`);

    // ── 2. Patterns ──

    // 흥국화재 금액: N,NNN만원 or N억원 (쉼표 포함)
    const AMT_PAT = /(\d{1,3}(?:,\d{3})*만원|\d+억원)/;

    // 납기/만기: "20년납 100세만기" / "10년갱신 100세만기" / "전기납 100세만기"
    const PERIOD_PAT = /(\d+년납|전기납|단기납)\s*\d+(?:세|년)만기|\d+년갱신\s*\d+세만기/;

    // 카테고리 앞부분 제거 (단독형 + 복합형 모두)
    // e.g. "선택 암치료 " / "기본 기본 " / "선택납입면제 " / "선택질병수술 " 등
    const CAT_PREFIX_PAT = /^(기본|선택)\s*(기본|납입면제|납입지원|진단|치료|암진단|암치료|암수술|암|간병|상해수술|질병수술)?\s*/;

    // 카테고리 전용 줄 판별 (전체 줄이 카테고리 키워드만인 경우)
    const CAT_ONLY_PAT = /^(기본|선택)(기본|납입면제|납입지원|진단|치료|암진단|암치료|암수술|암|간병|상해수술|질병수술)?$/;
    // 단독 서브카테고리 줄 (선택 없이 진단/치료/암치료 등만 있는 경우)
    const SUBCAT_ONLY_PAT = /^(납입면제|납입지원|진단|치료|암진단|암치료|암수술|암|간병|상해수술|질병수술)$/;

    // ── 3. Skip & Reset 판별 ──
    // SKIP_RESET: 이 줄이 나오면 nameBuffer도 초기화 (새 섹션 시작)
    // SKIP_KEEP:  이 줄은 skip하되 nameBuffer 유지 (기간/보험료 등 다음 행에 amount가 옴)
    const SKIP_RESET_PATTERNS = [
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
        /^\(\s*\d+\s*\/\s*\d+\s*\)$/,    // (7 / 19)
        /^\d+\s*\/\s*\d+$/,               // 7 / 19
        /^\[준법감시인/,
        /^\(설계번호\)/,
        /^\(발행일시\)/,
        /^무배당\s*흥Good/,
        /^흥국화재해상보험/,
        /^피보험자\s*\(\d+\/\d+\)/,
        /^[가-힣]{2,5}\(계약자와의\s*관계:/,
        /^운전여부:/,
        /^\d+월\s*우대플랜/,
        /^■\s*계약사항$/,
        /^■\s*보장사항$/,
        /^\d{4}-\d{2}-\d{2}/,
        /^\d{2}:\d{2}:\d{2}$/,
        /^1688-1688$/,
        /^www\./,
        /^5월/,   // "5월 우대플랜" 등 월별 헤더
        /^※가입담보/,
    ];

    // 보험료만 있는 숫자 줄 (순수 프리미엄)
    function isPremiumOnly(line) {
        return /^\d{1,3}(,\d{3})*$/.test(line);
    }

    // 납기/만기만 있는 줄 (순수 기간 줄) - buffer는 유지
    function isPeriodOnly(line) {
        return /^(\d+년납|전기납|단기납)\s*\d+(?:세|년)만기$|^\d+년갱신\s*\d+세만기$/.test(line);
    }

    function shouldSkipReset(line) {
        const norm = line.replace(/\s+/g, '');
        if (CAT_ONLY_PAT.test(norm) || SUBCAT_ONLY_PAT.test(norm)) return 'reset';
        if (SKIP_RESET_PATTERNS.some(p => p.test(line))) return 'reset';
        if (isPremiumOnly(line)) return 'keep';
        if (isPeriodOnly(line)) return 'keep';
        return null; // not a skip line
    }

    // ── 4. Extraction loop ──
    // 핵심 전략:
    //   - 금액(AMT_PAT)이 있는 줄 → 이름+금액 추출
    //   - 금액이 없는 줄:
    //     - 카테고리/헤더 줄 → skip + reset
    //     - 기간/보험료 줄 → skip (buffer 유지)
    //     - 그 외 → nameBuffer에 누적 (다음 줄에 금액이 오는 경우 대비)
    let nameBuffer = '';

    for (const line of sectionLines) {
        const skipResult = shouldSkipReset(line);
        if (skipResult === 'reset') { nameBuffer = ''; continue; }
        if (skipResult === 'keep') { continue; }

        // ── 금액이 있는 줄: 이름+금액 추출 ──
        const amtMatch = line.match(AMT_PAT);
        if (amtMatch) {
            // 카테고리 앞부분 제거
            let rest = line.replace(CAT_PREFIX_PAT, '').trim();

            // 납기/만기 패턴 위치 찾기
            const periodMatch = rest.match(PERIOD_PAT);

            let name, amount;

            if (periodMatch) {
                // 납기/만기 앞부분이 담보명
                const pIdx = rest.indexOf(periodMatch[0]);
                const namePart = rest.substring(0, pIdx).trim();
                // 납기/만기 뒷부분에서 금액 추출
                const afterPeriod = rest.substring(pIdx + periodMatch[0].length);
                const amtAfter = afterPeriod.match(AMT_PAT);
                amount = amtAfter ? amtAfter[1] : amtMatch[1];
                name = (nameBuffer + namePart).trim();
            } else {
                // 납기/만기가 이 줄에 없음 → 금액 앞부분이 담보명 (멀티라인 두번째 줄)
                const amtIdx = rest.indexOf(amtMatch[0]);
                const namePart = rest.substring(0, amtIdx).trim();
                name = (nameBuffer + namePart).trim();
                amount = amtMatch[1];
            }

            nameBuffer = ''; // 버퍼 초기화

            if (name && amount) {
                results.push({ name, amount });
                console.log(`[흥국] 추출: ${name} | ${amount}`);
            }
            continue;
        }

        // ── 금액 없는 줄: 담보명 누적 ──
        // 카테고리 앞부분 제거 후 누적
        const stripped = line.replace(CAT_PREFIX_PAT, '').trim();
        if (stripped) {
            // 카테고리 제거로 내용이 줄어들었다면 → 새 아이템 시작
            if (stripped !== line) {
                nameBuffer = stripped;
            } else {
                nameBuffer += stripped;
            }
        }
    }

    console.log(`[흥국] 총 ${results.length}건 추출`);
    return results;
}
