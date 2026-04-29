// ── Samsung Fire Insurance (삼성화재) Coverage Config ──
// samsungCoverageDetailsMap: 삼성화재 담보명 → 세부항목 매핑
// 기존 coverageDetailsMap과 동일한 구조를 따름 (js/config.js 참조)

const samsungCoverageDetailsMap = {
    // 담보 57: 종합병원 암 전액본인부담(비급여포함) 통합치료비
    // 표준형 1억 / 실속형 5천만
    "종합병원 암 전액본인부담(비급여포함) 통합치료비": {
        type: "variant",
        data: {
            "10000": [ // 표준형 1억원
                { name: "(수술 회당) 암 수술비", amount: "1,000만" },
                { name: "(연1회) 항암방사선치료비", amount: "1,000만" },
                { name: "(연1회) 항암약물치료비", amount: "1,000만" },
                { name: "(연1회) 다빈치로봇수술비(암, 특정암 제외)", amount: "1,000만" },
                { name: "(연1회) 다빈치로봇수술비(특정암)", amount: "500만" },
                { name: "(연1회) 항암양성자방사선치료비", amount: "3,000만" },
                { name: "(연1회) 표적항암약물허가치료비", amount: "3,000만" },
                { name: "(연1회) 면역항암약물허가치료비", amount: "3,000만" }
            ],
            "5000": [ // 실속형 5천만원
                { name: "(수술 회당) 암 수술비", amount: "1,000만" },
                { name: "(연1회) 항암방사선치료비", amount: "1,000만" },
                { name: "(연1회) 항암약물치료비", amount: "1,000만" },
                { name: "(연1회) 다빈치로봇수술비(암, 특정암 제외)", amount: "1,000만" },
                { name: "(연1회) 다빈치로봇수술비(특정암)", amount: "500만" },
                { name: "(연1회) 항암양성자방사선치료비", amount: "1,000만" },
                { name: "(연1회) 표적항암약물허가치료비", amount: "1,000만" },
                { name: "(연1회) 면역항암약물허가치료비", amount: "1,000만" }
            ]
        }
    },

    // 담보 86: 종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)
    "종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)": {
        type: "passthrough-dual",
        displayName: "암 특정치료비Ⅲ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // 담보 87: 종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)
    "종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)": {
        type: "passthrough-dual",
        displayName: "유사암Ⅱ 특정치료비Ⅲ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // 담보 53: 종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(암(유사암Ⅱ제외))
    "종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(암(유사암Ⅱ제외))": {
        type: "passthrough",
        displayName: "(연1회) 특정항암호르몬약물허가치료비Ⅱ(암)"
    },

    // 담보 53 (쌍): 종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(유사암Ⅱ)
    "종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(유사암Ⅱ)": {
        type: "passthrough",
        displayName: "(연1회) 특정항암호르몬약물허가치료비Ⅱ(유사암)"
    },

    // 담보 110: 항암 중입자방사선 치료비
    "항암 중입자방사선 치료비": {
        type: "passthrough",
        displayName: "(최초1회) 항암중입자방사선치료비"
    },

    // 담보 104: 하이클래스 암 특정치료비 (비급여 수술+항암방사선+항암약물, 가입금액만큼)
    "하이클래스 암 특정치료비": {
        type: "passthrough-dual",
        displayName: "하이클래스 암 특정치료비",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // 담보 97: 암 종합병원 중환자실 입원지원금(연간1회한)
    "암 종합병원 중환자실 입원지원금(연간1회한)": {
        type: "passthrough",
        displayName: "(연1회) 암 중환자실 입원지원금"
    }
};

// ── findSamsungDetails: 키워드 매칭으로 담보명 → samsungCoverageDetailsMap 항목 반환 ──
function findSamsungDetails(itemName) {
    // 1. 통합치료비 → 종합병원 암 전액본인부담(비급여포함) 통합치료비 (variant)
    if (itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["종합병원 암 전액본인부담(비급여포함) 통합치료비"];
    }

    // 2. 특정치료비Ⅲ / 특정치료비III
    if (itemName.includes("특정치료비") && (itemName.includes("Ⅲ") || itemName.includes("III"))) {
        if (itemName.includes("유사암")) {
            return samsungCoverageDetailsMap["종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)"];
        } else {
            return samsungCoverageDetailsMap["종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)"];
        }
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

    // 5. 중환자실 입원지원금 또는 (중환자실 + 암)
    if (itemName.includes("중환자실 입원지원금") || (itemName.includes("중환자실") && itemName.includes("암"))) {
        return samsungCoverageDetailsMap["암 종합병원 중환자실 입원지원금(연간1회한)"];
    }

    return null;
}

// ── 카테고리 계층: 부모 summaryTarget → 자동 포함되는 하위 카드 키 ──
const CATEGORY_HIERARCHY = {
    "암수술비": ["다빈치로봇수술비"],
    "항암방사선치료비": ["양성자방사선치료비", "중입자방사선치료비", "세기조절방사선치료비"],
    "항암약물치료비": ["표적항암약물치료비", "면역항암약물치료비"]
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
            details = [{ name: details.displayName, amount: item.amount }];
        }

        // Handle Passthrough-Dual (여러 summaryTargets에 동시 반영, 계층 하위 카드 자동 포함)
        if (details && details.type === 'passthrough-dual') {
            const displayName = details.displayName;
            const expandedTargets = [];
            details.summaryTargets.forEach(target => {
                if (!expandedTargets.includes(target)) expandedTargets.push(target);
                (CATEGORY_HIERARCHY[target] || []).forEach(child => {
                    if (!expandedTargets.includes(child)) expandedTargets.push(child);
                });
            });
            details = expandedTargets.map(t => ({
                name: displayName,
                amount: item.amount,
                targetName: t
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
                } else if (groupingSource.includes("면역") || groupingSource.includes("호르몬")) {
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
                    hiddenInDetail: det.hiddenInDetail,
                    sub: det.sub
                });
                // Update display name (pick longest readable name)
                if (det.name.length > group.displayName.length || group.displayName === normalizedName) {
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
