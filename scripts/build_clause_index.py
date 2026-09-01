# -*- coding: utf-8 -*-
"""
약관 검색기(슈린슈 AI) 인덱스 빌더
─────────────────────────────────────────────────────────────
출처: 옵시디언 "내돈내삼약관" 볼트 (New내돈내삼 1640)

왜 이 구조인가 ─ 약관은 "특약 본문 → 별표 참조 → 코드/등급"의 2홉 구조다.
예를 들어 "혈전제거술을 받으면 어떤 수술비가 나오나"를 물으면, 수술비 특약
본문에는 '혈전제거'라는 말이 한 번도 나오지 않는다(실측: 혈전제거 언급 특약
25개 중 담보분류=수술비는 0개). 정답은 별표16의 B027(경피적 뇌혈관 수술,
혈전제거)이 6종이고, 그 별표를 참조하는 특약이 1~8종 수술비라는 경로에 있다.
그래서 본문 유사도만으로는 절대 닿지 않고, 참조 그래프를 따라가야 한다.

만들어 내는 것 (모두 검색용 — LLM 입력에는 들어가지 않는다):
  cards   특약/별표 한 장짜리 메타      — 무엇이 있는지
  refs    특약 ↔ 별표 참조 그래프       — 2홉 추적용
  terms   별표 표의 (항목명, 코드, 종)  — 시술·질환명으로 별표를 찍는 역인덱스
  chunks  ## 섹션 단위 본문             — 근거로 인용할 원문
"""
import os, re, io, json, glob, hashlib, collections

VAULT = "/Users/hoons/Documents/Obsidian Vault/내돈내삼약관"
OUT_DIR = "db"

# 표 헤더에 이 말이 있으면 그 열을 그렇게 읽는다.
COL_NAME = ('분류항목', '수술 및 시술명', '시술명', '항목', '질병명', '분류')
COL_CODE = ('분류번호', '수술 시술 코드', '코드', '번호')
COL_TIER = ('수술 시술 종류', '종류', '종')


def fm(text, key):
    m = re.search(r'^%s:\s*"?([^"\n]*)"?\s*$' % re.escape(key), text, re.M)
    return m.group(1).strip() if m else ''


def slug(path):
    """볼트 상대경로를 안정적인 id로. 파일명이 길고 특수문자가 많아 해시를 쓴다."""
    return hashlib.md5(path.encode('utf-8')).hexdigest()[:12]


def parse_tables(text):
    """마크다운 표에서 (항목명, 코드, 종)을 뽑는다.
    별표마다 열 구성이 달라(4열 별표16 / 2열 나머지) 헤더를 보고 위치를 정한다."""
    rows, ci = [], None
    for line in text.split('\n'):
        if not line.lstrip().startswith('|'):
            ci = None
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r':?-{2,}:?', c) for c in cells if c):
            continue                                    # 구분선
        head = {'name': None, 'code': None, 'tier': None}
        for i, c in enumerate(cells):
            if any(k in c for k in COL_NAME) and head['name'] is None: head['name'] = i
            if any(k in c for k in COL_CODE) and head['code'] is None: head['code'] = i
            if any(k in c for k in COL_TIER) and head['tier'] is None: head['tier'] = i
        if head['name'] is not None and head['code'] is not None:
            ci = head                                   # 헤더 행
            continue
        if ci is None:
            continue
        try:
            name = cells[ci['name']]
            code = cells[ci['code']]
        except IndexError:
            continue
        # 앞머리 번호("29. ", "자-195 ")는 검색에 방해만 되므로 떼되 원문도 남긴다
        clean = re.sub(r'^\s*(\d+\.|[가-힣]-\d+(-\d+)?)\s*', '', name).strip()
        if not clean or not code or not re.search(r'[가-힣]', clean):
            continue
        tier = ''
        if ci['tier'] is not None and ci['tier'] < len(cells):
            t = cells[ci['tier']].strip()
            if re.fullmatch(r'\d', t): tier = t
        rows.append((clean, name.strip(), code.strip(), tier))
    return rows


def main():
    files = sorted(glob.glob(os.path.join(VAULT, '**', '*.md'), recursive=True))
    cards, chunks, terms = [], [], []
    refs = collections.defaultdict(list)      # 별표ID → [card_id]
    by_table_name = {}                        # 별표 파일명 → card_id

    for f in files:
        text = io.open(f, encoding='utf-8').read()
        rel = os.path.relpath(f, VAULT).replace(os.sep, '/')
        base = os.path.splitext(os.path.basename(rel))[0]
        cid = slug(rel)
        title_m = re.search(r'^#\s+(.+)$', text, re.M)
        title = (title_m.group(1) if title_m else base).strip()
        kind = 'table' if rel.startswith('별표분류표/') else (
               'clause' if rel.startswith('특약/') else 'common')

        card = {
            'id': cid, 'kind': kind, 'path': rel, 'title': title,
            'no': fm(text, '특약번호') or fm(text, '별표ID'),
            'cls': fm(text, '담보분류'),
            'group': fm(text, '구분'),
            'renew': fm(text, '갱신형'),
            'page': fm(text, '원본페이지'),
        }
        cards.append(card)
        if kind == 'table':
            by_table_name[base] = cid

        # 참조 그래프 — [[별표-…]] 위키링크
        for link in set(re.findall(r'\[\[([^\]|#]+)', text)):
            link = link.strip()
            if link.startswith('별표'):
                refs[link].append(cid)

        # 본문 청크 — ## 섹션 단위. 별표는 표가 본체라 통째로 두면 너무 커서
        # 표 행은 terms로 따로 뽑고, 청크는 앞부분 설명만 남긴다.
        if kind == 'table':
            for clean, raw, code, tier in parse_tables(text):
                terms.append({'t': clean, 'raw': raw, 'code': code,
                              'tier': tier, 'table': cid})
            head = re.split(r'\n\|', text, 1)[0]
            body = re.sub(r'^---.*?---\s*', '', head, flags=re.S).strip()
            if body:
                chunks.append({'id': cid + '-0', 'card': cid,
                               'sec': '분류표 개요', 'text': body[:2000]})
        else:
            parts = re.split(r'^## ', text, flags=re.M)
            for i, p in enumerate(parts[1:], 1):
                nl = p.find('\n')
                sec = p[:nl].strip() if nl > 0 else p.strip()
                body = p[nl + 1:].strip() if nl > 0 else ''
                body = re.sub(r'\n{3,}', '\n\n', body)
                if not body:
                    continue
                chunks.append({'id': f'{cid}-{i}', 'card': cid,
                               'sec': sec, 'text': body})

    # 별표 이름 → card_id 로 참조 그래프를 정리
    refmap = {}
    for name, ids in refs.items():
        tid = by_table_name.get(name)
        if tid:
            refmap[tid] = sorted(set(ids))

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {'cards': cards, 'chunks': chunks, 'terms': terms, 'refmap': refmap}
    for k, v in out.items():
        p = os.path.join(OUT_DIR, f'clause_{k}.json')
        io.open(p, 'w', encoding='utf-8').write(
            json.dumps(v, ensure_ascii=False, separators=(',', ':')))
        print(f'  {k:8} {len(v):>6}건  {os.path.getsize(p)/1024:>7.0f} KB  {p}')

    print(f'\n특약 {sum(1 for c in cards if c["kind"]=="clause")} · '
          f'별표 {sum(1 for c in cards if c["kind"]=="table")} · '
          f'참조 {sum(len(v) for v in refmap.values())}개 링크')


if __name__ == '__main__':
    main()
