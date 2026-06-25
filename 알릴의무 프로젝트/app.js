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
