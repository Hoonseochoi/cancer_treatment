# -*- coding: utf-8 -*-
import re

text = open('test3_debug.txt', 'r', encoding='utf-8').read()
lines = text.split('\n')

# Updated keywords matching script.js
startKeywords = ["가입담보리스트", "가입담보", "담보사항"]
endKeywords = ["주의사항", "유의사항", "알아두실"]

startIndex = -1
endIndex = -1

for i, line in enumerate(lines):
    clean = re.sub(r'\s+', '', line)
    
    if startIndex == -1:
        if len(clean) < 40 and any(k in clean for k in startKeywords):
            startIndex = i
            print(f"Start found at line {i}: {line.strip()[:60]}")
    elif endIndex == -1:
        if len(clean) < 40 and any(k in clean for k in endKeywords):
            endIndex = i
            print(f"End found at line {i}: {line.strip()[:60]}")
            break

print(f"\nRange: {startIndex} to {endIndex}")
print(f"Target line 182 in range: {startIndex <= 181 <= endIndex if endIndex > 0 else (startIndex <= 181 if startIndex != -1 else False)}")

# Check if 통합치료비Ⅱ is within range
if startIndex != -1:
    endPos = endIndex if endIndex > 0 else len(lines)
    found = False
    for i in range(startIndex, endPos):
        if '통합치료비' in lines[i] and ('Ⅱ' in lines[i]):
            print(f"Found 통합치료비Ⅱ at line {i}: {lines[i].strip()[:80]}")
            found = True
    if not found:
        print("통합치료비Ⅱ NOT found in range!")
else:
    print("Start index not found!")
