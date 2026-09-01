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
  catalog 담보 한눈에 보기 목록          — 모델이 직접 읽고 무엇을 볼지 고르는 지도

catalog를 따로 두는 이유 ─ 검색 규칙을 아무리 손봐도 질문 유형마다 예외가 생긴다.
규칙으로 답을 정하는 대신 모델에게 "약관에 무엇이 있는지"를 통째로 보여 주고 직접
고르게 하는 편이 낫다. 220개 계열 5천 자면 시스템 프롬프트에 상주시킬 만하고,
고정 접두사라 프롬프트 캐시도 걸린다. 규칙 검색은 판단자가 아니라 힌트 제공자로 남는다.
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

    # ── 모델용 담보 카탈로그 ──
    # 주제(암/뇌심/상해/…) → 담보분류 → 계열 순으로 접는다. 괄호 설명과 변형
    # (갱신형·추가가입용)은 지운다 — 343개를 220개로 줄여야 프롬프트에 들어간다.
    TOPIC = [
        ('암', r'암|종양|신생물|항암|백혈병|림프종'),
        ('뇌심', r'뇌|심장|심근|순환계|혈관|졸중|부정맥|허혈|혈전'),
        ('상해', r'상해|골절|화상|외상|재해|교통'),
        ('여성소아', r'여성|유방|자궁|난소|임신|출산|분만|산모|신생아|소아|어린이'),
        ('남성', r'전립선|남성'),
        ('근골격', r'관절|척추|디스크|추간판|근골격'),
        ('안이비', r'백내장|망막|녹내장|안과|중이|비염|부비동'),
        ('소화기', r'위|대장|간|담|췌장|용종|소화'),
        ('신장', r'신장|투석|요로|방광'),
    ]

    def topic_of(t):
        for name, pat in TOPIC:
            if re.search(pat, t):
                return name
        return '기타'

    def short(t):
        t = re.sub(r'\[[^\]]*\]', '', t)
        t = re.sub(r'^[0-9-]+\s*', '', t)
        t = re.sub(r'\((추가가입용|갱신형)\)', '', t)
        t = re.sub(r'\([^)]*\)', '', t)
        return re.sub(r'\s+', ' ', t).strip()

    def numkey(no):
        return [int(x) if x.isdigit() else 999 for x in str(no or '9').split('-')]

    fam = collections.OrderedDict()
    for c in sorted((c for c in cards if c['kind'] == 'clause'),
                    key=lambda c: numkey(c['no'])):
        nm = short(c['title'])
        fam.setdefault((topic_of(nm), c['cls'] or '기타', nm), []).append(c['no'])

    lines, cur = [], None
    for (tp, cls, nm), nos in sorted(fam.items(),
                                     key=lambda x: (x[0][0], x[0][1], numkey(x[1][0]))):
        head = f'{tp}/{cls}'
        if head != cur:
            lines.append(f'#{head}')
            cur = head
        lines.append(f'{nos[0]} {nm}' + (f'+{len(nos)-1}' if len(nos) > 1 else ''))
    catalog = '\n'.join(lines)
    cp = os.path.join(OUT_DIR, 'clause_catalog.txt')
    io.open(cp, 'w', encoding='utf-8').write(catalog)
    print(f'  {"catalog":8} {len(fam):>6}계열 {os.path.getsize(cp)/1024:>7.0f} KB  {cp}'
          f'  (~{len(catalog)/1.7:.0f} 토큰)')

    # ── 시스템 프롬프트에 카탈로그 끼워 넣기 ──
    # Edge Function은 이 파일을 사이트(surinsur.com/prompts/…)에서 읽어 간다.
    # 함수에 넣으면 문구 한 줄 고칠 때마다 재배포해야 하고, Secret에 넣으면
    # 대시보드에 6천 자를 붙여 넣어야 하는 데다 git으로도 관리되지 않는다.
    guide_path = os.path.join('prompts', 'clause_system.md')
    if os.path.exists(guide_path):
        guide = io.open(guide_path, encoding='utf-8').read()
        head = guide.split('## 담보 카탈로그')[0]
        full = head + '## 담보 카탈로그\n\n' + \
            '`주제/담보분류` 아래에 `특약번호 담보명` 형식입니다. `+n`은 갱신형·추가가입용 등\n' + \
            '같은 계열 변형이 n개 더 있다는 뜻입니다.\n\n' + catalog + '\n'
        io.open(guide_path, 'w', encoding='utf-8').write(full)

        print(f'  {"prompt":8} {len(full):>6}자   prompts/clause_system.md (사이트에서 함수가 읽어 간다)')

    # ── 브라우저용 경량 인덱스 ──
    # 본문(chunks.text)은 빼고 검색에 필요한 것만 싣는다. 본문은 Supabase에서
    # 고른 것만 가져온다 — 5MB를 전부 내려받게 할 이유가 없다.
    # secs(어느 담보에 어느 섹션이 있는지)는 넣는다. "면책 알려줘" 같은 질문은
    # 담보를 찾는 게 아니라 그 담보의 특정 섹션을 읽는 일이라, 이 목록이 있어야
    # 무엇을 가져올지 정할 수 있다.
    c2 = [{'i': c['id'], 'k': c['kind'][0], 'n': c['no'], 'c': c['cls'],
           't': c['title'], 'p': c['page']} for c in cards]
    t2 = []
    for t in terms:
        row = {'t': t['t'], 'c': t['code'], 'b': t['table']}
        if t['tier']: row['g'] = t['tier']
        if t['raw'] != t['t']: row['r'] = t['raw']
        t2.append(row)
    s2 = [{'i': ch['id'], 'c': ch['card'], 's': ch['sec']} for ch in chunks]

    js = ('// 자동 생성 — scripts/build_clause_index.py\n'
          '// 약관 검색용 경량 인덱스(본문 제외). 본문은 Supabase clause_chunks에서 가져온다.\n'
          'const CLAUSE_INDEX = ' + json.dumps(
              {'cards': c2, 'terms': t2, 'refmap': refmap, 'secs': s2},
              ensure_ascii=False, separators=(',', ':')) + ';\n')
    jp = os.path.join('js', 'clause_index_data.js')
    io.open(jp, 'w', encoding='utf-8').write(js)
    print(f'  {"front":8} {len(c2)+len(t2)+len(s2):>6}건  '
          f'{os.path.getsize(jp)/1024:>7.0f} KB  {jp}')

    print(f'\n특약 {sum(1 for c in cards if c["kind"]=="clause")} · '
          f'별표 {sum(1 for c in cards if c["kind"]=="table")} · '
          f'참조 {sum(len(v) for v in refmap.values())}개 링크')


