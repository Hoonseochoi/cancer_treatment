console.log('[score] v20260706c 로드됨 ✅');
// ── 담보 가치점수(암 치료비 점수) 계산 유틸 ──
// 설계 근거: C:\obsidian_hoons\Hoonseo\CANCER ANALAYSIS\담보_가치점수_설계_플랜.md (6장, v4 최종 확정판)
// 삼성/메리츠 공용 — summaryMap(calculateHierarchicalSummary*의 반환값)과 raw results 배열만 있으면 계산 가능.

// 9개 카드 own(직접) 가중치. 하위 카드로 자동전파되는 몫은 포함하지 않은 "고유" 비중이며,
// subtreeWeight(card)는 CATEGORY_HIERARCHY를 재귀 순회해 이 own 값들을 합산해 구한다(하드코딩 금지).
const SCORE_OWN_WEIGHTS = {
    "암수술비": 0.15,
    "다빈치로봇수술비": 0.06,
    "항암방사선치료비": 0.24,
    "양성자방사선치료비": 0.007,
    "중입자방사선치료비": 0.003,
    "세기조절방사선치료비": 0,
    "항암약물치료비": 0.24,
    "표적항암약물치료비": 0.20,
    "면역항암약물치료비": 0.10
};

// 배율→점수 환산 상수 (로그 압축 + 100점 상한)
// score = min(100, round(SCORE_LOG_SCALE × ln(1 + valueMultiple)))
// 근거: samsung_proposals 183건(설계번호 유니크 111건) 실측 배율 분포는 중앙값 3.1배,
// 최대 30배+(온통보장 live 기준 199배)로 우측 꼬리가 매우 길어 선형(×10)은 상한이 없고
// "평균 OO점" 문구와 공존 불가 → 로그 압축으로 0~100 스케일에 자연스럽게 안착시킴.
// (담보_가치점수_설계_플랜.md 6-4 참고)
const SCORE_LOG_SCALE = 25;
const SCORE_CAP = 100;
// 잠정 평균 벤치마크. 실측(로그 스케일 기준 중앙값 35~38점대) 근거로 40점 설정,
// 데이터가 더 쌓이면 실측 평균/백분위로 교체 예정.
const SCORE_PROVISIONAL_AVERAGE = 40;

// ── v5.2: 항암약물치료비 단일 절대금액 게이트 ──
// "넓은 담보(온통보장류)만 있어도 좁은 특화(표적/면역)에 빵만 키운 설계와 동일하게
// 만점이 나오는" 문제를 막기 위해, 가장 넓은 카드(항암약물치료비, subtreeWeight 54%)의
// own 5년가치가 이 기준액 미만이면 점수를 비례해서 깎는다(기준액 이상이면 게이트 통과, 1.0).
// 사용자 확정치: 3,000만원 (담보_가치점수_설계_플랜.md 6-5-3 v5.2 참고)
const SCORE_GATE_THRESHOLD_5Y = 3000;

// card의 CATEGORY_HIERARCHY 하위 전체(중복 제거)를 Set으로 반환
function getScoreSubtreeDescendants(card) {
    const visited = new Set();
    (function walk(node) {
        const children = (typeof CATEGORY_HIERARCHY !== 'undefined' ? CATEGORY_HIERARCHY[node] : null) || [];
        children.forEach(child => {
            if (!visited.has(child)) {
                visited.add(child);
                walk(child);
            }
        });
    })(card);
    return visited;
}

// subtreeWeight(card) = ownWeight(card) + Σ ownWeight(d), d는 고유 descendant 집합(DAG 중복 제거)
function getSubtreeWeight(card) {
    let weight = SCORE_OWN_WEIGHTS[card] || 0;
    getScoreSubtreeDescendants(card).forEach(d => {
        weight += SCORE_OWN_WEIGHTS[d] || 0;
    });
    return weight;
}

