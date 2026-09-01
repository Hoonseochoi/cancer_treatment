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
# 같은 것을 달리 부르는 이름이 들어 있는 열. 사람들이 쓰는 말(키트루다)에서
# 약관 용어(펨브롤리주맙)로 건너가는 다리가 된다.
COL_ALIAS = ('의약품명', '상품명', '제품명', '성분명', '영문', '약칭', '별칭', '이명')


def fm(text, key):
    m = re.search(r'^%s:\s*"?([^"\n]*)"?\s*$' % re.escape(key), text, re.M)
    return m.group(1).strip() if m else ''


def slug(path):
    """볼트 상대경로를 안정적인 id로. 파일명이 길고 특수문자가 많아 해시를 쓴다."""
    return hashlib.md5(path.encode('utf-8')).hexdigest()[:12]


def parse_tables(text):
    """마크다운 표에서 (대표명, 원문, 코드, 종, 별칭들)을 뽑는다.

    표 구성이 별표마다 다르다.
      4열  구분 | 수술 및 시술명 | 수술 시술 코드 | 종        (별표16)
      2열  분류항목 | 분류번호                              (KCD 목록)
      3열  작용기전 분류 | 성분명 | 의약품명                 (항암제 — 코드가 없다)

    코드 열이 없다고 건너뛰면 안 된다. 항암제 표에는 "펨브롤리주맙 | 키트루다주"처럼
    성분명과 상품명이 나란히 있어, 사람들이 실제로 부르는 이름(키트루다)으로 약관을
    찾아갈 수 있는 유일한 통로다. 실측: 이 표를 놓쳐 "키트루다"가 색인에 0건이었다.
    그래서 코드는 있으면 쓰고, 없으면 한글 셀들을 서로의 별칭으로 묶는다.
    """
    rows, head = [], None
    for line in text.split('\n'):
        if not line.lstrip().startswith('|'):
            head = None
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if all(re.fullmatch(r':?-{2,}:?', c) for c in cells if c):
            continue                                    # 구분선

        # 헤더 행인가
        idx = {'name': None, 'code': None, 'tier': None, 'alias': []}
        for i, c in enumerate(cells):
            if any(k in c for k in COL_NAME) and idx['name'] is None: idx['name'] = i
            elif any(k in c for k in COL_CODE) and idx['code'] is None: idx['code'] = i
            elif any(k in c for k in COL_TIER) and idx['tier'] is None: idx['tier'] = i
            elif any(k in c for k in COL_ALIAS): idx['alias'].append(i)
        if idx['name'] is not None:
            head = idx
            continue
        if head is None:
            continue

        raw = cells[head['name']] if head['name'] < len(cells) else ''
        # 이름 칸이 비어 있는 행이 흔하다 — 앞 열이 병합돼 첫 칸만 채우는 표가 많다.
        # 실측: 별표9의 "|  | 펨브롤리주맙 | 키트루다주 |"가 이래서 통째로 빠졌고,
        # 그 바람에 "키트루다"로는 약관에 닿을 길이 없었다.
        # 이름 칸이 비면 그 행에서 처음 나오는 한글 칸을 대표로 삼는다.
        used = head['name']
        if not raw.strip():
            for i, c in enumerate(cells):
                if i in (head['code'], head['tier']) or not c.strip():
                    continue
                if re.search(r'[가-힣]', c):
                    raw, used = c, i
                    break
        # 앞머리 번호("29. ", "자-195 ")는 검색에 방해만 되므로 뗀다
        clean = re.sub(r'^\s*(\d+\.|[가-힣]-\d+(-\d+)?)\s*', '', raw).strip()
        clean = re.sub(r'\s*[A-Za-z][A-Za-z\s-]{3,}$', '', clean).strip()   # 영문 성분명 꼬리
        if not clean or not re.search(r'[가-힣]', clean):
            continue

        code = ''
        if head['code'] is not None and head['code'] < len(cells):
            code = cells[head['code']].strip()
        tier = ''
        if head['tier'] is not None and head['tier'] < len(cells):
            t = cells[head['tier']].strip()
            if re.fullmatch(r'\d', t): tier = t

        # 별칭 열이 헤더로 표시돼 있지 않아도, 남는 한글 칸은 사실상 다른 이름이다.
        alias_idx = head['alias'] or [i for i in range(len(cells))
                                      if i not in (used, head['code'], head['tier'])]
        alias = []
        for i in alias_idx:
            if i != used and i < len(cells):
                a = re.sub(r'\([^)]*\)', '', cells[i]).strip()
                a = re.sub(r'\s*[A-Za-z][A-Za-z\s-]{3,}$', '', a).strip()   # 영문 성분명 꼬리 제거
                if a and re.search(r'[가-힣]', a) and a != clean:
                    alias.append(a)

        if not code and not alias:
            continue                                    # 코드도 별칭도 없으면 둘 게 없다
        rows.append((clean, raw.strip(), code, tier, alias))
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
            rows = parse_tables(text)
            for clean, raw, code, tier, alias in rows:
                row = {'t': clean, 'raw': raw, 'code': code, 'tier': tier, 'table': cid}
                if alias: row['alias'] = alias
                terms.append(row)
            head = re.split(r'\n\|', text, 1)[0]
            body = re.sub(r'^---.*?---\s*', '', head, flags=re.S).strip()
            if body:
                chunks.append({'id': cid + '-0', 'card': cid,
                               'sec': '분류표 개요', 'text': body[:2000]})
            # 표 자체도 청크로 남긴다. 예전에는 terms로만 뽑고 본문에서 뺐는데,
            # 그러면 모델이 read_clause로 등급표를 읽을 방법이 아예 없어진다.
            # 실측: "백내장은 몇 종?"에 모델이 분류표를 요청했지만 87자짜리 링크
            # 목록만 돌아와 "별표 내용을 확인할 수 없다"고 답했다.
            for n, i in enumerate(range(0, len(rows), 80), 1):
                part = rows[i:i + 80]
                lines = [f'{raw} | {code}' + (f' | {tier}종' if tier else '')
                         + (f' | {"/".join(alias)}' if alias else '')
                         for clean, raw, code, tier, alias in part]
                chunks.append({
                    'id': f'{cid}-t{n}', 'card': cid,
                    'sec': '분류표',
                    'text': f'[{title}] {i + 1}~{i + len(part)}행\n' + '\n'.join(lines)})
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
        if t.get('alias'): row['a'] = t['alias']
        t2.append(row)
    s2 = [{'i': ch['id'], 'c': ch['card'], 's': ch['sec']} for ch in chunks]

    # ── 담보 이름을 이루는 낱말 ──
    # 사람들은 "암통합치료비"라고 붙여 쓰는데 약관은 "암 통합치료비"라 띄어 쓴다.
    # 붙여 쓴 덩어리에서 낱말을 꺼내려면 무엇이 낱말인지 알아야 하는데, 그 목록을
    # 손으로 관리하면 담보가 늘 때마다 빠뜨린다. 담보명이 이미 공백으로 나뉘어
    # 있으므로 거기서 그대로 모은다.
    tok = collections.Counter()
    for c in cards:
        if c['kind'] != 'clause':
            continue
        name = re.sub(r'\[[^\]]*\]', ' ', c['title'])
        name = re.sub(r'^[0-9-]+', ' ', name)
        for w in re.split(r'[\s()·,~/]+', name):
            w = re.sub(r'^\d+', '', w).strip()
            if 2 <= len(w) <= 8 and re.fullmatch(r'[가-힣]+', w):
                tok[w] += 1
    # 한 담보에만 나오는 말은 덩어리에서 꺼낼 일이 드물고, 목록만 불린다.
    words = sorted(w for w, n in tok.items() if n >= 2)

    js = ('// 자동 생성 — scripts/build_clause_index.py\n'
          '// 약관 검색용 경량 인덱스(본문 제외). 본문은 Supabase clause_chunks에서 가져온다.\n'
          'const CLAUSE_INDEX = ' + json.dumps(
              {'cards': c2, 'terms': t2, 'refmap': refmap, 'secs': s2, 'words': words},
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
