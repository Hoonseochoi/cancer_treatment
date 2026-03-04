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
    let out = c.items.map(it => it.str).join('');
    fs.writeFileSync('out_native.txt', out, 'utf8');
}
test();