// 아이템 1건의 5년 기대가치(단위: 만원)
// - 최초1회/각각1회(payFreq: once, once-each): × 1
// - 연간1회(payFreq: annual, N=1) 또는 온통보장류 연간N회(annualCount/tierCount): × N × 5
function calcItemValue5y(item) {
    const amount = parseKoAmount(item.amount);
    if (!amount) return 0;
    if (item.payFreq === 'once' || item.payFreq === 'once-each') {
        return amount * 1;
    }
    const n = item.annualCount || item.tierCount || 1;
    return amount * n * 5;
}

// summaryMap(9카드 집계) + rawResults(원본 파싱 아이템 배열)로 담보 가치점수 계산
// 반환: { score, valueMultiple, expectedValue5y, totalPremium20y, average } 또는 보험료 파싱 불가 시 null
function calcCoverageScore(summaryMap, rawResults) {
    if (!summaryMap || !rawResults) return null;

    // [1~3단계] 카드별 own 아이템 5년가치 × subtreeWeight, 9개 카드 합산
    let expectedValue5y = 0;
    let drugCardValue5yOwn = 0; // v5.2 게이트용: 항암약물치료비의 own 5년가치(가중치 적용 전, 순수 금액)
    const cancerSourceNames = new Set();
    Object.keys(SCORE_OWN_WEIGHTS).forEach(cardName => {
        const group = summaryMap.get(cardName);
        if (!group) return;
        const weight = getSubtreeWeight(cardName);
        let cardValue5y = 0;
        group.items.forEach(item => {
            // _expansion: passthrough-dual/26jong의 확장 대상(root가 아닌 descendant)
            // fromParent: 삼성 전용 표시 계층전파(하위 카드에 상위 카드의 own 금액을 그대로 미러링)
            // 둘 다 "이 카드 고유의 own 금액"이 아니므로 점수 계산에서 제외
            if (item._expansion || item.fromParent) return;
            cardValue5y += calcItemValue5y(item);
            if (item.source) cancerSourceNames.add(item.source);
        });
        if (cardName === "항암약물치료비") drugCardValue5yOwn = cardValue5y;
        expectedValue5y += cardValue5y * weight;
    });

    if (expectedValue5y <= 0) return null;

    // [4단계] 20년 총 납입보험료 (암 관련 raw item 한정, 원본 아이템 단위로 1회만 합산)
    // rawResults를 그대로 순회하므로 passthrough-dual/26jong처럼 한 아이템이 여러 카드에
    // 반영되어도 premium은 원본당 정확히 1번만 더해진다.
    let monthlyPremiumWon = 0;
    rawResults.forEach(raw => {
        if (!cancerSourceNames.has(raw.name)) return;
        const digits = String(raw.premium || '').replace(/[^0-9]/g, '');
        if (!digits) return;
        monthlyPremiumWon += parseInt(digits, 10);
    });

    if (monthlyPremiumWon <= 0) return null;

    // premium은 원(₩) 단위, expectedValue5y는 만원 단위 → 만원으로 환산해 배율 계산
    const totalPremium20y = (monthlyPremiumWon * 12 * 20) / 10000;
    const valueMultiple = expectedValue5y / totalPremium20y;
    const cappedScore = Math.min(SCORE_CAP, Math.round(SCORE_LOG_SCALE * Math.log1p(valueMultiple)));

    // v5.2: 항암약물치료비 게이트 — 가장 넓은 카드가 기준액 미만이면 그 비율만큼 감점.
    // cap을 먼저 건 뒤 게이트를 곱하므로 최종 점수는 항상 100 이하로 자연히 수렴한다.
    const gateFactor = Math.min(1, drugCardValue5yOwn / SCORE_GATE_THRESHOLD_5Y);
    const score = Math.min(SCORE_CAP, Math.round(cappedScore * gateFactor));

    return {
        score,
        valueMultiple,
        expectedValue5y,
        totalPremium20y,
        monthlyPremiumWon,
        gateFactor,
        average: SCORE_PROVISIONAL_AVERAGE
    };
}
