// ── Heungkuk Fire Insurance (흥국화재) Coverage Config ──
console.log('[흥국config] v20260514f 로드됨 ✅');

// ── findHeungkukDetails: keyword-based lookup for Heungkuk coverage names ──
function findHeungkukDetails(itemName) {
    if (!itemName) return null;
    const n = itemName.trim();

    // ── 생활비: 1회당은 3카드 합산, 2~3회이상은 사이드바, 기타는 skip ──
    if (n.includes('생활비') && (n.includes('1회당') || n.includes('1회한'))) {
        return {
            type: 'passthrough-dual',
            displayName: '생활비(1회)',
            summaryTargets: ['암수술비', '항암방사선치료비', '항암약물치료비'],
            expandHierarchy: false,
            비급여: n.includes('비급여')
        };
    }
    if (n.includes('생활비') && (n.includes('2회') || n.includes('3회'))) {
        return { type: 'livingcost-other' };
    }
    if (n.includes('생활비')) return null;

    // ── SKIP: 진단비 (암진단비, 유사암진단비 등) ──
    if (n.includes('암진단비') || n.includes('진단비')) return null;

    // ── 플래티넘 리셋월렛 → wallet 타입 반환 (하드코딩 세부항목 분배) ──
    if (n.includes('리셋월렛') || n.includes('플래티넘')) {
        return { type: 'wallet' };
    }

    // ── SKIP: 납입면제, 납입지원 ──
    if (n.includes('납입면제') || n.includes('납입지원')) return null;

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

    // ── 다빈치및레보아이로봇 수술비 → 다빈치로봇수술비 ──
    if ((n.includes('다빈치') || n.includes('레보아이')) && (n.includes('수술비') || n.includes('암수술'))) {
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
        // ── 세부 구분자 없는 통합형 (유사암제외) → passthrough-dual ──
        return {
            type: 'passthrough-dual',
            displayName: '암주요치료비(유사암제외)',
            summaryTargets: ['암수술비', '항암방사선치료비', '항암약물치료비']
        };
    }

    // ── 비급여 암주요치료비 → passthrough-dual (비급여 태그) ──
    if (/비급여\s*암주요치료비/.test(n)) {
        return {
            type: 'passthrough-dual',
            displayName: '비급여 암주요치료비',
            summaryTargets: ['암수술비', '항암방사선치료비', '항암약물치료비'],
            비급여: true
        };
    }

    // ── 상급종합병원통합치료비II (비급여포함) → sanggup2 타입 (하드코딩) ──
    if (n.includes('상급종합병원') && (n.includes('통합치료') || n.includes('통합치료비'))) {
        return { type: 'sanggup2' };
    }

    // 그 외 (암주요치료비 포함하지만 세부 분류 없는 경우) → null
    return null;
}

// ── 상급종합병원통합치료비II (비급여포함) 하드코딩 데이터 ──
// 이미지 기준: 상급 통치 II 오른쪽 표
const SANGGUP2_CARD_ITEMS = [
    // ③ 상급종합병원 암주요치료비 (급여)
    { summaryTarget: '암수술비',           name: '상급종합병원 암수술비',         amount: '500만원' },
    { summaryTarget: '항암방사선치료비',    name: '상급종합병원 항암방사선치료비', amount: '1,000만원' },
    { summaryTarget: '항암약물치료비',      name: '상급종합병원 항암약물치료비',   amount: '1,000만원' },
    // ⑦ 비급여 암 주요치료
    { summaryTarget: '암수술비',           name: '비급여 암수술비 (상급종합)',     amount: '1,000만원', 비급여: true },
    { summaryTarget: '항암방사선치료비',    name: '비급여 항암방사선 (상급종합)',  amount: '1,000만원', 비급여: true },
    { summaryTarget: '항암약물치료비',      name: '비급여 항암약물 (상급종합)',    amount: '1,000만원', 비급여: true },
];
// 기타 사이드바 (9카드 미해당)
const SANGGUP2_OTHER_ITEMS = [
    { name: '상급종합병원 암 중환자실치료비',          amount: '1,000만원' },
    { name: '상급종합병원 항암호르몬치료비',            amount: '300만원' },
    { name: '상급종합병원 질병수술비 (8대질병제외)',    amount: '50만원/회' },
    { name: '3대질병 MRI검사지원비',                   amount: '7만원/연' },
];

// ── 월렛 하드코딩 데이터 ──
// 9카드 합산 대상 (fromWallet: true → 핑크 태그 표시)
const WALLET_CARD_ITEMS = [
    { summaryTarget: '암수술비',        name: '비급여 암수술',          amount: '1,000만원', fromWallet: true, 비급여: true },
    { summaryTarget: '항암방사선치료비', name: '비급여 항암방사선치료',   amount: '5,000만원', fromWallet: true, 비급여: true },
    { summaryTarget: '항암약물치료비',   name: '비급여 항암약물(1~3기)', amount: '5,000만원', fromWallet: true, 비급여: true, stage: '1~3기' },
    { summaryTarget: '항암약물치료비',   name: '비급여 항암약물(4기)',   amount: '1억원',     fromWallet: true, 비급여: true, stage: '4기' },
];
// 기타 사이드바 대상 (9카드 미해당)
const WALLET_OTHER_ITEMS = [
    { name: '암 종합중환자실 치료',      amount: '1,000만원' },
    { name: '2대질병 중환자실 치료',     amount: '1,000만원', note: '★감액없음' },
    { name: '비급여 2대질병 수술',       amount: '1,000만원' },
    { name: '상급종합병원 질병수술비',   amount: '50만원' },
    { name: '특정순환계질환 수술비',     amount: '500만원' },
    { name: '질병 동반입원비Ⅲ (최대)',  amount: '500만원' },
    { name: '상해사망',                 amount: '잔고 30%', note: '★선택사항' },
];

