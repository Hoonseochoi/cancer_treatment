// ── Configuration & PDF.js ──
// PDF.js worker setup
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const defaultConfig = {
    main_title: "메리츠 암보장 분석기",
    subtitle_text: "가입제안서 PDF를 업로드하면 모든 보장 내역을 추출합니다",
    upload_button_text: "PDF 파일을 드래그하거나 클릭하세요",
    result_header_text: "전체 보장 내역 분석 결과",
    background_color: "#0B1120",
    surface_color: "#151D33",
    text_color: "#E8ECF4",
    primary_color: "#3B82F6",
    secondary_color: "#1E293B",
    font_family: "Noto Sans KR",
    font_size: 16
};

function applyConfig(config) {
    const c = { ...defaultConfig, ...config };
    const font = c.font_family || defaultConfig.font_family;
    const baseSize = c.font_size || defaultConfig.font_size;
    // ... (rest of config logic same as before) ...
    document.documentElement.style.setProperty('--bg-color', c.background_color);
    document.documentElement.style.setProperty('--surface-color', c.surface_color);
    document.documentElement.style.setProperty('--text-color', c.text_color);
    document.documentElement.style.setProperty('--primary-color', c.primary_color);
    document.documentElement.style.setProperty('--secondary-color', c.secondary_color);

    const wrapper = document.getElementById('app-wrapper');
    if (wrapper) {
        wrapper.style.background = c.background_color;
        wrapper.style.color = c.text_color;
    }

    const titleEl = document.getElementById('main-title');
    const subtitleEl = document.getElementById('subtitle');
    const uploadBtnEl = document.getElementById('upload-btn-text');
    const resultHeaderEl = document.getElementById('result-header');

    if (titleEl) {
        titleEl.textContent = c.main_title;
        titleEl.style.fontFamily = `'Outfit', '${font}', sans-serif`;
        titleEl.style.fontSize = `${baseSize * 2}px`;
    }
    if (subtitleEl) {
        subtitleEl.textContent = c.subtitle_text;
        subtitleEl.style.fontFamily = `'${font}', sans-serif`;
        subtitleEl.style.fontSize = `${baseSize * 0.875}px`;
    }
    if (uploadBtnEl) {
        uploadBtnEl.textContent = c.upload_button_text;
        uploadBtnEl.style.fontFamily = `'${font}', sans-serif`;
        uploadBtnEl.style.fontSize = `${baseSize}px`;
    }
    if (resultHeaderEl) {
        resultHeaderEl.textContent = c.result_header_text;
        resultHeaderEl.style.fontFamily = `'Outfit', '${font}', sans-serif`;
        resultHeaderEl.style.fontSize = `${baseSize}px`;
    }

    document.body.style.fontFamily = `'${font}', sans-serif`;
    document.body.style.fontSize = `${baseSize}px`;
}

