const fs = require('fs');
let code = fs.readFileSync('../js/analyzer.js', 'utf8');
const text = fs.readFileSync('out_no_sort.txt', 'utf8');

let extractor = code.substring(code.indexOf('function extractRawCoverages(text) {'));
extractor = extractor.replace(/console\.log/g, '//');
extractor = extractor.replace('for (let i = 0; i < targetLines.length; i++) {', 'console.log("=== TARGET LINES ==="); console.log(targetLines); for (let i = 0; i < targetLines.length; i++) {');

eval(extractor);
console.log("=== START ===");
const res = extractRawCoverages(text);
console.log(JSON.stringify(res, null, 2));
