// ── PDF Extraction (Hybrid: Text Layer + OCR + Line Preservation) ──
async function extractTextFromPDF(file, log = console.log) {
    log("PDF 로딩 시작...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    log(`PDF 로드 완료. 총 ${pdf.numPages}페이지`);
    let fullText = '';
    // 1페이지: 가계약번호 (매니저 인식용), 3~6페이지: 가입담보리스트
    const pagesToProcess = [1, 3, 4, 5, 6].filter(p => p <= pdf.numPages);
    const totalPagesToProcess = pagesToProcess.length;
    showToast(`총 ${totalPagesToProcess}페이지 정밀 분석을 시작합니다.`, false);
    for (let idx = 0; idx < pagesToProcess.length; idx++) {
        const i = pagesToProcess[idx];
        let pageText = "";
        try {
            updateProgress(
                Math.round((idx / totalPagesToProcess) * 100),
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
                    // 정렬 로직 제거: PDF 원본 스트림 순서(논리적 읽기 순서)를 존중
                    let lastY = null;
                    let lastX = null;
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (lastY !== null) {
                            if (Math.abs(item.y - lastY) > 8) {
                                pageText += "\n";
                            } else if (lastX !== null && i > 0 && Math.abs(item.x - lastX) > 5) {
                                pageText += " ";
                            }
                        }

                        pageText += item.str;

                        // PDF native EOL support
                        if (item.hasEOL) {
                            pageText += "\n";
                            lastY = null;
                        } else {
                            lastY = item.y;
                            lastX = item.x + item.w;
                        }
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
                    Math.round((idx / totalPagesToProcess) * 100),
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
                                        Math.round((idx / totalPagesToProcess) * 100),
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
