console.log('[ui_renderer] v20260514d 로드됨 ✅');
// ── 유사암/특정암 전용 서브아이템 판별 (일반암 기준 표기용) ──
// "유사암 제외", "특정암 제외" 는 일반암이므로 표시 유지
function isYusamOrSpecificAmOnly(sub) {
    const text = (sub.source || '') + '|' + (sub.name || '');
    const isYusaAm = text.includes("유사암") &&
                     !text.includes("유사암Ⅱ 제외") &&
                     !text.includes("유사암Ⅱ제외") &&
                     !text.includes("유사암 제외") &&
                     !text.includes("유사암제외") &&
                     !text.includes("유사암포함");  // 유사암포함 = 일반암도 커버하는 통합 담보, 필터 제외
    const isSpecificAm = text.includes("특정암") &&
                         !text.includes("특정암 제외") &&
                         !text.includes("특정암제외");
    return isYusaAm || isSpecificAm;
}

// ── UI Helpers ──
function updateProgress(pct, text) {
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text;
}
function showToast(msg, isError = true) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = isError ? '#EF4444' : '#10B981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}
// ── Coverage Detail Dictionary ──

// Raw List Renderer (Updated for Hierarchical Summary and Insight Card)
function renderResults(results, customerName = '고객', insurer = 'meritz', meta = {}) {
    // ── 흥국화재 전역 상태 초기화 (분석 시작마다 리셋) ──
    window._heungkukSanggup2Others = null;
    window._heungkukWalletOthers = null;
    window._heungkukLivingCostOthers = null;

    const listEl = document.getElementById('results-list');
    const summaryGrid = document.getElementById('summary-grid');
    const resultsSection = document.getElementById('results-section');
    const summarySection = document.getElementById('summary-section');
    const emptyState = document.getElementById('empty-state');
    const insightSection = document.getElementById('insight-section');

    if (!results || results.length === 0) {
        resultsSection.classList.add('hidden');
        summarySection.classList.add('hidden');
        if (insightSection) insightSection.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    summarySection.classList.remove('hidden');

    // 1. Calculate Hierarchical Summary
    const summaryMap = insurer === 'samsung'
        ? calculateHierarchicalSummarySamsung(results)
        : insurer === 'db'
            ? calculateHierarchicalSummaryDB(results)
            : insurer === 'heungkuk'
                ? calculateHierarchicalSummaryHeungkuk(results)
                : insurer === 'mirae'
                    ? calculateHierarchicalSummaryMirae(results)
                    : calculateHierarchicalSummary(results);
    // Calculate Grand Total Range (최초1회·각각1회 담보 분리)
    let grandTotalMin = 0;
    let grandTotalMax = 0;
    let onceOnlyTotalMin = 0;  // 최초1회·각각1회 합계 (5년 계산 시 ×1)
    let onceOnlyTotalMax = 0;
    summaryMap.forEach(d => {
        const min = d.isolatedMin ?? d.totalMin ?? 0;   // isolatedMin: 직접 보장 항목만 합산 (계층 전파 자식 이중계산 방지)
        const max = d.isolatedMax ?? d.totalMax ?? 0;
        grandTotalMin += min;
        grandTotalMax += max;
        // isolatedOnceMin: 항목별 payFreq 기준으로 정확히 추적된 값
        onceOnlyTotalMin += (d.isolatedOnceMin || 0);
        onceOnlyTotalMax += (d.isolatedOnceMax || 0);
    });

    // ── 커버리지 스냅샷 저장 (전 보험사 공통) ──
    if (['samsung', 'db', 'heungkuk', 'meritz', 'mirae'].includes(insurer) && typeof logCoverageSnapshot === 'function') {
        logCoverageSnapshot(meta.fileName, insurer, meta, grandTotalMin, grandTotalMax, summaryMap);
    }

    // ── 삼성화재 상세 제안서 저장 (RC / 대리점 / 설계번호 포함) ──
    if (insurer === 'samsung' && typeof logSamsungProposal === 'function') {
        logSamsungProposal(meta, summaryMap);
    }

    // ── 담보 가치점수 계산 (삼성/메리츠 한정) ──
    let scoreResult = null;
    if (['samsung', 'meritz'].includes(insurer) && typeof calcCoverageScore === 'function') {
        scoreResult = calcCoverageScore(summaryMap, results);
        if (scoreResult && typeof logCoverageScore === 'function') {
            logCoverageScore(meta.fileName, insurer, meta, scoreResult);
        }
    }

    // ── Render 5-Year Insight Card ──
    if (insightSection) {
        insightSection.innerHTML = '';
        // 최초 1회 담보: ×1, 반복 보장 담보: ×5
        const repeatableMin = grandTotalMin - onceOnlyTotalMin;
        const repeatableMax = grandTotalMax - onceOnlyTotalMax;
        const total5Min = repeatableMin * 5 + onceOnlyTotalMin;
        const total5Max = repeatableMax * 5 + onceOnlyTotalMax;

        let total5Display = formatKoAmount(total5Min);
        if (total5Min !== total5Max) {
            total5Display = `${formatKoAmount(total5Min)} ~ ${formatKoAmount(total5Max)}`;
        }

        // Conditional Expert Mapping
        let expertName = "메리";
        let expertImgBase64 = MERY_B64; // Use global Base64 string
        if (currentFileName && currentFileName.startsWith("323003978")) {
            expertName = "보장분석 마스터";
            expertImgBase64 = JIAN_B64; // Base64 for download/export compatibility
        } else if (currentFileName && currentFileName.startsWith("325001957")) {
            expertName = "예원";
            expertImgBase64 = YEWON_B64; // Use global Base64 string
        } else if (insurer === 'samsung') {
            expertName = "바다";
            expertImgBase64 = SBADA_B64;
        } else if (insurer === 'db') {
            expertName = "프로미";
            expertImgBase64 = PROMY_B64;
        } else if (insurer === 'heungkuk') {
            expertName = "루루";
            expertImgBase64 = RURU_B64;
        } else if (insurer === 'mirae') {
            expertName = "미래봇";
            expertImgBase64 = MIRAE_B64;
        }

        // ── 점수 박스 HTML (있을 때만 렌더링) ──
        let scoreBoxHtml = '';
        if (scoreResult) {
            const s = scoreResult.score;
            const scoreColor = s >= 80 ? '#059669' : s >= 50 ? '#EA580C' : '#6B7280';
            const commentText = s >= scoreResult.average ? '든든한 보장이네요 👍' : '이 부분은 보완을 고려해보세요 💬';
            scoreBoxHtml = `
                <div id="score-box" class="flex flex-col items-center justify-center shrink-0" style="background:rgba(255,255,255,0.6);border-radius:16px;padding:12px 20px;min-width:140px;border:1px solid rgba(0,0,0,0.05);">
                    <p class="text-[11px] font-bold text-gray-500 mb-1 whitespace-nowrap">암 치료비 점수는?</p>
                    <p class="font-black font-outfit" style="font-size:2rem;color:${scoreColor};line-height:1.1;">${s}점</p>
                    <p class="text-[10px] font-bold text-gray-400 mt-1 whitespace-nowrap">점수는 높을수록 좋아요!</p>
                    <p class="text-[10px] font-bold text-gray-400 whitespace-nowrap">평균은 ${scoreResult.average}점이에요 📊</p>
                    <p class="text-[9px] font-semibold mt-1 whitespace-nowrap" style="color:${scoreColor}">${commentText}</p>
                </div>
            `;
        }

        insightSection.innerHTML = `
            <div class="premium-card rounded-3xl p-4 sm:p-6 shadow-xl border-none insight-card-gradient animate-insight relative overflow-hidden group">
                <!-- Background Decoration -->
                <div class="absolute -right-4 -top-4 w-32 h-32 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition-colors"></div>
                <div class="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                    <div class="relative shrink-0">
                        <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-red-100 border-2 border-white ring-1 ring-red-100">
                             <img src="${expertImgBase64}" alt="보험전문가 ${expertName}" class="w-full h-full object-cover object-top">
                        </div>
                        <div class="absolute -bottom-2 -right-2 ${insurer === 'db' ? 'bg-blue-600' : insurer === 'heungkuk' ? 'bg-pink-600' : insurer === 'mirae' ? 'bg-orange-500' : 'bg-red-600'} text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md uppercase tracking-tighter">
                            ${insurer === 'db' ? 'Promy' : insurer === 'heungkuk' ? 'Ruru' : insurer === 'mirae' ? 'Mirae' : 'Expert'}
                        </div>
                    </div>
                    <div class="text-center sm:text-left flex-1">
                        <p class="text-gray-500 text-[13px] font-bold mb-1 opacity-80">
                            🛡️ <span class="text-gray-400">${insurer === 'db' ? 'DB손보 마스코트' : insurer === 'heungkuk' ? '흥국화재 마스코트' : insurer === 'mirae' ? '미래에셋생명 AI' : '보험전문가'} <b class="text-gray-600">${expertName}</b>의 insight : 전문 통계에 의하면 암치료는 5년정도 받는대요 !</span>
                        </p>
                        <h3 class="text-sm sm:text-xl font-medium text-gray-800 leading-relaxed">
                            <span class="font-black text-red-600 underline decoration-red-200 underline-offset-4">${customerName}</span>님이 
                            <span class="font-bold text-gray-900 mx-1">5년간</span> 보장받을 수 있는 
                            <span class="font-black text-gray-900 border-b-2 border-red-500/30">암 치료비</span>는 최대
                        </h3>
                        <div class="mt-2 flex items-baseline gap-2 justify-center sm:justify-start">
                            <span class="text-2xl sm:text-4xl font-black text-red-600 tracking-tight font-outfit">
                                ${total5Display}
                            </span>
                            <span class="text-gray-400 text-xs font-bold ml-1">입니다.</span>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-3 font-medium tracking-tight leading-tight break-keep">
                            * 반복보장 담보 ×5 + 최초1회 담보 ×1로 산출한 참고값입니다. 실제 보장금액과 상이합니다.
                        </p>
                    </div>
                    ${scoreBoxHtml}
                </div>
                ${scoreResult ? `
                <p class="text-[9px] text-gray-300 mt-2 font-medium tracking-tight leading-tight break-keep relative z-10">
                    * 국내 암 치료 통계 경향성을 반영한 추정 점수이며, 실제 보장 결과와 다를 수 있습니다.
                </p>` : ''}
            </div>
        `;
        insightSection.classList.remove('hidden');
    }
    // 2. Render Summary Grid
    if (summaryMap.size > 0) {
        summaryGrid.innerHTML = '';
        summaryGrid.className = "mb-12";

        // ── 메인 카드 9종 고정 키 (표시 순서 = 이 배열 순서) ──
        const MAIN_CARD_KEYS = [
            "암수술비",
            "항암방사선치료비",
            "항암약물치료비",
            "표적항암약물치료비",
            "면역항암약물치료비",
            "양성자방사선치료비",
            "다빈치로봇수술비",
            "중입자방사선치료비",
            "세기조절방사선치료비"
        ];

        // Header Title
        const header = document.createElement('div');
        header.className = "text-lg font-black mb-4 flex items-center justify-between";
        header.style.color = "var(--primary-color)";
        let headerAmountStr = formatKoAmount(grandTotalMin);
        if (grandTotalMin !== grandTotalMax) {
            headerAmountStr = `${formatKoAmount(grandTotalMin)} ~${formatKoAmount(grandTotalMax)}`;
        }
        header.innerHTML = `🛡️ 집계된 암 치료 보장금액 합계 <span style="font-size:1.1em; color:var(--primary-dark); margin-left:12px; font-family:'Outfit';">${headerAmountStr}</span>`;
        summaryGrid.appendChild(header);

        // Convert Map to Array
        const allItems = Array.from(summaryMap.entries());

        // 메인 9장 vs 기타 분리 (메인 9장은 MAIN_CARD_KEYS 순서 그대로 정렬)
        const mainItems = allItems
            .filter(([name]) => MAIN_CARD_KEYS.includes(name))
            .sort((a, b) => MAIN_CARD_KEYS.indexOf(a[0]) - MAIN_CARD_KEYS.indexOf(b[0]));
        const otherItems = allItems.filter(([name]) => !MAIN_CARD_KEYS.includes(name));

        // 메인 카드 그리드 (summaryGrid는 wrapper, 카드는 inner div에)
        const mainGrid = document.createElement('div');
        mainGrid.className = "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6";
        summaryGrid.appendChild(mainGrid);

        // 우측 기타 패널: HTML의 other-panel-container에 렌더링 (하단 블록에서 처리)
        const otherContainer = document.getElementById('other-panel-container');
        if (otherContainer) otherContainer.innerHTML = '';

        // 메인 9장 렌더링
        const sortedItems = mainItems;
        sortedItems.forEach(([name, data]) => {
            const card = document.createElement('div');
            card.className = "premium-card p-3 sm:p-5 rounded-3xl flex flex-col justify-start gap-3 sm:gap-4 transition-all duration-300 group";
            // Generate Sub-items HTML (name+amount 기준 중복 제거)
            const seenSubKeys = new Set();
            const dedupedItems = data.items.filter(sub => {
                if (isYusamOrSpecificAmOnly(sub)) return false;
                const key = sub.name + '|' + sub.amount + '|' + (sub.source || '');
                if (seenSubKeys.has(key)) return false;
                seenSubKeys.add(key);
                return true;
            });
            const PAY_TAG_MAP = {
                'once':          '<span style="color:#7C3AED;font-weight:800;font-size:0.6rem;background:#F5F3FF;padding:1px 4px;border-radius:3px;margin-right:3px;vertical-align:middle">(최초1회)</span>',
                'once-each':     '<span style="color:#B45309;font-weight:800;font-size:0.6rem;background:#FFFBEB;padding:1px 4px;border-radius:3px;margin-right:3px;vertical-align:middle">(각각1회)</span>',
                'annual':        '<span style="color:#059669;font-weight:800;font-size:0.6rem;background:#ECFDF5;padding:1px 4px;border-radius:3px;margin-right:3px;vertical-align:middle">(연간1회)</span>',
                'annual-3type':  '<span style="color:#0369A1;font-weight:800;font-size:0.6rem;background:#E0F2FE;padding:1px 4px;border-radius:3px;margin-right:3px;vertical-align:middle">(연 3종류)</span>'
            };

            const buildSubItemHtml = (sub) => {
                if (sub.sub && Array.isArray(sub.sub)) {
                    return sub.sub.map(inner => {
                        const parts = inner.trim().split(' ');
                        const iAmt = parts.pop();
                        const iName = parts.join(' ');
                        return `<div class="text-[10px] mt-1 flex items-center justify-between font-medium text-gray-400">
                            <span class="truncate mr-2 flex-1 pl-3">ㄴ ${iName}</span>
                            <span class="whitespace-nowrap flex-shrink-0">${iAmt}</span>
                        </div>`;
                    }).join('');
                }
                let amtDisplay = sub.amount;
                if (!amtDisplay.includes('(') && !amtDisplay.includes('~')) amtDisplay = formatDisplayAmount(sub.amount);
                if (sub.maxAmount && sub.maxAmount !== sub.amount && !amtDisplay.includes('(')) {
                    amtDisplay = `${formatDisplayAmount(sub.amount)}(${formatDisplayAmount(sub.maxAmount)})`;
                }
                const bigugeumTag = sub.비급여 ? '<span style="color:#e53e3e;font-weight:800;font-size:0.65rem">(비급여)</span> ' : '';
                const walletTag = sub.fromWallet ? '<span style="color:#DB2777;font-weight:800;font-size:0.65rem">(10억월렛)</span> ' : '';
                const stageTag = sub.stage === '4기'
                    ? '<span style="color:#e53e3e;font-weight:800;font-size:0.65rem">(4기)</span> '
                    : sub.stage === '1~3기' ? '<span style="color:#F97316;font-weight:800;font-size:0.65rem">(1~3기)</span> ' : '';
                const hasAnnualCount = sub.annualCount && sub.annualCount > 1;
                // annualCount 배지(연N회)가 더 구체적인 정보이므로, 있을 땐 기존 payFreq 태그(연간1회 등)는 숨김
                const payTag = hasAnnualCount ? '' : (PAY_TAG_MAP[sub.payFreq] || '');
                const annualCountTag = hasAnnualCount
                    ? `<span style="color:#7C3AED;font-weight:800;font-size:0.6rem;background:#F5F3FF;padding:1px 4px;border-radius:3px;margin-right:3px;vertical-align:middle">(연${sub.annualCount}회)</span> `
                    : '';
                return `<div class="text-[10px] mt-1 flex items-center justify-between font-medium text-gray-400">
                    <span class="truncate mr-2 flex-1 pl-3">ㄴ ${bigugeumTag}${walletTag}${stageTag}${payTag}${annualCountTag}${sub.name}</span>
                    <span class="text-red-500 whitespace-nowrap flex-shrink-0 font-black">${amtDisplay}</span>
                </div>`;
            };

            let subItemsHtml = '';

            if (['samsung', 'meritz'].includes(insurer) && dedupedItems.length > 0) {
                // 삼성화재: source(담보명) 기준 그룹핑 → 접기/펼치기
                const srcMap = new Map();
                dedupedItems.forEach(sub => {
                    const src = sub.source || '';
                    if (!srcMap.has(src)) srcMap.set(src, []);
                    srcMap.get(src).push(sub);
                });
                srcMap.forEach((groupItems, srcName) => {
                    const groupTotal = groupItems.reduce((s, sub) => s + parseKoAmount(sub.amount), 0);
                    const truncSrc = srcName.length > 26 ? srcName.substring(0, 26) + '…' : srcName;
                    const itemsHtml = groupItems.map(sub => buildSubItemHtml(sub)).join('');
                    subItemsHtml += `
                        <details open class="mt-3" style="list-style:none">
                            <summary style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:4px 6px;border-radius:5px;background:rgba(0,0,0,0.03);font-size:10.5px;font-weight:700;color:#666;margin-bottom:2px;user-select:none;list-style:none" title="${srcName}">
                                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">ㄴ ${truncSrc}</span>
                                <span style="color:#e53e3e;font-weight:800;font-size:11px;white-space:nowrap;flex-shrink:0">${formatKoAmount(groupTotal)}</span>
                            </summary>
                            <div>${itemsHtml}</div>
                        </details>`;
                });
            } else {
                // 기타 보험사: 기존 flat 렌더링
                dedupedItems.forEach(sub => {
                    let truncatedSource = sub.source;
                    if (truncatedSource.length > 28) truncatedSource = truncatedSource.substring(0, 28) + "...";
                    subItemsHtml += `
                        <div class="mt-4 pl-2 border-l-2 border-red-500/10 group/row">
                            <div class="flex items-center justify-between text-[11px] font-bold text-gray-700/90 mb-0.5">
                                <span class="truncate mr-2 flex-1" title="${sub.source}">ㄴ ${truncatedSource}</span>
                            </div>
                            ${buildSubItemHtml(sub)}
                        </div>`;
                });
            }
            let totalDisplay = formatKoAmount(data.totalMin);
            if (data.totalMin !== data.totalMax) {
                totalDisplay = `${formatKoAmount(data.totalMin)}~${formatKoAmount(data.totalMax)}`;
            }
            const getSummaryIcon = (name) => {
                const map = {
                    "표적항암약물치료비": ICON_A_B64,
                    "면역항암약물치료비": ICON_B_B64,
                    "양성자방사선치료비": ICON_C_B64,
                    "암수술비": ICON_D_B64,
                    "다빈치로봇수술비": ICON_E_B64,
                    "항암약물치료비": ICON_F_B64,
                    "항암방사선치료비": ICON_G_B64,
                    "중입자방사선치료비": ICON_H_B64,
                    "세기조절방사선치료비": ICON_I_B64
                };
                return map[name] || ICON_A_B64;
            };

            const iconPath = getSummaryIcon(name);

            // Staggered Two-Line Display Logic
            let totalHtml = '';
            if (totalDisplay.includes('~')) {
                const [min, max] = totalDisplay.split('~');
                totalHtml = `
                        <div class="flex flex-col items-end leading-tight">
                            <span class="text-xl sm:text-2xl font-black text-red-600 font-outfit pr-8" style="color:var(--primary-bright);">${min}~</span>
                            <span class="text-xl sm:text-2xl font-black text-red-600 font-outfit" style="color:var(--primary-bright);">${max}</span>
                        </div>`;
            } else {
                totalHtml = `<p class="text-xl sm:text-2xl font-black text-red-600 font-outfit leading-tight break-keep" style="color:var(--primary-bright);">${totalDisplay}</p>`;
            }

            card.innerHTML = `
                <div class="flex flex-col gap-3 sm:gap-4">
                    <div class="flex items-start justify-between min-h-[64px]">
                        <div class="w-20 h-20 flex-shrink-0 -mt-2 -ml-2">
                            ${(() => {
                    if (!iconPath) return "";
                    let style = "";
                    if (iconPath === ICON_C_B64) style = 'style="transform: scale(1.8);"';
                    else if (iconPath === ICON_F_B64) style = 'style="transform: scale(1.4);"';
                    return `<img src="${iconPath}" class="w-full h-full object-contain" ${style} alt="${name} icon">`;
                })()}
                        </div>
                        <div class="text-right pt-1 flex-1">
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">COVERAGE TOTAL</p>
                            ${totalHtml}
                        </div>
                    </div>
                    <div class="h-px w-full bg-gray-50 border-t border-dashed border-gray-100"></div>
                <div class="flex-1">
                    <h4 class="text-sm font-black text-gray-800 mb-1 leading-tight">${name}</h4>
                    <div class="sub-items-container">${subItemsHtml}</div>
                </div>
            </div>`;
            mainGrid.appendChild(card);
        });

        // ── 기타 담보 패널 렌더링 ──
        const walletOthers      = (insurer === 'heungkuk') ? (window._heungkukWalletOthers      || null) : null;
        const sanggup2Others    = (insurer === 'heungkuk') ? (window._heungkukSanggup2Others    || null) : null;
        const livingCostOthers  = (insurer === 'heungkuk') ? (window._heungkukLivingCostOthers  || null) : null;
        const hasOtherItems       = otherItems.length > 0;
        const hasWalletOthers     = walletOthers     && walletOthers.length     > 0;
        const hasSanggup2Others   = sanggup2Others   && sanggup2Others.length   > 0;
        const hasLivingCostOthers = livingCostOthers && livingCostOthers.length > 0;
        // 삼성 무료 부가서비스(병원동행/가정케어) 안내 대상 여부
        // 특정 상품명에 한정하지 않고, PDF 뒷부분(OCR 폴백 포함 fullText)에서 서비스명이
        // 실제로 검출된 상품에서만 노출 — main.js에서 이미 감지해 meta에 실어 보냄
        const hasHospitalCompanionService = insurer === 'samsung' && !!(meta && meta.hasHospitalCompanionService);
        const hasHomeCareService = insurer === 'samsung' && !!(meta && meta.hasHomeCareService);
        const hasAnySamsungService = hasHospitalCompanionService || hasHomeCareService;

        if (otherContainer && (hasOtherItems || hasWalletOthers || hasSanggup2Others || hasLivingCostOthers || hasAnySamsungService)) {
            otherContainer.classList.remove('hidden');

            // ── 월렛 기타담보 섹션 (흥국 전용, 최상단) ──
            if (hasWalletOthers) {
                const walletPanel = document.createElement('div');
                walletPanel.className = "premium-card rounded-3xl p-5 flex flex-col gap-3 mb-4";
                walletPanel.style.border = "1.5px dashed rgba(219,39,119,0.35)";
                walletPanel.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base">💊</span>
                        <h4 class="text-sm font-black" style="color:#9D174D;">10억월렛 기타담보</h4>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium -mt-1">월렛에 포함된 추가 보장 항목 (암 치료비 집계 외)</p>
                    <div id="wallet-other-list" class="flex flex-col gap-0"></div>`;
                otherContainer.appendChild(walletPanel);

                const wList = walletPanel.querySelector('#wallet-other-list');
                walletOthers.forEach(wi => {
                    const noteHtml = wi.note ? `<span style="color:#DB2777;font-weight:800;font-size:0.65rem"> ${wi.note}</span>` : '';
                    const row = document.createElement('div');
                    row.className = "flex items-center justify-between gap-2 py-2 border-b border-pink-50 last:border-0";
                    row.innerHTML = `
                        <p class="text-[11px] font-bold text-gray-700 leading-snug flex-1">${wi.name}${noteHtml}</p>
                        <span class="text-[13px] font-black font-outfit flex-shrink-0" style="color:#DB2777;">${wi.amount}</span>`;
                    wList.appendChild(row);
                });
            }

            // ── 상급종합병원통합치료비II 기타담보 섹션 (흥국 전용) ──
            if (hasSanggup2Others) {
                const sg2Panel = document.createElement('div');
                sg2Panel.className = "premium-card rounded-3xl p-5 flex flex-col gap-3 mb-4";
                sg2Panel.style.border = "1.5px dashed rgba(59,130,246,0.35)";
                sg2Panel.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base">🏥</span>
                        <h4 class="text-sm font-black" style="color:#1D4ED8;">상급종합병원통합치료비II 기타담보</h4>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium -mt-1">암 치료비 집계 외 포함 보장 항목</p>
                    <div id="sanggup2-other-list" class="flex flex-col gap-0"></div>`;
                otherContainer.appendChild(sg2Panel);

                const sg2List = sg2Panel.querySelector('#sanggup2-other-list');
                sanggup2Others.forEach(wi => {
                    const row = document.createElement('div');
                    row.className = "flex items-center justify-between gap-2 py-2 border-b border-blue-50 last:border-0";
                    row.innerHTML = `
                        <p class="text-[11px] font-bold text-gray-700 leading-snug flex-1">${wi.name}</p>
                        <span class="text-[13px] font-black font-outfit flex-shrink-0" style="color:#1D4ED8;">${wi.amount}</span>`;
                    sg2List.appendChild(row);
                });
            }

            // ── 생활비(2회~3회이상) 기타담보 섹션 (흥국 전용) ──
            if (hasLivingCostOthers) {
                const lcPanel = document.createElement('div');
                lcPanel.className = "premium-card rounded-3xl p-5 flex flex-col gap-3 mb-4";
                lcPanel.style.border = "1.5px dashed rgba(22,163,74,0.35)";
                lcPanel.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base">💰</span>
                        <h4 class="text-sm font-black" style="color:#15803D;">생활비 담보 (2회~3회이상)</h4>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium -mt-1">암 치료비 집계 외 추가 생활비 보장</p>
                    <div id="livingcost-other-list" class="flex flex-col gap-0"></div>`;
                otherContainer.appendChild(lcPanel);

                const lcList = lcPanel.querySelector('#livingcost-other-list');
                livingCostOthers.forEach(wi => {
                    const row = document.createElement('div');
                    row.className = "flex items-center justify-between gap-2 py-2 border-b border-green-50 last:border-0";
                    row.innerHTML = `
                        <p class="text-[11px] font-bold text-gray-700 leading-snug flex-1">${wi.name}</p>
                        <span class="text-[13px] font-black font-outfit flex-shrink-0" style="color:#15803D;">${wi.amount}</span>`;
                    lcList.appendChild(row);
                });
            }

            // ── 삼성 무료 부가서비스 안내 (병원동행 / 가정케어, 검출된 것만 표시) ──
            if (hasAnySamsungService) {
                const svcPanel = document.createElement('div');
                svcPanel.className = "premium-card rounded-3xl p-5 flex flex-col gap-3 mb-4";
                svcPanel.style.border = "1.5px dashed rgba(0,0,0,0.12)";
                const hospitalBlock = hasHospitalCompanionService ? `
                        <div>
                            <p class="text-[11px] font-black text-gray-700 mb-1">🚑 병원동행 서비스</p>
                            <p class="text-[10px] text-gray-400 leading-relaxed">3대 질환(암·뇌혈관·허혈성심장) 진단/의심소견 또는 간·폐·신장, 근골격계 수술(예정) 시, 동행매니저가 병원 이동·진료 동행·간호사 상담·진료예약을 도와드려요. <span class="font-bold" style="color:var(--primary-color);">4시간 기준 합산 20회</span> 제공.</p>
                        </div>` : '';
                const homeCareBlock = hasHomeCareService ? `
                        <div>
                            <p class="text-[11px] font-black text-gray-700 mb-1">🏠 가정케어 서비스</p>
                            <p class="text-[10px] text-gray-400 leading-relaxed">같은 대상 질환으로 진단/수술 시, 전문요양보호사가 집으로 방문해 가사·신체활동·인지·정서 지원을 도와드려요. <span class="font-bold" style="color:var(--primary-color);">4시간 기준 최대 10회</span> 제공.</p>
                        </div>` : '';
                svcPanel.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base">🏥</span>
                        <h4 class="text-sm font-black" style="color:var(--primary-color);">무료 부가서비스 안내</h4>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium -mt-1">가입제안서에서 확인된 서비스만 안내해드려요</p>
                    <div class="flex flex-col gap-3">
                        ${hospitalBlock}${homeCareBlock}
                        <p class="text-[10px] text-gray-400 pt-1 border-t border-gray-100">📞 삼성화재 전용 콜센터 <span class="font-bold text-gray-700">1600-8204</span> (전화 신청 → 서류 제출 → 이용)</p>
                    </div>`;
                otherContainer.appendChild(svcPanel);
            }

            // ── 일반 기타담보 섹션 ──
            if (hasOtherItems) {
                const otherPanel = document.createElement('div');
                otherPanel.className = "premium-card rounded-3xl p-5 flex flex-col gap-3";
                otherPanel.style.border = "1.5px dashed rgba(229,62,62,0.25)";
                otherPanel.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="text-base">✨</span>
                        <h4 class="text-sm font-black text-gray-700">이런 담보들도 있어요!</h4>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium -mt-1">메인 집계 외 추가 보장 항목입니다.</p>
                    <div id="other-items-list" class="flex flex-col gap-1"></div>`;
                otherContainer.appendChild(otherPanel);

                const listEl = otherPanel.querySelector('#other-items-list');
                otherItems.forEach(([name, data]) => {
                    let totalDisplay = formatKoAmount(data.totalMin);
                    if (data.totalMin !== data.totalMax) {
                        totalDisplay = `${formatKoAmount(data.totalMin)}~${formatKoAmount(data.totalMax)}`;
                    }
                    const row = document.createElement('div');
                    row.className = "flex items-start justify-between gap-2 py-2.5 border-b border-gray-100 last:border-0";
                    row.innerHTML = `
                        <div class="flex-1 min-w-0">
                            <p class="text-[11px] font-bold text-gray-700 leading-snug truncate" title="${name}">${name}</p>
                            <div class="mt-0.5 space-y-0.5">
                                ${data.items.filter(sub => !isYusamOrSpecificAmOnly(sub)).map(sub => {
                                    const btag = sub.비급여 ? '<span style="color:#e53e3e;font-weight:800;font-size:0.65rem">(비급여)</span> ' : '';
                                    return `<p class="text-[10px] text-gray-400 font-medium truncate">ㄴ ${btag}${sub.name}</p>`;
                                }).join('')}
                            </div>
                        </div>
                        <div class="flex-shrink-0 text-right">
                            <span class="text-[13px] font-black text-red-500 font-outfit">${totalDisplay}</span>
                        </div>`;
                    listEl.appendChild(row);
                });
            }
        } else if (otherContainer) {
            otherContainer.classList.add('hidden');
        }
    }
    // 3. Render Detail List
    listEl.innerHTML = '';
    // Sort results: Items with details come first
    results.sort((a, b) => {
        const hasDetailsA = !!findDetails(a.name);
        const hasDetailsB = !!findDetails(b.name);
        if (hasDetailsA && !hasDetailsB) return -1;
        if (!hasDetailsA && hasDetailsB) return 1;
        return 0;
    });
    results.forEach((item, idx) => {
        let details = findDetails(item.name);
        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            if (!variantData) {
                if (amountVal > 6000) variantData = details.data["8000"] || details.data["10000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
            }
            if (!variantData && details.data["10000"]) variantData = details.data["10000"];
            details = variantData;
        }
        // Handle Passthrough Type
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }
        // Handle Passthrough-Dual (암 수술비(유사암제외)) - 세부내역에 "암 수술비 ###원" 표시
        if (details && details.type === 'passthrough-dual') {
            details = [{ name: details.displayName, amount: item.amount }];
        }
        // Handle 26jong Type
        if (details && details.type === '26jong') {
            details = [{ name: details.detailName, amount: item.amount }];
        }
        const itemCard = document.createElement('div');
        itemCard.className = "premium-card rounded-2xl p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 stagger-in cursor-pointer hover:border-red-500/30 transition-all";
        itemCard.style.animationDelay = `${idx * 40} ms`;
        const icon = getCoverageIcon(item.name);
        let detailHtml = '';
        if (details && Array.isArray(details)) {
            detailHtml = `
            <div class="detail-content hidden mt-4 pt-4 border-t border-gray-100">
                    <p class="text-[11px] font-black text-red-600 mb-3 flex items-center gap-1.5">
                        <span class="w-1 h-1 bg-red-600 rounded-full"></span> 상세 보장 내역
                    </p>
                    <div class="space-y-3">
            `;
            details.forEach(det => {
                let amtDisplay = det.amount;
                if (!amtDisplay.includes('(') && !amtDisplay.includes('~')) {
                    amtDisplay = formatDisplayAmount(det.amount);
                }
                detailHtml += `
                    <div class="flex flex-col text-[11px] group/sub">
                        <div class="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg">
                            <span class="font-bold text-gray-700 mr-2 flex-1">${det.name}</span>
                            <span class="font-black text-gray-900">${amtDisplay}</span>
                        </div>
                `;
                if (det.sub) {
                    det.sub.forEach(sub => {
                        const parts = sub.trim().split(' ');
                        const subAmount = parts.pop();
                        const subName = parts.join(' ');
                        detailHtml += `
                            <div class="flex justify-between pl-4 mt-1.5 text-[10px] text-gray-400/80 font-medium leading-tight">
                                <span class="flex-1 mr-2 flex items-start gap-1">
                                    <span class="text-gray-300">ㄴ</span>
                                    <span>${subName}</span>
                                </span>
                                <span class="flex-shrink-0">${subAmount || ''}</span>
                            </div>
                         `;
                    });
                }
                detailHtml += `</div>`;
            });
            detailHtml += `</div></div>`;
        }
        const isHiclass = item.name.includes('하이클래스');
        itemCard.innerHTML = `
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 text-base shadow-inner">
                        ${icon}
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4 class="text-sm font-bold ${isHiclass ? 'text-red-600' : 'text-gray-800'} truncate" title="${item.name}">
                            ${isHiclass ? '<span style="font-size:0.6rem;font-weight:800;color:#e53e3e;background:#fff1f1;padding:1px 5px;border-radius:3px;margin-right:4px;vertical-align:middle">(비급여)</span>' : ''}${item.name}
                        </h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[11px] font-medium text-gray-400">${item.desc || '가입담보리스트 추출 항목'}</p>
                            ${details ? '<span class="text-[9px] font-black text-red-400 bg-red-50 px-1.5 py-0.5 rounded leading-none">세부내역 ▼</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="text-base sm:text-lg font-black text-red-600 font-outfit whitespace-nowrap">${formatDisplayAmount(item.amount)}</span>
                </div>
            </div>
            ${detailHtml}
        `;
        if (details) {
            itemCard.addEventListener('click', () => {
                const content = itemCard.querySelector('.detail-content');
                if (content) {
                    content.classList.toggle('hidden');
                    const badge = itemCard.querySelector('.text-red-400');
                    if (badge) badge.textContent = content.classList.contains('hidden') ? '세부내역 ▼' : '세부내역 ▲';
                }
            });
        }
        listEl.appendChild(itemCard);
    });

    // 수술비 토글 (삼성 + 수술비 담보 감지 시에만 노출)
    if (typeof setupSurgeryToggle === 'function') {
        try { setupSurgeryToggle(results, insurer); }
        catch (e) { console.warn('[surgery] 토글 초기화 실패', e); }
    }
}

// [NEW] Toggle Results List
function toggleResultsList() {
    const list = document.getElementById('results-list');
    const icon = document.getElementById('results-toggle-icon');
    if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        // Add a micro-delay for opacity transition
        setTimeout(() => {
            list.classList.remove('opacity-0');
            list.classList.add('opacity-100');
        }, 10);
        icon.classList.add('rotate-180');
    } else {
        list.classList.add('opacity-0');
        list.classList.remove('opacity-100');
        // Wait for transition before hiding
        setTimeout(() => {
            list.classList.add('hidden');
        }, 400);
        icon.classList.remove('rotate-180');
    }
}

// ── Image Export Function (Renamed from PDF for clarity) ──
window.exportAsImage = async function () {
    console.log('Exporting image started...');
    const target = document.querySelector('main');
    if (!target) {
        console.error('Target main element not found');
        return;
    }

    // 원본 파일명 가져오기 및 분석 키워드 추가
    const fileNameEl = document.getElementById('file-name');
    let originalName = '분석결과';
    if (fileNameEl && fileNameEl.innerText) {
        originalName = fileNameEl.innerText.replace(/\.pdf$/i, '');
    }
    const finalFileName = `${originalName} 분석.png`;

    // 폰트 대기 (Google Font 로딩 보장)
    await document.fonts.ready;

    // ── 전문가 이름 읽기 (insight 섹션 DOM에서) ──
    const expertNameEl = document.querySelector('#insight-section b.text-gray-600');
    const captureExpertName = expertNameEl ? expertNameEl.textContent.trim() : '보험전문가';

    // ── QR 코드 사전 생성 (surinsur.com) ──
    let qrBase64 = '';
    try {
        const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https%3A%2F%2Fwww.surinsur.com&bgcolor=FFFFFF&color=1A3A8F&margin=2';
        const qrBlob = await fetch(qrUrl).then(r => r.blob());
        qrBase64 = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(qrBlob);
        });
    } catch (e) {
        console.warn('QR 코드 생성 실패, 생략합니다:', e);
    }

    const options = {
        scale: 3,
        useCORS: true,
        allowTaint: false, // Set to false to allow export if assets are clean
        backgroundColor: '#EBEBEB',
        logging: true,
        onclone: (clonedDoc) => {
            console.log('Clone created successfully');
            const cloneMain = clonedDoc.querySelector('main');
            if (!cloneMain) return;

            // 1. main의 모든 자식을 돌며 지정한 섹션 외에는 모두 숨김
            const allowedIds = ['file-info', 'insight-section', 'summary-section'];
            Array.from(cloneMain.children).forEach(child => {
                if (!allowedIds.includes(child.id)) {
                    child.style.display = 'none';
                }
            });

            // 2. 대상 섹션 강제 노출 및 내부 버튼 숨김
            const fileInfo = clonedDoc.getElementById('file-info');
            const insight = clonedDoc.getElementById('insight-section');
            const summary = clonedDoc.getElementById('summary-section');

            if (fileInfo) {
                fileInfo.style.display = 'flex';
                fileInfo.classList.remove('hidden');
                fileInfo.style.marginBottom = '24px';
                const resetBtn = fileInfo.querySelector('#reset-btn');
                if (resetBtn) resetBtn.style.display = 'none';
            }
            if (insight) {
                insight.style.display = 'block';
                insight.classList.remove('hidden');
                insight.style.marginBottom = '24px';
                insight.style.opacity = '1';
                insight.style.transform = 'translateY(0)';
                // Remove floating animation for capture
                insight.style.animation = 'none';
                // Hide blurred decoration which can cause artifacts in html2canvas
                const deco = insight.querySelector('.blur-3xl');
                if (deco) deco.style.display = 'none';
            }
            if (summary) {
                summary.style.display = 'block';
                summary.classList.remove('hidden');
                const exportBtn = summary.querySelector('#export-pdf-btn');
                if (exportBtn) exportBtn.style.display = 'none';

                // ── 수술비 뷰 캡처 ──
                // 수술비 토글이 켜져 있으면 그 화면 그대로 담는다. 토글 버튼 자체는 조작용
                // UI라 이미지에서는 뺀다. 상세는 펼친 것만 남기면 카드 높이가 들쭉날쭉해
                // 캡처가 지저분해지므로 전부 접어서 목록 형태로 통일한다.
                const sgToggle = clonedDoc.getElementById('surgery-toggle');
                if (sgToggle) sgToggle.style.display = 'none';
                const sgPanel = clonedDoc.getElementById('surgery-panel');
                const sgOn = sgPanel && !sgPanel.classList.contains('hidden');
                if (sgOn) {
                    sgPanel.style.display = 'block';
                    sgPanel.querySelectorAll('.sg-row').forEach(r => {
                        r.dataset.open = 'false';
                        const d = r.querySelector('.sg-d');
                        if (d) d.style.display = 'none';
                    });
                    sgPanel.querySelectorAll('.caret').forEach(c => { c.style.display = 'none'; });
                    // 면책 안내도 상단 리드 문구만 남기고 접는다. 상담 중 펼쳐본 상태로
                    // 캡처 버튼을 누르는 경우가 있어, 현재 열림 상태와 무관하게 강제로 접는다.
                    const disc = sgPanel.querySelector('.sg-disc');
                    if (disc) {
                        disc.dataset.open = 'false';
                        const rest = disc.querySelector('.sg-disc-rest');
                        if (rest) rest.style.display = 'none';
                        const caret = disc.querySelector('.sg-disc-caret');
                        if (caret) caret.style.display = 'none';
                    }
                }
            }

            const style = clonedDoc.createElement('style');
            style.innerHTML = `
            * {
                font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif !important;
                letter-spacing: 0 !important;
                word-spacing: 0 !important;
                animation: none !important;
                transition: none !important;
            }
            span, div, p, b, h1, h2, h3 {
                line-height: 1.6 !important;
                overflow: visible !important;
            }
            `;
            clonedDoc.head.appendChild(style);

            // ── 캡처용 색상 고정 ──
            // 앱 자체는 항상 라이트로 동작하지만(다크 오버라이드 제거됨), html2canvas는
            // Tailwind 유틸리티 클래스와 보험사 테마 변수를 그대로 읽어가므로 캡처 시점의
            // 값을 여기서 한 번 더 못박아 PNG 색이 흔들리지 않게 한다.
            const forceLightStyle = clonedDoc.createElement('style');
            forceLightStyle.innerHTML = `
            :root {
                --bg-light: #E4E7F0; --white: #FFFFFF;
                --gray-dark: #0E1629; --gray-mid: #5A607A;
                --border-color: rgba(0, 0, 0, 0.08);
            }
            body.meritz-theme { --bg-light: #EBEBEB; --gray-dark: #404040; --gray-mid: #8C8C8C; --primary-bright: #E60000; --primary-color: #E60000; }
            body.samsung-theme  { --bg-light: #EAECF4; --primary-bright: #1251CC; --primary-color: #1251CC; }
            body.db-theme        { --bg-light: #E8F5EE; --primary-bright: #00A04B; --primary-color: #00A04B; }
            body.heungkuk-theme  { --bg-light: #FDF2F8; --primary-bright: #DB2777; --primary-color: #DB2777; }
            body:not(.samsung-theme):not(.db-theme):not(.heungkuk-theme):not(.meritz-theme) { --primary-bright: #1A3A8F; --primary-color: #1A3A8F; }
            body { background-color: var(--bg-color) !important; color: var(--text-main) !important; }
            .premium-card { box-shadow: 0 4px 20px rgba(0,0,0,0.04) !important; }
            .bg-white { background-color: #fff !important; }
            .bg-gray-50 { background-color: #f9fafb !important; }
            .bg-gray-100 { background-color: #f3f4f6 !important; }
            .text-gray-900, .text-gray-800, .text-gray-700 { color: #1f2937 !important; }
            .text-gray-600 { color: #4b5563 !important; }
            .text-gray-500 { color: #6b7280 !important; }
            .border-gray-100, .border-gray-200 { border-color: #e5e7eb !important; }
            .bg-gray-800 { background-color: #1f2937 !important; }
            [style*="color:#666"] { color: #666 !important; }
            [style*="background:rgba(0,0,0,0.03)"] { background: rgba(0,0,0,0.03) !important; }
            #insurer-more-toggle { color: #6b7280 !important; border-color: #d1d5db !important; background: #fff !important; }
            [onclick="openAboutModal()"] { color: #1A3A8F !important; }
            [onclick="openInsightModal()"] { color: #e91e8c !important; }
            [style*="color:#333"] { color: #333 !important; }
            .welcome-greet { color: #888 !important; }
            .welcome-name  { color: #1a1a1a !important; }
            .text-red-600, .text-red-500 { color: var(--primary-bright) !important; }
            .bg-red-600, .hover\\:bg-red-700:hover { background-color: var(--primary-bright) !important; }
            .border-red-600, .border-red-500 { border-color: var(--primary-bright) !important; }
            .insight-card-gradient { background: linear-gradient(135deg, #fff 0%, #fffafa 100%) !important; }
            .manager-welcome-float { background: rgba(255,255,255,0.85) !important; }
            #score-box { background: rgba(255,255,255,0.6) !important; border-color: rgba(0,0,0,0.05) !important; }
            /* 수술비 패널 토큰도 라이트값으로 되돌린다 (style.css의 다크 오버라이드 무력화) */
            :root {
              --sg-surface:#FFFFFF; --sg-surface-2:#F7F9FC; --sg-line:#E3E7F0;
              --sg-ink:#0E1629; --sg-ink-2:#39415C; --sg-muted:#6B7290; --sg-off:#A8AEC0;
              --sg-chip:#EEF1F7; --sg-chip-ink:#39415C; --sg-accent:#0B6B7A; --sg-accent-soft:#E2F1F4;
              --sg-etc:#F3F0E8; --sg-etc-ink:#8A6A12;
              --sg-note-bg:#FDF6EC; --sg-note-line:#F0DFC4; --sg-note-ink:#7A5A12;
              --sg-g1:#DDE4F2; --sg-g1i:#39415C; --sg-g2:#C3D0EA; --sg-g2i:#39415C;
              --sg-g3:#9DB2DE; --sg-g4:#7391D0; --sg-g5:#4A6FC2; --sg-gi:#FFFFFF;
              --sg-shadow:rgba(14,22,41,.06); --sg-shadow-2:rgba(14,22,41,.08);
            }
            `;
            clonedDoc.head.appendChild(forceLightStyle);

            // ── 오류 제보 아일랜드 & 기타 패널 숨김 (캡처 불필요) ──
            const errorIsland = clonedDoc.getElementById('error-report-island');
            if (errorIsland) errorIsland.style.display = 'none';
            const otherPanel = clonedDoc.getElementById('other-panel-container');
            if (otherPanel) otherPanel.style.display = 'none';

            // ── QR 코드를 insight 카드 우측에 주입 (별도 헤더 박스 없이) ──
            if (insight && qrBase64) {
                const flexRow = insight.querySelector('.flex');
                if (flexRow) {
                    const qrEl = clonedDoc.createElement('div');
                    qrEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;margin-left:auto;padding-left:16px;';
                    qrEl.innerHTML = `
                        <img src="${qrBase64}" style="width:108px;height:108px;border-radius:12px;border:2px solid rgba(255,255,255,0.6);">
                        <span style="font-size:16px;color:#64748b;font-weight:700;white-space:nowrap;letter-spacing:0.03em;">surinsur.com</span>
                    `;
                    flexRow.appendChild(qrEl);
                }
            }

            // ── 최신 CSS 색상 함수 → rgba 치환 (html2canvas 1.4.1 호환 안전장치) ──
            // html2canvas 1.4.1은 rgb/rgba/hsl/hsla만 파싱한다. color-mix() 등을 쓰면 크롬/엣지의
            // computed style이 color(srgb ...) 형식을 돌려주는데, 이때 캡처가
            // "Attempting to parse an unsupported color function color" 오류로 통째로 실패한다.
            // CSS에서 color-mix()를 걷어냈지만, Tailwind CDN 등 외부 스타일에서 다시 유입될 수
            // 있으므로 캡처 직전에 남아있는 color() 값을 인라인 rgba로 덮어써 방어한다.
            try {
                const view = clonedDoc.defaultView;
                if (view) {
                    const toRgba = (value) => value.replace(
                        /color\(\s*(?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s*(?:\/\s*([\d.eE+-]+%?)\s*)?\)/g,
                        (match, r, g, b, a) => {
                            const to255 = (v) => Math.max(0, Math.min(255, Math.round(parseFloat(v) * 255)));
                            let alpha = 1;
                            if (a !== undefined) alpha = a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
                            if (!isFinite(alpha)) alpha = 1;
                            return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${alpha})`;
                        }
                    );
                    const COLOR_PROPS = [
                        'color', 'backgroundColor', 'backgroundImage', 'boxShadow',
                        'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
                        'outlineColor', 'textDecorationColor', 'columnRuleColor', 'fill', 'stroke'
                    ];
                    // 문제의 규칙들이 !important로 선언돼 있어, 인라인 스타일도 반드시
                    // important로 넣어야 우선순위에서 이긴다 (그냥 el.style.x = ... 는 무시됨)
                    const toKebab = (p) => p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
                    let patched = 0;
                    clonedDoc.querySelectorAll('*').forEach(el => {
                        const cs = view.getComputedStyle(el);
                        if (!cs) return;
                        COLOR_PROPS.forEach(prop => {
                            const v = cs[prop];
                            if (typeof v === 'string' && v.includes('color(')) {
                                el.style.setProperty(toKebab(prop), toRgba(v), 'important');
                                patched++;
                            }
                        });
                    });
                    if (patched > 0) console.log(`[export] 미지원 색상 함수 ${patched}건을 rgba로 치환했습니다.`);
                }
            } catch (colorErr) {
                console.warn('[export] 색상 함수 치환 중 오류(무시하고 진행):', colorErr);
            }
        }
    };

    try {
        console.log('Calling html2canvas...');
        const canvas = await html2canvas(target, options);
        console.log('Canvas generated successfully');
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        link.download = finalFileName;
        link.click();
        console.log('Image download triggered');
    } catch (err) {
        console.error('Capture Error Details:', err);
        alert(`이미지 저장 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'} `);
    }
};

// ── Error Report Dynamic Island Logic ──
window.toggleErrorReport = function(e) {
    if (e) e.stopPropagation();
    window.expandErrorReport();
};

window.expandErrorReport = function(e) {
    if (e) e.stopPropagation();
    const island = document.getElementById('error-report-island');
    const collapsed = document.getElementById('error-island-collapsed');
    const expanded = document.getElementById('error-island-expanded');
    
    // Check if already expanded (by checking height)
    if (island.style.height === '420px') return;
    
    // Expand dimensions (growing upwards from bottom right)
    island.style.width = '320px';
    island.style.height = '420px';
    island.style.borderRadius = '24px';
    // Remove pointer-cursor once expanded
    island.style.cursor = 'default';
    
    collapsed.style.opacity = '0';
    setTimeout(() => {
        collapsed.classList.add('hidden');
        expanded.classList.remove('hidden');
        // small delay for display block to apply before opacity transition
        setTimeout(() => {
            expanded.style.opacity = '1';
            expanded.style.pointerEvents = 'auto';
        }, 50);
    }, 150);
};

window.closeErrorReport = function(e) {
    if (e) e.stopPropagation();
    const island = document.getElementById('error-report-island');
    const collapsed = document.getElementById('error-island-collapsed');
    const expanded = document.getElementById('error-island-expanded');
    
    // Revert to button state
    island.style.width = '130px';
    island.style.height = '36px';
    island.style.borderRadius = '12px';
    island.style.cursor = 'pointer';
    
    expanded.style.opacity = '0';
    expanded.style.pointerEvents = 'none';
    
    setTimeout(() => {
        expanded.classList.add('hidden');
        collapsed.classList.remove('hidden');
        setTimeout(() => {
            collapsed.style.opacity = '1';
        }, 50);
    }, 300);
    
    // Clear form
    setTimeout(() => {
        document.getElementById('error-report-form').reset();
    }, 400);
};

window.submitErrorReport = async function(e) {
    e.preventDefault();
    const email = document.getElementById('error-email').value;
    const content = document.getElementById('error-content').value;
    const fileInput = document.getElementById('error-file');
    const file = fileInput.files[0];
    
    const statusEl = document.getElementById('error-upload-status');
    const submitBtn = document.getElementById('error-submit-btn');
    
    statusEl.classList.remove('hidden');
    statusEl.classList.add('flex');
    submitBtn.classList.add('opacity-50', 'pointer-events-none');
    submitBtn.innerHTML = '<span>처리 중...</span>';
    
    try {
        if (typeof window.uploadErrorReport === 'function') {
            await window.uploadErrorReport(email, content, file);
        } else {
            throw new Error("Supabase 함수를 찾을 수 없습니다.");
        }
        
        showToast('오류 제보가 성공적으로 접수되었습니다!', false);
        window.closeErrorReport();
    } catch (err) {
        showToast('오류 제보 중 문제가 발생했습니다: ' + err.message, true);
    } finally {
        statusEl.classList.add('hidden');
        statusEl.classList.remove('flex');
        submitBtn.classList.remove('opacity-50', 'pointer-events-none');
        submitBtn.innerHTML = '<span>제보하기</span>';
    }
};

