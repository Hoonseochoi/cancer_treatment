# -*- coding: utf-8 -*-
import re

# REPLICATING NEW LOGIC FROM SCRIPT.JS
def extract_raw_coverages(text):
    lines = text.split('\n')
    start_keywords = ["가입담보리스트", "가입담보", "담보사항"]
    end_keywords = ["주의사항", "유의사항", "알아두실"]
    
    start_index = -1
    end_index = -1
    
    for i, line in enumerate(lines):
        clean = re.sub(r'\s+', '', line)
        if start_index == -1:
            if len(clean) < 40 and any(k in clean for k in start_keywords):
                start_index = i
        elif end_index == -1:
            if len(clean) < 40 and any(k in clean for k in end_keywords):
                end_index = i
                break
                
    if start_index != -1:
        if end_index == -1: end_index = len(lines)
        target_lines = lines[start_index:end_index]
    else:
        target_lines = lines
    
    # Line merging (UPDATED JS lines 159-202)
    amount_regex = re.compile(r'[0-9,]+\s*(?:\uc5b5|\ucc9c|\ubc31|\uc2ed)*\s*(?:\ub9cc\uc6d0|\uc5b5\uc6d0)|\uc138\ubd80\ubcf4\uc7a5\ucc38\uc870')
    merged_lines = []
    pending_line = ''
    
    for line in target_lines:
        trimmed = line.strip()
        if not trimmed:
            if pending_line: merged_lines.append(pending_line); pending_line = ''
            merged_lines.append('')
            continue
            
        has_amount = bool(amount_regex.search(trimmed))
        
        if pending_line:
            pending_line += ' ' + trimmed
            if has_amount or bool(amount_regex.search(pending_line)):
                merged_lines.append(pending_line)
                pending_line = ''
        else:
            if has_amount:
                merged_lines.append(trimmed)
            else:
                if len(trimmed) < 5 or trimmed.isdigit():
                    # FIX: Push pending first
                    if pending_line:
                        merged_lines.append(pending_line)
                        pending_line = ''
                    merged_lines.append(trimmed)
                else:
                    pending_line = trimmed
    if pending_line: merged_lines.append(pending_line)
    
    # Results extraction
    results = []
    
    for idx, line in enumerate(merged_lines):
        trimmed = line.strip()
        if not trimmed: continue
        
        match = amount_regex.search(trimmed)
        if match:
            amount_str = match.group(0)
            name_part = trimmed[:match.start()].strip()
            
            # Cleaning (UPDATED JS 259-300)
            name_part = re.sub(r'^[\d\s]+(년|세|월)\s*[\/]?\s*[\d]*(년|세|월)?\s*', '', name_part).strip()
            name_part = re.sub(r'^(갱신형|갱신)\s+', '', name_part).strip()
            name_part = re.sub(r'^[\d]+\s+', '', name_part).strip()
            
            # ... (rest of cleaning)
            name_part = re.sub(r'^[ㄴ\-•·\s]+', '', name_part)
            name_part = re.sub(r'[.\s]+$', '', name_part)
            name_part = name_part.replace('\uc138\ubd80\ubcf4\uc7a5\ucc38\uc870', '').strip()
            name_part = re.sub(r'^\([^)]*\)', '', name_part).strip()
            name_part = re.sub(r'([가-힣])\d+$', r'\1', name_part).strip()
            
            results.append({'name': name_part, 'amount': amount_str})
                    
    return results

text = open('test3_debug.txt', 'r', encoding='utf-8').read()
results = extract_raw_coverages(text)

print("\n--- EXTRACTED ITEMS containing '통합치료비' ---")
for r in results:
    if '통합치료비' in r['name']:
        print(f"Result: Name=[{r['name']}] Amount=[{r['amount']}]")
        
        # Matching Logic test
        name = r['name']
        isIntegrated = "통합치료비" in name
        hasNum2 = "Ⅱ" in name or "II" in name or "②" in name or re.search(r'[^I]II[^I]', ' ' + name + ' ')
        hasNum3 = "Ⅲ" in name or "III" in name or "③" in name or re.search(r'[^I]III[^I]', ' ' + name + ' ')
        isNonBenefit = "비급여" in name
        
        if isIntegrated and hasNum2 and isNonBenefit:
             print("  -> MATCHED: 암 통합치료비Ⅱ(비급여)")
        elif isIntegrated and hasNum3:
             print("  -> MATCHED: 암 통합치료비III")
