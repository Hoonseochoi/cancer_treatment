// ── DB Insurance (DB손해보험) Coverage Config ──
// dbCoverageDetailsMap: exact-match fallback (most matching done via findDBDetails)

const dbCoverageDetailsMap = {};

// ── findDBDetails: keyword-based lookup for DB coverage names ──
function findDBDetails(itemName) {
    if (!itemName) return null;

    // Strip common DB suffixes for cleaner matching
    const n = itemName
        .replace(/\(맞춤간편고지\)/g, '')
        .replace(/\(갱신형\)/g, '')
        .replace(/\(자유설계\([^)]*\)\)/g, '')
        .trim();

    // ── 항암방사선약물치료비 (방사선+약물 통합형, 예: 항암방사선약물치료비Ⅱ(유사암포함)) ──
    if (/항암방사선약물치료비/.test(n)) {
        return {
            type: 'passthrough-dual',
            displayName: '항암방사선약물치료비',
            summaryTargets: ['항암방사선치료비', '항암약물치료비']
        };
    }

    // ── 항암방사선치료비 (단독, 약물 미포함) ──
    if (/항암방사선치료비/.test(n) && !n.includes('약물')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암방사선치료비',
            displayName: '항암방사선치료비'
        };
    }

    // ── 항암약물치료비 (단독, 방사선 미포함) ──
    if (/항암약물치료비/.test(n) && !n.includes('방사선')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암약물치료비',
            displayName: '항암약물치료비'
        };
    }

    // ── 하이클래스암주요치료비 - 수술 ──
    if (n.includes('하이클래스암') && n.includes('수술')) {
        return {
            type: 'passthrough',
            summaryTarget: '암수술비',
            displayName: '하이클래스암 수술비',
            비급여: true
        };
    }

    // ── 하이클래스암주요치료비 - 항암방사선·약물 ──
    if (n.includes('하이클래스암') && (n.includes('방사선') || n.includes('약물'))) {
        return {
            type: 'passthrough-dual',
            displayName: '하이클래스암 항암방사선·약물치료비',
            summaryTargets: ['항암방사선치료비', '항암약물치료비'],
            비급여: true
        };
    }

    // ── 암주요치료비Ⅲ - 수술 (유사암 제외) ──
    if (/암주요치료비/.test(n) && n.includes('수술') &&
        (n.includes('유사암제외') || n.includes('유사암 제외'))) {
        return {
            type: 'passthrough',
            summaryTarget: '암수술비',
            displayName: '암주요치료비(수술)'
        };
    }

    // ── 암주요치료비Ⅲ - 항암방사선 (유사암 제외) ──
    if (/암주요치료비/.test(n) && n.includes('방사선') &&
        (n.includes('유사암제외') || n.includes('유사암 제외'))) {
        return {
            type: 'passthrough',
            summaryTarget: '항암방사선치료비',
            displayName: '암주요치료비(항암방사선)'
        };
    }

    // ── 암주요치료비Ⅲ - 항암약물 (유사암 제외) ──
    if (/암주요치료비/.test(n) && n.includes('약물') &&
        (n.includes('유사암제외') || n.includes('유사암 제외'))) {
        return {
            type: 'passthrough',
            summaryTarget: '항암약물치료비',
            displayName: '암주요치료비(항암약물)'
        };
    }

    // ── 유사암주요치료비Ⅲ - 수술 ──
    if (n.includes('유사암주요치료비') && n.includes('수술')) {
        return {
            type: 'passthrough',
            summaryTarget: '암수술비',
            displayName: '유사암주요치료비(수술)',
            isYusamOnly: true
        };
    }

    // ── 유사암주요치료비Ⅲ - 항암방사선 ──
    if (n.includes('유사암주요치료비') && n.includes('방사선')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암방사선치료비',
            displayName: '유사암주요치료비(항암방사선)',
            isYusamOnly: true
        };
    }

    // ── 유사암주요치료비Ⅲ - 항암약물 ──
    if (n.includes('유사암주요치료비') && n.includes('약물')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암약물치료비',
            displayName: '유사암주요치료비(항암약물)',
            isYusamOnly: true
        };
    }

    // ── 비급여표적항암약물허가치료비 ──
    if (n.includes('비급여') && n.includes('표적항암')) {
        return {
            type: 'passthrough',
            summaryTarget: '표적항암약물치료비',
            displayName: '(비급여) 표적항암약물허가치료비',
            비급여: true
        };
    }

    // ── 표적항암약물허가치료비 (급여) ──
    if (n.includes('표적항암약물허가치료비') || (n.includes('표적항암') && n.includes('허가'))) {
        return {
            type: 'passthrough',
            summaryTarget: '표적항암약물치료비',
            displayName: '표적항암약물허가치료비'
        };
    }

    // ── 항암중입자방사선치료비 ──
    if (n.includes('중입자')) {
        return {
            type: 'passthrough',
            summaryTarget: '중입자방사선치료비',
            displayName: '항암중입자방사선치료비'
        };
    }

    // ── 다빈치로봇암수술비 ──
    if ((n.includes('다빈치') || n.includes('로봇')) && n.includes('암수술')) {
        return {
            type: 'passthrough',
            summaryTarget: '다빈치로봇수술비',
            displayName: '다빈치로봇암수술비'
        };
    }

    // ── 비급여암주요치료비(전액본인부담포함) → variant ──
    // 세부 지급: 다빈치로봇수술 회당 1천만 + 표적항암 연간 3천만 + 양성자 연간 3천만
    // 면역항암 3천만은 CATEGORY_HIERARCHY(표적→면역) 자동전파로 처리 (이중계산 방지)
    if (n.includes('비급여') && n.includes('암주요치료비')) {
        return {
            type: 'variant',
            data: {
                "8000": [
                    { name: "(회당) 다빈치로봇암수술비", amount: "1,000만", targetName: "다빈치로봇수술비", 비급여: true },
                    { name: "(연1회) 표적항암약물허가치료비", amount: "3,000만", targetName: "표적항암약물치료비", 비급여: true },
                    { name: "(연1회) 양성자방사선치료비", amount: "3,000만", targetName: "양성자방사선치료비", 비급여: true }
                ]
            }
        };
    }

    // 암진단비, 통합유사암진단비, 갑상선암호르몬, 특정항암호르몬,
    // 보험료납입 등 → null (집계 대상 아님)
    return null;
}

