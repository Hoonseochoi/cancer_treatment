// ── mirae_config.js ──
// 미래에셋생명 전용 담보 매핑 및 계층적 요약 계산

// ── findMiraeDetails ──
// 담보명을 받아 요약 대상 정보를 반환 (집계 제외 시 null)
function findMiraeDetails(itemName) {
    if (!itemName) return null;

    // ── suffix 제거 (미래에셋 특유 패턴) ──
    const n = itemName
        .replace(/\(간편고지형\(\d+\),갱신형\)최초계약/g, '')
        .replace(/\(355간편고지고당,갱신형\)최초계약/g, '')
        .replace(/\(355간편고지고당,갱신형\)/g, '')
        .replace(/\(갱신형\)최초계약/g, '')
        .replace(/\(갱신형\)/g, '')
        .replace(/최초계약\d*년?/g, '')
        .trim();

    // ── 집계 제외 담보 (return null) ──
    if (/^주계약/.test(n)) return null;
    if (/납입면제/.test(n)) return null;
    if (/재해장해/.test(n)) return null;
    if (/^1-[57]종수술/.test(n)) return null;
    if (/질병수술|재해수술/.test(n)) return null;
    if (/뇌혈관질환|뇌질환|허혈성심장|심장질환|부정맥|심부전|20대뇌/.test(n)) return null;
    if (/스텐트삽입술|풍선혈관성형|혈전용해|혈전제거/.test(n)) return null;
    if (/갑상선기능항진증|대상포진|깁스|재해골절|요로결석|통풍|녹내장|전립선비대|간경변|응급실/.test(n)) return null;
    if (/암통합케어|암직접치료통원|암통증완화|암재활|유전자검사|항암부작용/.test(n)) return null;
    if (/간병인사용|간호간병통합|중환자실입원|1인실|2-3인실|4-5인실/.test(n)) return null;
    if (/뇌심주요치료비|뇌혈관질환산정특례|심장질환산정특례/.test(n)) return null;
    if (/^입원특약/.test(n)) return null;

    // ── 집계 포함 담보 (return details object) ──

    // 항암방사선치료비 (세기/양성자/중입자/정위 제외)
    if (/항암방사선치료특약/.test(n) && !n.includes('세기') && !n.includes('양성자') && !n.includes('중입자') && !n.includes('정위')) {
        return { type: 'passthrough', summaryTarget: '항암방사선치료비', displayName: '항암방사선치료비' };
    }

    // 항암약물치료비 (호르몬 제외)
    if (/항암약물치료특약/.test(n) && !n.includes('호르몬')) {
        return { type: 'passthrough', summaryTarget: '항암약물치료비', displayName: '항암약물치료비' };
    }

    // 표적항암약물치료비
    if (/표적항암약물허가치료/.test(n)) {
        return { type: 'passthrough', summaryTarget: '표적항암약물치료비', displayName: '표적항암약물허가치료비' };
    }

    // 면역항암약물치료비
    if (/특정면역항암약물허가치료/.test(n)) {
        return { type: 'passthrough', summaryTarget: '면역항암약물치료비', displayName: '특정면역항암약물허가치료비' };
    }

    // 중입자방사선치료비
    if (/항암중입자방사선/.test(n)) {
        return { type: 'passthrough', summaryTarget: '중입자방사선치료비', displayName: '항암중입자방사선치료비' };
    }

    // 양성자방사선치료비
    if (/항암양성자방사선/.test(n)) {
        return { type: 'passthrough', summaryTarget: '양성자방사선치료비', displayName: '항암양성자방사선치료비' };
    }

    // 세기조절방사선치료비
    if (/항암세기조절방사선/.test(n)) {
        return { type: 'passthrough', summaryTarget: '세기조절방사선치료비', displayName: '항암세기조절방사선치료비' };
    }

    // 정위방사선치료비 (SBRT)
    if (/항암정위방사선/.test(n)) {
        return { type: 'passthrough', summaryTarget: '정위방사선치료비', displayName: '항암정위방사선치료비' };
    }

    // 다빈치로봇수술비 — 갑상선·전립선 제외형
    if (n.includes('다빈치로봇수술') && n.includes('갑상선암및전립선암제외')) {
        return { type: 'passthrough', summaryTarget: '다빈치로봇수술비', displayName: '다빈치로봇암수술비(갑·전제외)' };
    }

    // 다빈치로봇수술비 — 전체 암 포함형
    if (n.includes('다빈치로봇수술')) {
        return { type: 'passthrough', summaryTarget: '다빈치로봇수술비', displayName: '다빈치로봇암수술비' };
    }

    // 암수술비 — 신암수술특약Ⅱ 관혈 (회당)
    if (/신암수술특약.*관혈/.test(n) && !n.includes('비관혈')) {
        return { type: 'passthrough', summaryTarget: '암수술비', displayName: '암수술비(관혈)' };
    }

    // 암수술비 — 신암수술특약Ⅱ 비관혈 (연간1회)
    if (/신암수술특약.*비관혈/.test(n)) {
        return { type: 'passthrough', summaryTarget: '암수술비', displayName: '암수술비(비관혈)', annual: true };
    }

    // 항암호르몬약물치료비 (연간1회)
    if (/항암호르몬약물치료/.test(n)) {
        return { type: 'passthrough', summaryTarget: '항암호르몬약물치료비', displayName: '항암호르몬약물치료비', annual: true };
    }

    // 암주요치료비특약 — 기타피부암및갑상선암 제외 (일반암용)
    if (/암주요치료비특약/.test(n) && n.includes('기타피부암및갑상선암제외')) {
        return {
            type: 'passthrough-dual',
            displayName: '암주요치료비(방사선·약물)',
            summaryTargets: ['항암방사선치료비', '항암약물치료비']
        };
    }

    // 암주요치료비특약 — 기타피부암및갑상선암 포함 (유사암용)
    if (/암주요치료비특약/.test(n) && n.includes('기타피부암및갑상선암')) {
        return {
            type: 'passthrough-dual',
            displayName: '암주요치료비(기타피부암·갑상선)',
            summaryTargets: ['항암방사선치료비', '항암약물치료비'],
            isYusamOnly: true
        };
    }

    // 진단 관련 특약 → 집계 제외
    if (/암.*진단특약|유사암진단/.test(n)) return null;

    // 나머지 미매핑 특약 → null
    return null;
}

