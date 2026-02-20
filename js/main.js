// ── File Processing ──
async function processFile(file) {
    if (!file) return;
    currentFileName = file.name; // Save filename for mapping

    // ── Manager Recognition ──
    const badge = document.getElementById('manager-badge-container');
    if (badge) {
        badge.classList.add('hidden', 'scale-90', 'opacity-0');
        badge.classList.remove('scale-100', 'opacity-100');
    }

    try {
        const managerCodeMatch = file.name.match(/^\d{9}/);
        let name = null;
        let code = null;

        if (managerCodeMatch && typeof MANAGERS_MAP !== 'undefined') {
            code = managerCodeMatch[0];
            name = MANAGERS_MAP[code];
        }

        const nameEl = document.getElementById('welcome-manager-name');
        const codeEl = document.getElementById('welcome-manager-code');
        const nameContainer = document.querySelector('.welcome-name');

        if (name) {
            // Case: Manager Matched
            if (nameEl) nameEl.textContent = name;
            if (nameContainer) nameContainer.innerHTML = `<span id="welcome-manager-name">${name}</span> 매니저님`;

            // [NEW] Log activity to Supabase
            logManagerActivity(code, name, file.name);

            if (codeEl) {
                // codeEl.textContent = `M-${code}`;
                // codeEl.classList.remove('hidden');
            }
        } else {
            // Case: No Match - Fallback
            if (nameContainer) nameContainer.innerHTML = "환영합니다!";
            if (codeEl) codeEl.classList.add('hidden');
        }

        if (badge) {
            badge.classList.remove('hidden');
            setTimeout(() => {
                badge.classList.remove('scale-90', 'opacity-0');
                badge.classList.add('scale-100', 'opacity-100');
            }, 100);
        }
    } catch (mErr) {
        console.warn("Manager recognition failed:", mErr);
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

        // ── Customer Name Extraction ──
        let customerName = '고객';
        const nameMatch = text.match(/피보험자\s*[:：]?\s*([가-힣\w\s]{2,10})/);
        if (nameMatch && nameMatch[1]) {
            customerName = nameMatch[1].trim();
        }

        // Run Raw Extraction
        const results = extractRawCoverages(text);
        await new Promise(r => setTimeout(r, 500));
        document.getElementById('progress-section').classList.add('hidden');
        renderResults(results, customerName);
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
            if (fileInput) fileInput.value = '';
        });
    }
});

