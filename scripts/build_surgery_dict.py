# -*- coding: utf-8 -*-
"""KDRG 코드위키 → 수술비 백과사전 데이터 생성.

옵시디언 위키(별표16 + MDC)에서 아래 두 가지를 뽑아 js/surgery_dict_data.js 로 굽는다.
  tier : ADRG 코드 → [구분, 명칭, 종]           — 별표16 628개
  proc : ADRG 군(앞 3자리) → [[수가코드, 시술명]] — 분류규칙에 쓰이는 시술 테이블

주의: MDC의 시술 테이블은 ADRG 군의 마지막 하위 코드 아래에 한 번 나오고
군 전체가 공유한다. 그래서 하위 코드가 아니라 '군' 단위로 묶는다.
"""
import re, io, glob, json, os, collections

WIKI = "/Users/hoons/Documents/Obsidian Vault/KDRG코드위키"
OUT  = "js/surgery_dict_data.js"

# ── 1) 별표16: ADRG → 종 ──
tier = {}
for f in sorted(glob.glob(os.path.join(WIKI, "별표16_기준표/별표16_*.md"))):
    for m in re.finditer(
            r'^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([A-Z]\d{3})\s*\|\s*(\d)\s*\|',
            io.open(f, encoding='utf-8').read(), re.M):
        name = re.sub(r'^\d+\.\s*', '', m.group(2).strip())
        name = re.sub(r'\s+', ' ', name)
        tier[m.group(3)] = [m.group(1).strip(), name, int(m.group(4))]

# ── 2) MDC: ADRG 군 → 시술 테이블 ──
# 마취·항암제주입처럼 어느 군에나 붙는 공통 행은 검색을 흐리므로 뺀다.
NOISE = ('정맥마취', '기관내삽관', '마스크에', '항암제주입', '경막외마취', '척추마취')
group = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(WIKI, "MDC/*.md"))):
    cur = None
    for line in io.open(f, encoding='utf-8'):
        h = re.match(r'^#{3,4}\s+([A-Z]\d{2,4})\s', line)
        if h:
            cur = h.group(1)[:3]
            continue
        r = re.match(r'^\|\s*[^|]*\|\s*([A-Z]{1,2}\d{3,4})\s*\|\s*([^|]+?)\s*\|', line)
        if not (r and cur) or r.group(1) == '수가코드':
            continue
        nm = r.group(2).strip()
        nm = re.sub(r'\s*[바자마]\d[\w가-힣\-‡†()]*\s*$', '', nm)   # 꼬리 행위코드 제거
        nm = re.sub(r'\s*\d\)\s*관련코드.*$', '', nm)               # ACHI 주석 제거
        nm = re.sub(r'\s+', ' ', nm).strip()
        if not nm or nm.startswith(NOISE):
            continue
        group[cur].append([r.group(1), nm[:70]])

# 군마다 중복 제거 + 과도한 행 컷(검색 품질엔 상위 몇 개면 충분)
proc = {}
for k, v in group.items():
    seen, out = set(), []
    for code, nm in v:
        key = (code, nm)
        if key in seen:
            continue
        seen.add(key)
        out.append([code, nm])
    proc[k] = out[:24]

used = {c[:3] for c in tier}
proc = {k: v for k, v in proc.items() if k in used}

js = ("// 자동 생성 — scripts/build_surgery_dict.py\n"
      "// 출처: 옵시디언 KDRG코드위키 (별표16 + MDC, KDRG v4.6)\n"
      "// tier: ADRG → [구분, 명칭, 종] / proc: ADRG군 → [[수가코드, 시술명]]\n"
      "const SURGERY_DICT = {\n"
      f"  tier: {json.dumps(tier, ensure_ascii=False, separators=(',', ':'))},\n"
      f"  proc: {json.dumps(proc, ensure_ascii=False, separators=(',', ':'))}\n"
      "};\n")
io.open(OUT, 'w', encoding='utf-8').write(js)
print(f"tier {len(tier)}개 / proc {len(proc)}군 / 시술행 {sum(len(v) for v in proc.values())}")
print(f"{OUT}  {os.path.getsize(OUT)//1024}KB")
