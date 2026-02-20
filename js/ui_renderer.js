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
function renderResults(results, customerName = '고객') {
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
    const summaryMap = calculateHierarchicalSummary(results);
    // Calculate Grand Total Range
    let grandTotalMin = 0;
    let grandTotalMax = 0;
    summaryMap.forEach(d => {
        grandTotalMin += d.totalMin;
        grandTotalMax += d.totalMax;
    });

    // ── Render 5-Year Insight Card ──
    if (insightSection) {
        insightSection.innerHTML = '';
        const total5Min = grandTotalMin * 5;
        const total5Max = grandTotalMax * 5;

        let total5Display = formatKoAmount(total5Min);
        if (total5Min !== total5Max) {
            total5Display = `${formatKoAmount(total5Min)} ~ ${formatKoAmount(total5Max)}`;
        }

        // Conditional Expert Mapping
        let expertName = "메리";
        let expertImgBase64 = MERY_B64; // Use global Base64 string
        if (currentFileName && currentFileName.startsWith("325001957")) {
            expertName = "예원";
            expertImgBase64 = YEWON_B64; // Use global Base64 string
        }

        insightSection.innerHTML = `
            <div class="premium-card rounded-3xl p-6 shadow-xl border-none insight-card-gradient animate-insight relative overflow-hidden group">
                <!-- Background Decoration -->
                <div class="absolute -right-4 -top-4 w-32 h-32 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition-colors"></div>
                
                <div class="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                    <div class="relative shrink-0">
                        <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-red-100 border-2 border-white ring-1 ring-red-100">
                             <img src="${expertImgBase64}" alt="보험전문가 ${expertName}" class="w-full h-full object-cover object-top">
                        </div>
                        <div class="absolute -bottom-2 -right-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md uppercase tracking-tighter">
                            Expert
                        </div>
                    </div>
                    <div class="text-center sm:text-left flex-1">
                        <p class="text-gray-500 text-[13px] font-bold mb-1 opacity-80">
                            🛡️ <span class="text-gray-400">보험전문가 <b class="text-gray-600">${expertName}</b>의 insight : 전문 통계에 의하면 암치료는 5년정도 받는대요 !</span>
                        </p>
                        <h3 class="text-lg sm:text-xl font-medium text-gray-800 leading-relaxed">
                            <span class="font-black text-red-600 underline decoration-red-200 underline-offset-4">${customerName}</span>님이 
                            <span class="font-bold text-gray-900 mx-1">5년간</span> 보장받을 수 있는 
                            <span class="font-black text-gray-900 border-b-2 border-red-500/30">암 치료비</span>는 최대
                        </h3>
                        <div class="mt-2 flex items-baseline gap-2 justify-center sm:justify-start">
                            <span class="text-3xl sm:text-4xl font-black text-red-600 tracking-tight font-outfit">
                                ${total5Display}
                            </span>
                            <span class="text-gray-400 text-xs font-bold ml-1">입니다.</span>
                        </div>
                        <p class="text-[10px] text-gray-400 mt-3 font-medium tracking-tight leading-tight">
                            * 위 금액은 아래과정에서 산출된 암 치료비 합산의 단순히 5배를 곱한 값입니다. 실제 보장금액과 상이합니다.
                        </p>
                    </div>
                </div>
            </div>
        `;
        insightSection.classList.remove('hidden');
    }
    // 2. Render Summary Grid
    if (summaryMap.size > 0) {
        summaryGrid.innerHTML = '';
        summaryGrid.className = "grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12";
        // Header Title
        const header = document.createElement('div');
        header.className = "col-span-1 sm:col-span-3 text-lg font-black mb-2 flex items-center justify-between";
        header.style.color = "var(--primary-color)";
        let headerAmountStr = formatKoAmount(grandTotalMin);
        if (grandTotalMin !== grandTotalMax) {
            headerAmountStr = `${formatKoAmount(grandTotalMin)} ~${formatKoAmount(grandTotalMax)}`;
        }
        header.innerHTML = `🛡️ 집계된 암 치료 보장금액 합계 <span style="font-size:1.1em; color:var(--primary-dark); margin-left:12px; font-family:'Outfit';">${headerAmountStr}</span>`;
        summaryGrid.appendChild(header);
        // Convert Map to Array and Sort
        const sortedItems = Array.from(summaryMap.entries()).sort((a, b) => {
            const priorities = ["표적", "면역", "양성자"];
            const getPriority = (n) => {
                for (let i = 0; i < priorities.length; i++) {
                    if (n.includes(priorities[i])) return i;
                }
                return 99;
            };
            return getPriority(a[0]) - getPriority(b[0]);
        });
        sortedItems.forEach(([name, data]) => {
            const card = document.createElement('div');
            card.className = "premium-card p-5 rounded-3xl flex flex-col justify-start gap-4 transition-all duration-300 group";
            // Generate Sub-items HTML
            let subItemsHtml = '';
            data.items.forEach(sub => {
                let truncatedSource = sub.source;
                if (truncatedSource.length > 28) {
                    truncatedSource = truncatedSource.substring(0, 28) + "...";
                }

                let innerTreeHtml = '';
                if (sub.sub && Array.isArray(sub.sub)) {
                    // Cumulative Logic (Custom II variant or similar)
                    sub.sub.forEach(inner => {
                        const parts = inner.trim().split(' ');
                        const iAmt = parts.pop();
                        const iName = parts.join(' ');
                        innerTreeHtml += `
                            <div class="text-[10px] mt-1 flex items-center justify-between font-medium text-gray-400">
                                <span class="truncate mr-2 flex-1 pl-3">ㄴ ${iName}</span>
                                <span class="whitespace-nowrap flex-shrink-0 group-hover/row:text-red-400 transition-colors">${iAmt}</span>
                            </div>`;
                    });
                } else {
                    // Normal Item
                    let amtDisplay = sub.amount;
                    if (!amtDisplay.includes('(') && !amtDisplay.includes('~')) {
                        amtDisplay = formatDisplayAmount(sub.amount);
                    }
                    if (sub.maxAmount && sub.maxAmount !== sub.amount && !amtDisplay.includes('(')) {
                        amtDisplay = `${formatDisplayAmount(sub.amount)}(${formatDisplayAmount(sub.maxAmount)})`;
                    }
                    innerTreeHtml = `
                        <div class="text-[10px] mt-1 flex items-center justify-between font-medium text-gray-400">
                            <span class="truncate mr-2 flex-1 pl-3">ㄴ ${sub.name}</span>
                            <span class="text-red-500 whitespace-nowrap flex-shrink-0 font-black">${amtDisplay}</span>
                        </div>`;
                }

                subItemsHtml += `
                    <div class="mt-4 pl-2 border-l-2 border-red-500/10 group/row">
                        <div class="flex items-center justify-between text-[11px] font-bold text-gray-700/90 mb-0.5">
                            <span class="truncate mr-2 flex-1" title="${sub.source}">ㄴ ${truncatedSource}</span>
                        </div>
                        ${innerTreeHtml}
                    </div>`;
            });
            const icon = getCoverageIcon(name);
            let totalDisplay = formatKoAmount(data.totalMin);
            if (data.totalMin !== data.totalMax) {
                totalDisplay = `${formatKoAmount(data.totalMin)}~${formatKoAmount(data.totalMax)}`;
            }
            // Dynamic Font Size for Total Display
            let fontSize = "text-2xl";
            if (totalDisplay.length > 15) fontSize = "text-[18px]";
            else if (totalDisplay.length > 12) fontSize = "text-[20px]";

            card.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">COVERAGE TOTAL</p>
                        <p class="${fontSize} font-black text-red-600 font-outfit leading-tight break-keep" style="color:var(--primary-bright);">
                            ${totalDisplay}
                        </p>
                    </div>
                    <div class="h-px w-full bg-gray-50"></div>
                    <div class="flex-1">
                        <h4 class="text-sm font-black text-gray-800 mb-1 leading-tight">${name}</h4>
                        <div class="sub-items-container">${subItemsHtml}</div>
                    </div>
                </div>`;
            summaryGrid.appendChild(card);
        });
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
        // Handle 26jong Type
        if (details && details.type === '26jong') {
            details = [{ name: details.detailName, amount: item.amount }];
        }
        const itemCard = document.createElement('div');
        itemCard.className = "premium-card rounded-2xl p-4 flex flex-col gap-4 stagger-in cursor-pointer hover:border-red-500/30 transition-all";
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
        itemCard.innerHTML = `
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 text-base shadow-inner">
                        ${icon}
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4 class="text-sm font-bold text-gray-800 truncate" title="${item.name}">${item.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[11px] font-medium text-gray-400">${item.desc || '가입담보리스트 추출 항목'}</p>
                            ${details ? '<span class="text-[9px] font-black text-red-400 bg-red-50 px-1.5 py-0.5 rounded leading-none">세부내역 ▼</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="text-lg font-black text-red-600 font-outfit">${formatDisplayAmount(item.amount)}</span>
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

// ── PDF Export Function ──
window.exportToPDF = async function () {
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

    const options = {
        scale: 2,
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
            }
            if (summary) {
                summary.style.display = 'block';
                summary.classList.remove('hidden');
                const exportBtn = summary.querySelector('#export-pdf-btn');
                if (exportBtn) exportBtn.style.display = 'none';
            }

            // 3. 폰트 명시적 주입 (외부 @import 제거 - Tainted Canvas 방지)
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
            * {
            font- family: 'Noto Sans KR', 'Malgun Gothic', sans - serif!important;
        letter - spacing: 0!important;
        word - spacing: 0!important;
    }
    span, div, p, b, h1, h2, h3 {
        line - height: 1.6!important;
        overflow: visible!important;
    }
    `;
            clonedDoc.head.appendChild(style);
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

