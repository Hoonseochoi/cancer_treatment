function extractName(text) {
    let customerName = '고객';
    // 1. Try "피보험자 | 연령" table style first (often has name on next line)
    const tableMatch = text.match(/피보험자\s*\|\s*연령\s*[\r\n]+([^\s\|n\r\t]+)/);
    if (tableMatch && tableMatch[1]) {
        customerName = tableMatch[1].trim();
    } else {
        // 2. Standard "피보험자: 이름" or "피보험자 이름"
        const nameMatch = text.match(/피보험자\s*[:：|]?\s*([^|\n\r\t:：]{2,10})/);
        if (nameMatch && nameMatch[1]) {
            // Split by space, pipe, parenthesis, or bracket
            const tempName = nameMatch[1].trim().split(/[\s|(\[]/)[0];
            // If the matched "name" is just a header like "연령", skip it
            if (tempName && tempName !== '연령' && tempName !== '성별') {
                customerName = tempName;
            }
        }
    }
    // Last resort: ensure we didn't capture "보험료"
    if (customerName.includes('보험료')) customerName = '고객';
    return customerName;
}

const text1 = `고객님을 위한 가입제안서
피보험자
고객님
보험료
45,540 원`;
console.log("Test 1 (Vertical):", extractName(text1));

const text2 = `피보험자 | 연령
고객님 | 35세`;
console.log("Test 2 (Table Next Line):", extractName(text2));

const text3 = `피보험자: 홍길동님 보험료: 50,000원`;
console.log("Test 3 (Inline):", extractName(text3));

const text4 = `피보험자 고객님 성별: 남`;
console.log("Test 4 (Space):", extractName(text4));

const text5 = `피보험자 오순심(상령일: 56세) 성별: 여`;
console.log("Test 5 (Parenthesis):", extractName(text5));
