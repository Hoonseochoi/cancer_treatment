// ── Configuration & PDF.js ──
// PDF.js worker setup
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
const defaultConfig = {
    main_title: "암 치료비 보장금액 분석 ( 테스트 )",
    subtitle_text: "가입제안서 PDF를 업로드하면, 보장내역 중 암 치료비 파트만 추출 합니다",
    upload_button_text: "PDF 파일을 드래그하거나 클릭하세요",
    result_header_text: "전체 보장 내역 분석 결과",
    background_color: "#EBEBEB",
    surface_color: "#FFFFFF",
    text_color: "#404040",
    primary_color: "#E60000",
    secondary_color: "#8C8C8C",
    font_family: "Outfit",
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
    const startKeywords = ["가입담보리스트", "가입담보", "담보사항"];
    const endKeywords = ["주의사항", "유의사항", "알아두실"];
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
    const amountRegex = /[0-9,]+(?:억|천|백|십)*(?:만원|억원|만|억)|세부보장참조/;
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
        // [NEW] "세부보장"으로 시작하는 줄은 노이즈로 간주하고 제외 (세부보장참조는 허용하되, 문장 시작이 세부보장이면 제외)
        if (trimmed.startsWith("세부보장")) return;
        // B. 금액 패턴 찾기
        let match = trimmed.match(/([0-9,]+(?:억|천|백|십)*(?:만원|억원|만|억))/);
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
            // D. 담보명 유효성 체크
            // - 너무 짧으면(1글자) 제외
            // - 너무 길면(120글자 이상) 설명문일 확률 높음 -> 제외
            // - 문장형 어미로 끝나면 제외 ("다", "요", "음", "함")
            if (namePart.length > 1 && namePart.length < 120) {
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
                } else {
                    console.log(`Skipped (sentence end): ${namePart}`);
                }
            } else {
                console.log(`Skipped (length): ${namePart} (${namePart.length} chars)`);
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
    // 4. 비급여(상급종합병원 포함)형
    "암 통합치료비(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "8000": [
                { name: "(매회) (비급여)다빈치로봇수술비", amount: "1,000만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "3,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "6,000만" },
                { name: "(연1회) (비급여) 양성자방사선 치료비", amount: "3,000만" }
            ],
            "5000": [
                { name: "(매회) (비급여)다빈치로봇수술비", amount: "750만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "2,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "4,000만" },
                { name: "(연1회) (비급여) 양성자방사선 치료비", amount: "2,000만" }
            ],
            "2000": [
                { name: "(매회) (비급여)다빈치로봇수술비", amount: "500만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "2,000만" },
                { name: "(연1회) (비급여) 양성자방사선 치료비", amount: "1,000만" }
            ]
        }
    },
    // 1. 기본형 (사용자 요청 통일 + 금액별 분기)
    "암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "10000": [ // 1억원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "2,000만",
                    sub: ["(매회) (급여/비급여) 암 수술비 1,000만", "(매회) (비급여) 다빈치 로봇 수술 1,000만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "1,000만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "7,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만", "(연1회) (비급여) 면역 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자 방사선 치료비 3,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                }
            ],
            "8000": [ // 8천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "750만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "1,500만",
                    sub: ["(매회) (급여/비급여) 암 수술비 750만", "(매회) (비급여) 다빈치 로봇 수술 750만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "750만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "4,750만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 2,000만", "(연1회) (비급여) 면역 항암 약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만", "(연1회) (비급여) 양성자 방사선 치료비 2,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                }
            ],
            "4000": [ // 4천만원 (기존 데이터)
                { name: "(매회) (급여/비급여) 암 수술비", amount: "500만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (급여/비급여) 암 수술비 500만", "(매회) (비급여) 다빈치 로봇 수술 500만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "500만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "2,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만", "(연1회) (비급여) 면역 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만", "(연1회) (비급여) 양성자 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                }
            ]
        }
    },
    // 1-1. 실속형
    "암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "7000": [ // 7천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (급여/비급여) 암 수술비 1,000만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "1,000만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "2,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "3,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만", "(연1회) (비급여) 면역 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "2,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                }
            ],
            "5000": [ // 5천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "750만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "750만",
                    sub: ["(매회) (급여/비급여) 암 수술비 750만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "750만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 750만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "2,150만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 750만", "(연1회) (비급여) 면역 항암 약물 치료비 750만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만", "(연1회) (비급여) 양성자 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                }
            ],
            "3000": [ // 3천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "500만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "500만",
                    sub: ["(매회) (급여/비급여) 암 수술비 500만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "500만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 500만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 500만", "(연1회) (비급여) 면역 항암 약물 치료비 500만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만", "(연1회) (비급여) 양성자 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                }
            ],
            "1000": [ // 1천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "250만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "250만",
                    sub: ["(매회) (급여/비급여) 암 수술비 250만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "250만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "250만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 250만", "(연1회) (비급여) 표적 항암 약물 치료비 250만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 250만", "(연1회) (비급여) 표적 항암 약물 치료비 250만", "(연1회) (비급여) 면역 항암 약물 치료비 250만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 250만", "(연1회) (비급여) 양성자 방사선 치료비 250만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "250만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 250만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "250만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 250만"]
                }
            ]
        }
    },
    // 2. 비급여형
    "암 통합치료비Ⅱ(비급여)": {
        "type": "variant",
        "data": {
            "10000": [ // 1억원
                { name: "(매회) (비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(매회) (비급여) 다빈치 로봇 수술비",
                    amount: "2,000만",
                    sub: ["(매회) (비급여) 암 수술비 1,000만", "(매회) (비급여) 다빈치 로봇수술 1,000만"]
                },
                { name: "(연1회) (비급여) 항암 방사선 치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "1,000만" },
                {
                    name: "(연1회) (비급여) 표적 항암 약물 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) (비급여) 면역 항암 약물 치료비",
                    amount: "7,000만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만", "(연1회) (비급여) 면역 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) (비급여) 양성자 방사선 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자 방사선 치료비 3,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 1,000만"]
                }
            ],
            "7000": [ // 7천만원
                { name: "(매회) (비급여) 암 수술비", amount: "750만" },
                {
                    name: "(매회) (비급여) 다빈치 로봇 수술비",
                    amount: "1,500만",
                    sub: ["(매회) (비급여) 암 수술비 750만", "(매회) (비급여) 다빈치 로봇수술 750만"]
                },
                { name: "(연1회) (비급여) 항암방사선 치료비", amount: "750만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "750만" },
                {
                    name: "(연1회) (비급여) 표적항암약물치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적항암약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) (비급여) 면역항암 약물 치료비",
                    amount: "4,750만",
                    sub: ["(연1회) (비급여) 항암약물 치료비 750만", "(연1회) (비급여) 표적항암 약물치료비 2,000만", "(연1회) (비급여) 면역항암 약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) (비급여) 양성자 방사선 치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (비급여) 항암방사선 치료비 750만", "(연1회) (비급여) 양성자 방사선 치료비 2,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 750만"]
                }
            ],
            "4000": [ // 4천만원
                { name: "(매회) (비급여) 암 수술비", amount: "500만" },
                {
                    name: "(매회) (비급여) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (비급여) 암 수술비 500만", "(매회) (비급여) 다빈치 로봇수술 500만"]
                },
                { name: "(연1회) (비급여) 항암방사선 치료비", amount: "500만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "500만" },
                {
                    name: "(연1회) (비급여) 표적항암약물치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적항암약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 면역항암 약물 치료비",
                    amount: "2,500만",
                    sub: ["(연1회) (비급여) 항암약물 치료비 500만", "(연1회) (비급여) 표적항암 약물치료비 1,000만", "(연1회) (비급여) 면역항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (비급여) 항암방사선 치료비 500만", "(연1회) (비급여) 양성자 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 500만"]
                }
            ]
        }
    },
    // 3. 암 통합치료비 III (Range Type)
    "암진단및치료비(암 통합치료비III)": {
        "type": "variant",
        "data": {
            "5000": [
                { name: "(연1회) 표적항암약물치료비", amount: "2,000만(3,000만)", maxAmount: "3,000만" },
                { name: "(연1회) 면역항암약물치료비", amount: "2,000만(3,000만)", maxAmount: "3,000만", hiddenInDetail: true },
                { name: "(연1회) 양성자 방사선 치료비", amount: "2,000만(3,000만)", maxAmount: "3,000만" }
            ],
            "4000": [
                { name: "(연1회) 표적항암약물치료비", amount: "1,000만(3,000만)", maxAmount: "3,000만" },
                { name: "(연1회) 면역항암약물치료비", amount: "1,000만(3,000만)", maxAmount: "3,000만", hiddenInDetail: true },
                { name: "(연1회) 양성자 방사선 치료비", amount: "1,000만(3,000만)", maxAmount: "3,000만" }
            ]
        }
    },
    // 4. 10년갱신 개별 담보 (passthrough: 자기 자신의 금액을 그대로 사용)
    "항암중입자방사선치료비": {
        type: "passthrough",
        displayName: "(최초1회) 중입자방사선치료비"
    },
    "항암세기조절방사선치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 세기조절방사선치료비"
    },
    "특정면역항암약물허가치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 면역항암약물치료비"
    },
    "표적항암약물허가치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 표적항암약물치료비"
    },
    "항암양성자방사선치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 양성자방사선치료비"
    },
    // [NEW] 다빈치로봇 암수술비
    "다빈치로봇암수술비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 다빈치 로봇 수술비"
    },
    // [NEW] 암 통합치료비 (주요치료) - 비급여 (7천/5천/3천)
    "암 통합치료비(주요치료)(비급여(전액본인부담 포함), 암중점치료기관(상급 종합병원 포함))": {
        "type": "variant",
        "data": {
            "7000": [
                { name: "(매회) (비급여) 암 수술비", amount: "1,000만" },
                { name: "(연1회) (비급여) 항암 방사선 치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 중입자방사선치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 양성자방사선치료비", amount: "1,000만" },
                { name: "(매회) (비급여) 다빈치로봇수술비", amount: "1,000만" }
            ],
            "5000": [
                { name: "(매회) (비급여) 암 수술비", amount: "750만" },
                { name: "(연1회) (비급여) 항암 방사선 치료비", amount: "750만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "750만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "750만" },
                { name: "(연1회) (비급여) 중입자방사선치료비", amount: "750만" },
                { name: "(연1회) (비급여) 양성자방사선치료비", amount: "750만" },
                { name: "(매회) (비급여) 다빈치로봇수술비", amount: "750만" }
            ],
            "3000": [
                { name: "(매회) (비급여) 암 수술비", amount: "500만" },
                { name: "(연1회) (비급여) 항암 방사선 치료비", amount: "500만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "500만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "500만" },
                { name: "(연1회) (비급여) 중입자방사선치료비", amount: "500만" },
                { name: "(연1회) (비급여) 양성자방사선치료비", amount: "500만" },
                { name: "(매회) (비급여) 다빈치로봇수술비", amount: "500만" }
            ],
            "2000": [
                { name: "(매회) (비급여) 암 수술비", amount: "500만" },
                { name: "(연1회) (비급여) 항암 방사선 치료비", amount: "500만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "500만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "500만" },
                { name: "(연1회) (비급여) 중입자방사선치료비", amount: "500만" },
                { name: "(연1회) (비급여) 양성자방사선치료비", amount: "500만" },
                { name: "(매회) (비급여) 다빈치로봇수술비", amount: "500만" }
            ]
        }
    },
    // 4. 26종 항암방사선및약물치료비 (여러 카테고리에 동시 반영)
    "26종항암방사선및약물치료비": {
        type: "26jong",
        detailName: "26종 항암방사선 및 약물 치료비",
        summaryItems: [
            { name: "(최대 26회) 26종 항암 방사선 치료비", targetName: "항암방사선치료비" },
            { name: "(최대 26회) 26종 항암 약물 치료비", targetName: "항암약물치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "표적항암약물치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "면역항암약물치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "양성자방사선치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "중입자방사선치료비" }
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
            if (item.name.includes("암 통합치료비") && (item.name.includes("III") || item.name.includes("Ⅲ"))) {
                details = coverageDetailsMap["암진단및치료비(암 통합치료비III)"];
            }
            // [MOVED] 주요치료 우선 체크
            else if (item.name.includes("암 통합치료비") && item.name.includes("주요치료")) {
                details = coverageDetailsMap["암 통합치료비(주요치료)(비급여(전액본인부담 포함), 암중점치료기관(상급 종합병원 포함))"];
            }
            else if (item.name.includes("암 통합치료비") && item.name.includes("비급여") && item.name.includes("전액본인부담")) {
                details = coverageDetailsMap["암 통합치료비(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함))"];
            } else if (item.name.includes("암 통합치료비") && (item.name.includes("Ⅱ") || item.name.includes("II")) && item.name.includes("비급여")) {
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
            } else if (item.name.includes("26종") && (item.name.includes("치료비") || item.name.includes("약물"))) {
                details = coverageDetailsMap["26종항암방사선및약물치료비"];
            } else if (item.name.includes("다빈치") && item.name.includes("로봇")) {
                // Exclude "특정암" (Specific Cancer) but keep "특정암제외" (General)
                if (!item.name.includes("특정암") || item.name.includes("제외")) {
                    details = coverageDetailsMap["다빈치로봇암수술비"];
                }
            }
        }
        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            // Fallback default
            if (!variantData) {
                // Approximate matching for limits (e.g. 7XXX -> 8000, 4XXX -> 5000)
                if (amountVal > 6000) variantData = details.data["8000"] || details.data["10000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
                if (!variantData && details.data["10000"]) variantData = details.data["10000"];
            }
            details = variantData;
        }
        // Handle Passthrough Type (자기 금액 그대로 사용)
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }
        if (details && details.type === '26jong') {
            if (!first26SummaryFound) {
                first26SummaryFound = true;
                details = details.summaryItems.map(d => ({
                    name: d.name,
                    amount: item.amount,
                    targetName: d.targetName // targetName 전달
                }));
            } else {
                details = null;
            }
        }
        if (details && Array.isArray(details)) {
            details.forEach(det => {
                // Normalize Name to find "Common Group"
                let groupingSource = det.targetName || det.name;
                let normalizedName = groupingSource;
                // [KEYWORD-BASED CATEGORIZATION]
                // 1. targetName이 명시적으로 있으면 최우선 적용 (26종 매핑 보장)
                if (det.targetName) {
                    normalizedName = det.targetName;
                }
                // 2. 그 외의 경우 키워드 매칭
                else if (groupingSource.includes("표적")) {
                    normalizedName = "표적항암약물치료비";
                } else if (groupingSource.includes("면역")) {
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
                } else if (groupingSource.includes("약물") && !groupingSource.includes("표적") && !groupingSource.includes("면역")) {
                    normalizedName = "항암약물치료비";
                } else if (groupingSource.includes("방사선") && !groupingSource.includes("양성자") && !groupingSource.includes("중입자") && !groupingSource.includes("세기")) {
                    normalizedName = "항암방사선치료비";
                } else {
                    // Fallback: Remove special chars
                    normalizedName = groupingSource.replace(/[^가-힣0-9]/g, '');
                }
                // 3. Make Display Name pretty if needed (or just use normalized?)
                // Actually, we want to group by "meaning", so removing spaces helps matching "표적 항암" == "표적항암"
                const amount = parseKoAmount(det.amount); // det.amount: "500만"
                if (!summaryMap.has(normalizedName)) {
                    summaryMap.set(normalizedName, {
                        displayName: normalizedName, // Temporary
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
                    hiddenInDetail: det.hiddenInDetail
                });
                // Update display name (pick longest readable name)
                const is26JongItem = det.name.includes("26종");
                if ((det.name.length > group.displayName.length || group.displayName === normalizedName) && !is26JongItem) {
                    // 괄호 및 특수문자 제거 후 예쁜 이름으로 저장
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
// Helper: Get Icon based on coverage name
function getCoverageIcon(name) {
    // 1. Robot (Da Vinci)
    if (name.includes("다빈치") || name.includes("로봇")) {
        // Robot Arm / Robot Icon
        return `<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1c1.1 0 2 .9 2 2v6h2v-2c0-1.1.9-2 2-2h1V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v2h1c1.1 0 2 .9 2 2v2h2V9c0-1.1.9-2 2-2h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5V19c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2v-3.5A2.5 2.5 0 0 0 9.5 13m0 2a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5m9 0A2.5 2.5 0 0 0 14 15.5V19c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2v-3.5A2.5 2.5 0 0 0 16.5 13m0 2a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5"/>`;
    }
    // 2. Targeted (Target/Syringe)
    if (name.includes("표적")) {
        // Crosshair / Target
        return `<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8m0-14a6 6 0 1 0 6 6 6 6 0 0 0-6-6m0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4"/>`;
    }
    // 3. Immuno/Drug/Chemo (Pill/Medicine)
    if (name.includes("면역") || name.includes("약물") || name.includes("26종")) {
        // Pill capsule
        return `<path d="M10.5 2a8.5 8.5 0 0 0 0 17 8.5 8.5 0 0 0 0-17m0 2.5a6 6 0 0 1 0 12 6 6 0 0 1 0-12m10.84 5.37-7.41 7.42a2 2 0 0 1-2.83 0l-1.42-1.42a2 2 0 0 1 0-2.83l7.42-7.41a2 2 0 0 1 2.83 0l1.42 1.42a2 2 0 0 1 0 2.83"/>`;
    }
    // 4. Radiation/Proton/Heavy Ion (Radioactive/Atom)
    if (name.includes("방사선") || name.includes("양성자") || name.includes("중입자")) {
        // Radiation / Atom
        return `<path d="M12 2L9 7h6l-3-5m0 20l3-5H9l3 5M4.93 4.93L7.5 9H2.5L4.93 4.93m14.14 0L16.5 9h5l-2.43-4.07M2.5 15h5l-2.57 4.07L2.5 15m19 0h-5l2.57 4.07L21.5 15"/>`;
    }
    // 5. Surgery (Scalpel/Hospital)
    if (name.includes("수술")) {
        return `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14v14m-8.5-2h3v-3.5h3.5v-3h-3.5V6h-3v3.5H6.5v3h3.5z"/>`;
    }
    // 6. Diagnosis (Report/Clipboard)
    if (name.includes("진단") || name.includes("치료비")) {
        return `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM6 20V4h8v4h4v12H6m8-10V4.5L18.5 9H14"/>`;
    }
    // Default (Shield/Guard)
    return `<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>`;
}
// Raw List Renderer (Updated for Hierarchical Summary)
function renderResults(results) {
    const listEl = document.getElementById('results-list');
    const summaryGrid = document.getElementById('summary-grid');
    const resultsSection = document.getElementById('results-section');
    const summarySection = document.getElementById('summary-section');
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
    // Calculate Grand Total Range
    let grandTotalMin = 0;
    let grandTotalMax = 0;
    summaryMap.forEach(d => {
        grandTotalMin += d.totalMin;
        grandTotalMax += d.totalMax;
    });
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
            headerAmountStr = `${formatKoAmount(grandTotalMin)} ~ ${formatKoAmount(grandTotalMax)}`;
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
                let amtDisplay = sub.amount;
                if (!amtDisplay.includes('(') && !amtDisplay.includes('~')) {
                    amtDisplay = formatDisplayAmount(sub.amount);
                }
                if (sub.maxAmount && sub.maxAmount !== sub.amount && !amtDisplay.includes('(')) {
                    amtDisplay = `${formatDisplayAmount(sub.amount)}~${formatDisplayAmount(sub.maxAmount)}`;
                }
                subItemsHtml += `
                    <div class="mt-3 pl-4 border-l-3 border-red-500/10 text-xs text-left">
                        <div class="flex items-center justify-between font-bold text-gray-700">
                            <span class="truncate mr-2 flex-1" title="${sub.name}">${sub.name}</span>
                            <span class="text-red-600 whitespace-nowrap flex-shrink-0 font-black">${amtDisplay}</span>
                        </div>
                        <div class="text-[10px] mt-1 truncate font-medium text-gray-400">
                            └ ${sub.source}
                        </div>
                    </div>`;
            });
            const icon = getCoverageIcon(name);
            let totalDisplay = formatKoAmount(data.totalMin);
            if (data.totalMin !== data.totalMax) {
                totalDisplay = `${formatKoAmount(data.totalMin)}~${formatKoAmount(data.totalMax)}`;
            }
            card.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm" style="background:rgba(230,0,0,0.05);">
                            ${icon}
                        </div>
                        <div class="text-right">
                            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">COVERAGE TOTAL</p>
                            <p class="text-2xl font-black text-red-600 font-outfit" style="color:var(--primary-bright);">
                                ${totalDisplay}
                            </p>
                        </div>
                    </div>
                    <div class="h-px w-full bg-gray-50"></div>
                    <div>
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
        itemCard.style.animationDelay = `${idx * 40}ms`;
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
                            <div class="flex justify-between pl-4 mt-1.5 text-[10px] text-gray-400 font-medium">
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
// Helper to find details (Global Scope)
function findDetails(itemName) {
    let details = coverageDetailsMap[itemName];
    if (!details) {
        if (itemName.includes("암 통합치료비") && (itemName.includes("III") || itemName.includes("Ⅲ"))) {
            details = coverageDetailsMap["암진단및치료비(암 통합치료비III)"];
        }
        // [MOVED] 주요치료 우선 체크 (비급여/전액본인부담 키워드가 겹치므로 먼저 확인해야 함)
        else if (itemName.includes("암 통합치료비") && itemName.includes("주요치료")) {
            details = coverageDetailsMap["암 통합치료비(주요치료)(비급여(전액본인부담 포함), 암중점치료기관(상급 종합병원 포함))"];
        }
        else if (itemName.includes("암 통합치료비") && itemName.includes("비급여") && itemName.includes("전액본인부담")) {
            details = coverageDetailsMap["암 통합치료비(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함))"];
        }
        else if (itemName.includes("암 통합치료비") && (itemName.includes("Ⅱ") || itemName.includes("II")) && itemName.includes("비급여")) {
            details = coverageDetailsMap["암 통합치료비Ⅱ(비급여)"];
        }
        else if (itemName.includes("암 통합치료비") && itemName.includes("기본형")) {
            details = coverageDetailsMap["암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))"];
        }
        else if (itemName.includes("암 통합치료비") && itemName.includes("실속형")) {
            details = coverageDetailsMap["암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))"];
        }
        else if (itemName.includes("중입자방사선")) {
            details = coverageDetailsMap["항암중입자방사선치료비"];
        } else if (itemName.includes("세기조절방사선")) {
            details = coverageDetailsMap["항암세기조절방사선치료비"];
        } else if (itemName.includes("면역항암약물") || itemName.includes("면역항암")) {
            details = coverageDetailsMap["특정면역항암약물허가치료비"];
        } else if (itemName.includes("표적항암약물") || itemName.includes("표적항암")) {
            details = coverageDetailsMap["표적항암약물허가치료비"];
        } else if (itemName.includes("양성자방사선") || itemName.includes("양성자")) {
            details = coverageDetailsMap["항암양성자방사선치료비"];
        } else if (itemName.includes("26종")) {
            details = coverageDetailsMap["26종항암방사선및약물치료비"];
        } else if (itemName.includes("다빈치") && itemName.includes("로봇")) {
            if (!itemName.includes("특정암") || itemName.includes("제외")) {
                details = coverageDetailsMap["다빈치로봇암수술비"];
            }
        }
    }
    return details;
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
            // Increment remote counters (Today & Total)
            if (typeof incrementAnalysisCounts === 'function') {
                incrementAnalysisCounts();
            }
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

// ── PDF Export Function ──
window.exportToPDF = async function () {
    const target = document.querySelector('main');
    if (!target) return;

    // 원본 파일명 가져오기 및 분석 키워드 추가
    const fileNameEl = document.getElementById('file-name');
    let originalName = '분석결과';
    if (fileNameEl && fileNameEl.innerText) {
        originalName = fileNameEl.innerText.replace(/\.pdf$/i, '');
    }
    const finalFileName = `${originalName}분석.png`;

    // 폰트 대기 (Google Font 로딩 보장)
    await document.fonts.ready;

    const options = {
        scale: 2,
        useCORS: true,
        backgroundColor: '#EBEBEB',
        logging: false,
        onclone: (clonedDoc) => {
            const cloneMain = clonedDoc.querySelector('main');
            if (!cloneMain) return;

            // 1. main의 모든 자식을 돌며 지정한 섹션 외에는 모두 숨김
            const allowedIds = ['file-info', 'summary-section'];
            Array.from(cloneMain.children).forEach(child => {
                if (!allowedIds.includes(child.id)) {
                    child.style.display = 'none';
                }
            });

            // 2. 대상 섹션 강제 노출 및 내부 버튼 숨김
            const fileInfo = clonedDoc.getElementById('file-info');
            const summary = clonedDoc.getElementById('summary-section');

            if (fileInfo) {
                fileInfo.style.display = 'flex';
                fileInfo.classList.remove('hidden');
                fileInfo.style.marginBottom = '24px';
                const resetBtn = fileInfo.querySelector('#reset-btn');
                if (resetBtn) resetBtn.style.display = 'none';
            }
            if (summary) {
                summary.style.display = 'block';
                summary.classList.remove('hidden');
                const exportBtn = summary.querySelector('#export-pdf-btn');
                if (exportBtn) exportBtn.style.display = 'none';
            }

            // 3. 폰트 명시적 주입 (환경 간 차이 방지)
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
                
                * {
                    font-family: 'Noto Sans KR', sans-serif !important;
                    letter-spacing: 0 !important;
                    word-spacing: 0 !important;
                }
                span, div, p, b, h1, h2, h3 {
                    line-height: 1.6 !important;
                    overflow: visible !important;
                }
            `;
            clonedDoc.head.appendChild(style);
        }
    };

    try {
        const canvas = await html2canvas(target, options);
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imgData;
        link.download = finalFileName;
        link.click();
    } catch (err) {
        console.error('Capture Error:', err);
        alert('이미지 저장 중 오류가 발생했습니다.');
    }
};

/**
 * --- COUNTER API LOGIC (DUAL: TODAY & TOTAL) ---
 * tracks analysis counts via api.counterapi.dev
 */
const COUNTER_NAMESPACE = "meritz_analyzer";

// Get KST Date Key: meritz_daily_YYYYMMDD
function getTodayKey() {
    const now = new Date();
    // Offset to KST (UTC+9)
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    return `meritz_daily_${yyyy}${mm}${dd}`;
}

const TOTAL_KEY = "meritz_total_analysis";
const DAILY_KEY = getTodayKey();

const API_BASE = "https://api.counterapi.dev/v1";

async function fetchAnalysisCounts() {
    try {
        // Fetch Total and Daily in parallel
        const [totalRes, dailyRes] = await Promise.all([
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${TOTAL_KEY}`),
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${DAILY_KEY}`)
        ]);

        const totalData = await totalRes.json();
        const dailyData = await dailyRes.json();

        updateCounterUI(dailyData.count || 0, totalData.count || 0);
    } catch (error) {
        console.error('Failed to fetch counts:', error);
    }
}

async function incrementAnalysisCounts() {
    try {
        // Increment both in parallel
        const [totalRes, dailyRes] = await Promise.all([
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${TOTAL_KEY}/up`),
            fetch(`${API_BASE}/${COUNTER_NAMESPACE}/${DAILY_KEY}/up`)
        ]);

        const totalData = await totalRes.json();
        const dailyData = await dailyRes.json();

        updateCounterUI(dailyData.count, totalData.count);
    } catch (error) {
        console.error('Failed to increment counts:', error);
    }
}

function updateCounterUI(daily, total) {
    const todayEl = document.getElementById('analysis-count-today');
    const totalEl = document.getElementById('analysis-count-total');
    const badgeEl = document.getElementById('counter-badge');

    if (todayEl) todayEl.innerText = Number(daily).toLocaleString();
    if (totalEl) totalEl.innerText = Number(total).toLocaleString();

    if (badgeEl) {
        badgeEl.style.opacity = '1';
        badgeEl.style.transform = 'scale(1)';
    }
}

// Global exposure for increment
window.incrementAnalysisCounts = incrementAnalysisCounts;

// Initial fetch on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAnalysisCounts);
} else {
    fetchAnalysisCounts();
}

