"""db/clause_chunks.json을 Supabase clause_chunks 테이블에 올린다.

psql이 없고 대시보드 SQL Editor에 6MB를 붙여 넣기도 어려워 REST로 보낸다.
service_role 키가 필요하다 — anon 키로는 쓰기가 막혀 있다(읽기만 공개).

    SUPABASE_SERVICE_KEY=... python3 scripts/load_chunks.py

키는 인자로 받지 않는다. 셸 기록에 남기지 않기 위해서다.
"""
import io, json, os, sys, time, urllib.request, urllib.error

PROJECT = 'omgwvnibssizmhovporl'
URL = f'https://{PROJECT}.supabase.co/rest/v1/clause_chunks'
BATCH = 200

key = os.environ.get('SUPABASE_SERVICE_KEY', '').strip()
if not key:
    sys.exit('SUPABASE_SERVICE_KEY 환경변수가 비어 있습니다.')

rows = json.load(io.open('db/clause_chunks.json', encoding='utf-8'))
print(f'{len(rows)}행을 {BATCH}개씩 올립니다.')


def call(method, url, body=None, prefer=None):
    req = urllib.request.Request(url, method=method)
    req.add_header('apikey', key)
    req.add_header('Authorization', f'Bearer {key}')
    req.add_header('Content-Type', 'application/json')
    if prefer:
        req.add_header('Prefer', prefer)
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=120) as r:
            return r.status
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} 실패 {e.code}: {e.read().decode()[:400]}')


# 기존 행을 지우고 새로 넣는다. id가 바뀐 청크가 남아 있으면 옛 내용이 검색된다.
call('DELETE', URL + '?id=neq.__none__')
print('  기존 행 삭제')

t0 = time.time()
for i in range(0, len(rows), BATCH):
    call('POST', URL, rows[i:i + BATCH], prefer='return=minimal')
    print(f'  {min(i + BATCH, len(rows))}/{len(rows)}', flush=True)
print(f'완료 — {time.time() - t0:.0f}초')
