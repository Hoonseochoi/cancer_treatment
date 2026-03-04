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

    let pageText = "";
    let lastY = null;
    for (const item of c.items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
            // Native stream Y-jump -> newline
            pageText += "\n";
        } else if (lastY !== null) {
            pageText += " ";
        }
        pageText += item.str;
        if (item.hasEOL) {
            pageText += "\n";
            lastY = null; // force fresh line
        } else {
            lastY = item.transform[5];
        }
    }
    fs.writeFileSync('out_no_sort.txt', pageText, 'utf8');
}
test();
