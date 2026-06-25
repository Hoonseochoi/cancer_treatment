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
        (h.입원일수 !== null && h.입원일수 >= 7);
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
  }

  return result;
}

if (typeof module !== 'undefined') {
  module.exports.classifyHistories = classifyHistories;
}

if (typeof document !== 'undefined') {
  let histories = [];

  function renderAll() {
    // Task 6/7에서 병력표/결과 렌더링 함수가 여기서 호출된다.
  }

  document.getElementById('parse-btn').addEventListener('click', () => {
    const text = document.getElementById('history-input').value;
    const parsed = parseHistoryText(text);
    if (parsed.length === 0) {
      showToast('인식된 병력이 없습니다. 직접 행을 추가해주세요');
      histories.push(emptyHistoryRow());
    } else {
      histories = histories.concat(parsed);
    }
    renderAll();
  });

  function emptyHistoryRow() {
    return {
      진단명: '', 진단코드: '', 최초진단일: null, 최근진료일: null,
      입원여부: false, 입원일수: null, 수술여부: false, 수술명: null,
      계속치료일수: null, 계속투약일수: null, 재검사여부: false, 상시복용여부: false,
      현재상태: '', 비고: '', 원본: '',
    };
  }

  function showToast(message) {
    let toast = document.getElementById('al-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'al-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}
