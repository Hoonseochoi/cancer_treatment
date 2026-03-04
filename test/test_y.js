const fs = require('fs');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const path = require('path');
async function test() {
    const buffer = fs.readFileSync(path.join(__dirname, 'test12.pdf'));
    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        cMapUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'cmaps', '/'),
        cMapPacked: true,
        standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts', '/')
    }).promise;
    const p = await pdf.getPage(3);
    const c = await p.getTextContent();
    let items = c.items;
    let target = items.filter(it =>
        it.str.includes('91') || it.str.includes('95') || it.str.includes('통합치료비') ||
        it.str.includes('1억원') || it.str.includes('4천만원')
    );
    target.sort((a, b) => b.transform[5] - a.transform[5]);
    let out = '';
    target.forEach(it => {
        out += `X: ${it.transform[4].toFixed(2)}, Y: ${it.transform[5].toFixed(2)}, Text: '${it.str}'\n`;
    });
    fs.writeFileSync('out3.txt', out, 'utf8');
}
test();
