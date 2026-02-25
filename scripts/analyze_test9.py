#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test9.pdf 텍스트 추출 및 extractRawCoverages 로직 시뮬레이션
- "암통합치료비" / "통합치료비" 관련 내용 분석
- 제외 원인 분석
"""

import re
import os
import sys
import io

# Windows 콘솔 UTF-8 출력
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# PDF 경로 (프로젝트 루트 기준)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
PDF_PATHS = [
    os.path.join(PROJECT_ROOT, "test", "test9.pdf"),
    os.path.join(os.path.dirname(PROJECT_ROOT), "test", "test9.pdf"),
    "test9.pdf",
]


def extract_pdf_text(pdf_path):
    """PDF에서 텍스트 추출 (PyMuPDF 또는 pdfplumber 사용)"""
    text = ""
    for path in [pdf_path] + PDF_PATHS:
        if os.path.exists(path):
            pdf_path = path
            break
    else:
        return None, f"PDF 파일을 찾을 수 없습니다. 검색 경로: {PDF_PATHS}"

    try:
        import fitz  # PyMuPDF
        doc = fitz.open(pdf_path)
        # 가입담보리스트는 보통 3~6페이지 (1-based -> 0-based: 2~5)
        start_page = min(2, len(doc) - 1)
        end_page = min(5, len(doc) - 1)
        for i in range(start_page, end_page + 1):
            page = doc[i]
            text += page.get_text() + "\n"
        doc.close()
        return text, None
    except ImportError:
        pass

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            start_page = min(2, len(pdf.pages) - 1)
            end_page = min(5, len(pdf.pages) - 1)
            for i in range(start_page, end_page + 1):
                page = pdf.pages[i]
                text += (page.extract_text() or "") + "\n"
        return text, None
    except ImportError:
        pass

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(pdf_path)
        start_page = min(2, len(reader.pages) - 1)
        end_page = min(5, len(reader.pages) - 1)
        for i in range(start_page, end_page + 1):
            text += reader.pages[i].extract_text() + "\n"
        return text, None
    except ImportError:
        pass

    return None, "PDF 라이브러리가 없습니다. pip install pymupdf 또는 pip install pdfplumber"


# ── extractRawCoverages 로직 (analyzer.js 포팅) ──
def extract_raw_coverages(text, verbose=True):
    if not text or not isinstance(text, str):
        return [], "Invalid text input"

    lines = text.split("\n")
    target_lines = lines
    start_index = -1
    end_index = -1

    # 1. 범위 필터링
    start_keywords = ["가입담보리스트", "가입담보", "담보사항"]
    end_keywords = ["주의사항", "유의사항", "알아두실"]

    for i, line in enumerate(lines):
        line_clean = re.sub(r"\s+", "", line)
        if start_index == -1:
            if len(line_clean) < 40 and any(k in line_clean for k in start_keywords):
                start_index = i
                if verbose:
                    print(f"[시작] 라인 {i}: {lines[i][:60]}...")
        elif end_index == -1:
            if len(line_clean) < 40 and any(k in line_clean for k in end_keywords):
                end_index = i
                if verbose:
                    print(f"[종료] 라인 {i}: {lines[i][:60]}...")
                break

    if start_index != -1:
        end_index = end_index if end_index != -1 else len(lines)
        target_lines = lines[start_index:end_index]
        if verbose:
            print(f"범위 필터: {start_index} ~ {end_index} ({len(target_lines)}줄)")
        if len(target_lines) < 10:
            if verbose:
                print("범위가 너무 작음. 전체 문서 스캔으로 전환.")
            target_lines = lines
            start_index = -1
    else:
        if verbose:
            print("시작 키워드 미발견. 전체 문서 스캔.")

    # 1.5 줄 이어붙이기
    amount_regex = re.compile(
        r"[0-9,]+(?:억|천|백|십)*(?:만원|억원|만|억)|세부보장참조"
    )
    merged_lines = []
    pending_line = ""

    for i, line in enumerate(target_lines):
        trimmed = line.strip()
        if not trimmed:
            if pending_line:
                merged_lines.append(pending_line)
                pending_line = ""
            merged_lines.append("")
            continue

        has_amount = bool(amount_regex.search(trimmed))
        if pending_line:
            pending_line += " " + trimmed
            if has_amount or amount_regex.search(pending_line):
                merged_lines.append(pending_line)
                pending_line = ""
        else:
            if has_amount:
                merged_lines.append(trimmed)
            else:
                if len(trimmed) < 5 or re.match(r"^\d+$", trimmed):
                    merged_lines.append(trimmed)
                else:
                    pending_line = trimmed

    if pending_line:
        merged_lines.append(pending_line)
    target_lines = merged_lines

    # 2. 추출 로직
    blacklist = [
        "해당 상품은", "경우", "따라", "법에", "지급하여", "포함되어", "보호법",
        "해약환급금", "예시표", "적용이율", "최저보증", "평균공시",
        "가입금액인", "00만원", "00원", "합계", "점검",
        "참고", "확인하시기", "바랍니다", "입니다", "됩니다",
        "최초계약", "경과시점", "감액적용", "면책",
        "법률상", "부담하여", "손해를", "배상책임을",
        "이전 진단", "이전 수술", "이전 치료",
        "같은 질병", "같은 종류", "반은 경",
        "※", "보장개시", "납입면제",
        "남성", "여성", "만기", "가입금액",
    ]

    results = []
    amount_pattern = re.compile(
        r"([0-9,]+(?:억|천|백|십)*(?:만원|억원|만|억))"
    )
    amount_pattern_alt = re.compile(r"([0-9,]+(?:천|백|십)?원)")

    for idx, line in enumerate(target_lines):
        original_idx = (start_index if start_index != -1 else 0) + idx
        trimmed = line.strip()
        if not trimmed:
            continue

        # A. 블랙리스트
        if any(word in trimmed for word in blacklist):
            if verbose and ("통합" in trimmed or "암" in trimmed):
                print(f"[블랙리스트 제외] {trimmed[:80]}...")
            continue

        # 세부보장으로 시작
        if trimmed.startswith("세부보장"):
            if verbose and "통합" in trimmed:
                print(f"[세부보장 제외] {trimmed[:80]}...")
            continue

        # B. 금액 패턴
        match = amount_pattern.search(trimmed)
        if not match:
            match = amount_pattern_alt.search(trimmed)
        is_ref_amount = False
        if not match and "세부보장참조" in trimmed:
            ref_match = re.search(r"세부보장참조", trimmed)
            if ref_match:
                amount_str = "세부보장참조"
                match_start = ref_match.start()
                match_len = len("세부보장참조")
                is_ref_amount = True
                match = ref_match

        if match:
            if not is_ref_amount:
                amount_str = match.group(1)
                match_start = match.start()
                match_len = match.end() - match.start()

            name_part = trimmed[:match_start].strip()

            # 0. 날짜 패턴 제거
            name_part = re.sub(r"^[\d]+(년|세|월)\s*[/]?\s*[\d]*(년|세|월)?\s*", "", name_part).strip()
            name_part = re.sub(r"^[\d]+\s+", "", name_part).strip()

            # 1. 카테고리 헤더 제거
            category_keywords = ["기본계약", "3대진단", "치료비", "수술비", "입원비", "배상책임", "후유장해", "기타", "2대진단", "질병", "상해", "운전자"]
            for key in category_keywords:
                name_part = re.sub(r"^" + key + r"(?=[\s\d])", "", name_part).strip()

            # 2. 순번/코드 제거
            name_part = re.sub(r"^[\d]+\s+", "", name_part)
            name_part = re.sub(r"^[ㄴ\-•·\s]+", "", name_part)
            name_part = re.sub(r"^[\d]+\s+", "", name_part)
            name_part = re.sub(r"[.\s]+$", "", name_part)
            name_part = name_part.replace("세부보장참조", "").strip()
            name_part = re.sub(r"^\([^)]*\)", "", name_part).strip()
            name_part = re.sub(r"([가-힣])\d+$", r"\1", name_part).strip()

            # D. 담보명 유효성
            if 1 < len(name_part) < 120:
                last_char = name_part[-1]
                if last_char not in ["다", "요", "음", "함", "는", "은"]:
                    results.append({
                        "id": original_idx,
                        "name": name_part,
                        "amount": amount_str,
                        "original": trimmed,
                    })
                elif verbose and ("통합" in name_part or "암" in name_part):
                    print(f"[문장어미 제외] {name_part} (끝: '{last_char}')")
            elif verbose and ("통합" in name_part or "암" in name_part):
                print(f"[길이 제외] {name_part} (길이: {len(name_part)})")

    return results


def main():
    print("=" * 70)
    print("test9.pdf 분석: 암통합치료비/통합치료비 관련 내용")
    print("=" * 70)

    # PDF 경로 찾기
    pdf_path = None
    for p in PDF_PATHS:
        if os.path.exists(p):
            pdf_path = p
            break
    if not pdf_path:
        # 현재 디렉토리에서 test9.pdf 검색
        for root, dirs, files in os.walk(PROJECT_ROOT):
            for f in files:
                if f == "test9.pdf":
                    pdf_path = os.path.join(root, f)
                    break
            if pdf_path:
                break

    if not pdf_path:
        print("\n[오류] test9.pdf를 찾을 수 없습니다.")
        print("다음 위치에 파일을 배치하세요:")
        for p in PDF_PATHS:
            print(f"  - {p}")
        sys.exit(1)

    print(f"\n[1] PDF 경로: {pdf_path}")

    # 텍스트 추출
    text, err = extract_pdf_text(pdf_path)
    if err:
        print(f"\n[오류] {err}")
        sys.exit(1)

    print(f"\n[2] 추출된 텍스트 길이: {len(text)}자")

    # 통합치료비 관련 원문 검색
    print("\n" + "=" * 70)
    print("[3] 원문에서 '암통합치료비' / '통합치료비' 검색")
    print("=" * 70)
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if "통합치료비" in line or "암 통합" in line or "암통합" in line:
            print(f"\n라인 {i}: {line[:120]}{'...' if len(line) > 120 else ''}")

    # extractRawCoverages 시뮬레이션
    print("\n" + "=" * 70)
    print("[4] extractRawCoverages 시뮬레이션")
    print("=" * 70)
    results = extract_raw_coverages(text, verbose=True)

    # 통합치료비 관련 추출 결과
    print("\n" + "=" * 70)
    print("[5] 추출된 항목 중 '암통합치료비' / '통합치료비' 관련")
    print("=" * 70)
    related = [r for r in results if "통합" in r["name"] or "암" in r["name"]]
    if related:
        for r in related:
            print(f"  - {r['name']} | 금액: {r['amount']}")
    else:
        print("  (없음)")

    # 전체 추출 결과 요약
    print("\n" + "=" * 70)
    print(f"[6] 전체 추출 결과: {len(results)}건")
    print("=" * 70)
    for r in results[:20]:
        print(f"  - {r['name'][:50]} | {r['amount']}")
    if len(results) > 20:
        print(f"  ... 외 {len(results) - 20}건")

    # findDetails 매칭 시뮬레이션 (coverageDetailsMap)
    print("\n" + "=" * 70)
    print("[7] coverageDetailsMap 매칭 시뮬레이션 (암통합치료비 관련)")
    print("=" * 70)
    related_items = [r for r in results if "통합" in r["name"] and "암" in r["name"]]
    for r in related_items:
        name = r["name"]
        matched = False
        if "암 통합치료비" in name and ("III" in name or "Ⅲ" in name):
            matched = True
            map_key = "암진단및치료비(암 통합치료비III)"
        elif "암 통합치료비" in name and ("Ⅱ" in name or "II" in name) and "비급여" in name:
            matched = True
            map_key = "암 통합치료비Ⅱ(비급여)"
        elif "암 통합치료비" in name and "주요치료" in name:
            matched = True
            map_key = "암 통합치료비(주요치료)(비급여...)"
        elif "암 통합치료비" in name and "비급여" in name and "전액본인부담" in name:
            matched = True
            map_key = "암 통합치료비(비급여(전액본인부담 포함)...)"
        elif "암 통합치료비" in name and "기본형" in name:
            matched = True
            map_key = "암 통합치료비(기본형)(암중점치료기관...)"
        elif "암 통합치료비" in name and "실속형" in name:
            matched = True
            map_key = "암 통합치료비(실속형)(암중점치료기관...)"
        status = "✓ 매칭됨" if matched else "✗ 매칭 안됨 (fallback 없음)"
        print(f"  {name[:55]}... | {status}")

    # 제외 원인 분석
    print("\n" + "=" * 70)
    print("[8] 제외 가능 원인 분석")
    print("=" * 70)
    print("""
