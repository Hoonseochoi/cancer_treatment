// ── Helper: Parse Korean Amount ──
function parseKoAmount(str) {
    if (!str) return 0;
    // Remove "원", ",", " "
    let clean = str.replace(/[원,\s]/g, '');
    let val = 0;
    // Check units
    if (clean.includes('억')) {
        let parts = clean.split('억');
        let uk = parseInt(parts[0]) || 0;
        let rest = parts[1] || '';
        val += uk * 10000; // 만원 단위로 계산 (1억 = 10000만)
        if (rest.includes('천')) {
            val += (parseInt(rest.replace('천', '')) || 0) * 1000;
        } else if (rest.includes('만')) {
            val += parseInt(rest.replace('만', '')) || 0;
        }
    } else if (clean.includes('천만')) {
        val = (parseInt(clean.replace('천만', '')) || 0) * 1000;
    } else if (clean.includes('백만')) {
        val = (parseInt(clean.replace('백만', '')) || 0) * 100;
    } else if (clean.includes('만')) {
        val = parseInt(clean.replace('만', '')) || 0;
    } else {
        // 단위가 없거나 '원'만 있는 경우 (보험료는 제외하고 가입금액만 본다면 보통 만원 단위 이상임)
        // 여기서는 '만' 단위로 통일해서 리턴
        val = parseInt(clean) || 0;
    }
    return val; // 만원 단위 반환
}
// ── Helper: Format Korean Amount ──
function formatKoAmount(val) {
    if (val === 0) return "0원";
    let uk = Math.floor(val / 10000);
    let man = val % 10000;
    let result = "";
    if (uk > 0) result += `${uk}억 `;
    if (man > 0) result += `${man.toLocaleString()}만`;
    return result.trim() + "원";
}
// ── Helper: Normalize any amount string to #,###만원 format ──
function formatDisplayAmount(str) {
    if (!str) return str;
    const val = parseKoAmount(str);
    if (val === 0) return str; // 파싱 실패 시 원본 유지
    return formatKoAmount(val);
}
// ── Aggregate Hierarchical Summary Logic ──
function calculateHierarchicalSummary(results) {
    const summaryMap = new Map();
    let first26SummaryFound = false; // 26종 첫 번째만 한눈에보기에 반영
    results.forEach(item => {
        let details = coverageDetailsMap[item.name];
        // Dictionary Lookup (Fallback Logic)
        if (!details) {
            if (item.name.includes("암 통합치료비") && (item.name.includes("III") || item.name.includes("Ⅲ"))) {
                details = coverageDetailsMap["암진단및치료비(암 통합치료비III)"];
            }
            // [MOVED] 주요치료 우선 체크
            else if (item.name.includes("암 통합치료비") && item.name.includes("주요치료")) {
                details = coverageDetailsMap["암 통합치료비(주요치료)(비급여(전액본인부담 포함), 암중점치료기관(상급 종합병원 포함))"];
            }
            else if (item.name.includes("암 통합치료비") && item.name.includes("비급여") && item.name.includes("전액본인부담")) {
                details = coverageDetailsMap["암 통합치료비(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함))"];
            } else if (item.name.includes("암 통합치료비") && (item.name.includes("Ⅱ") || item.name.includes("II")) && item.name.includes("비급여")) {
                details = coverageDetailsMap["암 통합치료비Ⅱ(비급여)"];
            } else if (item.name.includes("암 통합치료비") && item.name.includes("기본형")) {
                details = coverageDetailsMap["암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))"];
            } else if (item.name.includes("암 통합치료비") && item.name.includes("실속형")) {
                details = coverageDetailsMap["암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))"];
            }
            // 10년갱신 개별 담보 키워드 매칭
            else if (item.name.includes("중입자방사선")) {
                details = coverageDetailsMap["항암중입자방사선치료비"];
            } else if (item.name.includes("세기조절방사선")) {
                details = coverageDetailsMap["항암세기조절방사선치료비"];
            } else if (item.name.includes("면역항암약물") || item.name.includes("면역항암")) {
                details = coverageDetailsMap["특정면역항암약물허가치료비"];
            } else if (item.name.includes("표적항암약물") || item.name.includes("표적항암")) {
                details = coverageDetailsMap["표적항암약물허가치료비"];
            } else if (item.name.includes("양성자방사선") || item.name.includes("양성자")) {
                details = coverageDetailsMap["항암양성자방사선치료비"];
            } else if (item.name.includes("26종") && (item.name.includes("치료비") || item.name.includes("약물"))) {
                details = coverageDetailsMap["26종항암방사선및약물치료비"];
            } else if (item.name.includes("다빈치") && item.name.includes("로봇")) {
                // Exclude "특정암" (Specific Cancer) but keep "특정암제외" (General)
                if (!item.name.includes("특정암") || item.name.includes("제외")) {
                    details = coverageDetailsMap["다빈치로봇암수술비"];
                }
            }
        }
        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            // Fallback default
            if (!variantData) {
                // Approximate matching for limits (e.g. 7XXX -> 8000, 4XXX -> 5000)
                if (amountVal > 6000) variantData = details.data["8000"] || details.data["10000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
                if (!variantData && details.data["10000"]) variantData = details.data["10000"];
            }
            details = variantData;
        }
        // Handle Passthrough Type (자기 금액 그대로 사용)
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }
        if (details && details.type === '26jong') {
            if (!first26SummaryFound) {
                first26SummaryFound = true;
                details = details.summaryItems.map(d => ({
                    name: d.name,
                    amount: item.amount,
                    targetName: d.targetName // targetName 전달
                }));
            } else {
                details = null;
            }
        }
        if (details && Array.isArray(details)) {
            details.forEach(det => {
                // Normalize Name to find "Common Group"
                let groupingSource = det.targetName || det.name;
                let normalizedName = groupingSource;
                // [KEYWORD-BASED CATEGORIZATION]
                // 1. targetName이 명시적으로 있으면 최우선 적용 (26종 매핑 보장)
                if (det.targetName) {
                    normalizedName = det.targetName;
                }
                // 2. 그 외의 경우 키워드 매칭
                else if (groupingSource.includes("표적")) {
                    normalizedName = "표적항암약물치료비";
                } else if (groupingSource.includes("면역")) {
                    normalizedName = "면역항암약물치료비";
                } else if (groupingSource.includes("양성자")) {
                    normalizedName = "양성자방사선치료비";
                } else if (groupingSource.includes("중입자")) {
                    normalizedName = "중입자방사선치료비";
                } else if (groupingSource.includes("다빈치") || groupingSource.includes("로봇")) {
                    normalizedName = "다빈치로봇수술비";
                } else if (groupingSource.includes("세기조절")) {
                    normalizedName = "세기조절방사선치료비";
                } else if (groupingSource.includes("수술") && groupingSource.includes("암") && !groupingSource.includes("다빈치") && !groupingSource.includes("로봇")) {
                    normalizedName = "암수술비";
                } else if (groupingSource.includes("약물") && !groupingSource.includes("표적") && !groupingSource.includes("면역")) {
                    normalizedName = "항암약물치료비";
                } else if (groupingSource.includes("방사선") && !groupingSource.includes("양성자") && !groupingSource.includes("중입자") && !groupingSource.includes("세기")) {
                    normalizedName = "항암방사선치료비";
                } else {
                    // Fallback: Remove special chars
                    normalizedName = groupingSource.replace(/[^가-힣0-9]/g, '');
                }
                // 3. Make Display Name pretty if needed (or just use normalized?)
                // Actually, we want to group by "meaning", so removing spaces helps matching "표적 항암" == "표적항암"
                const amount = parseKoAmount(det.amount); // det.amount: "500만"
                if (!summaryMap.has(normalizedName)) {
                    summaryMap.set(normalizedName, {
                        displayName: normalizedName, // Temporary
                        totalMin: 0,
                        totalMax: 0,
                        items: []
                    });
                }
                const group = summaryMap.get(normalizedName);
                // Amount Parsing (Support Range)
                const valMin = parseKoAmount(det.amount);
                const valMax = det.maxAmount ? parseKoAmount(det.maxAmount) : valMin;
                group.totalMin += valMin;
                group.totalMax += valMax;
                group.items.push({
                    name: det.name,
                    amount: det.amount,
                    maxAmount: det.maxAmount,
                    source: item.name,
                    hiddenInDetail: det.hiddenInDetail
                });
                // Update display name (pick longest readable name)
                const is26JongItem = det.name.includes("26종");
                if ((det.name.length > group.displayName.length || group.displayName === normalizedName) && !is26JongItem) {
                    // 괄호 및 특수문자 제거 후 예쁜 이름으로 저장
                    let cleanName = det.name.replace(/\([^)]*\)/g, '').trim();
                    if (cleanName.length > 0) {
                        group.displayName = cleanName;
                    }
                }
            });
        }
    });
    return summaryMap;
}