if __name__ == '__main__':
    main()


def emit_seed_sql():
    """clause_chunks 적재용 SQL. 본문이 5MB라 파일로 떨어뜨려 psql/대시보드로 넣는다."""
    cards = {c['id']: c for c in json.loads(
        io.open(os.path.join(OUT_DIR, 'clause_cards.json'), encoding='utf-8').read())}
    chunks = json.loads(io.open(
        os.path.join(OUT_DIR, 'clause_chunks.json'), encoding='utf-8').read())

    # 모델이 고르는 이름과 저장된 섹션명을 맞춰 둔다(프롬프트에 쓰는 짧은 이름).
    SEC_ALIAS = {
        '담보정의': '담보정의',
        '보상범위 (지급사유·세부규정)': '보상범위',
        '면책·감액 핵심 (자동 추출)': '면책',
        '보상하지 않는 범위': '면책',
        '소멸·한도 등': '한도',
        '관련 분류표': '분류표',
        '분류표 개요': '분류표',
    }
    q = lambda v: "'" + str(v).replace("'", "''") + "'"
    out = ["-- 자동 생성 — scripts/build_clause_index.py",
           "begin;", "truncate clause_chunks;"]
    for ch in chunks:
        c = cards[ch['card']]
        out.append(
            "insert into clause_chunks (id,card_id,no,title,section,cls,content) values (" +
            ",".join([q(ch['id']), q(ch['card']), q(c['no']), q(c['title']),
                      q(SEC_ALIAS.get(ch['sec'], ch['sec'])), q(c['cls']),
                      q(ch['text'])]) + ");")
    out.append("commit;")
    p = os.path.join(OUT_DIR, 'clause_chunks.sql')
    io.open(p, 'w', encoding='utf-8').write("\n".join(out))
    print(f'  {"seed sql":8} {len(chunks):>6}행  {os.path.getsize(p)/1024/1024:>6.1f} MB  {p}')


if __name__ == '__main__':
    emit_seed_sql()
