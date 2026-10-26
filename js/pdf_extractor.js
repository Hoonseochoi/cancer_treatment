// ── OCR 글자 간격 정리 ──
// Tesseract(kor)는 한글을 글자마다 띄워 읽는다("건 강 보 험 1,000 만 원"). 분석기는 글자 레이어처럼
// 붙은 이름·금액("건강보험 1,000만원")을 기대하므로, 이미지 PDF(예: OZ 뷰어로 이미지 저장한 삼성 제안서)는
// 0건이 나왔다. 칸 사이 공백(숫자↔숫자, 한글↔숫자)은 그대로 두고 글자 사이 공백만 걷어낸다.
function normalizeOcrText(t) {
    return String(t || '').split('\n').map(line => {
        let s = line;
        s = s.replace(/([가-힣])\s+(?=[가-힣])/g, '$1');                    // 한글 사이
        s = s.replace(/(\d)\s+(?=(?:만|천|억|원|년|세|회|개|종|대|일|%))/g, '$1');   // 1,000 만 원 → 1,000만원
        s = s.replace(/([가-힣])\s*-\s*(?=[가-힣])/g, '$1·');                // 뇌 - 심장 → 뇌·심장
        s = s.replace(/([(\[])\s+/g, '$1').replace(/\s+([)\]])/g, '$1');  // 괄호 안쪽
        s = s.replace(/([가-힣)\]])\s+(?=\()/g, '$1');                     // 수술비 ( → 수술비(
        s = s.replace(/([)\]])\s+(?=[가-힣(])/g, '$1');                     // ] 통합 → ]통합 (금액 앞 칸 공백은 둔다)
        // 로마숫자 Ⅱ·Ⅲ 오인식 — "특정치료비 1|(", "유사암 ! 제외", "수술비 |!(", "수술비 ㅣ |"
        // 실측(삼성 이미지 제안서)에서 '1'이 섞인 묶음은 Ⅲ, 나머지는 Ⅱ였다.
        s = s.replace(/([가-힣])\s*((?:[|!ㅣlI1]\s*){1,3}?)(?=\(|\s+[가-힣(]|\s*$)/g,
            (m, h, g) => h + (/1/.test(g) ? 'Ⅲ' : 'Ⅱ'));
        s = s.replace(/(^|\s)[_|ㅣ](?=\s)/g, '$1').replace(/\s+,/g, ',');   // 홀로 떨어진 _ | 잡티, " ," → ","
        s = s.replace(/\s{2,}/g, ' ');
        // 표지 이름 칸은 띄어 둔다 — "피보험자홍길동" 이면 이름을 못 찾는다
        s = s.replace(/(피보험자|계약자|설계사|보험상품명)(?=[가-힣])/g, '$1 ');
        return s;
    }).join('\n');
}

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
            // 메리츠 담보 목록은 3쪽부터 상품에 따라 6쪽 이상까지 이어진다. 1·3·4·5쪽만 읽어
            // 뒤쪽 담보가 빠졌다(실측: 내Mom대로 6쪽의 유사암 통합치료 생활비·양성뇌종양 진단비).
            // 넉넉히 14쪽까지 잡고, 목록 끝 문구가 나오면 거기서 멈춘다(아래 루프).
            ? [1, ...Array.from({ length: 12 }, (_, k) => k + 3)].filter(p => p <= pdf.numPages)
            : pdf.numPages > 8
                ? Array.from({ length: pdf.numPages }, (_, i) => i + 1)
                : [1, 3, 4, 5, 6].filter(p => p <= pdf.numPages);
    const totalPagesToProcess = pagesToProcess.length;
    let usedOcr = false;
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
            // 2. OCR Fallback
            // 텍스트가 너무 적으면(50자 미만) 이미지로 간주
            const len = pageText.trim().length;
            if (len < 50) {
                usedOcr = true;
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
                    pageText = normalizeOcrText((result && result.data && result.data.text) || "");
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
        // 메리츠: 담보별 설명(「가입담보 및 보장내용」)이 시작되는 쪽은 싣지 않고 멈춘다.
        // 목록 끝 안내문("가입담보리스트는 담보사항…")은 상품에 따라 목록 앞에 오기도 해 기준이 못 된다.
        if (isMeritzPDF && i >= 4 && /가입담보\s*및\s*보장내용/.test(pageText || '')) {
            log(`[pdf_extractor] 메리츠 담보 설명 시작(${i}쪽) — 여기서 멈춤`);
            break;
        }
        fullText += (pageText || "") + '\n';
        // 이미지(OCR) 제안서는 한 장에 수 초가 걸린다. 가입 담보 목록은 앞쪽에 몰려 있으므로
        // 목록 끝("보장보험료 합계")이 나온 쪽까지만 읽고 멈춘다(실측: 21쪽 → 3쪽).
        // 글자 레이어 PDF는 빠르니 그대로 끝까지 읽는다(뒤쪽 부가서비스 안내 감지 등).
        if (usedOcr && !isMeritzPDF && /보장보험료\s*합계/.test(pageText || '')) {
            log(`[pdf_extractor] 이미지 제안서 — 담보 목록 끝(${i}쪽)에서 멈춤`);
            break;
        }
        if (isMeritzPDF && i >= 3 && /^\s*주의사항\s*$/m.test(pageText || '')) {
            log(`[pdf_extractor] 메리츠 가입담보리스트 끝(${i}쪽)`);
            break;
        }
    }
    return fullText || "";
}
