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
