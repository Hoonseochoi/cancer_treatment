// ── PDF Extraction (Hybrid: Text Layer + OCR + Line Preservation) ──
async function extractTextFromPDF(file, log = console.log) {
    log("PDF 로딩 시작...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    log(`PDF 로드 완료. 총 ${pdf.numPages}페이지`);
    // 미래에셋생명: 파일명으로 조기 감지 → 1~8페이지
    // 메리츠화재: page 1 텍스트로 감지 → 1,3,4,5페이지 (청약서 page 6+ 중복 방지)
    // 삼성화재 등 대용량 PDF(8페이지 초과): 전체 페이지 스캔
    const isMiraePDF = typeof currentFileName === 'string' && /M-케어|케어건강|미래에셋/i.test(currentFileName);
    // 메리츠 감지: page 1 빠른 스캔
    let isMeritzPDF = false;
    if (!isMiraePDF && pdf.numPages > 8) {
        try {
            const p1 = await pdf.getPage(1);
            const p1c = await p1.getTextContent();
            const p1text = p1c.items.map(it => it.str).join('');
            isMeritzPDF = /메리츠화재|meritzfire/i.test(p1text);
            if (isMeritzPDF) log('[pdf_extractor] 메리츠화재 감지 → 담보 요약 페이지만 처리');
        } catch(e) {}
    }
    const pagesToProcess = isMiraePDF
        ? [1, 2, 3, 4, 5, 6, 7, 8].filter(p => p <= pdf.numPages)
        : isMeritzPDF
            ? [1, 3, 4, 5].filter(p => p <= pdf.numPages)
            : pdf.numPages > 8
                ? Array.from({ length: pdf.numPages }, (_, i) => i + 1)
                : [1, 3, 4, 5, 6].filter(p => p <= pdf.numPages);
    const totalPagesToProcess = pagesToProcess.length;
    log(`처리할 페이지: [${pagesToProcess.join(', ')}]`);
    showToast(`총 ${totalPagesToProcess}페이지 정밀 분석을 시작합니다.`, false);

    // ── Phase 1: 텍스트 레이어 추출 (전 대상 페이지, OCR 없이 빠르게) ──
    const pageTexts = new Array(pagesToProcess.length).fill("");
    for (let idx = 0; idx < pagesToProcess.length; idx++) {
        const i = pagesToProcess[idx];
        updateProgress(
            Math.round((idx / totalPagesToProcess) * 40),
            `${i}페이지 텍스트 확인 중...`
        );
        try {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            let pageText = "";
            if (content && content.items && content.items.length > 0) {
                // Y 좌표 기준: PDF좌표계는 아래에서 위로 증가. 원본 스트림 순서(논리적 읽기 순서)를 존중.
                const items = content.items.map(item => ({
                    str: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    w: item.width,
                    h: item.height
                }));
                let lastY = null;
                let lastX = null;
                for (let k = 0; k < items.length; k++) {
                    const item = items[k];
                    if (lastY !== null) {
                        if (Math.abs(item.y - lastY) > 8) {
                            pageText += "\n";
                        } else if (lastX !== null && k > 0 && Math.abs(item.x - lastX) > 5) {
                            pageText += " ";
                        }
                    }
                    pageText += item.str;
                    if (item.hasEOL) {
                        pageText += "\n";
                        lastY = null;
                    } else {
                        lastY = item.y;
                        lastX = item.x + item.w;
                    }
                }
            }
            pageTexts[idx] = pageText;
        } catch (err) {
            console.warn(`Page ${i} Text Layer Error:`, err);
        }
    }

    // ── Phase 2: 페이지마다 반복되는 머리말/꼬리말 줄 자동 감지 ──
    // 실제 본문이 이미지로 그려진 페이지는 텍스트 레이어에 머리말/꼬리말(설계번호, 발행일,
    // 페이지 번호, 상품명 등 반복 문구)만 잡혀 글자 수가 충분해 보이는 경우가 있음.
    // 여러 페이지에 동일하게 반복되는 줄은 보일러플레이트로 보고 실제 본문 판단에서 제외.
    const PAGE_NUM_RE = /페이지\s*\d+\s*\/\s*\d+|전체페이지\s*\d+\s*\/\s*\d+/g;
    const stripLine = (l) => l.replace(PAGE_NUM_RE, '').trim();
    const lineCounts = new Map();
    pageTexts.forEach(pt => {
        const linesInPage = new Set(pt.split('\n').map(stripLine).filter(l => l.length > 0));
        linesInPage.forEach(l => lineCounts.set(l, (lineCounts.get(l) || 0) + 1));
    });
    const boilerplateThreshold = Math.max(2, Math.ceil(pagesToProcess.length * 0.5));
    const boilerplateLines = new Set(
        [...lineCounts.entries()].filter(([, count]) => count >= boilerplateThreshold).map(([line]) => line)
    );

    // ── Phase 3: 보일러플레이트 제외 실질 글자 수 기준으로 OCR 필요 페이지만 처리 ──
    let fullText = '';
    for (let idx = 0; idx < pagesToProcess.length; idx++) {
        const i = pagesToProcess[idx];
        let pageText = pageTexts[idx];
        try {
            updateProgress(
                40 + Math.round((idx / totalPagesToProcess) * 60),
                `${i}페이지 분석 중...`
            );
            const strippedText = pageText.split('\n').map(stripLine)
                .filter(l => l.length > 0 && !boilerplateLines.has(l)).join('\n');
            const len = strippedText.trim().length;
            if (len < 100) {
                updateProgress(
                    40 + Math.round((idx / totalPagesToProcess) * 60),
                    `${i}페이지 OCR 변환 중...`
                );
                const page = await pdf.getPage(i);
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
                                        40 + Math.round((idx / totalPagesToProcess) * 60),
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
                log(`Page ${i} 텍스트 레이어 발견: ${len}자(보일러플레이트 제외)`);
            }
        } catch (pageErr) {
            console.error(`Page ${i} Critical Error:`, pageErr);
            log(`Page ${i} 처리 중 오류: ${pageErr.message}`);
        }
        fullText += (pageText || "") + '\n';
    }
    return fullText || "";
}
