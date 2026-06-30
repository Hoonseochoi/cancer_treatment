// ── Samsung Fire Insurance (삼성화재) Coverage Config ──
// samsungCoverageDetailsMap: 삼성화재 담보명 → 세부항목 매핑
// 기존 coverageDetailsMap과 동일한 구조를 따름 (js/config.js 참조)

const samsungCoverageDetailsMap = {
    // 담보 57: 종합병원 암 전액본인부담(비급여포함) 통합치료비
    // 표준형 1억 / 실속형 5천만
    "종합병원 암 전액본인부담(비급여포함) 통합치료비": {
        type: "variant",
        data: {
            "10000": [ // 표준형 1억원 — 전항목 비급여(전액본인부담) 보장
                { name: "암 수술비", amount: "1,000만", 비급여: true },
                { name: "항암방사선치료비", amount: "1,000만", 비급여: true },
                { name: "항암약물치료비", amount: "1,000만", 비급여: true },
                { name: "다빈치로봇수술비(암, 특정암 제외)", amount: "1,000만", 비급여: true },
                { name: "다빈치로봇수술비(특정암)", amount: "500만", 비급여: true },
                { name: "항암양성자방사선치료비", amount: "3,000만", 비급여: true },
                { name: "표적항암약물허가치료비", amount: "3,000만", 비급여: true },
                { name: "면역항암약물허가치료비", amount: "3,000만", 비급여: true }
            ],
            "5000": [ // 실속형 5천만원 — 전항목 비급여(전액본인부담) 보장
                { name: "암 수술비", amount: "1,000만", 비급여: true },
                { name: "항암방사선치료비", amount: "1,000만", 비급여: true },
                { name: "항암약물치료비", amount: "1,000만", 비급여: true },
                { name: "다빈치로봇수술비(암, 특정암 제외)", amount: "1,000만", 비급여: true },
                { name: "다빈치로봇수술비(특정암)", amount: "500만", 비급여: true },
                { name: "항암양성자방사선치료비", amount: "1,000만", 비급여: true },
                { name: "표적항암약물허가치료비", amount: "1,000만", 비급여: true },
                { name: "면역항암약물허가치료비", amount: "1,000만", 비급여: true }
            ]
        }
    },

    // 담보 86: 종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)
    // 비급여 수술·항암방사선·항암약물 포괄 → 표적/면역/양성자 등 하위 포함
    "종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)": {
        type: "passthrough-dual",
        displayName: "암 특정치료비Ⅲ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        비급여: true
    },

    // 담보 87: 종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)
    "종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)": {
        type: "passthrough-dual",
        displayName: "유사암Ⅱ 특정치료비Ⅲ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        비급여: true
    },

    // 담보 134: 상급종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술 입통원1회당)
    "상급종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ": {
        type: "passthrough-dual",
        displayName: "상급종합병원 암 특정치료비Ⅲ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        비급여: true
    },

    // 담보 135: 상급종합병원 유사암Ⅱ 특정치료비Ⅲ(수술 입통원1회당)
    "상급종합병원 유사암Ⅱ 특정치료비Ⅲ": {
        type: "passthrough-dual",
        displayName: "상급종합병원 유사암Ⅱ 특정치료비Ⅲ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        비급여: true
    },

    // 담보 79: 종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅱ — 급여 전용, 수술·항암방사선·항암약물 (다빈치/양성자/표적/면역 미포함)
    "종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅱ": {
        type: "passthrough-dual",
        displayName: "암 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        expandHierarchy: false // 급여 담보: 다빈치/양성자/표적/면역은 비급여 특정치료비Ⅱ에만 포함
    },

    // 담보 80: 종합병원 유사암Ⅱ 특정치료비Ⅱ — 급여+비급여 모두
    "종합병원 유사암Ⅱ 특정치료비Ⅱ": {
        type: "passthrough-dual",
        displayName: "유사암Ⅱ 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // 담보 83: 종합병원 암(기타피부암 및 갑상선암 포함) 전액본인부담(비급여포함) 특정치료비Ⅱ — 비급여만
    "종합병원 암(기타피부암 및 갑상선암 포함) 전액본인부담(비급여포함) 특정치료비Ⅱ": {
        type: "passthrough-dual",
        displayName: "암 전액본인부담 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        비급여: true
    },

    // 담보 53: 종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(암(유사암Ⅱ제외))
    "종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(암(유사암Ⅱ제외))": {
        type: "passthrough",
        displayName: "특정항암호르몬약물허가치료비Ⅱ(암)"
    },

    // 담보 53 (쌍): 종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(유사암Ⅱ)
    "종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(유사암Ⅱ)": {
        type: "passthrough",
        displayName: "특정항암호르몬약물허가치료비Ⅱ(유사암)"
    },

    // 담보 110: 항암 중입자방사선 치료비
    "항암 중입자방사선 치료비": {
        type: "passthrough",
        displayName: "항암중입자방사선치료비"
    },

    // 담보 104: 하이클래스 암 특정치료비 (비급여 수술+항암방사선+항암약물, 가입금액만큼)
    "하이클래스 암 특정치료비": {
        type: "passthrough-dual",
        displayName: "하이클래스 암 특정치료비",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"],
        비급여: true
    },

    // 담보 97: 암 종합병원 중환자실 입원지원금(연간1회한)
    "암 종합병원 중환자실 입원지원금(연간1회한)": {
        type: "passthrough",
        displayName: "암 중환자실 입원지원금"
    },

    // 담보 200: 암(특정암 제외) 다빈치로봇 수술비 [갱신형]
    "암(특정암 제외) 다빈치로봇 수술비": {
        type: "passthrough",
        summaryTarget: "다빈치로봇수술비",
        displayName: "다빈치로봇수술비(암, 특정암 제외)"
    },

    // 담보 201: 특정암 다빈치로봇 수술비 [갱신형]
    "특정암 다빈치로봇 수술비": {
        type: "passthrough",
        summaryTarget: "다빈치로봇수술비",
        displayName: "다빈치로봇수술비(특정암)"
    },

    // 담보 184: 항암 방사선 치료비 단독 (갱신형, 급여)
    "항암 방사선 치료비(기타피부암및갑상선암이외의암)": {
        type: "passthrough",
        summaryTarget: "항암방사선치료비",
        displayName: "항암방사선치료비"
    },

    // 담보 186: 항암방사선·약물 치료비Ⅲ (갱신형, 일반암, 비급여) — 수술비 미포함
    "암(유사암Ⅱ 제외) 항암방사선·약물 치료비Ⅲ": {
        type: "passthrough-dual",
        displayName: "암 항암방사선·약물치료비Ⅲ(방사선·약물)",
        summaryTargets: ["항암방사선치료비", "항암약물치료비"],
        expandHierarchy: false // 표적/면역/양성자 자동확장 금지
    },

    // 담보 196: 표적항암약물허가 치료비 (갱신형, 급여)
    "표적항암약물허가 치료비(연간1회한)(암(유사암Ⅱ 제외))": {
        type: "passthrough",
        summaryTarget: "표적항암약물치료비",
        displayName: "표적항암약물허가치료비"
    },

    // 담보 197: 전액본인부담(비급여포함) 표적항암약물허가 치료비 (갱신형, 비급여)
    "전액본인부담(비급여포함)표적항암약물허가 치료비": {
        type: "passthrough",
        summaryTarget: "표적항암약물치료비",
        displayName: "표적항암약물허가치료비",
        비급여: true
    },

    // 갱신형 항암양성자방사선치료비 단독 담보
    "항암양성자방사선치료비(갱신형)": {
        type: "passthrough",
        summaryTarget: "양성자방사선치료비",
        displayName: "항암양성자방사선치료비"
    },

    // 갱신형 특정면역항암약물허가치료비 단독 담보 (계속받는 포함)
    "특정면역항암약물허가치료비(갱신형)": {
        type: "passthrough",
        summaryTarget: "면역항암약물치료비",
        displayName: "특정면역항암약물허가치료비"
    },

    // 갱신형 암 수술비 단독 담보 (유사암 제외)
    "암수술비(갱신형)": {
        type: "passthrough",
        summaryTarget: "암수술비",
        displayName: "암 수술비(유사암 제외)"
    }
};

// ── findSamsungDetails: 키워드 매칭으로 담보명 → samsungCoverageDetailsMap 항목 반환 ──
function findSamsungDetails(itemName) {
    // 1. 통합치료비 → 종합병원 암 전액본인부담(비급여포함) 통합치료비 (variant)
    if (itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["종합병원 암 전액본인부담(비급여포함) 통합치료비"];
    }

    // 2. 특정치료비Ⅲ / 특정치료비III (상급종합병원 / 종합병원 구분)
    // 담보명에 "암/유사암"이 없는 특정치료비Ⅲ는 암 집계 대상 아님 (뇌혈관질환, 허혈성심장질환, 희귀질환 등 포함)
    if (itemName.includes("특정치료비") && (itemName.includes("Ⅲ") || itemName.includes("III"))) {
        if (!itemName.includes("암")) return null; // "암" 미포함 = 비암성 질환 담보 → 제외
        const isHighLevel = itemName.includes("상급종합병원");
        if (itemName.includes("유사암") && !itemName.includes("제외")) {
            return isHighLevel
                ? samsungCoverageDetailsMap["상급종합병원 유사암Ⅱ 특정치료비Ⅲ"]
                : samsungCoverageDetailsMap["종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)"];
        } else {
            return isHighLevel
                ? samsungCoverageDetailsMap["상급종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ"]
                : samsungCoverageDetailsMap["종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)"];
        }
    }

    // 2a. 특정치료비Ⅱ / 특정치료비II (Ⅲ과 구분, 전액본인부담·유사암 여부로 세분화)
    // 담보명에 "암/유사암"이 없으면 비암성 질환 담보 → 제외
    if ((itemName.includes("특정치료비Ⅱ") || itemName.includes("특정치료비II")) && !itemName.includes("Ⅲ") && !itemName.includes("III")) {
        if (!itemName.includes("암")) return null;
        if (itemName.includes("전액본인부담")) {
            return samsungCoverageDetailsMap["종합병원 암(기타피부암 및 갑상선암 포함) 전액본인부담(비급여포함) 특정치료비Ⅱ"];
        }
        if (itemName.includes("유사암") && !itemName.includes("제외")) {
            return null; // 유사암Ⅱ(갑상선암/기타피부암/제자리암/경계성종양) 특정치료비Ⅱ → 표시 안 함
        }
        return samsungCoverageDetailsMap["종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅱ"];
    }

    // 2-1. 다빈치로봇 수술비 단독 담보 (통합치료비 외 별도 담보)
    if (itemName.includes("다빈치") && !itemName.includes("통합치료비")) {
        if (itemName.includes("특정암") && !itemName.includes("제외")) {
            return samsungCoverageDetailsMap["특정암 다빈치로봇 수술비"];
        }
        return samsungCoverageDetailsMap["암(특정암 제외) 다빈치로봇 수술비"];
    }

    // 2-2. 항암방사선·약물 치료비Ⅲ (수술 제외, 방사선+약물만) — 특정치료비Ⅲ와 구분 필수
    if (itemName.includes("항암방사선") && itemName.includes("약물") && (itemName.includes("Ⅲ") || itemName.includes("III")) && !itemName.includes("특정치료비")) {
        // 기타피부암·갑상선암 전용("제외" 없음) = 유사암 담보 → null
        // "기타피부암 및 갑상선암 제외" = 일반암 버전 → 정상 매핑
        if (itemName.includes("기타피부암") && !itemName.includes("제외")) return null;
        return samsungCoverageDetailsMap["암(유사암Ⅱ 제외) 항암방사선·약물 치료비Ⅲ"];
    }

    // 2-3. 비급여 표적항암약물허가 치료비 (전액본인부담 버전)
    if (itemName.includes("전액본인부담") && itemName.includes("표적항암약물허가")) {
        return samsungCoverageDetailsMap["전액본인부담(비급여포함)표적항암약물허가 치료비"];
    }

    // 2-3b. 특정면역항암약물허가 치료비 단독 (갱신형, 계속받는 포함)
    if (itemName.includes("특정면역항암약물허가") || (itemName.includes("면역항암약물허가") && !itemName.includes("통합치료비"))) {
        return samsungCoverageDetailsMap["특정면역항암약물허가치료비(갱신형)"];
    }

    // 2-4. 표적항암약물허가 치료비 (급여 단독)
    if (itemName.includes("표적항암약물허가") && !itemName.includes("전액본인부담") && !itemName.includes("호르몬")) {
        return samsungCoverageDetailsMap["표적항암약물허가 치료비(연간1회한)(암(유사암Ⅱ 제외))"];
    }

    // 2-4b. 항암양성자방사선치료비 단독 (갱신형)
    if (itemName.includes("양성자방사선") && !itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["항암양성자방사선치료비(갱신형)"];
    }

    // 2-5. 항암방사선치료비 단독 (약물 미포함, 특정치료비 아님)
    if ((itemName.includes("항암 방사선 치료비") || itemName.includes("항암방사선치료비")) && !itemName.includes("약물") && !itemName.includes("특정치료비")) {
        // 기타피부암·갑상선암 전용(이외 없음) = 유사암 담보 → 제외
        if (itemName.includes("기타피부암") && !itemName.includes("이외")) return null;
        return samsungCoverageDetailsMap["항암 방사선 치료비(기타피부암및갑상선암이외의암)"];
    }

    // 3. 항암호르몬약물허가 / 호르몬약물
    if (itemName.includes("항암호르몬") || itemName.includes("호르몬약물")) {
        if (itemName.includes("유사암")) {
            return samsungCoverageDetailsMap["종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(유사암Ⅱ)"];
        } else {
            return samsungCoverageDetailsMap["종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(암(유사암Ⅱ제외))"];
        }
    }

    // 4. 중입자방사선
    if (itemName.includes("중입자방사선")) {
        return samsungCoverageDetailsMap["항암 중입자방사선 치료비"];
    }

    // 4-1. 하이클래스
    if (itemName.includes("하이클래스")) {
        return samsungCoverageDetailsMap["하이클래스 암 특정치료비"];
    }

    // 5. 암 중환자실 입원지원금 — 반드시 "암"이 포함된 경우만 매핑 (뇌혈관/허혈성심장/희귀질환 등 비암성 중환자실 담보 차단)
    if (itemName.includes("암") && itemName.includes("중환자실")) {
        return samsungCoverageDetailsMap["암 종합병원 중환자실 입원지원금(연간1회한)"];
    }

    // 6. 암 수술비 단독 (갱신형, 유사암 제외) — "유사암 제외" 명시된 경우만 매핑
    // 기타피부암/갑상선암/대장점막내암/제자리암 등 유사암 전용 수술비는 제외
    if (itemName.includes("수술비") && itemName.includes("암") && itemName.includes("유사암 제외") && !itemName.includes("다빈치") && !itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["암수술비(갱신형)"];
    }

    return null;
}

// ── 카테고리 계층: 부모 summaryTarget → 자동 포함되는 하위 카드 키 ──
const CATEGORY_HIERARCHY = {
    "암수술비": ["다빈치로봇수술비"],
    "항암방사선치료비": ["양성자방사선치료비", "중입자방사선치료비", "세기조절방사선치료비"],
    "항암약물치료비": ["표적항암약물치료비", "면역항암약물치료비"],
    "표적항암약물치료비": ["면역항암약물치료비"]  // 면역항암은 표적항암을 포함 (면역7천=면역3+표적3+비급여약물1)
};

// ── calculateHierarchicalSummarySamsung: 삼성화재 버전 계층적 요약 계산 ──
// js/analyzer.js의 calculateHierarchicalSummary와 동일한 로직
// samsungCoverageDetailsMap / findSamsungDetails 사용, 26종 분기 제거
function calculateHierarchicalSummarySamsung(results) {
    const summaryMap = new Map();

    results.forEach(item => {
        let details = samsungCoverageDetailsMap[item.name];

        // Dictionary Lookup (Fallback: 키워드 매칭)
        if (!details) {
            details = findSamsungDetails(item.name);
        }

        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            // Fallback: approximate tier matching
            if (!variantData) {
                if (amountVal > 6000) variantData = details.data["10000"] || details.data["8000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
                if (!variantData && details.data["10000"]) variantData = details.data["10000"];
                if (!variantData && details.data["5000"]) variantData = details.data["5000"];
            }
            details = variantData;
        }

        // Handle Passthrough Type (자기 금액 그대로 사용)
        if (details && details.type === 'passthrough') {
            const isBigugeom = details.비급여 || false;
            const tgt = details.summaryTarget || null;
            details = [{ name: details.displayName, amount: item.amount, 비급여: isBigugeom, ...(tgt ? { targetName: tgt } : {}) }];
        }

        // Handle Passthrough-Dual (여러 summaryTargets에 동시 반영)
        // expandHierarchy: false 이면 하위 카테고리 자동 포함 억제 (특정치료비Ⅲ 등)
        if (details && details.type === 'passthrough-dual') {
            const displayName = details.displayName;
            const shouldExpand = details.expandHierarchy !== false;
            const isBigugeom = details.비급여 || false;
            const directTargets = details.summaryTargets; // 명시적 대상 (확장 아님)
            const expandedTargets = [];
            directTargets.forEach(target => {
                if (!expandedTargets.includes(target)) expandedTargets.push(target);
                if (shouldExpand) {
                    (CATEGORY_HIERARCHY[target] || []).forEach(child => {
                        if (!expandedTargets.includes(child)) expandedTargets.push(child);
                    });
                }
            });
            details = expandedTargets.map(t => ({
                name: displayName,
                amount: item.amount,
                targetName: t,
                비급여: isBigugeom,
                _expansion: !directTargets.includes(t) // true = 확장항목, post-processing propagation에서 중복 방지용
            }));
        }

        if (details && Array.isArray(details)) {
            details.forEach(det => {
                // Normalize Name to find "Common Group"
                let groupingSource = det.targetName || det.name;
                let normalizedName = groupingSource;

                // [KEYWORD-BASED CATEGORIZATION]
                // 1. targetName이 명시적으로 있으면 최우선 적용
                if (det.targetName) {
                    normalizedName = det.targetName;
                }
                // 2. 그 외의 경우 키워드 매칭
                else if (groupingSource.includes("표적")) {
                    normalizedName = "표적항암약물치료비";
                } else if (groupingSource.includes("면역")) {
                    normalizedName = "면역항암약물치료비";
                } else if (groupingSource.includes("호르몬")) {
                    normalizedName = "항암호르몬약물치료비"; // 면역항암과 별개 → 사이드바로 분류
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
                } else if (groupingSource.includes("약물") && !groupingSource.includes("표적") && !groupingSource.includes("면역") && !groupingSource.includes("호르몬")) {
                    normalizedName = "항암약물치료비";
                } else if (groupingSource.includes("방사선") && !groupingSource.includes("양성자") && !groupingSource.includes("중입자") && !groupingSource.includes("세기")) {
                    normalizedName = "항암방사선치료비";
                } else {
                    // Fallback: Remove special chars
                    normalizedName = groupingSource.replace(/[^가-힣0-9]/g, '');
                }

                const amount = parseKoAmount(det.amount);
                if (!summaryMap.has(normalizedName)) {
                    summaryMap.set(normalizedName, {
                        displayName: normalizedName,
                        totalMin: 0,
                        totalMax: 0,
                        isolatedMin: 0, // passthrough-dual 확장 제외한 직접 금액
                        isolatedMax: 0,
                        isolatedOnceMin: 0,
                        isolatedOnceMax: 0,
                        items: [],
                        onceOnly: ONCE_ONLY_KEYS.has(normalizedName)
                    });
                }
                const group = summaryMap.get(normalizedName);
                // Amount Parsing (Support Range)
                const valMin = parseKoAmount(det.amount);
                const valMax = det.maxAmount ? parseKoAmount(det.maxAmount) : valMin;
                // 유사암/특정암 전용 담보는 합산금액에서 제외 (일반암 기준 표기)
                const sourceText = (item.name || '') + '|' + (det.name || '');
                const isYusamOnly = sourceText.includes("유사암") &&
                                    !sourceText.includes("유사암Ⅱ 제외") &&
                                    !sourceText.includes("유사암Ⅱ제외") &&
                                    !sourceText.includes("유사암 제외") &&
                                    !sourceText.includes("유사암제외");
                const isSpecificAmOnly = sourceText.includes("특정암") &&
                                         !sourceText.includes("특정암 제외") &&
                                         !sourceText.includes("특정암제외");
                if (!isYusamOnly && !isSpecificAmOnly) {
                    group.totalMin += valMin;
                    group.totalMax += valMax;
                    if (!det._expansion) {
                        group.isolatedMin += valMin;
                        group.isolatedMax += valMax;
                    }
                }
                // ── payFreq 결정 ──
                const srcIs26Jong_s  = /26종/.test(item.name) || /26종/.test(det.name || '');
                // 통합치료비/특정치료비Ⅱ/Ⅲ 소스 → ONCE_ONLY_KEYS 포함 모든 대상에서 연간1회
                const srcIsBundle_s  = /암진단|통합치료비|특정치료비/.test(item.name);
                let payFreq_s = '';
                if (srcIs26Jong_s) {
                    payFreq_s = 'once-each';
                } else if (ONCE_ONLY_KEYS.has(normalizedName)) {
                    payFreq_s = srcIsBundle_s ? 'annual' : 'once';
                } else if (/통합치료비|특정치료비/.test(item.name) || normalizedName === "암수술비") {
                    // 통합치료비/특정치료비 소스 및 암수술비 단독 담보 → 연간1회
                    payFreq_s = 'annual';
                }
                if (!det._expansion && (payFreq_s === 'once' || payFreq_s === 'once-each')) {
                    group.isolatedOnceMin += valMin;
                    group.isolatedOnceMax += valMax;
                }
                group.items.push({
                    name: det.name,
                    amount: det.amount,
                    maxAmount: det.maxAmount,
                    source: item.name,
                    hiddenInDetail: det.hiddenInDetail,
                    sub: det.sub,
                    비급여: det.비급여 || false,
                    _expansion: det._expansion || false,
                    payFreq: payFreq_s
                });
                // Update display name from direct (non-expansion) items only
                if (!det._expansion && (det.name.length > group.displayName.length || group.displayName === normalizedName)) {
                    let cleanName = det.name.replace(/\([^)]*\)/g, '').trim();
                    if (cleanName.length > 0) {
                        group.displayName = cleanName;
                    }
                }
            });
        }
    });

    // ── 상위→하위 카테고리 금액 누적 (포함관계 표현) ──
    // isolatedMin 기반 snapshot 사용: passthrough-dual 확장과의 이중계산 방지
    // 예: 항암약물(1천)→표적(3천→4천), 항암약물(1천)+표적(3천)→면역(3천→7천)
    const hierSnap = new Map();
    summaryMap.forEach((v, k) => hierSnap.set(k, {
        isolatedMin: v.isolatedMin,
        isolatedMax: v.isolatedMax,
        items: v.items.filter(i => !i._expansion) // 직접 항목만 전파
    }));
    // totalMin/Max를 isolatedMin/Max로 리셋 후 계층 누적으로 재계산
    summaryMap.forEach(v => { v.totalMin = v.isolatedMin; v.totalMax = v.isolatedMax; });
    Object.entries(CATEGORY_HIERARCHY).forEach(([parent, children]) => {
        const snap = hierSnap.get(parent);
        if (!snap || snap.isolatedMin === 0) return;
        children.forEach(child => {
            if (!summaryMap.has(child)) {
                summaryMap.set(child, { displayName: child, totalMin: 0, totalMax: 0, isolatedMin: 0, isolatedMax: 0, items: [], onceOnly: ONCE_ONLY_KEYS.has(child) });
            }
            const childGroup = summaryMap.get(child);
            childGroup.totalMin += snap.isolatedMin;
            childGroup.totalMax += snap.isolatedMax;
            // 부모 항목도 하위 카드에 추가 (포함관계 출처 표시용)
            snap.items.forEach(pItem => {
                const isDup = childGroup.items.some(ci => ci.name === pItem.name && ci.source === pItem.source);
                if (!isDup) childGroup.items.push({ ...pItem, fromParent: true });
            });
        });
    });

    return summaryMap;
}
