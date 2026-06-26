let nextHistoryId = 1;

function parseHistoryText(text) {
  if (!text || !text.trim()) return [];

  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const results = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const headerLine = lines.find(l => l.startsWith('🔴'));
    if (!headerLine) continue;

    const headerBody = headerLine.replace('🔴', '').trim();
    const [namePart, codePart] = headerBody.split('/').map(s => (s || '').trim());

    const entry = {
      id: nextHistoryId++,
      진단명: namePart || '',
      진단코드: codePart || '',
      최초진단일: null,
      최근진료일: null,
      입원여부: false,
      입원일수: null,
      수술여부: false,
      수술명: null,
      계속치료일수: null,
      계속투약일수: null,
      통원횟수: null,
      약물명: null,
      재검사여부: false,
      상시복용여부: false,
      현재상태: '',
      비고: '',
      원본: block,
    };

    for (const line of lines) {
      if (line.startsWith('입원:')) {
        const v = line.replace('입원:', '').trim();
        if (v && v !== '없음') {
          entry.입원여부 = true;
          const m = v.match(/(\d+)\s*일/);
          if (m) entry.입원일수 = parseInt(m[1], 10);
        }
      } else if (line.startsWith('수술:')) {
        const v = line.replace('수술:', '').trim();
        if (v && v !== '없음') {
          entry.수술여부 = true;
          entry.수술명 = v;
        }
      } else if (line.startsWith('통원:')) {
        const v = line.replace('통원:', '').trim();
        if (v && v !== '없음') {
          const m = v.match(/(\d+)\s*회/);
          if (m) entry.통원횟수 = parseInt(m[1], 10);
        }
      } else if (line.startsWith('투약:')) {
        const v = line.replace('투약:', '').trim();
        if (v && v !== '없음') {
          const m = v.match(/(\d+)\s*일/);
          if (m) entry.계속투약일수 = parseInt(m[1], 10);
        }
      } else if (line.startsWith('약물:')) {
        const v = line.replace('약물:', '').trim();
        if (v && v !== '없음') entry.약물명 = v;
      } else if (line.startsWith('비고:')) {
        entry.비고 = line.replace('비고:', '').trim();
      } else if (line.startsWith('치료/현상태:')) {
        const v = line.replace('치료/현상태:', '').trim();
        entry.현재상태 = v;
        // "~"로 끝나면 진행중 표기이지만 최근진료일을 자동으로 채우지 않는다
        // (README 5장: 과거에 오늘 날짜로 자동완성 → 완치 사례 오분류 버그 발생)
        if (!v.endsWith('~')) {
          const dateMatch = v.match(/(\d{2})\.(\d{2})\.(\d{2})/);
          if (dateMatch) {
            entry.최근진료일 = `20${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
            entry.최초진단일 = entry.최초진단일 || entry.최근진료일;
          }
        }
      }
    }

    results.push(entry);
  }

  return results;
}

if (typeof module !== 'undefined') {
  module.exports = { parseHistoryText };
}

function daysBetween(dateStr, todayStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date(todayStr);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function matchesDisease11(code) {
  if (!code) return false;
  for (const prefixes of Object.values(DISEASE_11)) {
    if (prefixes.some(p => code.startsWith(p))) return true;
  }
  return false;
}

function withinMonths(dateStr, todayStr, months) {
  const days = daysBetween(dateStr, todayStr);
  if (days === null) return null; // 정보 불충분
  return days <= months * 30.44 && days >= 0;
}

// minMonths 초과 ~ maxMonths 이내 (예: 5년 초과~10년 이내인 "6-10년" 구간)
function withinRangeMonths(dateStr, todayStr, minMonths, maxMonths) {
  const days = daysBetween(dateStr, todayStr);
  if (days === null) return null; // 정보 불충분
  return days > minMonths * 30.44 && days <= maxMonths * 30.44;
}

function isExceptionDisease(name) {
  if (!name) return false;
  return DISCLOSURE_EXCEPTIONS.some(keyword => name.includes(keyword));
}

function classifyHistories(histories, todayStr) {
  const result = {};
  for (const q of Q_DEFS) {
    result[q.id] = { included: [], review: [] };
  }

  for (const h of histories) {
    // Q1: 최근 3개월 진찰/검사
    {
      const within = withinMonths(h.최근진료일, todayStr, 3);
      if (within === null) result.Q1.review.push(h);
      else if (within) result.Q1.included.push(h);
    }

    // Q2: 상시복용 - 날짜 계산보다 체크 여부 신뢰 (README 6장)
    if (h.상시복용여부) {
      result.Q2.included.push(h);
    }

    // Q3: 최근 1년 재검사 - 체크 여부로만 판단(원문 자동추출은 1차 범위 제외)
    if (h.재검사여부) {
      const within = withinMonths(h.최근진료일, todayStr, 12);
      if (within === null) result.Q3.review.push(h);
      else if (within) result.Q3.included.push(h);
    }

    // Q4: 5년 이내 입원/수술/계속 7일↑치료/계속 30일↑투약, 질병종류 무관
    {
      const within = withinMonths(h.최근진료일, todayStr, 60);
      const hasQ4Trigger =
        h.입원여부 ||
        h.수술여부 ||
        (h.계속치료일수 !== null && h.계속치료일수 >= 7) ||
        (h.계속투약일수 !== null && h.계속투약일수 >= 30) ||
        (h.입원일수 !== null && h.입원일수 >= 7) ||
        (h.통원횟수 !== null && h.통원횟수 >= 7); // 같은 질병 7회 이상 통원 (현장 알릴의무 관행 - "계속 치료" 대체 지표)
      if (hasQ4Trigger) {
        if (within === null) result.Q4.review.push(h);
        else if (within) result.Q4.included.push(h);
      }
    }

    // Q5: 11대 질병이면 계속성 조건 없이 5년 이내 단발 진료도 포함
    if (matchesDisease11(h.진단코드)) {
      const within = withinMonths(h.최근진료일, todayStr, 60);
      if (within === null) result.Q5.review.push(h);
      else if (within) result.Q5.included.push(h);
    }

    // Q6: 고지건강체 전용 - 5년 초과~10년 이내(6-10년) 입원/수술. 표준알릴의무 Q1~Q5와 별개 제도.
    if (h.입원여부 || h.수술여부) {
      const within = withinRangeMonths(h.최근진료일, todayStr, 60, 120);
      if (within === null) result.Q6.review.push(h);
      else if (within) result.Q6.included.push(h);
    }
  }

  return result;
}

if (typeof module !== 'undefined') {
  module.exports.classifyHistories = classifyHistories;
  module.exports.isExceptionDisease = isExceptionDisease;
}

if (typeof document !== 'undefined') {
  // 새로고침하면 항상 빈 상태로 시작한다 — 고지 내용을 화면/저장소에 남기지 않는다.
  let histories = [];

  const HISTORY_FIELDS = [
    { key: '진단명', label: '진단명', type: 'text' },
    { key: '진단코드', label: '진단코드', type: 'text' },
    { key: '최초진단일', label: '최초진단일', type: 'date' },
    { key: '최근진료일', label: '최근진료일', type: 'date' },
    { key: '입원일수', label: '입원일수', type: 'number' },
    { key: '수술명', label: '수술명', type: 'text' },
    { key: '계속치료일수', label: '계속치료일수', type: 'number' },
    { key: '계속투약일수', label: '계속투약일수', type: 'number' },
    { key: '통원횟수', label: '통원횟수', type: 'number' },
    { key: '약물명', label: '약물명(상시복용)', type: 'text' },
    { key: '비고', label: '비고', type: 'text' },
  ];

  const CHECKBOX_FIELDS = [
    { key: '입원여부', label: '입원' },
    { key: '수술여부', label: '수술' },
    { key: '재검사여부', label: '재검사' },
    { key: '상시복용여부', label: '상시복용' },
  ];

  function isReviewNeeded(h) {
    return !h.최근진료일;
  }

  function renderHistoryList() {
    const container = document.getElementById('history-list');
    if (!container) return;
    container.innerHTML = '';
    histories.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = 'history-card';

      const head = document.createElement('div');
      head.className = 'history-card-head';
      const title = document.createElement('span');
      title.className = 'history-card-title';
      title.textContent = h.진단명 || `병력 ${idx + 1}`;
      head.appendChild(title);
      if (isReviewNeeded(h)) {
        const badge = document.createElement('span');
        badge.className = 'review-badge';
        badge.textContent = '확인필요';
        head.appendChild(badge);
      }
      card.appendChild(head);

      const fields = document.createElement('div');
      fields.className = 'history-fields';
      HISTORY_FIELDS.forEach(f => {
        const label = document.createElement('label');
        label.textContent = f.label;
        const input = document.createElement('input');
        input.type = f.type;
        input.value = h[f.key] === null || h[f.key] === undefined ? '' : h[f.key];
        input.addEventListener('change', () => {
          h[f.key] = f.type === 'number'
            ? (input.value === '' ? null : Number(input.value))
            : (input.value === '' ? (f.type === 'date' ? null : '') : input.value);
          renderAll();
        });
        label.appendChild(input);
        fields.appendChild(label);
      });
      card.appendChild(fields);

      CHECKBOX_FIELDS.forEach(({ key, label: labelText }) => {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!h[key];
        cb.addEventListener('change', () => { h[key] = cb.checked; renderAll(); });
        label.appendChild(document.createTextNode(labelText));
        label.appendChild(cb);
        fields.appendChild(label);
      });

      const actions = document.createElement('div');
      actions.className = 'history-card-actions';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-link-danger';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => { histories.splice(idx, 1); renderAll(); });
      actions.appendChild(delBtn);
      card.appendChild(actions);

      container.appendChild(card);
    });
  }

  function renderAll() {
    renderHistoryList();
    renderClassifyResult();
  }

  const TODAY_ISO = new Date().toISOString().slice(0, 10);
  // `${qId}::${historyId}` 형태로 "명시적으로 체크 해제한" 항목만 저장한다.
  // 기본값은 체크됨(분류된 항목은 기본적으로 고지 대상으로 간주) — 사용자가
  // 직접 체크를 해제한 것만 이 Set에 들어가므로, 다른 필드를 수정해 화면이
  // 다시 그려져도 사용자가 해제한 상태가 의도치 않게 되돌아가지 않는다.
  const uncheckedKeys = new Set();

  function renderClassifyResult() {
    const container = document.getElementById('classify-result');
    if (!container) return;
    container.innerHTML = '';
    const result = classifyHistories(histories, TODAY_ISO);

    Q_DEFS.forEach(q => {
      const block = document.createElement('div');
      block.className = 'q-block';

      const title = document.createElement('div');
      title.className = 'q-title';
      title.textContent = q.title;
      block.appendChild(title);

      const oneliner = document.createElement('div');
      oneliner.className = 'q-oneliner';
      oneliner.textContent = q.trigger;
      block.appendChild(oneliner);

      const included = result[q.id].included;
      const review = result[q.id].review;

      if (included.length === 0 && review.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'q-empty';
        empty.textContent = '해당 항목 없음';
        block.appendChild(empty);
      }

      [...included.map(h => ({ h, cat: 's' })), ...review.map(h => ({ h, cat: 'r' }))].forEach(({ h, cat: baseCat }) => {
        // Q6는 예외질환 키워드 매칭 시 분류완료/확인필요와 무관하게 "예외질환" 배지를 우선 노출
        // (부가조건은 사람이 직접 확인해야 하므로 자동으로 빼지 않음)
        const cat = q.id === 'Q6' && isExceptionDisease(h.진단명) ? 'e' : baseCat;

        const wrap = document.createElement('div');
        wrap.className = 'q-item-wrap';

        const row = document.createElement('div');
        row.className = 'q-item-row';

        const checkLabel = document.createElement('label');
        checkLabel.className = 'q-item-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const key = `${q.id}::${h.id}`;
        cb.checked = !uncheckedKeys.has(key);
        cb.addEventListener('change', () => {
          if (cb.checked) uncheckedKeys.delete(key); else uncheckedKeys.add(key);
        });
        checkLabel.appendChild(cb);
        const badge = document.createElement('span');
        badge.className = `cat-badge cat-${cat}`;
        badge.textContent = cat === 'e' ? '예외질환(확인필요)' : (cat === 'r' ? '확인필요' : '분류완료');
        checkLabel.appendChild(badge);
        row.appendChild(checkLabel);

        const nameBtn = document.createElement('button');
        nameBtn.type = 'button';
        nameBtn.className = 'q-item-name';
        nameBtn.textContent = h.진단명 || '(이름없음)';
        row.appendChild(nameBtn);

        wrap.appendChild(row);

        const detail = document.createElement('div');
        detail.className = 'q-item-detail';
        const detailFields = [
          ['진단명', h.진단명],
          ['진단코드', h.진단코드],
          ['최초진단일', h.최초진단일],
          ['최근진료일', h.최근진료일],
          ['입원일수', h.입원일수 !== null ? `${h.입원일수}일` : null],
          ['수술명', h.수술명],
          ['계속치료일수', h.계속치료일수 !== null ? `${h.계속치료일수}일` : null],
          ['계속투약일수', h.계속투약일수 !== null ? `${h.계속투약일수}일` : null],
          ['통원횟수', h.통원횟수 !== null ? `${h.통원횟수}회` : null],
          ['약물명(상시복용)', h.약물명],
          ['비고', h.비고],
        ];
        detailFields.forEach(([label, value]) => {
          if (!value) return;
          const line = document.createElement('div');
          line.className = 'q-item-detail-line';
          line.textContent = `- ${label}: ${value}`;
          detail.appendChild(line);
        });
        if (!detail.children.length) {
          const empty = document.createElement('div');
          empty.className = 'q-item-detail-line';
          empty.textContent = '추가 정보 없음';
          detail.appendChild(empty);
        }
        wrap.appendChild(detail);

        nameBtn.addEventListener('click', () => {
          detail.classList.toggle('open');
        });

        block.appendChild(wrap);
      });

      container.appendChild(block);
    });
  }

  // 체크된 항목만 모아 Q1~Q6 문항별로 읽기 좋은 텍스트 보고서를 만든다.
  function buildCopyText(result) {
    const lines = ['[표준알릴의무 자동분류 결과 - 초안, 최종 기재 전 직접 확인 필수]', ''];
    Q_DEFS.forEach(q => {
      lines.push(q.title);
      const checkedItems = [...result[q.id].included, ...result[q.id].review]
        .filter(h => !uncheckedKeys.has(`${q.id}::${h.id}`));

      if (checkedItems.length === 0) {
        lines.push('- 해당사항 없음');
      } else {
        checkedItems.forEach(h => {
          const detailParts = [];
          if (h.입원일수 !== null) detailParts.push(`입원 ${h.입원일수}일`);
          if (h.수술명) detailParts.push(`수술: ${h.수술명}`);
          if (h.통원횟수 !== null) detailParts.push(`통원 ${h.통원횟수}회`);
          if (h.계속투약일수 !== null) detailParts.push(`투약 ${h.계속투약일수}일`);
          if (h.약물명) detailParts.push(`약물: ${h.약물명}`);
          if (q.id === 'Q6' && isExceptionDisease(h.진단명)) detailParts.push('예외질환(확인필요)');
          const detail = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
          lines.push(`- ${h.진단명 || '(이름없음)'}${detail}`);
        });
      }
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  // navigator.clipboard가 막혀있거나(포커스/권한 등) 실패하는 환경을 위한 폴백.
  function copyTextFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
  }

  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const result = classifyHistories(histories, TODAY_ISO);
      const text = buildCopyText(result);

      const handleFailure = () => {
        if (copyTextFallback(text)) {
          showToast('결과가 복사되었습니다');
        } else {
          showToast('복사에 실패했습니다. 직접 선택해 복사해주세요');
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => showToast('결과가 복사되었습니다'))
          .catch(handleFailure);
      } else {
        handleFailure();
      }
    });
  }

  const addRowBtn = document.getElementById('add-row-btn');
  if (addRowBtn) {
    addRowBtn.addEventListener('click', () => {
      histories.push(emptyHistoryRow());
      renderAll();
    });
  }

  const parseBtn = document.getElementById('parse-btn');
  const historyInput = document.getElementById('history-input');
  if (!parseBtn || !historyInput) {
    console.error('필수 DOM 요소를 찾을 수 없습니다: parse-btn 또는 history-input');
  } else {
    parseBtn.addEventListener('click', async () => {
      const text = historyInput.value;
      const parsed = parseHistoryText(text);

      if (parsed.length > 0) {
        // 새로 변환한 결과로 교체한다 — 이전에 표로 변환했던 병력은 비운다.
        // (병력을 계속 추가하고 싶으면 "+ 병력 추가" 버튼을 쓴다.)
        histories = parsed;
        uncheckedKeys.clear();
        renderAll();
        return;
      }

      // 우리 포맷(🔴...)으로 바로 안 읽히면, 텍스트가 비어있지 않은 경우에만
      // Gemini에게 우리 포맷으로 변환을 맡긴다 (config.js에 키가 있을 때만).
      const hasApiKey = typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY;
      if (text.trim() && hasApiKey && typeof convertFreeTextWithGemini === 'function') {
        parseBtn.disabled = true;
        parseBtn.textContent = 'AI가 변환 중...';
        try {
          const converted = await convertFreeTextWithGemini(text, GEMINI_API_KEY);
          const aiParsed = parseHistoryText(converted);
          if (aiParsed.length > 0) {
            // 새로 변환한 결과로 교체한다 — 이전 결과는 비운다.
            histories = aiParsed;
            uncheckedKeys.clear();
            showToast('AI가 자유양식 병력을 우리 포맷으로 변환했습니다. 결과를 꼭 확인해주세요');
          } else {
            showToast('AI 변환 결과도 인식하지 못했습니다. 빈 행을 추가했습니다');
            histories.push(emptyHistoryRow());
          }
        } catch (e) {
          console.error('Gemini 변환 실패:', e);
          showToast('AI 변환에 실패했습니다. 빈 행을 추가했습니다');
          histories.push(emptyHistoryRow());
        } finally {
          parseBtn.disabled = false;
          parseBtn.textContent = 'AI로 고지 미리 확인하기';
        }
        renderAll();
        return;
      }

      showToast('인식된 병력이 없습니다. 빈 행을 추가했습니다');
      histories.push(emptyHistoryRow());
      renderAll();
    });
  }

  function emptyHistoryRow() {
    return {
      id: nextHistoryId++,
      진단명: '', 진단코드: '', 최초진단일: null, 최근진료일: null,
      입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
      계속치료일수: null, 계속투약일수: null, 통원횟수: null, 약물명: null, 재검사여부: false, 상시복용여부: false,
      현재상태: '', 비고: '', 원본: '',
    };
  }

  function showToast(message) {
    let toast = document.getElementById('al-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'al-toast';
      toast.className = 'toast';
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  renderAll();

  const resetAllBtn = document.getElementById('reset-all-btn');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
      if (!confirm('입력한 모든 병력과 분류결과를 초기화합니다. 계속할까요?')) return;
      histories = [];
      uncheckedKeys.clear();
      renderAll();
      showToast('전체 초기화되었습니다');
    });
  }
}
