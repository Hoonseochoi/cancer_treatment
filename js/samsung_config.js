// ── Samsung Fire Insurance (삼성화재) Coverage Config ──
// samsungCoverageDetailsMap: 삼성화재 담보명 → 세부항목 매핑
// 기존 coverageDetailsMap과 동일한 구조를 따름 (js/config.js 참조)
// ※ 메리츠 로직(js/config.js, js/analyzer.js)과 완전히 독립 — 이 파일만 삼성 전용

const samsungCoverageDetailsMap = {
    // ── 담보 50: 종합병원 암 통합치료비(고급형) — 연간 1.2억 한도 ──
    "종합병원 암 통합치료비(고급형)": {
        type: "variant",
        data: {
            "12000": [ // 고급형 1억2,000만원
                { name: "(수술 회당) 암 수술비(암)", amount: "1,500만" },
                { name: "(수술 회당) 암 수술비(유사암Ⅱ)", amount: "600만" },
                { name: "(연1회) 항암방사선치료비(암)", amount: "1,500만" },
                { name: "(연1회) 항암방사선치료비(유사암Ⅱ)", amount: "600만" },
                { name: "(연1회) 항암약물치료비(암)", amount: "1,500만" },
                { name: "(연1회) 항암약물치료비(유사암Ⅱ)", amount: "600만" },
                { name: "(연1회) 중환자실 입원지원금", amount: "500만" },
                { name: "(연1회) 특정항암호르몬약물허가치료Ⅱ(암)", amount: "300만" },
                { name: "(연1회) 특정항암호르몬약물허가치료Ⅱ(유사암Ⅱ)", amount: "60만" },
                { name: "(연1회) 다빈치로봇수술비(암, 특정암 제외)", amount: "1,000만" },
                { name: "(연1회) 다빈치로봇수술비(특정암)", amount: "500만" },
                { name: "(연1회) 항암양성자방사선치료비", amount: "3,000만" },
                { name: "(연1회) 표적항암약물허가치료비", amount: "3,000만" },
                { name: "(연1회) 면역항암약물허가치료비", amount: "3,000만" }
            ]
        }
    },

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

    // 담보 97: 암 종합병원 중환자실 입원지원금(연간1회한)
    "암 종합병원 중환자실 입원지원금(연간1회한)": {
        type: "passthrough",
        displayName: "(연1회) 암 중환자실 입원지원금"
    },

    // ── 담보 76: 종합병원 암(유사암Ⅱ제외) 특정치료비Ⅱ(패키지) ──
    "종합병원 암(유사암Ⅱ제외) 특정치료비Ⅱ(패키지)": {
        type: "passthrough-dual",
        displayName: "암 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // ── 담보 77: 종합병원 유사암Ⅱ 특정치료비Ⅱ(패키지) ──
    "종합병원 유사암Ⅱ 특정치료비Ⅱ(패키지)": {
        type: "passthrough-dual",
        displayName: "유사암Ⅱ 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // ── 담보 85: 종합병원 전이암(특정뇌및림프절암제외) 특정치료비Ⅱ ──
    "종합병원 전이암(특정뇌및림프절암제외) 특정치료비Ⅱ": {
        type: "passthrough-dual",
        displayName: "전이암 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // ── 담보 104/71: 하이클래스 암 특정치료비(진단 후 10년, 연간1회한) ──
    // 비급여 전액본인부담 → 표적·면역·양성자·중입자·로봇·세기조절 포함 전 카테고리에 반영
    "하이클래스 암 특정치료비": {
        type: "passthrough-dual",
        displayName: "(비급여) 하이클래스 암 특정치료비",
        summaryTargets: [
            "암수술비", "항암방사선치료비", "항암약물치료비",
            "표적항암약물치료비", "면역항암약물치료비",
            "양성자방사선치료비", "중입자방사선치료비",
            "다빈치로봇수술비", "세기조절방사선치료비"
        ]
    },

    // ── 담보 72: 하이클래스 항암약물치료비(진단 후 10년, 연간1회한) ──
    "하이클래스 항암약물치료비(진단 후 10년, 연간1회한)": {
        type: "passthrough",
        displayName: "(비급여) 하이클래스 항암약물치료비"
    },

    // ── 담보 79: 종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅱ (패키지 아님) ──
    "종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅱ": {
        type: "passthrough-dual",
        displayName: "암 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // ── 담보 84: 종합병원 10대주요암 특정치료비Ⅱ ──
    "종합병원 10대주요암 특정치료비Ⅱ": {
        type: "passthrough-dual",
        displayName: "10대주요암 특정치료비Ⅱ(수술·항암방사선·항암약물)",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // ── 담보 59/98: 암 진단후 암특정치료비(진단후10년,연간1회한) ──
    "암(기타피부암및갑상선암제외) 진단후 암특정치료비(진단후10년,연간1회한)": {
        type: "passthrough-dual",
        displayName: "(연1회) 진단후 암 특정치료비",
        summaryTargets: ["암수술비", "항암방사선치료비", "항암약물치료비"]
    },

    // ── 담보 106: 암 치료비 지원Ⅲ ──
    "암 치료비 지원Ⅲ": {
        type: "passthrough",
        displayName: "(최초1회) 암 치료비 지원Ⅲ"
    },

    // ── 담보 107: 항암방사선·약물 치료비Ⅲ(기타피부암 및 갑상선암) ──
    "항암방사선·약물 치료비Ⅲ(기타피부암 및 갑상선암)": {
        type: "passthrough",
        displayName: "(최초1회) 항암방사선·약물치료비Ⅲ(기타피부암·갑상선암)"
    },

    // ── 담보 108: 항암방사선·약물 치료비Ⅲ(암(기타피부암 및 갑상선암 제외)) ──
    "항암방사선·약물 치료비Ⅲ(암(기타피부암 및 갑상선암 제외))": {
        type: "passthrough",
        displayName: "(최초1회) 항암방사선·약물치료비Ⅲ(암)"
    },

    // ── 담보 109: 계속받는 항암방사선·약물 치료비(연간1회한) 3종 ──
    "계속받는 항암방사선·약물 치료비(연간1회한)(암(기타피부암 및 갑상선암 제외))": {
        type: "passthrough",
        displayName: "(연1회) 계속받는 항암방사선·약물치료비(암)"
    },
    "계속받는 항암방사선·약물 치료비(연간1회한)(기타피부암)": {
        type: "passthrough",
        displayName: "(연1회) 계속받는 항암방사선·약물치료비(기타피부암)"
    },
    "계속받는 항암방사선·약물 치료비(연간1회한)(갑상선암)": {
        type: "passthrough",
        displayName: "(연1회) 계속받는 항암방사선·약물치료비(갑상선암)"
    },

    // ── 담보 111: 항암 방사선 치료비 2종 ──
    "항암 방사선 치료비(암(기타피부암 및 갑상선암 제외))": {
        type: "passthrough",
        displayName: "(최초1회) 항암방사선치료비(암)"
    },
    "항암 방사선 치료비(기타피부암 및 갑상선암)": {
        type: "passthrough",
        displayName: "(최초1회) 항암방사선치료비(기타피부암·갑상선암)"
    },

    // ── 담보 112: 표적항암약물허가 치료비 (standalone, 갱신형) ──
    "표적항암약물허가 치료비": {
        type: "passthrough",
        displayName: "(최초1회) 표적항암약물허가치료비"
    },

    // ── 담보 113: 전액본인부담(비급여포함) 표적항암약물허가 치료비 ──
    "전액본인부담(비급여포함) 표적항암약물허가 치료비": {
        type: "passthrough",
        displayName: "(최초1회) 전액본인부담 표적항암약물허가치료비"
    },

    // ── 담보 114: 항암 양성자방사선 치료비 (standalone, 갱신형) ──
    "항암 양성자방사선 치료비": {
        type: "passthrough",
        displayName: "(최초1회) 항암양성자방사선치료비"
    },

    // ── 담보 115: 항암 세기조절방사선 치료비 (갱신형) ──
    "항암 세기조절방사선 치료비": {
        type: "passthrough",
        displayName: "(최초1회) 항암세기조절방사선치료비"
    }
};

// ── findSamsungDetails: 키워드 매칭으로 담보명 → samsungCoverageDetailsMap 항목 반환 ──
// ※ 삼성화재 전용 — 메리츠 로직(config.js)과 완전히 독립
function findSamsungDetails(itemName) {
    // 1-a. 고급형 통합치료비 (담보 50) — 반드시 일반 통합치료비보다 먼저 확인
    if (itemName.includes("통합치료비") && itemName.includes("고급형")) {
        return samsungCoverageDetailsMap["종합병원 암 통합치료비(고급형)"];
    }

    // 1-b. 전액본인부담 통합치료비 / 표준형·실속형 (담보 57)
    if (itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["종합병원 암 전액본인부담(비급여포함) 통합치료비"];
    }

    // 2-a. 특정치료비Ⅲ / 특정치료비III (기존 담보 86, 87)
    if (itemName.includes("특정치료비") && (itemName.includes("Ⅲ") || itemName.includes("III"))) {
        if (itemName.includes("유사암")) {
            return samsungCoverageDetailsMap["종합병원 유사암Ⅱ 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)"];
        }
        return samsungCoverageDetailsMap["종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅲ(수술(회당),항암방사선,항암약물)"];
    }

    // 2-b. 특정치료비Ⅱ(패키지) (담보 76, 77)
    if (itemName.includes("특정치료비") && itemName.includes("Ⅱ") && itemName.includes("패키지")) {
        if (itemName.includes("유사암")) {
            return samsungCoverageDetailsMap["종합병원 유사암Ⅱ 특정치료비Ⅱ(패키지)"];
        }
        return samsungCoverageDetailsMap["종합병원 암(유사암Ⅱ제외) 특정치료비Ⅱ(패키지)"];
    }

    // 2-c-1. 10대주요암 특정치료비Ⅱ (담보 84)
    if (itemName.includes("10대주요암") || itemName.includes("10대 주요암")) {
        return samsungCoverageDetailsMap["종합병원 10대주요암 특정치료비Ⅱ"];
    }

    // 2-c-2. 특정치료비Ⅱ (패키지 없음, 담보 79)
    if (itemName.includes("특정치료비") && itemName.includes("Ⅱ") && !itemName.includes("패키지")) {
        if (!itemName.includes("유사암") || itemName.includes("제외")) {
            return samsungCoverageDetailsMap["종합병원 암(유사암Ⅱ 제외) 특정치료비Ⅱ"];
        }
    }

    // 2-c. 전이암 특정치료비Ⅱ (담보 85)
    if (itemName.includes("전이암") && itemName.includes("특정치료비")) {
        return samsungCoverageDetailsMap["종합병원 전이암(특정뇌및림프절암제외) 특정치료비Ⅱ"];
    }

    // 3. 항암호르몬약물허가 / 호르몬약물 (기존 담보 53)
    if (itemName.includes("항암호르몬") || itemName.includes("호르몬약물")) {
        if (itemName.includes("유사암")) {
            return samsungCoverageDetailsMap["종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(유사암Ⅱ)"];
        }
        return samsungCoverageDetailsMap["종합병원 특정항암호르몬약물허가 치료비Ⅱ(연간1회한)(암(유사암Ⅱ제외))"];
    }

    // 4. 중입자방사선 (담보 110, 116)
    if (itemName.includes("중입자방사선")) {
        return samsungCoverageDetailsMap["항암 중입자방사선 치료비"];
    }

    // 5. 중환자실 입원지원금 (기존 담보 97)
    if (itemName.includes("중환자실 입원지원금") || (itemName.includes("중환자실") && itemName.includes("암"))) {
        return samsungCoverageDetailsMap["암 종합병원 중환자실 입원지원금(연간1회한)"];
    }

    // 6-a. 하이클래스 항암약물치료비 (담보 72) — 일반 하이클래스보다 먼저
    if (itemName.includes("하이클래스") && itemName.includes("항암약물")) {
        return samsungCoverageDetailsMap["하이클래스 항암약물치료비(진단 후 10년, 연간1회한)"];
    }

    // 6-b. 하이클래스 암 특정치료비 (담보 71/104)
    if (itemName.includes("하이클래스")) {
        return samsungCoverageDetailsMap["하이클래스 암 특정치료비"];
    }

    // 7. 암 치료비 지원Ⅲ (담보 61/106)
    if (itemName.includes("치료비 지원") || itemName.includes("치료비지원")) {
        return samsungCoverageDetailsMap["암 치료비 지원Ⅲ"];
    }

    // 8. 진단후 암특정치료비 (담보 59/98)
    if (itemName.includes("진단후") && itemName.includes("특정치료비")) {
        return samsungCoverageDetailsMap["암(기타피부암및갑상선암제외) 진단후 암특정치료비(진단후10년,연간1회한)"];
    }

    // 9. 계속받는 항암방사선·약물 치료비 3종 (담보 109) — "약물" 포함 분기보다 먼저
    if (itemName.includes("계속받는")) {
        if (itemName.includes("기타피부암")) {
            return samsungCoverageDetailsMap["계속받는 항암방사선·약물 치료비(연간1회한)(기타피부암)"];
        }
        if (itemName.includes("갑상선암")) {
            return samsungCoverageDetailsMap["계속받는 항암방사선·약물 치료비(연간1회한)(갑상선암)"];
        }
        return samsungCoverageDetailsMap["계속받는 항암방사선·약물 치료비(연간1회한)(암(기타피부암 및 갑상선암 제외))"];
    }

    // 9. 항암방사선·약물 치료비Ⅲ (담보 107, 108) — "Ⅲ" 포함
    if ((itemName.includes("방사선") && itemName.includes("약물")) && itemName.includes("Ⅲ")) {
        if (itemName.includes("기타피부암") || itemName.includes("갑상선암")) {
            return samsungCoverageDetailsMap["항암방사선·약물 치료비Ⅲ(기타피부암 및 갑상선암)"];
        }
        return samsungCoverageDetailsMap["항암방사선·약물 치료비Ⅲ(암(기타피부암 및 갑상선암 제외))"];
    }

    // 10. 항암 방사선 치료비 2종 (담보 111) — 약물 없이 방사선만
    if (itemName.includes("항암") && itemName.includes("방사선 치료비") && !itemName.includes("약물")) {
        if (itemName.includes("기타피부암") || itemName.includes("갑상선암")) {
            return samsungCoverageDetailsMap["항암 방사선 치료비(기타피부암 및 갑상선암)"];
        }
        return samsungCoverageDetailsMap["항암 방사선 치료비(암(기타피부암 및 갑상선암 제외))"];
    }

    // 11. 양성자방사선 치료비 standalone (담보 114) — 통합치료비 안의 양성자와 구분
    if (itemName.includes("양성자방사선") && !itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["항암 양성자방사선 치료비"];
    }

    // 12. 세기조절방사선 치료비 (담보 115)
    if (itemName.includes("세기조절방사선")) {
        return samsungCoverageDetailsMap["항암 세기조절방사선 치료비"];
    }

    // 13. 전액본인부담 표적항암약물허가 치료비 (담보 113) — 일반 표적보다 먼저
    if (itemName.includes("전액본인부담") && itemName.includes("표적")) {
        return samsungCoverageDetailsMap["전액본인부담(비급여포함) 표적항암약물허가 치료비"];
    }

    // 14. 표적항암약물허가 치료비 standalone (담보 112) — 통합치료비 안의 표적과 구분
    if (itemName.includes("표적") && !itemName.includes("통합치료비")) {
        return samsungCoverageDetailsMap["표적항암약물허가 치료비"];
    }

    return null;
}

// ── calculateHierarchicalSummarySamsung: 삼성화재 버전 계층적 요약 계산 ──
// js/analyzer.js의 calculateHierarchicalSummary와 동일한 로직
// samsungCoverageDetailsMap / findSamsungDetails 사용, 26종 분기 제거
function calculateHierarchicalSummarySamsung(results) {
    const summaryMap = new Map();

    // 유사암 전용 담보 판별: "유사암" 포함 + "제외" 미포함
    const isYuSaAmOnly = (name) => name.includes("유사암") && !name.includes("제외");

    results.forEach(item => {
        // source 담보 자체가 유사암 전용이면 스킵
        if (isYuSaAmOnly(item.name)) return;

        let details = samsungCoverageDetailsMap[item.name];

        // Dictionary Lookup (Fallback: 키워드 매칭)
        if (!details) {
            details = findSamsungDetails(item.name);
        }

        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            // Fallback: approximate tier matching (고급형 12000 포함)
            if (!variantData) {
                if (amountVal > 11000) variantData = details.data["12000"] || details.data["10000"];
                else if (amountVal > 6000) variantData = details.data["10000"] || details.data["8000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
                if (!variantData && details.data["12000"]) variantData = details.data["12000"];
                if (!variantData && details.data["10000"]) variantData = details.data["10000"];
                if (!variantData && details.data["5000"]) variantData = details.data["5000"];
            }
            details = variantData;
        }

        // Handle Passthrough Type (자기 금액 그대로 사용)
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }

        // Handle Passthrough-Dual (여러 summaryTargets에 동시 반영)
        if (details && details.type === 'passthrough-dual') {
            details = details.summaryTargets.map(t => ({
                name: details.displayName,
                amount: item.amount,
                targetName: t
            }));
        }

        if (details && Array.isArray(details)) {
            details.forEach(det => {
                // 세부항목이 유사암 전용이면 스킵
                if (isYuSaAmOnly(det.name)) return;

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
                // Dedup: same name+amount already in group → skip (prevents double-counting갱신형)
                const dupKey = det.name + '|' + det.amount;
                if (group.items.some(ex => ex.name + '|' + ex.amount === dupKey)) return;
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
