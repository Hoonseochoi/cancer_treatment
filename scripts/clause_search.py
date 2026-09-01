# -*- coding: utf-8 -*-
"""
약관 검색 — LLM에 넘길 근거를 고르는 단계. 여기서는 LLM을 쓰지 않는다.
검색까지 모델에 맡기면 호출이 두 배가 되고, 무엇을 근거로 골랐는지도 흐려진다.

경로가 둘이다.
  A. 본문 직격   질문 낱말이 특약 제목/본문에 그대로 있는 경우
  B. 별표 2홉    질문 낱말이 별표의 시술·질환명에 있고, 그 별표를 참조하는 특약을 끌어온다
"혈전제거술 → 수술비"는 B로만 닿는다(수술비 특약 본문에 '혈전제거'가 없다).
"""
import io, json, os, re, collections

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db')
_d = lambda n: json.loads(io.open(os.path.join(DB, f'clause_{n}.json'), encoding='utf-8').read())

CARDS = {c['id']: c for c in _d('cards')}
TERMS = _d('terms')
REFMAP = _d('refmap')
CHUNKS = _d('chunks')

# 질문에 담보 종류가 드러나면 그쪽으로 좁힌다("수술비 담보 뭐 있어?" → cls=수술비)
CLS_HINT = [
    ('수술비', ['수술비', '수술 비']),
    ('치료비', ['치료비']),
    ('진단비', ['진단비', '진단금']),
    ('입원일당', ['입원일당', '입원 일당']),
    ('통원일당', ['통원일당']),
    ('간병인사용일당', ['간병인']),
    ('검사비', ['검사비']),
    ('지원금', ['지원금']),
]
STOP = set('그리고 어떤 어떤게 있어 있나요 알려줘 뭐야 무엇 뭔가 받을 수 있는 하면 했을 때 경우 담보 담보들 해당 관련 얼마 나와 나오나요 인가요 있습니까'.split())


def bigrams(s):
    s = re.sub(r'[\s()·,\-\[\]/]', '', s)
    return {s[i:i+2] for i in range(len(s)-1)} or ({s} if s else set())


def dice(a, b):
    if not a or not b: return 0.0
    return 2 * len(a & b) / (len(a) + len(b))


def keywords(q, drop=()):
    """조사·군더더기를 떼고 명사 덩어리만 남긴다(형태소 분석기 없이).

    drop에는 담보 종류를 나타내는 말이 들어온다. "수술비 담보 뭐 있어?"의
    '수술비'는 이미 분류 필터로 반영했는데, 검색어로도 남겨 두면 이름에
    '수술비'가 든 특약이 전부 만점을 받아 상위를 독식한다(실측: 정작 정답인
    질병 1~8종 수술비가 상해 수술비들에 밀려 사라졌다)."""
    q = re.sub(r'[?!.,]', ' ', q)
    out = []
    for w in q.split():
        w = re.sub(r'(을|를|이|가|은|는|도|만|에|의|로|으로|와|과|들|에서|한테|까지|부터)$', '', w)
        w = re.sub(r'(했을|하면|받으면|받을|나오는|되는)$', '', w)
        if len(w) >= 2 and w not in STOP and w not in drop:
            out.append(w)
    return out


def variants(k):
    """약관은 '혈전제거술'을 '경피적 뇌혈관 수술(혈전제거의 경우)'처럼 풀어 쓴다.
    끝의 술/수술/시술을 떼어 낸 어간까지 같이 넣어야 이런 표기에 닿는다."""
    v = {k}
    for suf in ('수술', '시술', '술'):
        if k.endswith(suf) and len(k) > len(suf) + 1:
            v.add(k[:-len(suf)])
    if len(k) >= 3 and k.endswith('암'):
        v.add(k[:-1])
    return v


def search(q, limit=8):
    cls = next((c for c, pats in CLS_HINT if any(p in q for p in pats)), None)
    drop = set(sum((p for c, p in CLS_HINT if c == cls), [])) if cls else set()
    kws = keywords(q, drop)
    # 어간 변형까지 펼쳐 두고, 매칭은 이 확장 목록으로 한다
    forms = sorted({v for k in kws for v in variants(k)}, key=len, reverse=True)
    kb = [(k, bigrams(k)) for k in forms]

    # ── B. 별표 매칭 → 시술/질환 항목을 찍는다 ──
    hit_terms, table_score = [], collections.Counter()
    for t in TERMS:
        tb = bigrams(t['t'])
        best = max((dice(kb_, tb) for _, kb_ in kb), default=0)
        exact = any(k in t['t'] or t['t'] in k for k, _ in kb)
        s = 1.0 if exact else best
        if s >= 0.62:
            hit_terms.append((s, t))
            table_score[t['table']] = max(table_score[t['table']], s)
    hit_terms.sort(key=lambda x: -x[0])

    # ── 그 별표를 참조하는 특약으로 한 홉 더 ──
    cand = collections.defaultdict(lambda: {'via': [], 'score': 0.0})
    for tid, ts in table_score.items():
        for cardid in REFMAP.get(tid, []):
            c = CARDS.get(cardid)
            if not c: continue
            e = cand[cardid]
            e['score'] = max(e['score'], ts * 0.9)
            e['via'].append(CARDS[tid]['title'])

    # ── A. 본문·제목 직격 ──
    for cid, c in CARDS.items():
        if c['kind'] != 'clause': continue
        tb = bigrams(c['title'])
        s = max((dice(kb_, tb) for _, kb_ in kb), default=0)
        if any(k in c['title'] for k, _ in kb): s = max(s, 0.85)
        if s >= 0.4:
            e = cand[cid]
            e['score'] = max(e['score'], s)
            e['via'].append('담보명')

    # ── 담보 종류 필터 ──
    rows = []
    for cid, e in cand.items():
        c = CARDS[cid]
        if cls and c.get('cls') != cls:
            continue
        rows.append({'card': c, 'score': round(e['score'], 3),
                     'via': sorted(set(e['via']))[:3]})
    rows.sort(key=lambda r: (-r['score'], r['card']['no']))
    return {'cls': cls, 'kws': kws,
            'terms': [{'t': t['raw'], 'code': t['code'], 'tier': t['tier'],
                       'table': CARDS[t['table']]['title'], 's': round(s, 2)}
                      for s, t in hit_terms[:10]],
            'cards': rows[:limit]}


if __name__ == '__main__':
    import sys
    q = sys.argv[1] if len(sys.argv) > 1 else '혈전제거술을 했을때 받을수있는 수술비 담보들은 어떤게있어?'
    r = search(q)
    print(f'질문: {q}')
    print(f'낱말: {r["kws"]}   담보종류 필터: {r["cls"] or "(없음)"}\n')
    print('── 별표에서 찾은 항목 ──')
    for t in r['terms']:
        print(f'  {t["s"]:.2f}  {t["code"]:6} {t["tier"] or "-"}종  {t["t"][:44]:<46} ({t["table"]})')
    print('\n── 관련 담보 ──')
    for c in r['cards']:
        cd = c['card']
        print(f'  {c["score"]:.2f}  [{cd["no"]:>7}] {cd["cls"] or "-":<6} {cd["title"][:46]}')
        print(f'         ↳ {", ".join(c["via"])}')