// ── calculateHierarchicalSummaryMirae ──
// 미래에셋생명 전용 계층적 요약 계산
function calculateHierarchicalSummaryMirae(results) {
    const summaryMap = new Map();

    results.forEach(item => {
        let details = findMiraeDetails(item.name);
        if (!details) return;

        // Passthrough → single array entry
        if (details.type === 'passthrough') {
            const tgt = details.summaryTarget || null;
            const annualFlag = details.annual || false;
            details = [{
                name: details.displayName,
                amount: item.amount,
                비급여: false,
                isYusamOnly: false,
                annual: annualFlag,
                ...(tgt ? { targetName: tgt } : {})
            }];
        }

        // Passthrough-Dual → multiple targets (미래에셋: CATEGORY_HIERARCHY 전파 완전 차단)
        if (details && details.type === 'passthrough-dual') {
            const displayName = details.displayName;
            const shouldExpand = false; // 미래에셋: CATEGORY_HIERARCHY 전파 완전 차단
            const isYusamOnly = details.isYusamOnly || false;
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
                isYusamOnly,
                비급여: false,
                annual: false,
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
            } else if (groupingSource.includes('세기조절')) {
                normalizedName = '세기조절방사선치료비';
            } else if (groupingSource.includes('정위')) {
                normalizedName = '정위방사선치료비';
            } else if (groupingSource.includes('다빈치') || groupingSource.includes('로봇')) {
                normalizedName = '다빈치로봇수술비';
            } else if (groupingSource.includes('수술') && groupingSource.includes('암')) {
                normalizedName = '암수술비';
            } else if (groupingSource.includes('호르몬')) {
                normalizedName = '항암호르몬약물치료비';
            } else if (groupingSource.includes('약물') && !groupingSource.includes('표적') && !groupingSource.includes('면역') && !groupingSource.includes('호르몬')) {
                normalizedName = '항암약물치료비';
            } else if (groupingSource.includes('방사선') && !groupingSource.includes('양성자') && !groupingSource.includes('중입자') && !groupingSource.includes('세기') && !groupingSource.includes('정위')) {
                normalizedName = '항암방사선치료비';
            } else {
                normalizedName = groupingSource.replace(/[^가-힣0-9]/g, '');
            }

            if (!summaryMap.has(normalizedName)) {
                summaryMap.set(normalizedName, {
                    displayName: normalizedName,
                    totalMin: 0, totalMax: 0,
                    isolatedMin: 0, isolatedMax: 0,
                    isolatedOnceMin: 0, isolatedOnceMax: 0,
                    items: [],
                    onceOnly: ONCE_ONLY_KEYS.has(normalizedName)
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

            // ── payFreq 결정 ──
            let payFreq = '';
            if (ONCE_ONLY_KEYS.has(normalizedName)) {
                payFreq = 'once';
            } else if (det.annual === true) {
                payFreq = 'annual';
            }
            if (!det._expansion && !isYusamOnly && payFreq === 'once') {
                group.isolatedOnceMin += valMin;
                group.isolatedOnceMax += valMax;
            }

            group.items.push({
                name: det.name,
                amount: det.amount,
                source: item.name,
                isYusamOnly,
                비급여: det.비급여 || false,
                _expansion: det._expansion || false,
                payFreq
            });

            // targetName이 있는 경우(=상위 카드에 합산되는 하위 개념)는 카드명 덮어쓰기 금지
            if (!det._expansion && !det.targetName && (det.name.length > group.displayName.length || group.displayName === normalizedName)) {
                const cleanName = det.name.replace(/\([^)]*\)/g, '').trim();
                if (cleanName.length > 0) group.displayName = cleanName;
            }
        });
    });

    // ── Step 1: totalMin을 isolatedMin으로 초기화 (_expansion 아티팩트 제거) ──
    summaryMap.forEach(v => { v.totalMin = v.isolatedMin; v.totalMax = v.isolatedMax; });

    // ── Step 2: 포함관계 반영 — 부모 카드 금액을 자식 카드에 하향 전파 ──
    // 자식 카드 totalMin = 부모 isolatedMin + 자식 own isolatedMin
    const MIRAE_PARENT_TO_CHILDREN = {
        '항암방사선치료비': ['중입자방사선치료비', '양성자방사선치료비', '세기조절방사선치료비', '정위방사선치료비'],
        '항암약물치료비':   ['표적항암약물치료비', '면역항암약물치료비'],
        '암수술비':         ['다빈치로봇수술비'],
    };
    Object.entries(MIRAE_PARENT_TO_CHILDREN).forEach(([parent, children]) => {
        if (!summaryMap.has(parent)) return;
        const p = summaryMap.get(parent);
        children.forEach(child => {
            // 자식 카드가 없으면 빈 카드 자동 생성
            if (!summaryMap.has(child)) {
                summaryMap.set(child, {
                    displayName: child,
                    totalMin: 0, totalMax: 0,
                    isolatedMin: 0, isolatedMax: 0,
                    isolatedOnceMin: 0, isolatedOnceMax: 0,
                    items: [],
                    onceOnly: ONCE_ONLY_KEYS.has(child)
                });
            }
            const c = summaryMap.get(child);
            // 부모 직접 금액을 자식 totalMin에 추가 (자식 own은 이미 isolatedMin에 있음)
            c.totalMin += p.totalMin;
            c.totalMax += p.totalMax;
            // 부모 세부내역(items)도 자식 카드에 복사 (_fromParent 표시)
            p.items.filter(it => !it._expansion).forEach(it => {
                c.items.unshift({ ...it, _fromParent: true });
            });
        });
    });

    return summaryMap;
}
