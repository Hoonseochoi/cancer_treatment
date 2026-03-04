const fs = require('fs');
let code = fs.readFileSync('../js/analyzer.js', 'utf8');

let extractor = code.substring(code.indexOf('function extractRawCoverages(text) {'));
extractor = extractor.replace(/console\.log/g, '//');
extractor = extractor.replace(/console\.warn/g, '//');

eval(extractor);

const sample = `가입담보리스트
보장보험료 합계
91 갱신형 암 통합치료비(기본형) 4천만원 6,546
갱신종료 : 100세
95 갱신형 암 통합치료비Ⅱ(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함)) 1억원 6,281
발행정보`;

console.log("=== START ===");
const res = extractRawCoverages(sample);
console.log(JSON.stringify(res, null, 2));
