// ── PDF Extraction (Hybrid: Text Layer + OCR + Line Preservation) ──
async function extractTextFromPDF(file, log = console.log) {
    log("PDF 로딩 시작...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    log(`PDF 로드 완료. 총 ${pdf.numPages}페이지`);
    let fullText = '';
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
            // 1-b. 페이지 대부분이 래스터 이미지인지 검사 (텍스트 레이어는 헤더/푸터만 잡고
            // 실제 본문이 이미지로 그려진 페이지 감지용 — 글자 수만으로는 못 걸러냄)
            // 성능: 이미 텍스트가 충분히 추출된(500자↑) 페이지는 진짜 본문 페이지일 확률이
            // 매우 높으므로 이 검사 자체를 건너뛴다 (getOperatorList/OCR 재실행 방지 → 속도 저하 방지)
            const len0 = pageText.trim().length;
            let hasLargeImage = false;
            if (len0 < 500) {
                try {
                    const ops = await page.getOperatorList();
                    const viewport0 = page.getViewport({ scale: 1 });
                    const pageArea = viewport0.width * viewport0.height;
                    const mul = (m1, m2) => [
                        m1[0] * m2[0] + m1[1] * m2[2], m1[0] * m2[1] + m1[1] * m2[3],
                        m1[2] * m2[0] + m1[3] * m2[2], m1[2] * m2[1] + m1[3] * m2[3],
                        m1[4] * m2[0] + m1[5] * m2[2] + m2[4], m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
                    ];
                    let stack = [[1, 0, 0, 1, 0, 0]];
                    for (let k = 0; k < ops.fnArray.length; k++) {
                        const fn = ops.fnArray[k];
                        if (fn === pdfjsLib.OPS.save) {
                            stack.push(stack[stack.length - 1].slice());
                        } else if (fn === pdfjsLib.OPS.restore) {
                            stack.pop();
                        } else if (fn === pdfjsLib.OPS.transform) {
                            stack[stack.length - 1] = mul(stack[stack.length - 1], ops.argsArray[k]);
                        } else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintImageXObjectRepeat) {
                            const m = stack[stack.length - 1];
                            const coverage = Math.abs(m[0] * m[3] - m[1] * m[2]) / pageArea;
                            if (coverage > 0.35) { hasLargeImage = true; break; }
                        }
                    }
                } catch (opErr) {
                    console.warn(`Page ${i} Image Coverage Check Error:`, opErr);
                }
            }
            // 2. OCR Fallback
            // 텍스트가 너무 적으면(50자 미만) 이미지로 간주 + 텍스트가 있어도 페이지 대부분이
            // 이미지(본문이 이미지로 그려진 경우)면 OCR 병행
            const len = len0;
            if (len < 50 || hasLargeImage) {
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
                    const ocrText = (result && result.data && result.data.text) || "";
                    // 텍스트 레이어에 이미 헤더/푸터 등 유효한 내용이 있었다면 버리지 않고 이어붙임
                    pageText = (len >= 50 && hasLargeImage) ? (pageText + "\n" + ocrText) : ocrText;
                    log(`Page ${i} OCR 완료: ${ocrText.length}자`);
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