if (window.elementSdk) {
    window.elementSdk.init({
        defaultConfig,
        onConfigChange: async (config) => { applyConfig(config); },
        mapToCapabilities: (config) => ({
            recolorables: [
                { get: () => config.background_color || defaultConfig.background_color, set: (v) => { config.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
                { get: () => config.surface_color || defaultConfig.surface_color, set: (v) => { config.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
                { get: () => config.text_color || defaultConfig.text_color, set: (v) => { config.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
                { get: () => config.primary_color || defaultConfig.primary_color, set: (v) => { config.primary_color = v; window.elementSdk.setConfig({ primary_color: v }); } },
                { get: () => config.secondary_color || defaultConfig.secondary_color, set: (v) => { config.secondary_color = v; window.elementSdk.setConfig({ secondary_color: v }); } }
            ],
            borderables: [],
            fontEditable: {
                get: () => config.font_family || defaultConfig.font_family,
                set: (v) => { config.font_family = v; window.elementSdk.setConfig({ font_family: v }); }
            },
            fontSizeable: {
                get: () => config.font_size || defaultConfig.font_size,
                set: (v) => { config.font_size = v; window.elementSdk.setConfig({ font_size: v }); }
            }
        }),
        mapToEditPanelValues: (config) => new Map([
            ["main_title", config.main_title || defaultConfig.main_title],
            ["subtitle_text", config.subtitle_text || defaultConfig.subtitle_text],
            ["upload_button_text", config.upload_button_text || defaultConfig.upload_button_text],
            ["result_header_text", config.result_header_text || defaultConfig.result_header_text]
        ])
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Script v1.5: Name Cleaning Updated");
    applyConfig(defaultConfig);
});


// ── RAW Extraction Logic ──
// 모든 텍스트 줄을 분석하되, 특정 범위(가입담보리스트 ~ 주의사항) 내에서만 추출
// + 노이즈 필터링 강화
function extractRawCoverages(text) {
    if (!text || typeof text !== 'string') {
        console.warn("extractRawCoverages: Invalid text input", text);
        return [];
    }

    const lines = text.split('\n');
    let targetLines = lines;
    let startIndex = -1;
    let endIndex = -1;

    // 1. 범위 필터링 (Noise Reduction) - 개선: 설명문이 아닌 실제 테이블 헤더만 감지
    const startKeywords = ["가입담보", "담보사항", "보장내용"];
    const endKeywords = ["주의사항", "유의사항", "보험금 지급", "알아두실"];

    // 시작점: 짧은 줄에서만 찾기 (설명문이 아닌 테이블 헤더/제목)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\s+/g, '');

        if (startIndex === -1) {
            // 40자 이하인 줄에서만 시작 키워드 검색 (긴 설명문 제외)
            if (line.length < 40 && startKeywords.some(k => line.includes(k))) {
                startIndex = i;
                console.log(`Start index found at line ${i}: ${lines[i]}`);
            }
        }
        else if (endIndex === -1) {
            // 종료 키워드도 짧은 줄에서만 (설명문에 포함된 "상품설명서" 등 무시)
            if (line.length < 40 && endKeywords.some(k => line.includes(k))) {
                endIndex = i;
                console.log(`End index found at line ${i}: ${lines[i]}`);
                break;
            }
        }
    }

    if (startIndex !== -1) {
        if (endIndex === -1) endIndex = lines.length;
        targetLines = lines.slice(startIndex, endIndex);
        console.log(`Range filtering applied: ${startIndex} ~ ${endIndex} (${targetLines.length} lines)`);

        // 범위가 너무 작으면 (10줄 미만) 전체 문서 스캔으로 Fallback
        if (targetLines.length < 10) {
            console.warn(`Range too small (${targetLines.length} lines). Falling back to full document scan.`);
            targetLines = lines;
            startIndex = -1; // reset for id calculation
        }
    } else {
        console.warn("Start keyword not found. Scanning entire document.");
    }

    // 1.5 줄 이어붙이기 (PDF 텍스트 레이어에서 줄이 분리된 경우 처리)
    // 예: "갱신형 암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))(통합간\n편가입)\n1천만원"
    //   → "갱신형 암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))(통합간편가입) 1천만원"
    const amountRegex = /[0-9,]+(?:억|천|백|십)*(?:만원|억원)|세부보장참조/;
    const mergedLines = [];
    let pendingLine = '';

    for (let i = 0; i < targetLines.length; i++) {
        const trimmed = targetLines[i].trim();
        if (!trimmed) {
            if (pendingLine) { mergedLines.push(pendingLine); pendingLine = ''; }
            mergedLines.push('');
            continue;
        }

        // 현재 줄에 금액이 있는지 체크
        const hasAmount = amountRegex.test(trimmed);

        if (pendingLine) {
            // 이전에 금액 없는 줄이 대기 중 → 현재 줄과 합침
            pendingLine += ' ' + trimmed;
            if (hasAmount || amountRegex.test(pendingLine)) {
                mergedLines.push(pendingLine);
                pendingLine = '';
            }
            // 금액 없으면 계속 대기 (다음 줄과도 합칠 수 있음)
        } else {
            if (hasAmount) {
                mergedLines.push(trimmed);
            } else {
                // 금액 없는 줄 → 다음 줄과 합칠 수 있으므로 대기
                // 단, 너무 짧은 줄(5자 미만)이거나 숫자만 있는 줄은 그냥 보냄
                if (trimmed.length < 5 || /^\d+$/.test(trimmed)) {
                    mergedLines.push(trimmed);
                } else {
                    pendingLine = trimmed;
                }
            }
        }
    }
    if (pendingLine) mergedLines.push(pendingLine);
    targetLines = mergedLines;
    console.log(`Line merging: ${mergedLines.length} lines after merge`);

    const results = [];

    // 2. 추출 로직 + 강력한 필터링
    // 제외할 단어들 (법적 문구, 설명, 예시표 등)
    const blacklist = [
        "해당 상품은", "경우", "따라", "법에", "지급하여", "포함되어", "보호법",
        "해약환급금", "예시표", "적용이율", "최저보증", "평균공시",
        "가입금액인", "00만원", "00원", "합계", "점검",
        "참고", "확인하시기", "바랍니다", "입니다", "됩니다",
        // 조건문/약관 설명 필터
        "최초계약", "경과시점", "감액적용", "면책",
        "법률상", "부담하여", "손해를", "배상책임을",
        "이전 진단", "이전 수술", "이전 치료",
        "같은 질병", "같은 종류", "반은 경",
        "※", "보장개시", "납입면제",
        // 계약 정보 필터
        "남성", "여성", "만기", "가입금액"
    ];

    targetLines.forEach((line, idx) => {
        const originalIdx = (startIndex === -1 ? 0 : startIndex) + idx;
        const trimmed = line.trim();
        if (!trimmed) return;

        // A. 블랙리스트 체크 (문장 전체)
        if (blacklist.some(word => trimmed.includes(word))) return;

        // B. 금액 패턴 찾기
        let match = trimmed.match(/([0-9,]+(?:억|천|백|십)*(?:만원|억원))/);

        // "원"만 있는 경우도 찾되, 너무 작은 금액(100원 미만)이나 긴 문장은 제외
        if (!match) {
            match = trimmed.match(/([0-9,]+(?:천|백|십)?원)/);
        }

        // "세부보장참조" 패턴도 금액으로 인정 (상위 담보항목)
        let isRefAmount = false;
        if (!match && trimmed.includes('세부보장참조')) {
            // 세부보장참조 뒤의 보험료 숫자를 찾아서 그 앞까지를 이름으로 사용
            const refMatch = trimmed.match(/세부보장참조/);
            if (refMatch) {
                match = refMatch;
                match[1] = '세부보장참조';
                isRefAmount = true;
            }
        }

        if (match) {
            const amountStr = match[1];

            // C. 담보명 추출 및 정제
            let namePart = trimmed.substring(0, match.index).trim();

            // 0. [NEW] 앞부분에 붙은 "20년 / 20년" 같은 날짜 패턴 제거 (텍스트 병합 이슈 해결)
            // 패턴: "숫자년" 또는 "숫자세"가 포함된 앞부분 제거
            namePart = namePart.replace(/^[\d]+(년|세|월)\s*[\/]?\s*[\d]*(년|세|월)?\s*/, '').trim();
            // 혹시 숫자가 남아있다면 한번 더 제거 (예: "278 갱신형...")
            namePart = namePart.replace(/^[\d]+\s+/, '').trim();

            // 1. 카테고리 헤더 제거 (표의 첫번째 열 내용이 섞여 들어간 경우)
            // 예: "치료비 112 암...", "기본계약 32...", "3대진단 64..."
            // 주의: "기타피부암" 처럼 단어의 일부인 경우는 제외하고, "기타 110" 처럼 분리된 경우만 제거
            const categoryKeywords = ["기본계약", "3대진단", "치료비", "수술비", "입원비", "배상책임", "후유장해", "기타", "2대진단", "질병", "상해", "운전자"];

            for (const key of categoryKeywords) {
                // 키워드 뒤에 공백이나 숫자가 오는 경우에만 제거 (정규식 사용)
                // 예: "기타 110" -> 제거, "기타피부암" -> 유지
                const regex = new RegExp('^' + key + '(?=[\\s\\d])');
                if (regex.test(namePart)) {
                    namePart = namePart.replace(regex, '').trim();
                }
            }

            // 2. 순번/코드 제거 (예: "32 ", "112 ", "64 ", "ㄴ ", "- ")
            // 주의: "26종" 같은건 지우면 안됨. 숫자 뒤에 공백이나 기호가 있는 경우만 제거
            namePart = namePart.replace(/^[\d]+\s+/, '');
            namePart = namePart.replace(/^[ㄴ\-•·\s]+/, '');

            // 한번 더 체크 (예: "치료비" 지우고 났더니 "112 "가 남은 경우)
            namePart = namePart.replace(/^[\d]+\s+/, '');

            // 3. 끝부분 공백/점 제거
            namePart = namePart.replace(/[.\s]+$/, '');
            // 4. "세부보장참조" 제거
            namePart = namePart.replace(/세부보장참조/g, '').trim();

            // 5. 괄호 안 내용 정리
            // 맨 앞의 짧은 괄호만 제거 (예: "(무)암진단비" -> "암진단비")
            // 주의: non-greedy로 첫 번째 괄호쌍만 제거 ("(무)암(실속형)" -> "암(실속형)" 유지)
            namePart = namePart.replace(/^\([^)]*\)/, '').trim();

            // 6. [NEW] 끝부분에 붙은 숫자/코드 제거 (예: "상급종합병원116" -> "상급종합병원")
            // 패턴: 한글 뒤에 붙은 숫자들 제거
            namePart = namePart.replace(/([가-힣])\d+$/, '$1').trim();



            // E. 세부 내용(보험료, 납기/만기) 추출
            // 나머지 뒷부분에서 정보 추출
            // 예: "4천만원 15,560 20년 / 100세"
            // match[0]은 "4천만원" (금액 전체 매치)

            // 금액 뒷부분 자르기
            let suffix = trimmed.substring(match.index + match[0].length).trim();

            let premium = "-";
            let period = "-";

            // 1. 보험료 찾기 (숫자 + 콤마 조합, 보통 금액 바로 뒤에 옴)
            // 예: "15,560" 또는 "2,144"
            const premiumMatch = suffix.match(/([0-9,]+)/);
            if (premiumMatch) {
                premium = premiumMatch[1] + "원";
                // 보험료 찾았으면 그 뒤 내용에서 기간 찾기
                suffix = suffix.substring(premiumMatch.index + premiumMatch[0].length).trim();
            }

            // 2. 납기/만기 찾기 (예: "20년 / 100세", "20년/100세")
            // 패턴: "숫자년" 또는 "숫자세"가 포함된 문자열
            const periodMatch = suffix.match(/([0-9]+\s*년\s*\/?[^]*)/);
            if (periodMatch) {
                period = periodMatch[1].trim();
            }

            // D. 담보명 유효성 체크
            // - 너무 짧으면(1글자) 제외
            // - 너무 길면(50글자 이상) 설명문일 확률 높음 -> 제외
            // - 문장형 어미로 끝나면 제외 ("다", "요", "음", "함")
            if (namePart.length > 1 && namePart.length < 50) {
                const lastChar = namePart.slice(-1);
                if (!['다', '요', '음', '함', '는', '은'].includes(lastChar)) {
                    results.push({
                        id: originalIdx,
                        name: namePart,
                        amount: amountStr,
                        premium: premium,
                        period: period,
                        original: trimmed
                    });
                }
            }
        }
    });

    console.log(`extractRawCoverages: ${results.length}건 추출 완료 (전체 ${targetLines.length}줄 분석)`);
    return results;
}

// ── PDF Extraction (Hybrid: Text Layer + OCR + Line Preservation) ──
async function extractTextFromPDF(file, log = console.log) {
    log("PDF 로딩 시작...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    log(`PDF 로드 완료. 총 ${pdf.numPages}페이지`);
    let fullText = '';

    // 가입담보리스트는 보통 3~6페이지에 위치 (전체 스캔시 약관/조건문 노이즈 발생)
    const startPage = Math.min(3, pdf.numPages);
    const endPage = Math.min(6, pdf.numPages);
    const totalPagesToProcess = endPage - startPage + 1;

    showToast(`총 ${totalPagesToProcess}페이지 정밀 분석을 시작합니다.`, false);

    for (let i = startPage; i <= endPage; i++) {
        let pageText = "";

        try {
            updateProgress(
                Math.round(((i - startPage) / totalPagesToProcess) * 100),
                `${i}페이지 분석 중...`
            );

            const page = await pdf.getPage(i);

            // 1. 텍스트 레이어 시도 (줄바꿈 보존 로직 추가)
            try {
                const content = await page.getTextContent();
                if (content && content.items && content.items.length > 0) {

                    // Y 좌표 기준 정렬 (PDF.js는 가끔 순서가 섞임)
                    // transform[5]가 Y좌표 (PDF좌표계는 아래에서 위로 증가)
                    // Y가 큰 순서대로(위->아래) 정렬, 같은 줄은 X(transform[4])가 작은 순서대로(왼->오) 정렬
                    const items = content.items.map(item => ({
                        str: item.str,
                        x: item.transform[4],
                        y: item.transform[5],
                        w: item.width,
                        h: item.height
                    }));

                    // 정렬: Y 내림차순 (허용오차 5), X 오름차순
                    items.sort((a, b) => {
                        if (Math.abs(a.y - b.y) < 5) { // 같은 줄로 간주
                            return a.x - b.x;
                        }
                        return b.y - a.y; // 위에서 아래로
                    });

                    // 텍스트 조립
                    let lastY = items[0].y;
                    let lastX = items[0].x;

                    for (const item of items) {
                        // 줄바꿈 감지 (Y차이가 큼)
                        if (Math.abs(item.y - lastY) > 8) { // 줄 간격 임계값 8
                            pageText += "\n";
                        } else {
                            // 같은 줄인데 X차이가 큼 (공백)
                            // 글자 크기에 따라 다르지만 대략 5 이상이면 공백 추가
                            if (item.x - lastX > 5) { // 문자 간격 임계값
                                pageText += " ";
                            }
                        }

                        pageText += item.str;
                        lastY = item.y;
                        lastX = item.x + item.w; // 다음 글자 예상 시작 위치
                    }
                }
            } catch (err) {
                console.warn(`Page ${i} Text Layer Error:`, err);
            }

            // 2. OCR Fallback
            // 텍스트가 너무 적으면(50자 미만) 이미지로 간주
            const len = pageText.trim().length;

            if (len < 50) {
                updateProgress(
                    Math.round(((i - startPage) / totalPagesToProcess) * 100),
                    `${i}페이지 OCR 변환 중...`
                );

                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                try {
                    const result = await Tesseract.recognize(
                        canvas,
                        'kor+eng',
                        {
                            logger: m => {
                                if (m && m.status === 'recognizing text') {
                                    const progress = Math.round((m.progress || 0) * 100);
                                    updateProgress(
                                        Math.round(((i - startPage) / totalPagesToProcess) * 100),
                                        `${i}페이지 인식 중... ${progress}%`
                                    );
                                }
                            }
                        }
                    );

                    pageText = (result && result.data && result.data.text) || "";
                    log(`Page ${i} OCR 완료: ${pageText.length}자`);

                } catch (ocrErr) {
                    console.error(`Page ${i} OCR Error:`, ocrErr);
                    log(`Page ${i} OCR 실패: ${ocrErr.message}`);
                }
            } else {
                log(`Page ${i} 텍스트 레이어 발견: ${len}자`);
            }

        } catch (pageErr) {
            console.error(`Page ${i} Critical Error:`, pageErr);
            log(`Page ${i} 처리 중 오류: ${pageErr.message}`);
        }

        fullText += (pageText || "") + '\n';
    }

    return fullText || "";
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
const coverageDetailsMap = {
    // 1. 기본형 (사용자 요청 통일 + 금액별 분기)
    "암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "10000": [ // 1억원
                { name: "(급여/비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "2,000만",
                    sub: ["(급여/비급여) 암 수술비 1,000만", "(비급여) 다빈치 로봇 수술 1,000만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "1,000만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "4,000만",
                    sub: ["(급여/비급여) 항암 약물 치료비 1,000만", "(비급여) 표적 항암 약물 치료비 3,000만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "7,000만",
                    sub: ["(급여/비급여) 항암 약물 치료비 1,000만", "(비급여) 표적 항암 약물 치료비 3,000만", "(비급여) 면역 항암 약물 치료비 3,000만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "4,000만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 1,000만", "(비급여) 양성자 방사선 치료비 3,000만"]
                }
            ],
            "8000": [ // 8천만원
                { name: "(급여/비급여) 암 수술비", amount: "750만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "1,500만",
                    sub: ["(급여/비급여) 암 수술비 750만", "(비급여) 다빈치 로봇 수술 750만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "750만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "2,750만",
                    sub: ["(급여/비급여) 항암 약물 치료비 750만", "(비급여) 표적 항암 약물 치료비 2,000만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "4,750만",
                    sub: ["(급여/비급여) 항암 약물 치료비 750만", "(비급여) 표적 항암 약물 치료비 2,000만", "(비급여) 면역 항암 약물 치료비 2,000만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "2,750만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 750만", "(비급여) 양성자 방사선 치료비 2,000만"]
                }
            ],
            "4000": [ // 4천만원 (기존 데이터)
                { name: "(급여/비급여) 암 수술비", amount: "500만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(급여/비급여) 암 수술비 500만", "(비급여) 다빈치 로봇 수술 500만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "500만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(급여/비급여) 항암 약물 치료비 500만", "(비급여) 표적 항암 약물 치료비 1,000만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "2,500만",
                    sub: ["(급여/비급여) 항암 약물 치료비 500만", "(비급여) 표적 항암 약물 치료비 1,000만", "(비급여) 면역 항암 약물 치료비 1,000만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 500만", "(비급여) 양성자 방사선 치료비 1,000만"]
                }
            ]
        }
    },
    // 1-1. 실속형
    "암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "7000": [ // 7천만원
                { name: "(급여/비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(급여/비급여) 암 수술비 1,000만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "1,000만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "2,000만",
                    sub: ["(급여/비급여) 항암 약물 치료비 1,000만", "(비급여) 표적 항암 약물 치료비 1,000만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "3,000만",
                    sub: ["(급여/비급여) 항암 약물 치료비 1,000만", "(비급여) 표적 항암 약물 치료비 1,000만", "(비급여) 면역 항암 약물 치료비 1,000만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "2,000만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 1,000만", "(비급여) 양성자 방사선 치료비 1,000만"]
                }
            ],
            "5000": [ // 5천만원
                { name: "(급여/비급여) 암 수술비", amount: "750만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "750만",
                    sub: ["(급여/비급여) 암 수술비 750만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "750만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(급여/비급여) 항암 약물 치료비 750만", "(비급여) 표적 항암 약물 치료비 750만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "2,150만",
                    sub: ["(급여/비급여) 항암 약물 치료비 750만", "(비급여) 표적 항암 약물 치료비 750만", "(비급여) 면역 항암 약물 치료비 750만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 750만", "(비급여) 양성자 방사선 치료비 750만"]
                }
            ],
            "3000": [ // 3천만원
                { name: "(급여/비급여) 암 수술비", amount: "500만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "500만",
                    sub: ["(급여/비급여) 암 수술비 500만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "500만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "1,000만",
                    sub: ["(급여/비급여) 항암 약물 치료비 500만", "(비급여) 표적 항암 약물 치료비 500만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(급여/비급여) 항암 약물 치료비 500만", "(비급여) 표적 항암 약물 치료비 500만", "(비급여) 면역 항암 약물 치료비 500만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 500만", "(비급여) 양성자 방사선 치료비 500만"]
                }
            ],
            "1000": [ // 1천만원
                { name: "(급여/비급여) 암 수술비", amount: "250만" },
                {
                    name: "다빈치 로봇 수술비",
                    amount: "250만",
                    sub: ["(급여/비급여) 암 수술비 250만"]
                },
                { name: "(급여/비급여) 항암 약물 치료비", amount: "250만" },
                { name: "(급여/비급여) 항암 방사선 치료비", amount: "250만" },
                {
                    name: "표적 항암 약물 치료비",
                    amount: "500만",
                    sub: ["(급여/비급여) 항암 약물 치료비 250만", "(비급여) 표적 항암 약물 치료비 250만"]
                },
                {
                    name: "면역 항암 약물 치료비",
                    amount: "750만",
                    sub: ["(급여/비급여) 항암 약물 치료비 250만", "(비급여) 표적 항암 약물 치료비 250만", "(비급여) 면역 항암 약물 치료비 250만"]
                },
                {
                    name: "양성자 방사선 치료비",
                    amount: "500만",
                    sub: ["(급여/비급여) 항암 방사선 치료비 250만", "(비급여) 양성자 방사선 치료비 250만"]
                }
            ]
        }
    },
    // 2. 비급여형
    "암 통합치료비Ⅱ(비급여)": {
        "type": "variant",
        "data": {
            "10000": [ // 1억원
                { name: "(비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(비급여) 다빈치 로봇 수술비",
                    amount: "2,000만",
                    sub: ["(비급여) 암 수술비 1,000만", "(비급여) 다빈치 로봇수술 1,000만"]
                },
                { name: "(비급여) 항암 방사선 치료비", amount: "1,000만" },
                { name: "(비급여) 항암 약물 치료비", amount: "1,000만" },
                {
                    name: "(비급여) 표적 항암 약물 치료비",
                    amount: "4,000만",
                    sub: ["(비급여) 항암 약물 치료비 1,000만", "(비급여) 표적 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(비급여) 면역 항암 약물 치료비",
                    amount: "7,000만",
                    sub: ["(비급여) 항암 약물 치료비 1,000만", "(비급여) 표적 항암 약물 치료비 3,000만", "(비급여) 면역 항암 약물 치료비 3,000만"]
                },
                {
                    name: "세기조절 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(비급여) 항암 방사선 치료비 1,000만"]
                },
                {
                    name: "(비급여) 양성자 방사선 치료비",
                    amount: "4,000만",
                    sub: ["(비급여) 항암 방사선 치료비 1,000만", "(비급여) 양성자 방사선 치료비 3,000만"]
                }
            ],
            "7000": [ // 7천만원
                { name: "(비급여) 암 수술비", amount: "750만" },
                {
                    name: "(비급여) 다빈치 로봇 수술비",
                    amount: "1,500만",
                    sub: ["(비급여) 암 수술비 750만", "(비급여) 다빈치 로봇수술 750만"]
                },
                { name: "(비급여) 항암방사선 치료비", amount: "750만" },
                { name: "(비급여) 항암 약물 치료비", amount: "750만" },
                {
                    name: "(비급여) 표적항암약물치료비",
                    amount: "2,750만",
                    sub: ["(비급여) 항암 약물 치료비 750만", "(비급여) 표적항암약물 치료비 2,000만"]
                },
                {
                    name: "(비급여) 면역항암 약물 치료비",
                    amount: "4,750만",
                    sub: ["(비급여) 항암약물 치료비 750만", "(비급여) 표적항암 약물치료비 2,000만", "(비급여) 면역항암 약물 치료비 2,000만"]
                },
                {
                    name: "세기조절 방사선치료비",
                    amount: "750만",
                    sub: ["(비급여) 항암 방사선 치료비 750만"]
                },
                {
                    name: "(비급여) 양성자 방사선 치료비",
                    amount: "2,750만",
                    sub: ["(비급여) 항암방사선 치료비 750만", "(비급여) 양성자 방사선 치료비 2,000만"]
                }
            ],
            "4000": [ // 4천만원
                { name: "(비급여) 암 수술비", amount: "500만" },
                {
                    name: "(비급여) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(비급여) 암 수술비 500만", "(비급여) 다빈치 로봇수술 500만"]
                },
                { name: "(비급여) 항암방사선 치료비", amount: "500만" },
                { name: "(비급여) 항암 약물 치료비", amount: "500만" },
                {
                    name: "(비급여) 표적항암약물치료비",
                    amount: "1,500만",
                    sub: ["(비급여) 항암 약물 치료비 500만", "(비급여) 표적항암약물 치료비 1,000만"]
                },
                {
                    name: "(비급여) 면역항암 약물 치료비",
                    amount: "2,500만",
                    sub: ["(비급여) 항암약물 치료비 500만", "(비급여) 표적항암 약물치료비 1,000만", "(비급여) 면역항암 약물 치료비 1,000만"]
                },
                {
                    name: "세기조절 방사선치료비",
                    amount: "500만",
                    sub: ["(비급여) 항암 방사선 치료비 500만"]
                },
                {
                    name: "(비급여) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(비급여) 항암방사선 치료비 500만", "(비급여) 양성자 방사선 치료비 1,000만"]
                }
            ]
        }
    },

    // 3. 10년갱신 개별 담보 (passthrough: 자기 자신의 금액을 그대로 사용)
    "항암중입자방사선치료비": {
        type: "passthrough",
        displayName: "중입자방사선치료비"
    },
    "항암세기조절방사선치료비": {
        type: "passthrough",
        displayName: "(10년갱신) 세기조절방사선치료비"
    },
    "특정면역항암약물허가치료비": {
        type: "passthrough",
        displayName: "(10년갱신) 면역항암약물치료비"
    },
    "표적항암약물허가치료비": {
        type: "passthrough",
        displayName: "(10년갱신) 표적항암약물치료비"
    },
    "항암양성자방사선치료비": {
        type: "passthrough",
        displayName: "(10년갱신) 양성자방사선치료비"
    },

    // 4. 26종 항암방사선및약물치료비 (두 카테고리에 동시 반영)
    "26종항암방사선및약물치료비": {
        type: "26jong",
        detailName: "26종 항암방사선 및 약물 치료비",
        summaryItems: [
            { name: "26종 항암 방사선 치료비" },
            { name: "26종 항암 약물 치료비" }
        ]
    }
};

// ── Helper: Parse Korean Amount ──
function parseKoAmount(str) {
    if (!str) return 0;
    // Remove "원", ",", " "
    let clean = str.replace(/[원,\s]/g, '');
    let val = 0;

    // Check units
    if (clean.includes('억')) {
        let parts = clean.split('억');
        let uk = parseInt(parts[0]) || 0;
        let rest = parts[1] || '';
        val += uk * 10000; // 만원 단위로 계산 (1억 = 10000만)
        if (rest.includes('천')) {
            val += (parseInt(rest.replace('천', '')) || 0) * 1000;
        } else if (rest.includes('만')) {
            val += parseInt(rest.replace('만', '')) || 0;
        }
    } else if (clean.includes('천만')) {
        val = (parseInt(clean.replace('천만', '')) || 0) * 1000;
    } else if (clean.includes('백만')) {
        val = (parseInt(clean.replace('백만', '')) || 0) * 100;
    } else if (clean.includes('만')) {
        val = parseInt(clean.replace('만', '')) || 0;
    } else {
        // 단위가 없거나 '원'만 있는 경우 (보험료는 제외하고 가입금액만 본다면 보통 만원 단위 이상임)
        // 여기서는 '만' 단위로 통일해서 리턴
        val = parseInt(clean) || 0;
    }
    return val; // 만원 단위 반환
}

// ── Helper: Format Korean Amount ──
function formatKoAmount(val) {
    if (val === 0) return "0원";
    let uk = Math.floor(val / 10000);
    let man = val % 10000;

    let result = "";
    if (uk > 0) result += `${uk}억 `;
    if (man > 0) result += `${man.toLocaleString()}만`;

    return result.trim() + "원";
}

// ── Helper: Normalize any amount string to #,###만원 format ──
function formatDisplayAmount(str) {
    if (!str) return str;
    const val = parseKoAmount(str);
    if (val === 0) return str; // 파싱 실패 시 원본 유지
    return formatKoAmount(val);
}

// ── Aggregate Hierarchical Summary Logic ──
function calculateHierarchicalSummary(results) {
    const summaryMap = new Map();
    let first26SummaryFound = false; // 26종 첫 번째만 한눈에보기에 반영

    results.forEach(item => {
        let details = coverageDetailsMap[item.name];

        // Dictionary Lookup (Fallback Logic)
        if (!details) {
            if (item.name.includes("암 통합치료비") && (item.name.includes("Ⅱ") || item.name.includes("II")) && item.name.includes("비급여")) {
                details = coverageDetailsMap["암 통합치료비Ⅱ(비급여)"];
            } else if (item.name.includes("암 통합치료비") && item.name.includes("기본형")) {
                details = coverageDetailsMap["암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))"];
            } else if (item.name.includes("암 통합치료비") && item.name.includes("실속형")) {
                details = coverageDetailsMap["암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))"];
            }
            // 10년갱신 개별 담보 키워드 매칭
            else if (item.name.includes("중입자방사선")) {
                details = coverageDetailsMap["항암중입자방사선치료비"];
            } else if (item.name.includes("세기조절방사선")) {
                details = coverageDetailsMap["항암세기조절방사선치료비"];
            } else if (item.name.includes("면역항암약물") || item.name.includes("면역항암")) {
                details = coverageDetailsMap["특정면역항암약물허가치료비"];
            } else if (item.name.includes("표적항암약물") || item.name.includes("표적항암")) {
                details = coverageDetailsMap["표적항암약물허가치료비"];
            } else if (item.name.includes("양성자방사선") || item.name.includes("양성자")) {
                details = coverageDetailsMap["항암양성자방사선치료비"];
            } else if (item.name.includes("26종")) {
                details = coverageDetailsMap["26종항암방사선및약물치료비"];
            }
        }

        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];

            // Fallback default
            if (!variantData) {
                if (details.data["10000"]) variantData = details.data["10000"];
            }
            details = variantData;
        }

        // Handle Passthrough Type (자기 금액 그대로 사용)
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }

        // Handle 26종 Type (항암방사선 + 항암약물 두 카테고리에 반영, 첫 번째만)
        if (details && details.type === '26jong') {
            if (!first26SummaryFound) {
                first26SummaryFound = true;
                details = details.summaryItems.map(d => ({ name: d.name, amount: item.amount }));
            } else {
                details = null; // 이후 26종 항목은 한눈에보기에 반영 안함
            }
        }

        if (details && Array.isArray(details)) {
            details.forEach(det => {
                // Normalize Name to find "Common Group"
                // 1. Remove prefixes: (급여/비급여), (비급여), (급여), (10년갱신)
                let normalizedName = det.name.replace(/\(급여\/비급여\)/g, '')
                    .replace(/\(비급여\)/g, '')
                    .replace(/\(급여\)/g, '')
                    .replace(/\(10년갱신\)/g, '')
                    .replace(/26종/g, '') // Remove 26종 prefix
                    .replace(/\s+/g, '') // 2. Remove ALL spaces
                    .trim();

                // 3. Make Display Name pretty if needed (or just use normalized?)
                // Actually, we want to group by "meaning", so removing spaces helps matching "표적 항암" == "표적항암"

                const amount = parseKoAmount(det.amount); // det.amount: "500만"

                if (!summaryMap.has(normalizedName)) {
                    // Use the first encountered name as the "Display Name" (with spaces stripped? maybe restore spaces?)
                    // For better UX, let's just use the normalized name but maybe add spaces back manually or use a mapping?
                    // Let's stick to the current det.name stripped of prefix but keep original spaces? No, inconsistent.
                    // Better approach: Use a predefined readable map or just formatted string.
                    // For now, let's use the normalized string with manual space insertion if needed.
                    // Actually, let's use the "longest" name found in group as display name?
                    // Simpler: Just use the cleaned string.

                    summaryMap.set(normalizedName, {
                        total: 0,
                        items: [],
                        displayName: normalizedName // Temporary, will refine below
                    });
                }

                const group = summaryMap.get(normalizedName);
                group.total += amount;
                group.items.push({
                    displayName: det.name,
                    amount: det.amount,
                    source: item.name
                });

                // Update display name to be the one with spaces if available (longer usually means more spaces/detail)
                // e.g. "표적항암약물치료비" (length 9) vs "표적 항암 약물 치료비" (length 13)
                // We prefer the spaced version for readability.
                // But wait, normalizedName has NO spaces. We need to store the "best" display name separately.
                if (det.name.length > group.displayName.length || group.displayName === normalizedName) {
                    // Try to pick a name that has spaces and no prefix
                    let cleanNameWithSpaces = det.name.replace(/\(급여\/비급여\)/g, '').replace(/\(비급여\)/g, '').replace(/\(급여\)/g, '').replace(/\(10년갱신\)/g, '').replace(/26종/g, '').trim();
                    if (cleanNameWithSpaces.length > 0) {
                        group.displayName = cleanNameWithSpaces;
                    }
                }
            });
        }
    });

    return summaryMap;
}

// Raw List Renderer (Updated for Hierarchical Summary)
function renderResults(results) {
    const listEl = document.getElementById('results-list');
    const summaryGrid = document.getElementById('summary-grid');
    const resultsSection = document.getElementById('results-section');
    const summarySection = document.getElementById('summary-section');

    // emptyState variable is already declared above in previous fix
    const emptyState = document.getElementById('empty-state');

    if (!results || results.length === 0) {
        resultsSection.classList.add('hidden');
        summarySection.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    summarySection.classList.remove('hidden');

    // 1. Calculate Hierarchical Summary
    const summaryMap = calculateHierarchicalSummary(results);

    // 2. Render Summary Grid
    if (summaryMap.size > 0) {
        summaryGrid.innerHTML = '';
        summaryGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6";

        // Header Title
        const header = document.createElement('div');
        header.className = "col-span-1 sm:col-span-2 text-sm font-bold mb-2 flex items-center";
        header.style.color = "var(--primary-color)";
        header.innerHTML = `📊 한 눈에 치료비 보장 보기 (통합 합산)`;
        summaryGrid.appendChild(header);

        summaryMap.forEach((data, name) => {
            const card = document.createElement('div');
            card.className = "p-3 rounded-lg flex flex-col cursor-pointer transition-colors";
            card.style.background = "rgba(59,130,246,0.05)";
            card.style.border = "1px solid rgba(59,130,246,0.1)";

            // Generate Sub-items HTML
            let subItemsHtml = '';
            data.items.forEach(sub => {
                subItemsHtml += `
                    <div class="mt-2 pl-3 border-l-2 border-blue-500/20 text-xs">
                        <div class="flex justify-between" style="color:var(--text-color);">
                            <span>${sub.displayName}</span>
                            <span class="font-bold text-blue-400">${formatDisplayAmount(sub.amount)}</span>
                        </div>
                        <div class="text-[10px] mt-0.5" style="color:rgba(232,236,244,0.5);">
                            └ 출처: ${sub.source}
                        </div>
                    </div>
                `;
            });

            card.innerHTML = `
                <div class="flex justify-between items-center w-full">
                    <span class="text-xs font-medium" style="color:var(--text-color);">${data.displayName}</span>
                    <div class="flex items-center gap-2">
                         <span class="text-sm font-bold" style="color:#10B981;">${formatDisplayAmount(formatKoAmount(data.total))}</span>
                         <span class="text-[10px] text-blue-400 opacity-70">▼</span>
                    </div>
                </div>
                <div class="summary-details hidden pt-2 mt-1 border-t border-blue-500/10">
                    ${subItemsHtml}
                </div>
            `;

            // Toggle Event
            card.addEventListener('click', () => {
                const details = card.querySelector('.summary-details');
                details.classList.toggle('hidden');
            });

            summaryGrid.appendChild(card);
        });
    } else {
        // Fallback if no relevant coverage found
        summaryGrid.innerHTML = `
            <div class="rounded-xl p-3 text-center col-span-2 sm:col-span-3" style="background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.12);">
              <p class="text-xs mb-0.5" style="color:rgba(232,236,244,0.5);">발견된 담보 항목</p>
              <p class="text-xl font-bold" style="color:var(--primary-color); font-family:'Outfit','Noto Sans KR',sans-serif;">${results.length}건</p>
            </div>
        `;
    }

    // 3. Render Detail List
    listEl.innerHTML = '';
    let first26Found = false; // 26종 첫 번째만 세부내역 표시
    results.forEach((item, idx) => {
        // Dictionary Lookup (Same logic as before)
        let details = coverageDetailsMap[item.name];

        // 만약 못 찾으면 키워드로 대략적으로 체크 (Fallback)
        if (!details) {
            // 2. 비급여형 체크 (우선순위)
            if (item.name.includes("암 통합치료비") && (item.name.includes("Ⅱ") || item.name.includes("II")) && item.name.includes("비급여")) {
                details = coverageDetailsMap["암 통합치료비Ⅱ(비급여)"];
            }
            // 1. 기본형 체크
            else if (item.name.includes("암 통합치료비") && item.name.includes("기본형")) {
                details = coverageDetailsMap["암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))"];
            }
            else if (item.name.includes("암 통합치료비") && item.name.includes("실속형")) {
                details = coverageDetailsMap["암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))"];
            }
            // 10년갱신 개별 담보
            else if (item.name.includes("중입자방사선")) {
                details = coverageDetailsMap["항암중입자방사선치료비"];
            } else if (item.name.includes("세기조절방사선")) {
                details = coverageDetailsMap["항암세기조절방사선치료비"];
            } else if (item.name.includes("면역항암약물") || item.name.includes("면역항암")) {
                details = coverageDetailsMap["특정면역항암약물허가치료비"];
            } else if (item.name.includes("표적항암약물") || item.name.includes("표적항암")) {
                details = coverageDetailsMap["표적항암약물허가치료비"];
            } else if (item.name.includes("양성자방사선") || item.name.includes("양성자")) {
                details = coverageDetailsMap["항암양성자방사선치료비"];
            } else if (item.name.includes("26종")) {
                details = coverageDetailsMap["26종항암방사선및약물치료비"];
            }
        }

        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];

            // Fallback default
            if (!variantData) {
                if (details.data["10000"]) variantData = details.data["10000"];
            }
            details = variantData;
        }

        // Handle Passthrough Type (자기 금액 그대로 사용)
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }

        // Handle 26종 Type (첫 번째만 세부내역 표시)
        if (details && details.type === '26jong') {
            if (!first26Found) {
                first26Found = true;
                details = [{ name: details.detailName, amount: item.amount }];
            } else {
                details = null;
            }
        }

        const card = document.createElement('div');
        card.className = 'result-card card-shine rounded-xl mb-3 stagger-in';
        card.style.cssText = `background:var(--surface-color); border:1px solid rgba(255,255,255,0.05); animation-delay:${Math.min(idx * 30, 1000)}ms; cursor: pointer; transition: all 0.2s;`;

        const premiumDisplay = item.premium !== '-' ? `<span class="text-xs mr-2" style="color:rgba(232,236,244,0.6);">보험료: ${item.premium}</span>` : '';
        const periodDisplay = item.period !== '-' ? `<span class="text-xs" style="color:rgba(232,236,244,0.6);">납기/만기: ${item.period}</span>` : '';

        // Detail Section HTML
        let detailHtml = '';
        if (details && Array.isArray(details)) {
            detailHtml = `
                <div class="detail-content hidden mt-4 pt-4 border-t border-gray-700/50">
                    <p class="text-xs font-bold text-blue-400 mb-2">💡 세부 보장 내역 (예시)</p>
                    <div class="space-y-2">
            `;
            details.forEach(det => {
                detailHtml += `
                    <div class="flex flex-col text-xs" style="color:rgba(232,236,244,0.8);">
                        <div class="flex justify-between">
                            <span>• ${det.name}</span>
                            <span class="font-medium text-white">${formatDisplayAmount(det.amount)}</span>
                        </div>
                `;
                if (det.sub) {
                    det.sub.forEach(sub => {
                        // sub 문자열 파싱 (마지막 공백 기준으로 이름/금액 분리)
                        // 예: "(비급여) 항암약물 치료비 1,000만"
                        const parts = sub.trim().split(' ');
                        const subAmount = parts.pop(); // 금액 (마지막 부분)
                        const subName = parts.join(' '); // 이름 (나머지 전체)

                        detailHtml += `
                            <div class="flex justify-between pl-3 mt-1 text-[10px]" style="color:rgba(232,236,244,0.5);">
                                <span>└ ${subName}</span>
                                <span>${subAmount || ''}</span>
                            </div>
                         `;
                    });
                }
                detailHtml += `</div>`;
            });
            detailHtml += `</div></div>`;
        }

        card.innerHTML = `
            <div class="p-4">
                <div class="flex items-center justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium break-keep mb-1" style="color:var(--text-color);">${item.name}</p>
                        <div class="flex flex-wrap items-center">
                            ${premiumDisplay}
                            ${periodDisplay}
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <span class="inline-block px-2 py-1 rounded text-xs font-bold"
                              style="background:rgba(16,185,129,0.1); color:#10B981; border:1px solid rgba(16,185,129,0.2);">
                            ${formatDisplayAmount(item.amount)}
                        </span>
                        ${details ? '<span class="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">세부내역 ▼</span>' : ''}
                    </div>
                </div>
                ${detailHtml}
            </div>
        `;

        if (details && Array.isArray(details)) {
            card.addEventListener('click', () => {
                const content = card.querySelector('.detail-content');
                content.classList.toggle('hidden');
                // 화살표 변경 로직 추가 가능
            });
        }

        listEl.appendChild(card);
    });

    // Hide Expand All button since we have no details
    const expandBtn = document.getElementById('expand-all-btn');
    if (expandBtn) expandBtn.style.display = 'none';
}


// ── File Processing ──
async function processFile(file) {
    if (!file) return;

    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('summary-section').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');

    try {
        let text = '';
        const nameEl = document.getElementById('file-name');
        const sizeEl = document.getElementById('file-size');
        const infoEl = document.getElementById('file-info');

        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
        if (infoEl) infoEl.classList.remove('hidden');

        const rawTextEl = document.getElementById('raw-text');
        const log = (msg) => {
            console.log(msg);
            if (rawTextEl) rawTextEl.textContent += msg + "\n";
        }

        // Image Mode
        if (file.type.startsWith('image/')) {
            updateProgress(0, '이미지 OCR 분석 준비 중...');
            if (typeof Tesseract === 'undefined') throw new Error("Tesseract.js 로드 실패");

            const result = await Tesseract.recognize(file, 'kor+eng', {
                logger: m => {
                    if (m?.status === 'recognizing text') {
                        const p = Math.round((m.progress || 0) * 100);
                        updateProgress(p, `이미지 인식 중... ${p}%`);
                    }
                }
            });
            text = result?.data?.text || '';
            updateProgress(100, '분석 완료!');
        }
        // PDF Mode
        else if (file.type === 'application/pdf') {
            updateProgress(5, 'PDF 분석 준비 중...');
            if (typeof Tesseract === 'undefined') throw new Error("Tesseract.js 로드 실패");
            text = await extractTextFromPDF(file, log);
            updateProgress(100, '분석 완료!');
        }
        else {
            throw new Error('지원되지 않는 파일 형식입니다.');
        }

        // Debug output
        if (rawTextEl) {
            rawTextEl.textContent = text.substring(0, 5000) + (text.length > 5000 ? '\n...(이하 생략)' : '');
            document.getElementById('debug-section').classList.remove('hidden');
        }

        // Run Raw Extraction
        const results = extractRawCoverages(text);

        await new Promise(r => setTimeout(r, 500));
        document.getElementById('progress-section').classList.add('hidden');

        renderResults(results);

        if (results.length > 0) {
            showToast(`${results.length}개의 항목을 추출했습니다.`, false);
        } else {
            showToast('추출된 항목이 없습니다. 텍스트 인식 결과를 확인해주세요.', true);
        }

    } catch (err) {
        document.getElementById('progress-section').classList.add('hidden');
        document.getElementById('upload-section').style.display = '';
        showToast(err.message || '오류 발생', true);
        console.error(err);
    }
}

// ── Event Handlers ──
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    const resetBtn = document.getElementById('reset-btn');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
        });
    }

    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('upload-section').style.display = '';
            document.getElementById('file-info').classList.add('hidden');
            document.getElementById('results-section').classList.add('hidden');
            document.getElementById('summary-section').classList.add('hidden');
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('debug-section').classList.add('hidden');
            document.getElementById('progress-section').classList.add('hidden');
            if (fileInput) fileInput.value = '';
        });
    }
});