const fs = require('fs');
let code = fs.readFileSync('js/analyzer.js', 'utf8');
const text = fs.readFileSync('test12_raw.txt', 'utf8');

let extractor = code.substring(code.indexOf('function extractRawCoverages(text) {'));
extractor = extractor.replace(/console\.log/g, '//');
extractor = extractor.replace(/console\.warn/g, '//');
extractor = extractor.replace('results.push({', 'if(namePart && namePart.includes("II") && namePart.includes("통합")) console.log("PUSHING", namePart, amountPart); results.push({');
extractor = extractor.replace(
    'if (blacklist.some(word => trimmed.includes(word))) return;',
    'let failedWord = blacklist.find(word => trimmed.includes(word)); if (failedWord) { if(trimmed.includes("II") && trimmed.includes("통합")) console.log("BLK FAIL:", failedWord, trimmed); return; }'
);
extractor = extractor.replace(
    /} else {\n\s*\/\/\(`Skipped/g,
    '} else { if(namePart && namePart.includes("II") && namePart.includes("통합")) console.log("LEN/CHAR DROP:", namePart, "LENGTH:", namePart.length); //(`Skipped'
);

eval(extractor);
console.log("=== START ===");
const res = extractRawCoverages(text);
console.log("Total items extracted:", res.length);
console.log("Found II:", res.filter(r => r.name.includes("II") && r.name.includes("통합")));