// Helper to find details (Global Scope)
function findDetails(itemName) {
    let details = coverageDetailsMap[itemName];
    if (!details) {
        if (itemName.includes("암 통합치료비") && (itemName.includes("III") || itemName.includes("Ⅲ"))) {
            details = coverageDetailsMap["암진단및치료비(암 통합치료비III)"];
        }
        // [MOVED] 주요치료 우선 체크 (비급여/전액본인부담 키워드가 겹치므로 먼저 확인해야 함)
        else if (itemName.includes("암 통합치료비") && itemName.includes("주요치료")) {
            details = coverageDetailsMap["암 통합치료비(주요치료)(비급여(전액본인부담 포함), 암중점치료기관(상급 종합병원 포함))"];
        }
        else if (itemName.includes("암 통합치료비") && itemName.includes("비급여") && itemName.includes("전액본인부담")) {
            details = coverageDetailsMap["암 통합치료비(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함))"];
        }
        else if (itemName.includes("암 통합치료비") && (itemName.includes("Ⅱ") || itemName.includes("II")) && itemName.includes("비급여")) {
            details = coverageDetailsMap["암 통합치료비Ⅱ(비급여)"];
        }
        else if (itemName.includes("암 통합치료비") && itemName.includes("기본형")) {
            details = coverageDetailsMap["암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))"];
        }
        else if (itemName.includes("암 통합치료비") && itemName.includes("실속형")) {
            details = coverageDetailsMap["암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))"];
        }
        else if (itemName.includes("중입자방사선")) {
            details = coverageDetailsMap["항암중입자방사선치료비"];
        } else if (itemName.includes("세기조절방사선")) {
            details = coverageDetailsMap["항암세기조절방사선치료비"];
        } else if (itemName.includes("면역항암약물") || itemName.includes("면역항암")) {
            details = coverageDetailsMap["특정면역항암약물허가치료비"];
        } else if (itemName.includes("표적항암약물") || itemName.includes("표적항암")) {
            details = coverageDetailsMap["표적항암약물허가치료비"];
        } else if (itemName.includes("양성자방사선") || itemName.includes("양성자")) {
            details = coverageDetailsMap["항암양성자방사선치료비"];
        } else if (itemName.includes("26종")) {
            details = coverageDetailsMap["26종항암방사선및약물치료비"];
        } else if (itemName.includes("다빈치") && itemName.includes("로봇")) {
            if (!itemName.includes("특정암") || itemName.includes("제외")) {
                details = coverageDetailsMap["다빈치로봇암수술비"];
            }
        }
    }
    return details;
}

