# -*- coding: utf-8 -*-
"""
약관 본문(clause_chunks)을 Supabase에 올린다.

5MB짜리 본문이라 SQL 편집기에 붙여 넣기 어려워 REST로 나눠 올린다.
service_role 키가 필요하다 — 이 키는 RLS를 통과하므로 저장소에 두지 말고
실행할 때 환경변수로 넘긴다.

  SUPABASE_SERVICE_KEY='...' python3 scripts/upload_clause_chunks.py

약관이 개정되면 build_clause_index.py를 먼저 돌린 뒤 이 스크립트를 다시 실행한다.
"""
import io, os, sys, json, time, urllib.request

URL = os.environ.get('SUPABASE_URL', 'https://omgwvnibssizmhovporl.supabase.co')
KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
BATCH = 120

# 모델이 고르는 짧은 이름과 저장된 섹션명을 맞춰 둔다.
SEC_ALIAS = {
    '담보정의': '담보정의',
    '보상범위 (지급사유·세부규정)': '보상범위',
    '면책·감액 핵심 (자동 추출)': '면책',
    '보상하지 않는 범위': '면책',
    '소멸·한도 등': '한도',
    '관련 분류표': '분류표',
    '분류표 개요': '분류표',
}


def req(method, path, body=None, prefer=None):
    r = urllib.request.Request(URL + path, method=method,
                               data=json.dumps(body).encode() if body is not None else None)
    r.add_header('apikey', KEY)
    r.add_header('Authorization', 'Bearer ' + KEY)
    r.add_header('Content-Type', 'application/json')
    if prefer:
        r.add_header('Prefer', prefer)
    with urllib.request.urlopen(r, timeout=90) as res:
        return res.status, res.read().decode()


def main():
    if not KEY:
        sys.exit('SUPABASE_SERVICE_KEY 환경변수가 필요합니다.\n'
                 '  Supabase 대시보드 → Project Settings → API → service_role 키')

    cards = {c['id']: c for c in json.loads(
        io.open('db/clause_cards.json', encoding='utf-8').read())}
    chunks = json.loads(io.open('db/clause_chunks.json', encoding='utf-8').read())

    rows = []
    for ch in chunks:
        c = cards[ch['card']]
        rows.append({
            'id': ch['id'], 'card_id': ch['card'], 'no': c['no'] or None,
            'title': c['title'], 'section': SEC_ALIAS.get(ch['sec'], ch['sec']),
            'cls': c['cls'] or None, 'content': ch['text'],
        })

    print(f'{len(rows)}행을 {BATCH}개씩 올립니다…')
    req('DELETE', '/rest/v1/clause_chunks?id=neq.__none__')

    sent = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        for attempt in range(3):
            try:
                st, _ = req('POST', '/rest/v1/clause_chunks', batch,
                            prefer='resolution=merge-duplicates')
                if st < 300:
                    break
            except Exception as e:
                if attempt == 2:
                    sys.exit(f'\n{i}행 근처에서 실패: {e}')
                time.sleep(1.5 * (attempt + 1))
        sent += len(batch)
        print(f'\r  {sent}/{len(rows)}', end='', flush=True)

    st, body = req('GET', '/rest/v1/clause_chunks?select=id', prefer='count=exact')
    print(f'\n완료. 적재 확인: {len(json.loads(body))}행')


if __name__ == '__main__':
    main()
