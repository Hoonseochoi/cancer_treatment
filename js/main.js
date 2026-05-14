// ── Insurer Detection ──
function detectInsurer(text) {
    // 0차: DB손해보험 → idbins.com URL / 브랜드명 (가장 명확한 식별자)
    if (/idbins\.com|DB손해보험|프로미라이프/.test(text)) return 'db';
    if (typeof currentFileName === 'string' && /\bDB\b|idbins/i.test(currentFileName)) return 'db';

    // 0차: 흥국화재 → heungkukfire.co.kr / 흥국화재해상보험 / 흥Good
    if (/heungkukfire\.co\.kr|흥국화재해상보험|흥Good/.test(text)) return 'heungkuk';
    if (typeof currentFileName === 'string' && /흥국|heungkuk/i.test(currentFileName)) return 'heungkuk';

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
        // Validate: Korean name must be 2–5 pure Hangul chars (reject particles like "는", "의", "에" etc.)
        if (customerName !== '고객' && !/^[가-힣]{2,5}$/.test(customerName)) customerName = '고객';

        // Run Raw Extraction
        const insurer = detectInsurer(text);
        console.log(`[detectInsurer] → ${insurer} (textLen=${text.length})`);
        document.body.classList.toggle('meritz-theme', insurer === 'meritz');
        document.body.classList.toggle('samsung-theme', insurer === 'samsung');
        document.body.classList.toggle('db-theme', insurer === 'db');
        document.body.classList.toggle('heungkuk-theme', insurer === 'heungkuk');

        // ── 메타 추출: 상품명 / 연령 / 보험료 ──
        const samsungMeta = { fileName: file.name };
        if (insurer === 'samsung') {
            const pm = text.match(/보험상품명\s*(무배당[\s\S]+?)(?=보험계약자)/);
            if (pm) samsungMeta.productName = pm[1].replace(/\s+/g, '').trim();

            const am = text.match(/나이\s*(\d{1,3})\s*세/);
            if (am) samsungMeta.age = parseInt(am[1], 10);

            const prm = text.match(/1회\s*보험료\s*([\d,]+)\s*원/) ||
                        text.match(/보험료\s*([\d,]+)\s*원\s*\(매월\)/);
            if (prm) samsungMeta.premium = parseInt(prm[1].replace(/,/g, ''), 10);

            // 설계번호
            const dnM = text.match(/설계번호\s*[:：]?\s*([\w\-]+)/);
            if (dnM) samsungMeta.designNo = dnM[1].trim();

            // RC (소속 RC 또는 "경인0센터" 형태)
            const rcM = text.match(/소속\s*RC\s*[:：]?\s*([^\n\r]{2,30})/) ||
                        text.match(/RC\s*[:：]\s*([^\n\r]{2,30})/i);
            if (rcM) samsungMeta.rc = rcM[1].trim();

            // 대리점/지사명 (주식회사 ~~~~)
            const agM = text.match(/(?:보험)?\s*대리점(?:명)?\s*[:：]?\s*([^\n\r]{2,50})/) ||
                        text.match(/((?:주식회사|\(주\))[^\n\r\s()]{1,30})/);
            if (agM) samsungMeta.agency = agM[1].trim();

            console.log('[samsung meta]', samsungMeta);
        } else if (insurer === 'db') {
            // 상품명: "무배당 프로미라이프 ..." 형태 (같은 줄 우선, 없으면 다음 줄)
            const pmInline = text.match(/(무배당\s*프로미라이프[^\n\r]{0,80})/);
            const pmNext = text.match(/프로미라이프\s*[\r\n]+([^\r\n]+)/);
            const pm = pmInline
                ? pmInline
                : pmNext ? { 1: '프로미라이프 ' + pmNext[1].trim() } : null;
            if (pm) samsungMeta.productName = pm[1].trim();

            // 보험료: "납입보험료 XXX원" 또는 "합계보험료 XXX원"
            const prm = text.match(/납입보험료\s*([\d,]+)\s*원/) ||
                        text.match(/합계보험료\s*([\d,]+)\s*원/);
            if (prm) samsungMeta.premium = parseInt(prm[1].replace(/,/g, ''), 10);

            // 연령: DB는 "XX세" 미표기 → 주민번호 앞 2자리 또는 "XX년생"에서 출생연도 추산
            const amYunsaeng = text.match(/(\d{2})년생/);
            const amJumin = text.match(/본인\s+[가-힣]{2,5}\s+(\d{2})\d{4}[-]/);
            const amSe = text.match(/피보험자[^\n]{0,50}?(\d{2,3})\s*세/);
            if (amYunsaeng) {
                const yy = parseInt(amYunsaeng[1]);
                const fullYear = yy >= 25 ? 1900 + yy : 2000 + yy;
                samsungMeta.age = new Date().getFullYear() - fullYear;
            } else if (amJumin) {
                const yy = parseInt(amJumin[1]);
                const fullYear = yy >= 25 ? 1900 + yy : 2000 + yy;
                samsungMeta.age = new Date().getFullYear() - fullYear;
            } else if (amSe) {
                samsungMeta.age = parseInt(amSe[1], 10);
            }

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
        } else if (insurer === 'heungkuk') {
            // 상품명: "무배당 흥Good..." 직접 매칭 우선 (레이아웃 무관하게 가장 안정적)
            const pm = text.match(/(무배당\s*흥Good[^\n\r]{0,80})/) ||
                       text.match(/보험상품\s+(무배당[^\n\r]{0,80})/);
            if (pm) samsungMeta.productName = pm[1].trim();

            // 연령: "나이:41세" 형태 (피보험자 사항 라인)
            const am = text.match(/나이\s*[:：]\s*(\d+)\s*세/);
            if (am) samsungMeta.age = parseInt(am[1], 10);

            // 보험료: "실납입보험료 XXX원" 우선, fallback "보험료 XXX원"
            const prm = text.match(/실납입보험료\s*([\d,]+)\s*원/) ||
                        text.match(/합계보험료\s*([\d,]+)\s*원/) ||
                        text.match(/보\s*험\s*료\s*[\r\n]+([\d,]+)\s*원/) ||
                        text.match(/보험료\s*([\d,]+)\s*원/);
            if (prm) samsungMeta.premium = parseInt(prm[1].replace(/,/g, ''), 10);

            // 고객이름: "이현우(계약자와의 관계:본인," 형태
            if (customerName === '고객') {
                const hkMatch = text.match(/([가-힣]{2,5})\(계약자와의\s*관계/);
                if (hkMatch) customerName = hkMatch[1];
            }
            // 보조: "{이름}님" 형태
            if (customerName === '고객') {
                const nimMatch = text.match(/([가-힣]{2,5})님\s*(보장|안내)/);
                if (nimMatch) customerName = nimMatch[1];
            }
            if (customerName !== '고객') console.log('[흥국] 고객이름:', customerName);
            console.log('[heungkuk meta]', samsungMeta);
        } else if (insurer === 'meritz') {
            // 상품명: "(무) 메리츠..." 헤더 직접 매칭
            // PDF.js는 (무) 뒤 텍스트를 같은 줄 또는 근접하게 출력
            const pm = text.match(/\(무\)\s*(메리츠[^\n\r]{0,100})/) ||
                       text.match(/\(무\)\s*([^\n\r(]{0,100})/) ||
                       text.match(/보험상품명\s*(무배당[^\n\r]+)/);
            if (pm) samsungMeta.productName = pm[1].trim();

            // 연령: ① "| XX세" 형태(표) ② "(여, 1967. 02. 23)" 생년월일 계산 ③ "XX세" 단독
            const amPipe = text.match(/\|\s*(\d{1,3})\s*세\s*(?:주피보험자|본인)/);
            const amDob  = text.match(/(?:여|남),\s*((?:19|20)\d{2})\.\s*\d{2}\.\s*\d{2}/);
            const amSe   = text.match(/피보험자[^\n]{0,80}(\d{2,3})\s*세\s*(?:주피보험자|본인)/);
            if (amPipe) {
                samsungMeta.age = parseInt(amPipe[1], 10);
            } else if (amDob) {
                samsungMeta.age = new Date().getFullYear() - parseInt(amDob[1], 10);
            } else if (amSe) {
                samsungMeta.age = parseInt(amSe[1], 10);
            }

            // 보험료: "1회차보험료(할인후) XXX원" / "보험료 XXX원(매월)" / "보험료 XXX원"
            const prm = text.match(/1회차\s*보험료[^\n\r\d]*([\d,]+)\s*원/) ||
                        text.match(/보험료\s*([\d,]+)\s*원\s*\(매월\)/) ||
                        text.match(/보험료\s+([\d,]+)\s*원(?!\s*\()/) ;
            if (prm) samsungMeta.premium = parseInt(prm[1].replace(/,/g, ''), 10);

            console.log('[meritz meta]', samsungMeta);
        }

        const results = insurer === 'samsung'
            ? extractRawCoveragesSamsung(text)
            : insurer === 'db'
                ? extractRawCoveragesDB(text)
                : insurer === 'heungkuk'
                    ? extractRawCoveragesHeungkuk(text)
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
            // Increment per-insurer counter
            if (typeof incrementInsurerCount === 'function') {
                incrementInsurerCount(insurer);
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
    // CI 로고 base64 주입 (expert_data.js 로드 후)
    const dbLogo = document.getElementById('db-ci-logo');
    const hkLogo = document.getElementById('hkfire-ci-logo');
    if (dbLogo && typeof DB_CI_B64 !== 'undefined') dbLogo.src = DB_CI_B64;
    if (hkLogo && typeof HKFIRE_CI_B64 !== 'undefined') hkLogo.src = HKFIRE_CI_B64;

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
            document.body.classList.remove('meritz-theme');
            document.body.classList.remove('samsung-theme');
            document.body.classList.remove('db-theme');
            document.body.classList.remove('heungkuk-theme');
            if (fileInput) fileInput.value = '';
        });
    }
});