function extractRawCoverages(text) {
    if (!text || typeof text !== 'string') {
        console.warn("extractRawCoverages: Invalid text input", text);
        return [];
    }
    const lines = text.split('\n');
    let targetLines = lines;
    let startIndex = -1;
    let endIndex = -1;
    // 1. 범위 필터링 (Noise Reduction) - 개선: 설명문이 아닌 실제 테이블 헤더만 감지
    const startKeywords = ["가입담보리스트", "가입담보", "담보사항"];
    const endKeywords = ["주의사항", "유의사항", "알아두실"];
    // 시작점: 짧은 줄에서만 찾기 (설명문이 아닌 테이블 헤더/제목)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\s+/g, '');
        if (startIndex === -1) {
            // 40자 이하인 줄에서만 시작 키워드 검색 (긴 설명문 제외)
            if (line.length < 40 && startKeywords.some(k => line.includes(k))) {
                startIndex = i;
                console.log(`Start index found at line ${i}: ${lines[i]}`);
            }
        }
        else if (endIndex === -1) {
            // 종료 키워드도 짧은 줄에서만 (설명문에 포함된 "상품설명서" 등 무시)
            if (line.length < 40 && endKeywords.some(k => line.includes(k))) {
                endIndex = i;
                console.log(`End index found at line ${i}: ${lines[i]}`);
                break;
            }
        }
    }
    if (startIndex !== -1) {
        if (endIndex === -1) endIndex = lines.length;
        targetLines = lines.slice(startIndex, endIndex);
        console.log(`Range filtering applied: ${startIndex} ~ ${endIndex} (${targetLines.length} lines)`);
        // 범위가 너무 작으면 (10줄 미만) 전체 문서 스캔으로 Fallback
        if (targetLines.length < 10) {
            console.warn(`Range too small (${targetLines.length} lines). Falling back to full document scan.`);
            targetLines = lines;
            startIndex = -1; // reset for id calculation
        }
    } else {
        console.warn("Start keyword not found. Scanning entire document.");
    }
    // 1.5 줄 이어붙이기 (PDF 텍스트 레이어에서 줄이 분리된 경우 처리)
    // 예: "갱신형 암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))(통합간\n편가입)\n1천만원"
    //   → "갱신형 암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))(통합간편가입) 1천만원"
    const amountRegex = /[0-9,]+(?:억|천|백|십)*(?:만원|억원|만|억)|세부보장참조/;
    const mergedLines = [];
    let pendingLine = '';
    for (let i = 0; i < targetLines.length; i++) {
        const trimmed = targetLines[i].trim();
        if (!trimmed) {
            if (pendingLine) { mergedLines.push(pendingLine); pendingLine = ''; }
            mergedLines.push('');
            continue;
        }
        // 현재 줄에 금액이 있는지 체크
        const hasAmount = amountRegex.test(trimmed);
        if (pendingLine) {
            // 이전에 금액 없는 줄이 대기 중 → 현재 줄과 합침
            pendingLine += ' ' + trimmed;
            if (hasAmount || amountRegex.test(pendingLine)) {
                mergedLines.push(pendingLine);
                pendingLine = '';
            }
            // 금액 없으면 계속 대기 (다음 줄과도 합칠 수 있음)
        } else {
            if (hasAmount) {
                mergedLines.push(trimmed);
            } else {
                // 금액 없는 줄 → 다음 줄과 합칠 수 있으므로 대기
                // 단, 너무 짧은 줄(5자 미만)이거나 숫자만 있는 줄은 그냥 보냄
                if (trimmed.length < 5 || /^\d+$/.test(trimmed)) {
                    mergedLines.push(trimmed);
                } else {
                    pendingLine = trimmed;
                }
            }
        }
    }
    if (pendingLine) mergedLines.push(pendingLine);
    targetLines = mergedLines;
    console.log(`Line merging: ${mergedLines.length} lines after merge`);
    const results = [];
    // 2. 추출 로직 + 강력한 필터링
    // 제외할 단어들 (법적 문구, 설명, 예시표 등)
    const blacklist = [
        "해당 상품은", "경우", "따라", "법에", "지급하여", "포함되어", "보호법",
        "해약환급금", "예시표", "적용이율", "최저보증", "평균공시",
        "가입금액인", "00만원", "00원", "합계", "점검",
        "참고", "확인하시기", "바랍니다", "입니다", "됩니다",
        // 조건문/약관 설명 필터
        "최초계약", "경과시점", "감액적용", "면책",
        "법률상", "부담하여", "손해를", "배상책임을",
        "이전 진단", "이전 수술", "이전 치료",
        "같은 질병", "같은 종류", "반은 경",
        "※", "보장개시", "납입면제",
        // 계약 정보 필터
        "남성", "여성", "만기", "가입금액"
    ];
    targetLines.forEach((line, idx) => {
        const originalIdx = (startIndex === -1 ? 0 : startIndex) + idx;
        const trimmed = line.trim();
        if (!trimmed) return;
        // A. 블랙리스트 체크 (문장 전체)
        if (blacklist.some(word => trimmed.includes(word))) return;
        // [NEW] "세부보장"으로 시작하는 줄은 노이즈로 간주하고 제외 (세부보장참조는 허용하되, 문장 시작이 세부보장이면 제외)
        if (trimmed.startsWith("세부보장")) return;
        // B. 금액 패턴 찾기
        let match = trimmed.match(/([0-9,]+(?:억|천|백|십)*(?:만원|억원|만|억))/);
        // "원"만 있는 경우도 찾되, 너무 작은 금액(100원 미만)이나 긴 문장은 제외
        if (!match) {
            match = trimmed.match(/([0-9,]+(?:천|백|십)?원)/);
        }
        // "세부보장참조" 패턴도 금액으로 인정 (상위 담보항목)
        let isRefAmount = false;
        if (!match && trimmed.includes('세부보장참조')) {
            // 세부보장참조 뒤의 보험료 숫자를 찾아서 그 앞까지를 이름으로 사용
            const refMatch = trimmed.match(/세부보장참조/);
            if (refMatch) {
                match = refMatch;
                match[1] = '세부보장참조';
                isRefAmount = true;
            }
        }
        if (match) {
            const amountStr = match[1];
            // C. 담보명 추출 및 정제
            let namePart = trimmed.substring(0, match.index).trim();
            // 0. [NEW] 앞부분에 붙은 "20년 / 20년" 같은 날짜 패턴 제거 (텍스트 병합 이슈 해결)
            // 패턴: "숫자년" 또는 "숫자세"가 포함된 앞부분 제거
            namePart = namePart.replace(/^[\d]+(년|세|월)\s*[\/]?\s*[\d]*(년|세|월)?\s*/, '').trim();
            // 혹시 숫자가 남아있다면 한번 더 제거 (예: "278 갱신형...")
            namePart = namePart.replace(/^[\d]+\s+/, '').trim();
            // 1. 카테고리 헤더 제거 (표의 첫번째 열 내용이 섞여 들어간 경우)
            // 예: "치료비 112 암...", "기본계약 32...", "3대진단 64..."
            // 주의: "기타피부암" 처럼 단어의 일부인 경우는 제외하고, "기타 110" 처럼 분리된 경우만 제거
            const categoryKeywords = ["기본계약", "3대진단", "치료비", "수술비", "입원비", "배상책임", "후유장해", "기타", "2대진단", "질병", "상해", "운전자"];
            for (const key of categoryKeywords) {
                // 키워드 뒤에 공백이나 숫자가 오는 경우에만 제거 (정규식 사용)
                // 예: "기타 110" -> 제거, "기타피부암" -> 유지
                const regex = new RegExp('^' + key + '(?=[\\s\\d])');
                if (regex.test(namePart)) {
                    namePart = namePart.replace(regex, '').trim();
                }
            }
            // 2. 순번/코드 제거 (예: "32 ", "112 ", "64 ", "ㄴ ", "- ")
            // 주의: "26종" 같은건 지우면 안됨. 숫자 뒤에 공백이나 기호가 있는 경우만 제거
            namePart = namePart.replace(/^[\d]+\s+/, '');
            namePart = namePart.replace(/^[ㄴ\-•·\s]+/, '');
            // 한번 더 체크 (예: "치료비" 지우고 났더니 "112 "가 남은 경우)
            namePart = namePart.replace(/^[\d]+\s+/, '');
            // 3. 끝부분 공백/점 제거
            namePart = namePart.replace(/[.\s]+$/, '');
            // 4. "세부보장참조" 제거
            namePart = namePart.replace(/세부보장참조/g, '').trim();
            // 5. 괄호 안 내용 정리
            // 맨 앞의 짧은 괄호만 제거 (예: "(무)암진단비" -> "암진단비")
            // 주의: non-greedy로 첫 번째 괄호쌍만 제거 ("(무)암(실속형)" -> "암(실속형)" 유지)
            namePart = namePart.replace(/^\([^)]*\)/, '').trim();
            // 6. [NEW] 끝부분에 붙은 숫자/코드 제거 (예: "상급종합병원116" -> "상급종합병원")
            // 패턴: 한글 뒤에 붙은 숫자들 제거
            namePart = namePart.replace(/([가-힣])\d+$/, '$1').trim();
            // E. 세부 내용(보험료, 납기/만기) 추출
            // 나머지 뒷부분에서 정보 추출
            // 예: "4천만원 15,560 20년 / 100세"
            // match[0]은 "4천만원" (금액 전체 매치)
            // 금액 뒷부분 자르기
            let suffix = trimmed.substring(match.index + match[0].length).trim();
            let premium = "-";
            let period = "-";
            // 1. 보험료 찾기 (숫자 + 콤마 조합, 보통 금액 바로 뒤에 옴)
            // 예: "15,560" 또는 "2,144"
            const premiumMatch = suffix.match(/([0-9,]+)/);
            if (premiumMatch) {
                premium = premiumMatch[1] + "원";
                // 보험료 찾았으면 그 뒤 내용에서 기간 찾기
                suffix = suffix.substring(premiumMatch.index + premiumMatch[0].length).trim();
            }
            // 2. 납기/만기 찾기 (예: "20년 / 100세", "20년/100세")
            // 패턴: "숫자년" 또는 "숫자세"가 포함된 문자열
            const periodMatch = suffix.match(/([0-9]+\s*년\s*\/?[^]*)/);
            if (periodMatch) {
                period = periodMatch[1].trim();
            }
            // D. 담보명 유효성 체크
            // - 너무 짧으면(1글자) 제외
            // - 너무 길면(50글자 이상) 설명문일 확률 높음 -> 제외
            // - 문장형 어미로 끝나면 제외 ("다", "요", "음", "함")
            // D. 담보명 유효성 체크
            // - 너무 짧으면(1글자) 제외
            // - 너무 길면(120글자 이상) 설명문일 확률 높음 -> 제외
            // - 문장형 어미로 끝나면 제외 ("다", "요", "음", "함")
            if (namePart.length > 1 && namePart.length < 120) {
                const lastChar = namePart.slice(-1);
                if (!['다', '요', '음', '함', '는', '은'].includes(lastChar)) {
                    results.push({
                        id: originalIdx,
                        name: namePart,
                        amount: amountStr,
                        premium: premium,
                        period: period,
                        original: trimmed
                    });
                } else {
                    console.log(`Skipped (sentence end): ${namePart}`);
                }
            } else {
                console.log(`Skipped (length): ${namePart} (${namePart.length} chars)`);
            }
        }
    });
    console.log(`extractRawCoverages: ${results.length}건 추출 완료 (전체 ${targetLines.length}줄 분석)`);
    return results;
}
