// ── Insurer Detection ──
function detectInsurer(text) {
    // 0차: DB손해보험 → idbins.com URL / 브랜드명 (가장 명확한 식별자)
    if (/idbins\.com|DB손해보험|프로미라이프/.test(text)) return 'db';
    if (typeof currentFileName === 'string' && /\bDB\b|idbins/i.test(currentFileName)) return 'db';

    // 1차: 메리츠 명시 → 무조건 meritz
    if (/메리츠\s*화재|meritzfire\.com|메리츠/i.test(text)) return 'meritz';
    if (typeof currentFileName === 'string' && /메리츠|meritz/i.test(currentFileName)) return 'meritz';

    // 2차: 삼성 회사명/URL 직접 매칭
    if (/삼성\s*화재|samsungfire\.com/i.test(text)) return 'samsung';
    // 3차: 삼성 가입제안서 고유 구조 키워드
    if (/담보가입현황/.test(text)) return 'samsung';
    // 4차: 파일명 기반
    if (typeof currentFileName === 'string' && /삼성|samsung/i.test(currentFileName)) return 'samsung';

    return 'meritz'; // default
}

// ── File Processing ──
async function processFile(file) {
    if (!file) return;
    currentFileName = file.name; // Save filename for mapping

    const badge = document.getElementById('manager-badge-container');
    if (badge) {
        badge.classList.add('hidden', 'scale-90', 'opacity-0');
        badge.classList.remove('scale-100', 'opacity-100');
    }

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

        // ── Manager Recognition (가계약번호 OCR → managers.js 매칭) ──
        let name = null;
        let code = null;
        const gaMatch = text.match(/(?:가계약번호|설계번호)\s*[:：]?\s*(\d{9,})/);
        if (gaMatch && gaMatch[1] && typeof MANAGERS_MAP !== 'undefined') {
            code = gaMatch[1].substring(0, 9);  // 앞 9자리 = 매니저코드
            name = MANAGERS_MAP[code];
        }
        const welcomeNameEl = document.getElementById('welcome-manager-name');
        const codeEl = document.getElementById('welcome-manager-code');
        const nameContainer = document.querySelector('.welcome-name');
        if (name) {
            if (welcomeNameEl) welcomeNameEl.textContent = name;
            const levelEl = document.getElementById('welcome-manager-level');
            if (nameContainer) {
                nameContainer.innerHTML = `<span id="welcome-manager-name">${name}</span> 매니저님 ${levelEl ? levelEl.outerHTML : ''}`;
            }
            if (typeof logManagerActivity === 'function') {
                logManagerActivity(code, name, file.name);
            }
        } else {
            if (nameContainer) nameContainer.innerHTML = "환영합니다!";
            if (codeEl) codeEl.classList.add('hidden');
            if (typeof logUnrecognizedUpload === 'function') {
                logUnrecognizedUpload(file.name);
            }
        }
        if (badge) {
            badge.classList.remove('hidden');
            setTimeout(() => {
                badge.classList.remove('scale-90', 'opacity-0');
                badge.classList.add('scale-100', 'opacity-100');
            }, 100);
        }

        // ── Customer Name Extraction ──
        let customerName = '고객';
        // 1. Try "피보험자 | 연령" table style first (often has name on next line)
        const tableMatch = text.match(/피보험자\s*\|\s*연령\s*[\r\n]+([^\s\|\n\r\t]+)/);
        if (tableMatch && tableMatch[1]) {
            customerName = tableMatch[1].trim();
        } else {
            // 2. Standard "피보험자: 이름" or "피보험자 이름"
            const nameMatch = text.match(/피보험자\s*[:：|]?\s*([^|\n\r\t:：]{2,10})/);
            if (nameMatch && nameMatch[1]) {
                // Split by space, pipe, parenthesis, or bracket
                const tempName = nameMatch[1].trim().split(/[\s|(\[]/)[0];
                // If the matched "name" is just a header like "연령", skip it
                if (tempName && tempName !== '연령' && tempName !== '성별') {
                    customerName = tempName;
                }
            }
        }
        // Last resort: ensure we didn't capture "보험료"
        if (customerName.includes('보험료')) customerName = '고객';

        // Run Raw Extraction
        const insurer = detectInsurer(text);
        console.log(`[detectInsurer] → ${insurer} (textLen=${text.length})`);
        document.body.classList.toggle('samsung-theme', insurer === 'samsung');
        document.body.classList.toggle('db-theme', insurer === 'db');

        // ── 메타 추출: 상품명 / 연령 / 보험료 ──
        const samsungMeta = { fileName: file.name };
        if (insurer === 'samsung') {
            const pm = text.match(/보험상품명(무배당[\s\S]+?)(?=보험계약자)/);
            if (pm) samsungMeta.productName = pm[1].replace(/\s+/g, '').trim();

            const am = text.match(/나이\s*(\d{1,3})\s*세/);
            if (am) samsungMeta.age = parseInt(am[1], 10);

            const prm = text.match(/1회\s*보험료\s*([\d,]+)\s*원/) ||
                        text.match(/보험료\s*([\d,]+)\s*원\s*\(매월\)/);
            if (prm) samsungMeta.premium = parseInt(prm[1].replace(/,/g, ''), 10);

            console.log('[samsung meta]', samsungMeta);
        } else if (insurer === 'db') {
            // 상품명: "무배당 프로미라이프" 다음 줄
            const pm = text.match(/프로미라이프\s*[\r\n]+([^\r\n]+)/);
            if (pm) samsungMeta.productName = '프로미라이프 ' + pm[1].trim();

            // 보험료: 납입보험료 xxx원
            const prm = text.match(/납입보험료\s*([\d,]+)\s*원/);
            if (prm) samsungMeta.premium = parseInt(prm[1].replace(/,/g, ''), 10);

            // 연령: (DB PDF에서 명시적 나이 표기 없는 경우 null 유지)
            const am = text.match(/피보험자[^\n]{0,20}?(\d{1,2})\s*세/);
            if (am) samsungMeta.age = parseInt(am[1], 10);

            // ── DB 고객 이름 추출 ──
            // 방법 1: "{이름}님 보장내용" 형태 (가입담보요약 페이지 헤더)
            if (customerName === '고객') {
                const nimMatch = text.match(/([가-힣]{2,5})님\s*보장내용/);
                if (nimMatch) customerName = nimMatch[1];
            }
            // 방법 2: "[피보험자/66] {이름}" 또는 "/66] {이름}" 형태
            if (customerName === '고객') {
                const dbPiMatch = text.match(/\[피보험자[^\]]*\]\s*([가-힣]{2,5})/);
                if (dbPiMatch) customerName = dbPiMatch[1];
            }
            // 방법 3: "피보험자 {이름}(주민번호)" 형태 (예: 홍길동(660710-1*))
            if (customerName === '고객') {
                const piNumMatch = text.match(/피보험자\s*([가-힣]{2,5})\s*\(\d{6}/);
                if (piNumMatch) customerName = piNumMatch[1];
            }
            if (customerName !== '고객') console.log('[db] 고객이름:', customerName);

            console.log('[db meta]', samsungMeta);
        }

        const results = insurer === 'samsung'
            ? extractRawCoveragesSamsung(text)
            : insurer === 'db'
                ? extractRawCoveragesDB(text)
                : extractRawCoverages(text);
        console.log(`[extraction] ${results.length}건 추출 (insurer=${insurer})`);

        // 미인식 담보 추적
        if (insurer === 'samsung' && typeof findSamsungDetails === 'function') {
            const unmatchedNames = results
                .filter(item => !findSamsungDetails(item.name))
                .map(item => item.name);
            if (unmatchedNames.length > 0) {
                console.warn('[미인식 담보]', unmatchedNames);
                if (typeof logUnmatchedCoverages === 'function') {
                    logUnmatchedCoverages(file.name, insurer, unmatchedNames);
                }
            }
        }

        await new Promise(r => setTimeout(r, 500));
        document.getElementById('progress-section').classList.add('hidden');
        renderResults(results, customerName, insurer, samsungMeta);
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
            document.getElementById('insight-section').classList.add('hidden');

            document.getElementById('progress-section').classList.add('hidden');
            document.body.classList.remove('samsung-theme');
            document.body.classList.remove('db-theme');
            if (fileInput) fileInput.value = '';
        });
    }
});