// ── calculateHierarchicalSummaryDB ──
// DB 전용 계층적 요약 계산 (samsung_config.js의 calculateHierarchicalSummarySamsung과 동일 구조)
function calculateHierarchicalSummaryDB(results) {
    const summaryMap = new Map();

    results.forEach(item => {
        let details = dbCoverageDetailsMap[item.name];
        if (!details) details = findDBDetails(item.name);
        if (!details) return;

        // Variant → amount-based sub-item selection
        if (details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            if (!variantData) {
                if (amountVal > 6000) variantData = details.data["10000"] || details.data["8000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
                if (!variantData && details.data["8000"]) variantData = details.data["8000"];
                if (!variantData && details.data["10000"]) variantData = details.data["10000"];
            }
            details = variantData;
        }

        // Passthrough → single array entry
        if (details && details.type === 'passthrough') {
            const tgt = details.summaryTarget || null;
            details = [{
                name: details.displayName,
                amount: item.amount,
                비급여: details.비급여 || false,
                isYusamOnly: details.isYusamOnly || false,
                ...(tgt ? { targetName: tgt } : {})
            }];
        }

        // Passthrough-Dual → multiple targets (with optional CATEGORY_HIERARCHY expansion)
        if (details && details.type === 'passthrough-dual') {
            const displayName = details.displayName;
            const shouldExpand = details.expandHierarchy !== false;
            const isBigugeom = details.비급여 || false;
            const directTargets = details.summaryTargets;
            const expandedTargets = [];
            directTargets.forEach(target => {
                if (!expandedTargets.includes(target)) expandedTargets.push(target);
                if (shouldExpand && typeof CATEGORY_HIERARCHY !== 'undefined') {
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
                _expansion: !directTargets.includes(t)
            }));
        }

        if (!Array.isArray(details)) return;

        details.forEach(det => {
            // Normalize to summary card key
            let groupingSource = det.targetName || det.name;
            let normalizedName = groupingSource;

            if (det.targetName) {
                normalizedName = det.targetName;
            } else if (groupingSource.includes('표적')) {
                normalizedName = '표적항암약물치료비';
            } else if (groupingSource.includes('면역')) {
                normalizedName = '면역항암약물치료비';
            } else if (groupingSource.includes('중입자')) {
                normalizedName = '중입자방사선치료비';
            } else if (groupingSource.includes('양성자')) {
                normalizedName = '양성자방사선치료비';
            } else if (groupingSource.includes('다빈치') || groupingSource.includes('로봇')) {
                normalizedName = '다빈치로봇수술비';
            } else if (groupingSource.includes('세기조절')) {
                normalizedName = '세기조절방사선치료비';
            } else if (groupingSource.includes('수술') && groupingSource.includes('암')) {
                normalizedName = '암수술비';
            } else if (groupingSource.includes('약물') && !groupingSource.includes('표적') && !groupingSource.includes('면역')) {
                normalizedName = '항암약물치료비';
            } else if (groupingSource.includes('방사선') && !groupingSource.includes('양성자') && !groupingSource.includes('중입자')) {
                normalizedName = '항암방사선치료비';
            } else {
                normalizedName = groupingSource.replace(/[^가-힣0-9]/g, '');
            }

            if (!summaryMap.has(normalizedName)) {
                summaryMap.set(normalizedName, {
                    displayName: normalizedName,
                    totalMin: 0, totalMax: 0,
                    isolatedMin: 0, isolatedMax: 0,
                    items: []
                });
            }

            const group = summaryMap.get(normalizedName);
            const valMin = parseKoAmount(det.amount);
            const valMax = det.maxAmount ? parseKoAmount(det.maxAmount) : valMin;

            const isYusamOnly = det.isYusamOnly || false;

            if (!isYusamOnly) {
                group.totalMin += valMin;
                group.totalMax += valMax;
                if (!det._expansion) {
                    group.isolatedMin += valMin;
                    group.isolatedMax += valMax;
                }
            }

            group.items.push({
                name: det.name,
                amount: det.amount,
                source: item.name,
                비급여: det.비급여 || false,
                isYusamOnly,
                _expansion: det._expansion || false
            });

            if (!det._expansion && (det.name.length > group.displayName.length || group.displayName === normalizedName)) {
                const cleanName = det.name.replace(/\([^)]*\)/g, '').trim();
                if (cleanName.length > 0) group.displayName = cleanName;
            }
        });
    });

    // ── 상위→하위 계층 누적 (CATEGORY_HIERARCHY 전파) ──
    if (typeof CATEGORY_HIERARCHY !== 'undefined') {
        const hierSnap = new Map();
        summaryMap.forEach((v, k) => hierSnap.set(k, {
            isolatedMin: v.isolatedMin,
            isolatedMax: v.isolatedMax,
            items: v.items.filter(i => !i._expansion)
        }));
        summaryMap.forEach(v => { v.totalMin = v.isolatedMin; v.totalMax = v.isolatedMax; });
        Object.entries(CATEGORY_HIERARCHY).forEach(([parent, children]) => {
            const snap = hierSnap.get(parent);
            if (!snap || snap.isolatedMin === 0) return;
            children.forEach(child => {
                if (!summaryMap.has(child)) {
                    summaryMap.set(child, { displayName: child, totalMin: 0, totalMax: 0, isolatedMin: 0, isolatedMax: 0, items: [] });
                }
                const childGroup = summaryMap.get(child);
                childGroup.totalMin += snap.isolatedMin;
                childGroup.totalMax += snap.isolatedMax;
                snap.items.forEach(pItem => {
                    const isDup = childGroup.items.some(ci => ci.name === pItem.name && ci.source === pItem.source);
                    if (!isDup) childGroup.items.push({ ...pItem, fromParent: true });
                });
            });
        });
    }

    return summaryMap;
}