extractRawCoverages에서 '암통합치료비'가 제외될 수 있는 경우:

1. 범위 필터: "가입담보리스트" ~ "주의사항" 이외 구간에 있으면 제외
2. 블랙리스트: "해당 상품은", "경우", "입니다" 등 포함 시 제외
3. 세부보장: "세부보장"으로 시작하는 줄 제외
4. 금액 패턴: 담보명 + 금액(만원/억원) 형식이 아니면 제외
   - 금액이 다음 줄에 있으면 줄 이어붙이기로 처리되나, 50자 미만만 병합
5. 담보명 유효성:
   - 1글자 이상 120글자 미만
   - 문장형 어미("다","요","음","함","는","은")로 끝나면 제외
6. 카테고리 제거: "치료비"가 단독으로 앞에 오면 제거됨
   - "치료비 암 통합치료비..." → "암 통합치료비..." (정상)
7. PDF 텍스트 레이어: 줄이 분리되어 "암 통합"과 "치료비"가 다른 줄에 있으면
   - 금액이 없는 줄은 pending으로 대기 → 다음 줄과 병합
   - "통합치료비"만 단독으로 있으면 금액 패턴 없어서 제외될 수 있음

coverageDetailsMap 매칭 실패 시 (calculateHierarchicalSummary):
- findDetails에서 키워드(II, III, 기본형, 실속형, 비급여 등)가 없으면
  details=null → 해당 항목이 "한눈에보기" 요약에 반영되지 않음
""")


if __name__ == "__main__":
    main()