// ── calculateHierarchicalSummaryHeungkuk ──
// 흥국화재 전용 계층적 요약 계산 (db_config.js의 calculateHierarchicalSummaryDB와 동일 구조)
function calculateHierarchicalSummaryHeungkuk(results) {
    const summaryMap = new Map();
    let walletDetected = false;
    let sanggup2Detected = false;

    results.forEach(item => {
        let details = findHeungkukDetails(item.name);
        if (!details) return;

        // ── sanggup2 타입: 상급종합병원통합치료비II(비급여포함) 하드코딩 분배 ──
        if (details.type === 'sanggup2') {
            if (sanggup2Detected) return; // 중복 방지
            sanggup2Detected = true;

            SANGGUP2_CARD_ITEMS.forEach(wi => {
                const target = wi.summaryTarget;
                if (!summaryMap.has(target)) {
                    summaryMap.set(target, {
                        displayName: target,
                        totalMin: 0, totalMax: 0,
                        isolatedMin: 0, isolatedMax: 0,
                        items: []
                    });
                }
                const group = summaryMap.get(target);
                const val = parseKoAmount(wi.amount);
                group.totalMin += val;
                group.totalMax += val;
                group.isolatedMin += val;
                group.isolatedMax += val;
                group.items.push({
                    name: wi.name,
                    amount: wi.amount,
                    source: '상급종합병원통합치료비II(비급여포함)',
                    fromSanggup2: true,
                    비급여: wi.비급여 || false,
                });
            });

            // 기타 항목 → 사이드바 전역 저장
            window._heungkukSanggup2Others = SANGGUP2_OTHER_ITEMS;
            return;
        }

        // ── wallet 타입: 하드코딩 항목 분배 ──
        if (details.type === 'wallet') {
            if (walletDetected) return; // 중복 방지
            walletDetected = true;

            // 9카드 합산 대상 주입
            WALLET_CARD_ITEMS.forEach(wi => {
                const target = wi.summaryTarget;
                if (!summaryMap.has(target)) {
                    summaryMap.set(target, {
                        displayName: target,
                        totalMin: 0, totalMax: 0,
                        isolatedMin: 0, isolatedMax: 0,
                        items: []
                    });
                }
                const group = summaryMap.get(target);
                const val = parseKoAmount(wi.amount);
                group.totalMin += val;
                group.totalMax += val;
                group.isolatedMin += val;
                group.isolatedMax += val;
                group.items.push({
                    name: wi.name,
                    amount: wi.amount,
                    source: '플래티넘 건강 리셋 월렛',
                    fromWallet: true,
                    비급여: wi.비급여 || false,
                    stage: wi.stage || null,
                });
            });

            // 기타 항목 → 전역 저장 (ui_renderer에서 사용)
            window._heungkukWalletOthers = WALLET_OTHER_ITEMS;
            return;
        }

        // ── livingcost-other 타입: 생활비(2회~3회이상) → 사이드바 전역 저장 ──
        if (details.type === 'livingcost-other') {
            if (!window._heungkukLivingCostOthers) window._heungkukLivingCostOthers = [];
            const existing = window._heungkukLivingCostOthers.find(x => x.source === item.name);
            if (!existing) {
                window._heungkukLivingCostOthers.push({
                    name: '생활비(2회~3회이상)',
                    amount: item.amount,
                    source: item.name
                });
            }
            return;
        }

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

        // Passthrough-Dual → multiple targets (흥국은 계층 전파 없음, 각 담보 독립 집계)
        if (details && details.type === 'passthrough-dual') {
            const displayName = details.displayName;
            const shouldExpand = false; // 흥국: CATEGORY_HIERARCHY 전파 완전 차단
            const isYusamOnly = details.isYusamOnly || false;
            const isBigugeumDual = details.비급여 || false;
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
                비급여: isBigugeumDual,
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
                비급여: det.비급여 || false,
                _expansion: det._expansion || false
            });

            if (!det._expansion && (det.name.length > group.displayName.length || group.displayName === normalizedName)) {
                const cleanName = det.name.replace(/\([^)]*\)/g, '').trim();
                if (cleanName.length > 0) group.displayName = cleanName;
            }
        });
    });

    // ── totalMin을 isolatedMin으로 최종 정리 ──
    // _expansion 항목은 시각적 서브아이템용이며 금액 집계에서 제외
    // 흥국은 CATEGORY_HIERARCHY 계층전파 없이 직접 담보 금액만 합산
    summaryMap.forEach(v => { v.totalMin = v.isolatedMin; v.totalMax = v.isolatedMax; });

    return summaryMap;
}
