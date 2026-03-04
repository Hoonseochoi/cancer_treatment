const fs = require('fs');
let code = fs.readFileSync('../js/analyzer.js', 'utf8');
const text = fs.readFileSync('out_no_sort.txt', 'utf8');

let extractor = code.substring(code.indexOf('function extractRawCoverages(text) {'));
extractor = extractor.replace(/console\.log/g, '//');
extractor = extractor.replace(/console\.warn/g, '//');
extractor = extractor.replace('let trimmed = targetLines[i];', 'let trimmed = targetLines[i]; if(trimmed.includes("91") || trimmed.includes("95") || trimmed.includes("통합")) console.log("=> EVALUATING LINE:", trimmed);');
extractor = extractor.replace('results.push({', 'if(namePart && (namePart.includes("91") || namePart.includes("95") || namePart.includes("통합"))) console.log("PUSHING", namePart); results.push({');

eval(extractor);
console.log("=== START ===");
const res = extractRawCoverages(text);
