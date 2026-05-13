// ── Heungkuk Fire Insurance (흥국화재) Coverage Config ──

// ── findHeungkukDetails: keyword-based lookup for Heungkuk coverage names ──
function findHeungkukDetails(itemName) {
    if (!itemName) return null;
    const n = itemName.trim();

    // ── SKIP: 생활비 (skip, 집계 대상 아님) ──
    if (n.includes('생활비')) return null;

    // ── SKIP: 진단비 (암진단비, 유사암진단비 등) ──
    if (n.includes('암진단비') || n.includes('진단비')) return null;

    // ── SKIP: 플래티넘 리셋월렛 (오집계 방지 - 복합담보, 금액 너무 큼) ──
    if (n.includes('리셋월렛') || n.includes('플래티넘')) return null;

    // ── SKIP: 납입면제, 납입지원 ──
    if (n.includes('납입면제') || n.includes('납입지원')) return null;

    // ── SKIP: 암주요치료(유사암) 생활비 ──
    if (n.includes('유사암') && n.includes('생활비')) return null;

    // ── 항암방사선약물치료비 (방사선+약물 통합형) ──
    if (n.includes('항암방사선약물치료비')) {
        return {
            type: 'passthrough-dual',
            displayName: '항암방사선약물치료비',
            summaryTargets: ['항암방사선치료비', '항암약물치료비']
        };
    }

    // ── 항암방사선치료비 (단독) ──
    if (n.includes('항암방사선치료비') && !n.includes('약물')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암방사선치료비',
            displayName: '항암방사선치료비'
        };
    }

    // ── 항암약물치료비 (단독, 방사선 미포함, 표적/면역/호르몬 미포함) ──
    if (n.includes('항암약물치료비') &&
        !n.includes('방사선') &&
        !n.includes('표적') &&
        !n.includes('면역') &&
        !n.includes('호르몬')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암약물치료비',
            displayName: '항암약물치료비'
        };
    }

    // ── 항암호르몬약물치료비 → 항암약물치료비로 집계 ──
    if (n.includes('호르몬') && n.includes('약물')) {
        return {
            type: 'passthrough',
            summaryTarget: '항암약물치료비',
            displayName: '항암호르몬약물치료비'
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

    // ── 항암세기조절방사선치료비 ──
    if (n.includes('세기조절')) {
        return {
            type: 'passthrough',
            summaryTarget: '세기조절방사선치료비',
            displayName: '항암세기조절방사선치료비'
        };
    }

    // ── 항암양성자방사선치료비 ──
    if (n.includes('양성자')) {
        return {
            type: 'passthrough',
            summaryTarget: '양성자방사선치료비',
            displayName: '항암양성자방사선치료비'
        };
    }

    // ── 특정면역항암약물허가치료비 → 면역항암약물치료비 ──
    if (n.includes('특정면역항암') || (n.includes('면역항암') && !n.includes('카티') && !n.includes('CAR'))) {
        return {
            type: 'passthrough',
            summaryTarget: '면역항암약물치료비',
            displayName: '특정면역항암약물허가치료비'
        };
    }

    // ── 카티(CAR-T) 항암약물허가치료비 → 면역항암약물치료비 ──
    if (n.includes('카티') || n.includes('CAR-T') || n.includes('CAR T')) {
        return {
            type: 'passthrough',
            summaryTarget: '면역항암약물치료비',
            displayName: '카티(CAR-T) 항암약물허가치료비'
        };
    }

    // ── 표적항암약물허가치료비 ──
    if (n.includes('표적항암')) {
        return {
            type: 'passthrough',
            summaryTarget: '표적항암약물치료비',
            displayName: '표적항암약물허가치료비'
        };
    }

    // ── 다빈치및레보아이로봇 암수술비 → 다빈치로봇수술비 ──
    if ((n.includes('다빈치') || n.includes('레보아이') || n.includes('로봇')) && n.includes('암수술')) {
        return {
            type: 'passthrough',
            summaryTarget: '다빈치로봇수술비',
            displayName: '다빈치·레보아이로봇 암수술비'
        };
    }

    // ── 암주요치료비Ⅱ(유사암) → 복합 [isYusamOnly] ──
    // 유사암제외가 없고 유사암이 있으면 → 유사암 전용
    if (/암주요치료비/.test(n) && n.includes('유사암') &&
        !n.includes('유사암제외') && !n.includes('유사암 제외')) {
        if (n.includes('_암수술비') || n.includes('_암중환자실')) {
            return {
                type: 'passthrough',
                summaryTarget: '암수술비',
                displayName: '암주요치료비(유사암_수술)',
                isYusamOnly: true
            };
        }
        if (n.includes('_항암방사선')) {
            return {
                type: 'passthrough',
                summaryTarget: '항암방사선치료비',
                displayName: '암주요치료비(유사암_방사선)',
                isYusamOnly: true
            };
        }
        if (n.includes('_항암약물') || n.includes('_항암호르몬')) {
            return {
                type: 'passthrough',
                summaryTarget: '항암약물치료비',
                displayName: '암주요치료비(유사암_약물)',
                isYusamOnly: true
            };
        }
        // 세부 구분자 없는 통합형 유사암 복합담보 → passthrough-dual (유사암 전용)
        return {
            type: 'passthrough-dual',
            displayName: '암주요치료비(유사암)',
            summaryTargets: ['암수술비', '항암방사선치료비', '항암약물치료비'],
            isYusamOnly: true
        };
    }

    // ── 암주요치료비Ⅱ(유사암제외) 세부 담보 ──
    if (/암주요치료비/.test(n) && (n.includes('유사암제외') || n.includes('유사암 제외'))) {
        if (n.includes('_암수술비')) {
            return {
                type: 'passthrough',
                summaryTarget: '암수술비',
                displayName: '암주요치료비(수술)'
            };
        }
        if (n.includes('_암중환자실')) {
            return {
                type: 'passthrough',
                summaryTarget: '암수술비',
                displayName: '암주요치료비(중환자실)'
            };
        }
        if (n.includes('_항암방사선')) {
            return {
                type: 'passthrough',
                summaryTarget: '항암방사선치료비',
                displayName: '암주요치료비(항암방사선)'
            };
        }
        if (n.includes('_항암호르몬')) {
            return {
                type: 'passthrough',
                summaryTarget: '항암약물치료비',
                displayName: '암주요치료비(항암호르몬)'
            };
        }
        if (n.includes('_항암약물')) {
            return {
                type: 'passthrough',
                summaryTarget: '항암약물치료비',
                displayName: '암주요치료비(항암약물)'
            };
        }
    }

    // 그 외 (암주요치료비 포함하지만 세부 분류 없는 경우) → null
    return null;
}

// ── calculateHierarchicalSummaryHeungkuk ──
// 흥국화재 전용 계층적 요약 계산 (db_config.js의 calculateHierarchicalSummaryDB와 동일 구조)
function calculateHierarchicalSummaryHeungkuk(results) {
    const summaryMap = new Map();

    results.forEach(item => {
        let details = findHeungkukDetails(item.name);
        if (!details) return;

        // Passthrough → single array entry
        if (details.type === 'passthrough') {
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
            } else if (groupingSource.includes('면역') || groupingSource.includes('카티')) {
                normalizedName = '면역항암약물치료비';
            } else if (groupingSource.includes('중입자')) {
                normalizedName = '중입자방사선치료비';
            } else if (groupingSource.includes('양성자')) {
                normalizedName = '양성자방사선치료비';
            } else if (groupingSource.includes('세기조절')) {
                normalizedName = '세기조절방사선치료비';
            } else if (groupingSource.includes('다빈치') || groupingSource.includes('로봇')) {
                normalizedName = '다빈치로봇수술비';
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
