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
    let target = c.items.filter(it => it.transform[5] > 260 && it.transform[5] < 310);
    target.sort((a, b) => b.transform[5] - a.transform[5]);
    let out = '';
    target.forEach(it => {
        out += `X: ${it.transform[4].toFixed(2)}, Y: ${it.transform[5].toFixed(2)}, H: ${it.height.toFixed(2)}, Text: '${it.str}'\n`;
    });
    fs.writeFileSync('out_all.txt', out, 'utf8');
}
test();
