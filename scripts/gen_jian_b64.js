// jian.png를 Base64로 변환하여 expert_data.js에 JIAN_B64 추가
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const imgPath = path.join(root, 'level', 'jian.png');
const outPath = path.join(root, 'expert_data.js');

const img = fs.readFileSync(imgPath);
const b64 = 'data:image/png;base64,' + img.toString('base64');

let content = '';
const existingPath = path.join(root, 'expert_data.js');
if (fs.existsSync(existingPath)) {
  content = fs.readFileSync(existingPath, 'utf8');
  if (content.includes('JIAN_B64')) {
    content = content.replace(/const JIAN_B64 = "[^"]+";?/, `const JIAN_B64 = "${b64}";`);
  } else {
    content += `\nconst JIAN_B64 = "${b64}";\n`;
  }
} else {
  content = `// Expert images (Base64) - for 5년치 암치료비 모아보기
const JIAN_B64 = "${b64}";
`;
}
fs.writeFileSync(outPath, content, 'utf8');
console.log('expert_data.js updated with JIAN_B64, length:', b64.length);
