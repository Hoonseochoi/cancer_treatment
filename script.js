// ?? Configuration & PDF.js ??
// PDF.js worker setup
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const defaultConfig = {
    main_title: "??移섎즺鍮?蹂댁옣湲덉븸 遺꾩꽍 ( ?뚯뒪??)",
    subtitle_text: "媛?낆젣?덉꽌 PDF瑜??낅줈?쒗븯硫? 蹂댁옣?댁뿭 以???移섎즺鍮??뚰듃留?異붿텧 ?⑸땲??,
    upload_button_text: "PDF ?뚯씪???쒕옒洹명븯嫄곕굹 ?대┃?섏꽭??,
    result_header_text: "?꾩껜 蹂댁옣 ?댁뿭 遺꾩꽍 寃곌낵",
    background_color: "#EBEBEB",
    surface_color: "#FFFFFF",
    text_color: "#404040",
    primary_color: "#E60000",
    secondary_color: "#8C8C8C",
    font_family: "Outfit",
    font_size: 16
};

function applyConfig(config) {
    const c = { ...defaultConfig, ...config };
    const font = c.font_family || defaultConfig.font_family;
    const baseSize = c.font_size || defaultConfig.font_size;
    // ... (rest of config logic same as before) ...
    document.documentElement.style.setProperty('--bg-color', c.background_color);
    document.documentElement.style.setProperty('--surface-color', c.surface_color);
    document.documentElement.style.setProperty('--text-color', c.text_color);
    document.documentElement.style.setProperty('--primary-color', c.primary_color);
    document.documentElement.style.setProperty('--secondary-color', c.secondary_color);

    const wrapper = document.getElementById('app-wrapper');
    if (wrapper) {
        wrapper.style.background = c.background_color;
        wrapper.style.color = c.text_color;
    }

    const titleEl = document.getElementById('main-title');
    const subtitleEl = document.getElementById('subtitle');
    const uploadBtnEl = document.getElementById('upload-btn-text');
    const resultHeaderEl = document.getElementById('result-header');

    if (titleEl) {
        titleEl.textContent = c.main_title;
        titleEl.style.fontFamily = `'Outfit', '${font}', sans-serif`;
        titleEl.style.fontSize = `${baseSize * 2}px`;
    }
    if (subtitleEl) {
        subtitleEl.textContent = c.subtitle_text;
        subtitleEl.style.fontFamily = `'${font}', sans-serif`;
        subtitleEl.style.fontSize = `${baseSize * 0.875}px`;
    }
    if (uploadBtnEl) {
        uploadBtnEl.textContent = c.upload_button_text;
        uploadBtnEl.style.fontFamily = `'${font}', sans-serif`;
        uploadBtnEl.style.fontSize = `${baseSize}px`;
    }
    if (resultHeaderEl) {
        resultHeaderEl.textContent = c.result_header_text;
        resultHeaderEl.style.fontFamily = `'Outfit', '${font}', sans-serif`;
        resultHeaderEl.style.fontSize = `${baseSize}px`;
    }

    document.body.style.fontFamily = `'${font}', sans-serif`;
    document.body.style.fontSize = `${baseSize}px`;
}

if (window.elementSdk) {
    window.elementSdk.init({
        defaultConfig,
        onConfigChange: async (config) => { applyConfig(config); },
        mapToCapabilities: (config) => ({
            recolorables: [
                { get: () => config.background_color || defaultConfig.background_color, set: (v) => { config.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
                { get: () => config.surface_color || defaultConfig.surface_color, set: (v) => { config.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
                { get: () => config.text_color || defaultConfig.text_color, set: (v) => { config.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
                { get: () => config.primary_color || defaultConfig.primary_color, set: (v) => { config.primary_color = v; window.elementSdk.setConfig({ primary_color: v }); } },
                { get: () => config.secondary_color || defaultConfig.secondary_color, set: (v) => { config.secondary_color = v; window.elementSdk.setConfig({ secondary_color: v }); } }
            ],
            borderables: [],
            fontEditable: {
                get: () => config.font_family || defaultConfig.font_family,
                set: (v) => { config.font_family = v; window.elementSdk.setConfig({ font_family: v }); }
            },
            fontSizeable: {
                get: () => config.font_size || defaultConfig.font_size,
                set: (v) => { config.font_size = v; window.elementSdk.setConfig({ font_size: v }); }
            }
        }),
        mapToEditPanelValues: (config) => new Map([
            ["main_title", config.main_title || defaultConfig.main_title],
            ["subtitle_text", config.subtitle_text || defaultConfig.subtitle_text],
            ["upload_button_text", config.upload_button_text || defaultConfig.upload_button_text],
            ["result_header_text", config.result_header_text || defaultConfig.result_header_text]
        ])
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Script v1.5: Name Cleaning Updated");
    applyConfig(defaultConfig);
});


// ?? RAW Extraction Logic ??
// 紐⑤뱺 ?띿뒪??以꾩쓣 遺꾩꽍?섎릺, ?뱀젙 踰붿쐞(媛?낅떞蹂대━?ㅽ듃 ~ 二쇱쓽?ы빆) ?댁뿉?쒕쭔 異붿텧
// + ?몄씠利??꾪꽣留?媛뺥솕
function extractRawCoverages(text) {
    if (!text || typeof text !== 'string') {
        console.warn("extractRawCoverages: Invalid text input", text);
        return [];
    }

    const lines = text.split('\n');
    let targetLines = lines;
    let startIndex = -1;
    let endIndex = -1;

    // 1. 踰붿쐞 ?꾪꽣留?(Noise Reduction) - 媛쒖꽑: ?ㅻ챸臾몄씠 ?꾨땶 ?ㅼ젣 ?뚯씠釉??ㅻ뜑留?媛먯?
    const startKeywords = ["媛?낅떞蹂대━?ㅽ듃", "媛?낅떞蹂?, "?대낫?ы빆"];
    const endKeywords = ["二쇱쓽?ы빆", "?좎쓽?ы빆", "?뚯븘?먯떎"];

    // ?쒖옉?? 吏㏃? 以꾩뿉?쒕쭔 李얘린 (?ㅻ챸臾몄씠 ?꾨땶 ?뚯씠釉??ㅻ뜑/?쒕ぉ)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\s+/g, '');

        if (startIndex === -1) {
            // 40???댄븯??以꾩뿉?쒕쭔 ?쒖옉 ?ㅼ썙??寃??(湲??ㅻ챸臾??쒖쇅)
            if (line.length < 40 && startKeywords.some(k => line.includes(k))) {
                startIndex = i;
                console.log(`Start index found at line ${i}: ${lines[i]}`);
            }
        }
        else if (endIndex === -1) {
            // 醫낅즺 ?ㅼ썙?쒕룄 吏㏃? 以꾩뿉?쒕쭔 (?ㅻ챸臾몄뿉 ?ы븿??"?곹뭹?ㅻ챸?? ??臾댁떆)
            if (line.length < 40 && endKeywords.some(k => line.includes(k))) {
                endIndex = i;
                console.log(`End index found at line ${i}: ${lines[i]}`);
                break;
            }
        }
    }

    if (startIndex !== -1) {
        if (endIndex === -1) endIndex = lines.length;
        targetLines = lines.slice(startIndex, endIndex);
        console.log(`Range filtering applied: ${startIndex} ~ ${endIndex} (${targetLines.length} lines)`);

        // 踰붿쐞媛 ?덈Т ?묒쑝硫?(10以?誘몃쭔) ?꾩껜 臾몄꽌 ?ㅼ틪?쇰줈 Fallback
        if (targetLines.length < 10) {
            console.warn(`Range too small (${targetLines.length} lines). Falling back to full document scan.`);
            targetLines = lines;
            startIndex = -1; // reset for id calculation
        }
    } else {
        console.warn("Start keyword not found. Scanning entire document.");
    }

    // 1.5 以??댁뼱遺숈씠湲?(PDF ?띿뒪???덉씠?댁뿉??以꾩씠 遺꾨━??寃쎌슦 泥섎━)
    // ?? "媛깆떊?????듯빀移섎즺鍮??ㅼ냽??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))(?듯빀媛?n?멸???\n1泥쒕쭔??
    //   ??"媛깆떊?????듯빀移섎즺鍮??ㅼ냽??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))(?듯빀媛꾪렪媛?? 1泥쒕쭔??
    const amountRegex = /[0-9,]+(?:??泥?諛???*(?:留뚯썝|?듭썝|留???|?몃?蹂댁옣李몄“/;
    const mergedLines = [];
    let pendingLine = '';

    for (let i = 0; i < targetLines.length; i++) {
        const trimmed = targetLines[i].trim();
        if (!trimmed) {
            if (pendingLine) { mergedLines.push(pendingLine); pendingLine = ''; }
            mergedLines.push('');
            continue;
        }

        // ?꾩옱 以꾩뿉 湲덉븸???덈뒗吏 泥댄겕
        const hasAmount = amountRegex.test(trimmed);

        if (pendingLine) {
            // ?댁쟾??湲덉븸 ?녿뒗 以꾩씠 ?湲?以????꾩옱 以꾧낵 ?⑹묠
            pendingLine += ' ' + trimmed;
            if (hasAmount || amountRegex.test(pendingLine)) {
                mergedLines.push(pendingLine);
                pendingLine = '';
            }
            // 湲덉븸 ?놁쑝硫?怨꾩냽 ?湲?(?ㅼ쓬 以꾧낵???⑹튌 ???덉쓬)
        } else {
            if (hasAmount) {
                mergedLines.push(trimmed);
            } else {
                // 湲덉븸 ?녿뒗 以????ㅼ쓬 以꾧낵 ?⑹튌 ???덉쑝誘濡??湲?
                // ?? ?덈Т 吏㏃? 以?5??誘몃쭔)?닿굅???レ옄留??덈뒗 以꾩? 洹몃깷 蹂대깂
                if (trimmed.length < 5 || /^\d+$/.test(trimmed)) {
                    mergedLines.push(trimmed);
                } else {
                    pendingLine = trimmed;
                }
            }
        }
    }
    if (pendingLine) mergedLines.push(pendingLine);
    targetLines = mergedLines;
    console.log(`Line merging: ${mergedLines.length} lines after merge`);

    const results = [];

    // 2. 異붿텧 濡쒖쭅 + 媛뺣젰???꾪꽣留?
    // ?쒖쇅???⑥뼱??(踰뺤쟻 臾멸뎄, ?ㅻ챸, ?덉떆????
    const blacklist = [
        "?대떦 ?곹뭹?", "寃쎌슦", "?곕씪", "踰뺤뿉", "吏湲됲븯??, "?ы븿?섏뼱", "蹂댄샇踰?,
        "?댁빟?섍툒湲?, "?덉떆??, "?곸슜?댁쑉", "理쒖?蹂댁쬆", "?됯퇏怨듭떆",
        "媛?낃툑?≪씤", "00留뚯썝", "00??, "?⑷퀎", "?먭?",
        "李멸퀬", "?뺤씤?섏떆湲?, "諛붾엻?덈떎", "?낅땲??, "?⑸땲??,
        // 議곌굔臾??쎄? ?ㅻ챸 ?꾪꽣
        "理쒖큹怨꾩빟", "寃쎄낵?쒖젏", "媛먯븸?곸슜", "硫댁콉",
        "踰뺣쪧??, "遺?댄븯??, "?먰빐瑜?, "諛곗긽梨낆엫??,
        "?댁쟾 吏꾨떒", "?댁쟾 ?섏닠", "?댁쟾 移섎즺",
        "媛숈? 吏덈퀝", "媛숈? 醫낅쪟", "諛섏? 寃?,
        "??, "蹂댁옣媛쒖떆", "?⑹엯硫댁젣",
        // 怨꾩빟 ?뺣낫 ?꾪꽣
        "?⑥꽦", "?ъ꽦", "留뚭린", "媛?낃툑??
    ];

    targetLines.forEach((line, idx) => {
        const originalIdx = (startIndex === -1 ? 0 : startIndex) + idx;
        const trimmed = line.trim();
        if (!trimmed) return;

        // A. 釉붾옓由ъ뒪??泥댄겕 (臾몄옣 ?꾩껜)
        if (blacklist.some(word => trimmed.includes(word))) return;

        // [NEW] "?몃?蹂댁옣"?쇰줈 ?쒖옉?섎뒗 以꾩? ?몄씠利덈줈 媛꾩＜?섍퀬 ?쒖쇅 (?몃?蹂댁옣李몄“???덉슜?섎릺, 臾몄옣 ?쒖옉???몃?蹂댁옣?대㈃ ?쒖쇅)
        if (trimmed.startsWith("?몃?蹂댁옣")) return;

        // B. 湲덉븸 ?⑦꽩 李얘린
        let match = trimmed.match(/([0-9,]+(?:??泥?諛???*(?:留뚯썝|?듭썝|留???)/);

        // "??留??덈뒗 寃쎌슦??李얜릺, ?덈Т ?묒? 湲덉븸(100??誘몃쭔)?대굹 湲?臾몄옣? ?쒖쇅
        if (!match) {
            match = trimmed.match(/([0-9,]+(?:泥?諛??????/);
        }

        // "?몃?蹂댁옣李몄“" ?⑦꽩??湲덉븸?쇰줈 ?몄젙 (?곸쐞 ?대낫??ぉ)
        let isRefAmount = false;
        if (!match && trimmed.includes('?몃?蹂댁옣李몄“')) {
            // ?몃?蹂댁옣李몄“ ?ㅼ쓽 蹂댄뿕猷??レ옄瑜?李얠븘??洹??욊퉴吏瑜??대쫫?쇰줈 ?ъ슜
            const refMatch = trimmed.match(/?몃?蹂댁옣李몄“/);
            if (refMatch) {
                match = refMatch;
                match[1] = '?몃?蹂댁옣李몄“';
                isRefAmount = true;
            }
        }

        if (match) {
            const amountStr = match[1];

            // C. ?대낫紐?異붿텧 諛??뺤젣
            let namePart = trimmed.substring(0, match.index).trim();

            // 0. [NEW] ?욌?遺꾩뿉 遺숈? "20??/ 20?? 媛숈? ?좎쭨 ?⑦꽩 ?쒓굅 (?띿뒪??蹂묓빀 ?댁뒋 ?닿껐)
            // ?⑦꽩: "?レ옄?? ?먮뒗 "?レ옄??媛 ?ы븿???욌?遺??쒓굅
            namePart = namePart.replace(/^[\d]+(??????\s*[\/]?\s*[\d]*(???????\s*/, '').trim();
            // ?뱀떆 ?レ옄媛 ?⑥븘?덈떎硫??쒕쾲 ???쒓굅 (?? "278 媛깆떊??..")
            namePart = namePart.replace(/^[\d]+\s+/, '').trim();

            // 1. 移댄뀒怨좊━ ?ㅻ뜑 ?쒓굅 (?쒖쓽 泥ル쾲吏????댁슜???욎뿬 ?ㅼ뼱媛?寃쎌슦)
            // ?? "移섎즺鍮?112 ??..", "湲곕낯怨꾩빟 32...", "3?吏꾨떒 64..."
            // 二쇱쓽: "湲고??쇰??? 泥섎읆 ?⑥뼱???쇰???寃쎌슦???쒖쇅?섍퀬, "湲고? 110" 泥섎읆 遺꾨━??寃쎌슦留??쒓굅
            const categoryKeywords = ["湲곕낯怨꾩빟", "3?吏꾨떒", "移섎즺鍮?, "?섏닠鍮?, "?낆썝鍮?, "諛곗긽梨낆엫", "?꾩쑀?ν빐", "湲고?", "2?吏꾨떒", "吏덈퀝", "?곹빐", "?댁쟾??];

            for (const key of categoryKeywords) {
                // ?ㅼ썙???ㅼ뿉 怨듬갚?대굹 ?レ옄媛 ?ㅻ뒗 寃쎌슦?먮쭔 ?쒓굅 (?뺢퇋???ъ슜)
                // ?? "湲고? 110" -> ?쒓굅, "湲고??쇰??? -> ?좎?
                const regex = new RegExp('^' + key + '(?=[\\s\\d])');
                if (regex.test(namePart)) {
                    namePart = namePart.replace(regex, '').trim();
                }
            }

            // 2. ?쒕쾲/肄붾뱶 ?쒓굅 (?? "32 ", "112 ", "64 ", "??", "- ")
            // 二쇱쓽: "26醫? 媛숈?嫄?吏?곕㈃ ?덈맖. ?レ옄 ?ㅼ뿉 怨듬갚?대굹 湲고샇媛 ?덈뒗 寃쎌슦留??쒓굅
            namePart = namePart.replace(/^[\d]+\s+/, '');
            namePart = namePart.replace(/^[??-?◈?s]+/, '');

            // ?쒕쾲 ??泥댄겕 (?? "移섎즺鍮? 吏?곌퀬 ?щ뜑??"112 "媛 ?⑥? 寃쎌슦)
            namePart = namePart.replace(/^[\d]+\s+/, '');

            // 3. ?앸?遺?怨듬갚/???쒓굅
            namePart = namePart.replace(/[.\s]+$/, '');
            // 4. "?몃?蹂댁옣李몄“" ?쒓굅
            namePart = namePart.replace(/?몃?蹂댁옣李몄“/g, '').trim();

            // 5. 愿꾪샇 ???댁슜 ?뺣━
            // 留??욎쓽 吏㏃? 愿꾪샇留??쒓굅 (?? "(臾??붿쭊?⑤퉬" -> "?붿쭊?⑤퉬")
            // 二쇱쓽: non-greedy濡?泥?踰덉㎏ 愿꾪샇?띾쭔 ?쒓굅 ("(臾????ㅼ냽??" -> "???ㅼ냽??" ?좎?)
            namePart = namePart.replace(/^\([^)]*\)/, '').trim();

            // 6. [NEW] ?앸?遺꾩뿉 遺숈? ?レ옄/肄붾뱶 ?쒓굅 (?? "?곴툒醫낇빀蹂묒썝116" -> "?곴툒醫낇빀蹂묒썝")
            // ?⑦꽩: ?쒓? ?ㅼ뿉 遺숈? ?レ옄???쒓굅
            namePart = namePart.replace(/([媛-??)\d+$/, '$1').trim();



            // E. ?몃? ?댁슜(蹂댄뿕猷? ?⑷린/留뚭린) 異붿텧
            // ?섎㉧吏 ?룸?遺꾩뿉???뺣낫 異붿텧
            // ?? "4泥쒕쭔??15,560 20??/ 100??
            // match[0]? "4泥쒕쭔?? (湲덉븸 ?꾩껜 留ㅼ튂)

            // 湲덉븸 ?룸?遺??먮Ⅴ湲?
            let suffix = trimmed.substring(match.index + match[0].length).trim();

            let premium = "-";
            let period = "-";

            // 1. 蹂댄뿕猷?李얘린 (?レ옄 + 肄ㅻ쭏 議고빀, 蹂댄넻 湲덉븸 諛붾줈 ?ㅼ뿉 ??
            // ?? "15,560" ?먮뒗 "2,144"
            const premiumMatch = suffix.match(/([0-9,]+)/);
            if (premiumMatch) {
                premium = premiumMatch[1] + "??;
                // 蹂댄뿕猷?李얠븯?쇰㈃ 洹????댁슜?먯꽌 湲곌컙 李얘린
                suffix = suffix.substring(premiumMatch.index + premiumMatch[0].length).trim();
            }

            // 2. ?⑷린/留뚭린 李얘린 (?? "20??/ 100??, "20??100??)
            // ?⑦꽩: "?レ옄?? ?먮뒗 "?レ옄??媛 ?ы븿??臾몄옄??
            const periodMatch = suffix.match(/([0-9]+\s*??s*\/?[^]*)/);
            if (periodMatch) {
                period = periodMatch[1].trim();
            }

            // D. ?대낫紐??좏슚??泥댄겕
            // - ?덈Т 吏㏃쑝硫?1湲?? ?쒖쇅
            // - ?덈Т 湲몃㈃(50湲???댁긽) ?ㅻ챸臾몄씪 ?뺣쪧 ?믪쓬 -> ?쒖쇅
            // - 臾몄옣???대?濡??앸굹硫??쒖쇅 ("??, "??, "??, "??)
            // D. ?대낫紐??좏슚??泥댄겕
            // - ?덈Т 吏㏃쑝硫?1湲?? ?쒖쇅
            // - ?덈Т 湲몃㈃(120湲???댁긽) ?ㅻ챸臾몄씪 ?뺣쪧 ?믪쓬 -> ?쒖쇅
            // - 臾몄옣???대?濡??앸굹硫??쒖쇅 ("??, "??, "??, "??)
            if (namePart.length > 1 && namePart.length < 120) {
                const lastChar = namePart.slice(-1);
                if (!['??, '??, '??, '??, '??, '?'].includes(lastChar)) {
                    results.push({
                        id: originalIdx,
                        name: namePart,
                        amount: amountStr,
                        premium: premium,
                        period: period,
                        original: trimmed
                    });
                } else {
                    console.log(`Skipped (sentence end): ${namePart}`);
                }
            } else {
                console.log(`Skipped (length): ${namePart} (${namePart.length} chars)`);
            }
        }
    });

    console.log(`extractRawCoverages: ${results.length}嫄?異붿텧 ?꾨즺 (?꾩껜 ${targetLines.length}以?遺꾩꽍)`);
    return results;
}

// ?? PDF Extraction (Hybrid: Text Layer + OCR + Line Preservation) ??
async function extractTextFromPDF(file, log = console.log) {
    log("PDF 濡쒕뵫 ?쒖옉...");
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    log(`PDF 濡쒕뱶 ?꾨즺. 珥?${pdf.numPages}?섏씠吏`);
    let fullText = '';

    // 媛?낅떞蹂대━?ㅽ듃??蹂댄넻 3~6?섏씠吏???꾩튂 (?꾩껜 ?ㅼ틪???쎄?/議곌굔臾??몄씠利?諛쒖깮)
    const startPage = Math.min(3, pdf.numPages);
    const endPage = Math.min(6, pdf.numPages);
    const totalPagesToProcess = endPage - startPage + 1;

    showToast(`珥?${totalPagesToProcess}?섏씠吏 ?뺣? 遺꾩꽍???쒖옉?⑸땲??`, false);

    for (let i = startPage; i <= endPage; i++) {
        let pageText = "";

        try {
            updateProgress(
                Math.round(((i - startPage) / totalPagesToProcess) * 100),
                `${i}?섏씠吏 遺꾩꽍 以?..`
            );

            const page = await pdf.getPage(i);

            // 1. ?띿뒪???덉씠???쒕룄 (以꾨컮轅?蹂댁〈 濡쒖쭅 異붽?)
            try {
                const content = await page.getTextContent();
                if (content && content.items && content.items.length > 0) {

                    // Y 醫뚰몴 湲곗? ?뺣젹 (PDF.js??媛???쒖꽌媛 ?욎엫)
                    // transform[5]媛 Y醫뚰몴 (PDF醫뚰몴怨꾨뒗 ?꾨옒?먯꽌 ?꾨줈 利앷?)
                    // Y媛 ???쒖꽌?濡???>?꾨옒) ?뺣젹, 媛숈? 以꾩? X(transform[4])媛 ?묒? ?쒖꽌?濡???>?? ?뺣젹
                    const items = content.items.map(item => ({
                        str: item.str,
                        x: item.transform[4],
                        y: item.transform[5],
                        w: item.width,
                        h: item.height
                    }));

                    // ?뺣젹: Y ?대┝李⑥닚 (?덉슜?ㅼ감 5), X ?ㅻ쫫李⑥닚
                    items.sort((a, b) => {
                        if (Math.abs(a.y - b.y) < 5) { // 媛숈? 以꾨줈 媛꾩＜
                            return a.x - b.x;
                        }
                        return b.y - a.y; // ?꾩뿉???꾨옒濡?
                    });

                    // ?띿뒪??議곕┰
                    let lastY = items[0].y;
                    let lastX = items[0].x;

                    for (const item of items) {
                        // 以꾨컮轅?媛먯? (Y李⑥씠媛 ??
                        if (Math.abs(item.y - lastY) > 8) { // 以?媛꾧꺽 ?꾧퀎媛?8
                            pageText += "\n";
                        } else {
                            // 媛숈? 以꾩씤??X李⑥씠媛 ??(怨듬갚)
                            // 湲???ш린???곕씪 ?ㅻⅤ吏留????5 ?댁긽?대㈃ 怨듬갚 異붽?
                            if (item.x - lastX > 5) { // 臾몄옄 媛꾧꺽 ?꾧퀎媛?
                                pageText += " ";
                            }
                        }

                        pageText += item.str;
                        lastY = item.y;
                        lastX = item.x + item.w; // ?ㅼ쓬 湲???덉긽 ?쒖옉 ?꾩튂
                    }
                }
            } catch (err) {
                console.warn(`Page ${i} Text Layer Error:`, err);
            }

            // 2. OCR Fallback
            // ?띿뒪?멸? ?덈Т ?곸쑝硫?50??誘몃쭔) ?대?吏濡?媛꾩＜
            const len = pageText.trim().length;

            if (len < 50) {
                updateProgress(
                    Math.round(((i - startPage) / totalPagesToProcess) * 100),
                    `${i}?섏씠吏 OCR 蹂??以?..`
                );

                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                try {
                    const result = await Tesseract.recognize(
                        canvas,
                        'kor+eng',
                        {
                            logger: m => {
                                if (m && m.status === 'recognizing text') {
                                    const progress = Math.round((m.progress || 0) * 100);
                                    updateProgress(
                                        Math.round(((i - startPage) / totalPagesToProcess) * 100),
                                        `${i}?섏씠吏 ?몄떇 以?.. ${progress}%`
                                    );
                                }
                            }
                        }
                    );

                    pageText = (result && result.data && result.data.text) || "";
                    log(`Page ${i} OCR ?꾨즺: ${pageText.length}??);

                } catch (ocrErr) {
                    console.error(`Page ${i} OCR Error:`, ocrErr);
                    log(`Page ${i} OCR ?ㅽ뙣: ${ocrErr.message}`);
                }
            } else {
                log(`Page ${i} ?띿뒪???덉씠??諛쒓껄: ${len}??);
            }

        } catch (pageErr) {
            console.error(`Page ${i} Critical Error:`, pageErr);
            log(`Page ${i} 泥섎━ 以??ㅻ쪟: ${pageErr.message}`);
        }

        fullText += (pageText || "") + '\n';
    }

    return fullText || "";
}

// ?? UI Helpers ??
function updateProgress(pct, text) {
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text;
}

function showToast(msg, isError = true) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = isError ? '#EF4444' : '#10B981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// ?? Coverage Detail Dictionary ??
const coverageDetailsMap = {
    // 4. 鍮꾧툒???곴툒醫낇빀蹂묒썝 ?ы븿)??
    "???듯빀移섎즺鍮?鍮꾧툒???꾩븸蹂몄씤遺???ы븿), ?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))": {
        "type": "variant",
        "data": {
            "8000": [
                { name: "(留ㅽ쉶) (鍮꾧툒???ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "3,000留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "6,000留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑 移섎즺鍮?, amount: "3,000留? }
            ],
            "5000": [
                { name: "(留ㅽ쉶) (鍮꾧툒???ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "750留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "2,000留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "4,000留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑 移섎즺鍮?, amount: "2,000留? }
            ],
            "2000": [
                { name: "(留ㅽ쉶) (鍮꾧툒???ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "500留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "2,000留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑 移섎즺鍮?, amount: "1,000留? }
            ]
        }
    },
    // 1. 湲곕낯??(?ъ슜???붿껌 ?듭씪 + 湲덉븸蹂?遺꾧린)
    "???듯빀移섎즺鍮?湲곕낯??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))": {
        "type": "variant",
        "data": {
            "10000": [ // 1?듭썝
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "1,000留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "2,000留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?1,000留?, "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸 ?섏닠 1,000留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "1,000留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "4,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?3,000留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "7,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?3,000留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?3,000留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "4,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?3,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "1,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "1,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?]
                }
            ],
            "8000": [ // 8泥쒕쭔??
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "750留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "1,500留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?750留?, "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸 ?섏닠 750留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "750留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "750留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "2,750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?2,000留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "4,750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?2,000留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?2,000留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "2,750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?2,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?]
                }
            ],
            "4000": [ // 4泥쒕쭔??(湲곗〈 ?곗씠??
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "500留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "1,000留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?500留?, "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸 ?섏닠 500留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "500留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "500留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "2,500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?]
                }
            ]
        }
    },
    // 1-1. ?ㅼ냽??
    "???듯빀移섎즺鍮??ㅼ냽??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))": {
        "type": "variant",
        "data": {
            "7000": [ // 7泥쒕쭔??
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "1,000留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "1,000留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?1,000留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "1,000留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "2,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "3,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "2,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "1,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "1,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?]
                }
            ],
            "5000": [ // 5泥쒕쭔??
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "750留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "750留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?750留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "750留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "750留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?750留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "2,150留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?750留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?750留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?]
                }
            ],
            "3000": [ // 3泥쒕쭔??
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "500留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "500留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?500留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "500留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "500留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "1,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?500留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?500留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "1,000留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?500留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?]
                }
            ],
            "1000": [ // 1泥쒕쭔??
                { name: "(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?, amount: "250留? },
                {
                    name: "(留ㅽ쉶) ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "250留?,
                    sub: ["(留ㅽ쉶) (湲됱뿬/鍮꾧툒?? ???섏닠鍮?250留?]
                },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "250留? },
                { name: "(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "250留? },
                {
                    name: "(???? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?250留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?250留?]
                },
                {
                    name: "(???? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "750留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?250留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?250留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?250留?]
                },
                {
                    name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "500留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?250留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?250留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "250留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?250留?]
                },
                {
                    name: "(???? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬",
                    amount: "250留?,
                    sub: ["(???? (湲됱뿬/鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?250留?]
                }
            ]
        }
    },
    // 2. 鍮꾧툒?ы삎
    "???듯빀移섎즺鍮꾟뀫(鍮꾧툒??": {
        "type": "variant",
        "data": {
            "10000": [ // 1?듭썝
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "1,000留? },
                {
                    name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "2,000留?,
                    sub: ["(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?1,000留?, "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸?섏닠 1,000留?]
                },
                { name: "(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "1,000留? },
                {
                    name: "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "4,000留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?3,000留?]
                },
                {
                    name: "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "7,000留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?쒖쟻 ??븫 ?쎈Ъ 移섎즺鍮?3,000留?, "(???? (鍮꾧툒?? 硫댁뿭 ??븫 ?쎈Ъ 移섎즺鍮?3,000留?]
                },
                {
                    name: "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "4,000留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?3,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "1,000留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?1,000留?]
                }
            ],
            "7000": [ // 7泥쒕쭔??
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "750留? },
                {
                    name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "1,500留?,
                    sub: ["(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?750留?, "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸?섏닠 750留?]
                },
                { name: "(???? (鍮꾧툒?? ??븫諛⑹궗??移섎즺鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "750留? },
                {
                    name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?,
                    amount: "2,750留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ 移섎즺鍮?2,000留?]
                },
                {
                    name: "(???? (鍮꾧툒?? 硫댁뿭??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "4,750留?,
                    sub: ["(???? (鍮꾧툒?? ??븫?쎈Ъ 移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?쒖쟻??븫 ?쎈Ъ移섎즺鍮?2,000留?, "(???? (鍮꾧툒?? 硫댁뿭??븫 ?쎈Ъ 移섎즺鍮?2,000留?]
                },
                {
                    name: "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "2,750留?,
                    sub: ["(???? (鍮꾧툒?? ??븫諛⑹궗??移섎즺鍮?750留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?2,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "750留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?750留?]
                }
            ],
            "4000": [ // 4泥쒕쭔??
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "500留? },
                {
                    name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?,
                    amount: "1,000留?,
                    sub: ["(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?500留?, "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移?濡쒕큸?섏닠 500留?]
                },
                { name: "(???? (鍮꾧툒?? ??븫諛⑹궗??移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "500留? },
                {
                    name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ 移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? (鍮꾧툒?? 硫댁뿭??븫 ?쎈Ъ 移섎즺鍮?,
                    amount: "2,500留?,
                    sub: ["(???? (鍮꾧툒?? ??븫?쎈Ъ 移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?쒖쟻??븫 ?쎈Ъ移섎즺鍮?1,000留?, "(???? (鍮꾧툒?? 硫댁뿭??븫 ?쎈Ъ 移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?,
                    amount: "1,500留?,
                    sub: ["(???? (鍮꾧툒?? ??븫諛⑹궗??移섎즺鍮?500留?, "(???? (鍮꾧툒?? ?묒꽦??諛⑹궗??移섎즺鍮?1,000留?]
                },
                {
                    name: "(???? 以묒엯??諛⑹궗??移섎즺鍮?,
                    amount: "500留?,
                    sub: ["(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?500留?]
                }
            ]
        }
    },

    // 3. ???듯빀移섎즺鍮?III (Range Type)
    "?붿쭊?⑤컦移섎즺鍮????듯빀移섎즺鍮껱II)": {
        "type": "variant",
        "data": {
            "5000": [
                { name: "(???? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "2,000留?3,000留?", maxAmount: "3,000留? },
                { name: "(???? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "2,000留?3,000留?", maxAmount: "3,000留?, hiddenInDetail: true },
                { name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?, amount: "2,000留?3,000留?", maxAmount: "3,000留? }
            ],
            "4000": [
                { name: "(???? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "1,000留?3,000留?", maxAmount: "3,000留? },
                { name: "(???? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "1,000留?3,000留?", maxAmount: "3,000留?, hiddenInDetail: true },
                { name: "(???? ?묒꽦??諛⑹궗??移섎즺鍮?, amount: "1,000留?3,000留?", maxAmount: "3,000留? }
            ]
        }
    },

    // 4. 10?꾧갚??媛쒕퀎 ?대낫 (passthrough: ?먭린 ?먯떊??湲덉븸??洹몃?濡??ъ슜)
    "??븫以묒엯?먮갑?ъ꽑移섎즺鍮?: {
        type: "passthrough",
        displayName: "(理쒖큹1?? 以묒엯?먮갑?ъ꽑移섎즺鍮?
    },
    "??븫?멸린議곗젅諛⑹궗?좎튂猷뚮퉬": {
        type: "passthrough",
        displayName: "(10?꾧갚??(理쒖큹1?? ?멸린議곗젅諛⑹궗?좎튂猷뚮퉬"
    },
    "?뱀젙硫댁뿭??븫?쎈Ъ?덇?移섎즺鍮?: {
        type: "passthrough",
        displayName: "(10?꾧갚??(理쒖큹1?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?
    },
    "?쒖쟻??븫?쎈Ъ?덇?移섎즺鍮?: {
        type: "passthrough",
        displayName: "(10?꾧갚??(理쒖큹1?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?
    },
    "??븫?묒꽦?먮갑?ъ꽑移섎즺鍮?: {
        type: "passthrough",
        displayName: "(10?꾧갚??(理쒖큹1?? ?묒꽦?먮갑?ъ꽑移섎즺鍮?
    },
    // [NEW] ?ㅻ퉰移섎줈遊??붿닔?좊퉬
    "?ㅻ퉰移섎줈遊뉗븫?섏닠鍮?: {
        type: "passthrough",
        displayName: "(10?꾧갚??(理쒖큹1?? ?ㅻ퉰移?濡쒕큸 ?섏닠鍮?
    },

    // [NEW] ???듯빀移섎즺鍮?(二쇱슂移섎즺) - 鍮꾧툒??(7泥?5泥?3泥?
    "???듯빀移섎즺鍮?二쇱슂移섎즺)(鍮꾧툒???꾩븸蹂몄씤遺???ы븿), ?붿쨷?먯튂猷뚭린愿(?곴툒 醫낇빀蹂묒썝 ?ы븿))": {
        "type": "variant",
        "data": {
            "7000": [
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? 以묒엯?먮갑?ъ꽑移섎즺鍮?, amount: "1,000留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑移섎즺鍮?, amount: "1,000留? },
                { name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "1,000留? }
            ],
            "5000": [
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? 以묒엯?먮갑?ъ꽑移섎즺鍮?, amount: "750留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑移섎즺鍮?, amount: "750留? },
                { name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "750留? }
            ],
            "3000": [
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? 以묒엯?먮갑?ъ꽑移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑移섎즺鍮?, amount: "500留? },
                { name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "500留? }
            ],
            "2000": [
                { name: "(留ㅽ쉶) (鍮꾧툒?? ???섏닠鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ??븫 諛⑹궗??移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ??븫 ?쎈Ъ 移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ?쒖쟻??븫?쎈Ъ移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? 硫댁뿭??븫?쎈Ъ移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? 以묒엯?먮갑?ъ꽑移섎즺鍮?, amount: "500留? },
                { name: "(???? (鍮꾧툒?? ?묒꽦?먮갑?ъ꽑移섎즺鍮?, amount: "500留? },
                { name: "(留ㅽ쉶) (鍮꾧툒?? ?ㅻ퉰移섎줈遊뉗닔?좊퉬", amount: "500留? }
            ]
        }
    },

    // 4. 26醫???븫諛⑹궗?좊컦?쎈Ъ移섎즺鍮?(?щ윭 移댄뀒怨좊━???숈떆 諛섏쁺)
    "26醫낇빆?붾갑?ъ꽑諛륁빟臾쇱튂猷뚮퉬": {
        type: "26jong",
        detailName: "26醫???븫諛⑹궗??諛??쎈Ъ 移섎즺鍮?,
        summaryItems: [
            { name: "(理쒕? 26?? 26醫???븫 諛⑹궗??移섎즺鍮?, targetName: "??븫諛⑹궗?좎튂猷뚮퉬" },
            { name: "(理쒕? 26?? 26醫???븫 ?쎈Ъ 移섎즺鍮?, targetName: "??븫?쎈Ъ移섎즺鍮? },
            { name: "(理쒕? 26?? 26醫낇빆?붾갑?ъ꽑移섎즺鍮?, targetName: "?쒖쟻??븫?쎈Ъ移섎즺鍮? },
            { name: "(理쒕? 26?? 26醫낇빆?붾갑?ъ꽑移섎즺鍮?, targetName: "硫댁뿭??븫?쎈Ъ移섎즺鍮? },
            { name: "(理쒕? 26?? 26醫낇빆?붾갑?ъ꽑移섎즺鍮?, targetName: "?묒꽦?먮갑?ъ꽑移섎즺鍮? },
            { name: "(理쒕? 26?? 26醫낇빆?붾갑?ъ꽑移섎즺鍮?, targetName: "以묒엯?먮갑?ъ꽑移섎즺鍮? }
        ]
    }
};

// ?? Helper: Parse Korean Amount ??
function parseKoAmount(str) {
    if (!str) return 0;
    // Remove "??, ",", " "
    let clean = str.replace(/[??\s]/g, '');
    let val = 0;

    // Check units
    if (clean.includes('??)) {
        let parts = clean.split('??);
        let uk = parseInt(parts[0]) || 0;
        let rest = parts[1] || '';
        val += uk * 10000; // 留뚯썝 ?⑥쐞濡?怨꾩궛 (1??= 10000留?
        if (rest.includes('泥?)) {
            val += (parseInt(rest.replace('泥?, '')) || 0) * 1000;
        } else if (rest.includes('留?)) {
            val += parseInt(rest.replace('留?, '')) || 0;
        }
    } else if (clean.includes('泥쒕쭔')) {
        val = (parseInt(clean.replace('泥쒕쭔', '')) || 0) * 1000;
    } else if (clean.includes('諛깅쭔')) {
        val = (parseInt(clean.replace('諛깅쭔', '')) || 0) * 100;
    } else if (clean.includes('留?)) {
        val = parseInt(clean.replace('留?, '')) || 0;
    } else {
        // ?⑥쐞媛 ?녾굅??'??留??덈뒗 寃쎌슦 (蹂댄뿕猷뚮뒗 ?쒖쇅?섍퀬 媛?낃툑?〓쭔 蹂몃떎硫?蹂댄넻 留뚯썝 ?⑥쐞 ?댁긽??
        // ?ш린?쒕뒗 '留? ?⑥쐞濡??듭씪?댁꽌 由ы꽩
        val = parseInt(clean) || 0;
    }
    return val; // 留뚯썝 ?⑥쐞 諛섑솚
}

// ?? Helper: Format Korean Amount ??
function formatKoAmount(val) {
    if (val === 0) return "0??;
    let uk = Math.floor(val / 10000);
    let man = val % 10000;

    let result = "";
    if (uk > 0) result += `${uk}??`;
    if (man > 0) result += `${man.toLocaleString()}留?;

    return result.trim() + "??;
}

// ?? Helper: Normalize any amount string to #,###留뚯썝 format ??
function formatDisplayAmount(str) {
    if (!str) return str;
    const val = parseKoAmount(str);
    if (val === 0) return str; // ?뚯떛 ?ㅽ뙣 ???먮낯 ?좎?
    return formatKoAmount(val);
}

// ?? Aggregate Hierarchical Summary Logic ??
function calculateHierarchicalSummary(results) {
    const summaryMap = new Map();
    let first26SummaryFound = false; // 26醫?泥?踰덉㎏留??쒕늿?먮낫湲곗뿉 諛섏쁺

    results.forEach(item => {
        let details = coverageDetailsMap[item.name];

        // Dictionary Lookup (Fallback Logic)
        if (!details) {
            if (item.name.includes("???듯빀移섎즺鍮?) && (item.name.includes("III") || item.name.includes("??))) {
                details = coverageDetailsMap["?붿쭊?⑤컦移섎즺鍮????듯빀移섎즺鍮껱II)"];
            }
            // [MOVED] 二쇱슂移섎즺 ?곗꽑 泥댄겕
            else if (item.name.includes("???듯빀移섎즺鍮?) && item.name.includes("二쇱슂移섎즺")) {
                details = coverageDetailsMap["???듯빀移섎즺鍮?二쇱슂移섎즺)(鍮꾧툒???꾩븸蹂몄씤遺???ы븿), ?붿쨷?먯튂猷뚭린愿(?곴툒 醫낇빀蹂묒썝 ?ы븿))"];
            }
            else if (item.name.includes("???듯빀移섎즺鍮?) && item.name.includes("鍮꾧툒??) && item.name.includes("?꾩븸蹂몄씤遺??)) {
                details = coverageDetailsMap["???듯빀移섎즺鍮?鍮꾧툒???꾩븸蹂몄씤遺???ы븿), ?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))"];
            } else if (item.name.includes("???듯빀移섎즺鍮?) && (item.name.includes("??) || item.name.includes("II")) && item.name.includes("鍮꾧툒??)) {
                details = coverageDetailsMap["???듯빀移섎즺鍮꾟뀫(鍮꾧툒??"];
            } else if (item.name.includes("???듯빀移섎즺鍮?) && item.name.includes("湲곕낯??)) {
                details = coverageDetailsMap["???듯빀移섎즺鍮?湲곕낯??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))"];

                details = coverageDetailsMap["???듯빀移섎즺鍮??ㅼ냽??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))"];
            }
            // 10?꾧갚??媛쒕퀎 ?대낫 ?ㅼ썙??留ㅼ묶
            else if (item.name.includes("以묒엯?먮갑?ъ꽑")) {
                details = coverageDetailsMap["??븫以묒엯?먮갑?ъ꽑移섎즺鍮?];
            } else if (item.name.includes("?멸린議곗젅諛⑹궗??)) {
                details = coverageDetailsMap["??븫?멸린議곗젅諛⑹궗?좎튂猷뚮퉬"];
            } else if (item.name.includes("硫댁뿭??븫?쎈Ъ") || item.name.includes("硫댁뿭??븫")) {
                details = coverageDetailsMap["?뱀젙硫댁뿭??븫?쎈Ъ?덇?移섎즺鍮?];
            } else if (item.name.includes("?쒖쟻??븫?쎈Ъ") || item.name.includes("?쒖쟻??븫")) {
                details = coverageDetailsMap["?쒖쟻??븫?쎈Ъ?덇?移섎즺鍮?];
            } else if (item.name.includes("?묒꽦?먮갑?ъ꽑") || item.name.includes("?묒꽦??)) {
                details = coverageDetailsMap["??븫?묒꽦?먮갑?ъ꽑移섎즺鍮?];
            } else if (item.name.includes("26醫?) && (item.name.includes("移섎즺鍮?) || item.name.includes("?쎈Ъ"))) {
                details = coverageDetailsMap["26醫낇빆?붾갑?ъ꽑諛륁빟臾쇱튂猷뚮퉬"];
            } else if (item.name.includes("?ㅻ퉰移?) && item.name.includes("濡쒕큸")) {
                // Exclude "?뱀젙?? (Specific Cancer) but keep "?뱀젙?붿젣?? (General)
                if (!item.name.includes("?뱀젙??) || item.name.includes("?쒖쇅")) {
                    details = coverageDetailsMap["?ㅻ퉰移섎줈遊뉗븫?섏닠鍮?];
                }
            }
        }

        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];

            // Fallback default
            if (!variantData) {
                // Approximate matching for limits (e.g. 7XXX -> 8000, 4XXX -> 5000)
                if (amountVal > 6000) variantData = details.data["8000"] || details.data["10000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];

                if (!variantData && details.data["10000"]) variantData = details.data["10000"];
            }
            details = variantData;
        }

        // Handle Passthrough Type (?먭린 湲덉븸 洹몃?濡??ъ슜)
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }

        if (details && details.type === '26jong') {
            if (!first26SummaryFound) {
                first26SummaryFound = true;
                details = details.summaryItems.map(d => ({
                    name: d.name,
                    amount: item.amount,
                    targetName: d.targetName // targetName ?꾨떖
                }));
            } else {
                details = null;
            }
        }

        if (details && Array.isArray(details)) {
            details.forEach(det => {
                // Normalize Name to find "Common Group"
                let groupingSource = det.targetName || det.name;
                let normalizedName = groupingSource;

                // [KEYWORD-BASED CATEGORIZATION]
                // 1. targetName??紐낆떆?곸쑝濡??덉쑝硫?理쒖슦???곸슜 (26醫?留ㅽ븨 蹂댁옣)
                if (det.targetName) {
                    normalizedName = det.targetName;
                }
                // 2. 洹??몄쓽 寃쎌슦 ?ㅼ썙??留ㅼ묶
                else if (groupingSource.includes("?쒖쟻")) {
                    normalizedName = "?쒖쟻??븫?쎈Ъ移섎즺鍮?;
                } else if (groupingSource.includes("硫댁뿭")) {
                    normalizedName = "硫댁뿭??븫?쎈Ъ移섎즺鍮?;
                } else if (groupingSource.includes("?묒꽦??)) {
                    normalizedName = "?묒꽦?먮갑?ъ꽑移섎즺鍮?;
                } else if (groupingSource.includes("以묒엯??)) {
                    normalizedName = "以묒엯?먮갑?ъ꽑移섎즺鍮?;
                } else if (groupingSource.includes("?ㅻ퉰移?) || groupingSource.includes("濡쒕큸")) {
                    normalizedName = "?ㅻ퉰移섎줈遊뉗닔?좊퉬";
                } else if (groupingSource.includes("?멸린議곗젅")) {
                    normalizedName = "?멸린議곗젅諛⑹궗?좎튂猷뚮퉬";
                } else if (groupingSource.includes("?섏닠") && groupingSource.includes("??) && !groupingSource.includes("?ㅻ퉰移?) && !groupingSource.includes("濡쒕큸")) {
                    normalizedName = "?붿닔?좊퉬";
                } else if (groupingSource.includes("?쎈Ъ") && !groupingSource.includes("?쒖쟻") && !groupingSource.includes("硫댁뿭")) {
                    normalizedName = "??븫?쎈Ъ移섎즺鍮?;
                } else if (groupingSource.includes("諛⑹궗??) && !groupingSource.includes("?묒꽦??) && !groupingSource.includes("以묒엯??) && !groupingSource.includes("?멸린")) {
                    normalizedName = "??븫諛⑹궗?좎튂猷뚮퉬";
                } else {
                    // Fallback: Remove special chars
                    normalizedName = groupingSource.replace(/[^媛-??-9]/g, '');
                }

                // 3. Make Display Name pretty if needed (or just use normalized?)
                // Actually, we want to group by "meaning", so removing spaces helps matching "?쒖쟻 ??븫" == "?쒖쟻??븫"

                const amount = parseKoAmount(det.amount); // det.amount: "500留?

                if (!summaryMap.has(normalizedName)) {
                    summaryMap.set(normalizedName, {
                        displayName: normalizedName, // Temporary
                        totalMin: 0,
                        totalMax: 0,
                        items: []
                    });
                }

                const group = summaryMap.get(normalizedName);

                // Amount Parsing (Support Range)
                const valMin = parseKoAmount(det.amount);
                const valMax = det.maxAmount ? parseKoAmount(det.maxAmount) : valMin;

                group.totalMin += valMin;
                group.totalMax += valMax;

                group.items.push({
                    name: det.name,
                    amount: det.amount,
                    maxAmount: det.maxAmount,
                    source: item.name,
                    hiddenInDetail: det.hiddenInDetail
                });

                // Update display name (pick longest readable name)
                const is26JongItem = det.name.includes("26醫?);
                if ((det.name.length > group.displayName.length || group.displayName === normalizedName) && !is26JongItem) {
                    // 愿꾪샇 諛??뱀닔臾몄옄 ?쒓굅 ???덉걶 ?대쫫?쇰줈 ???
                    let cleanName = det.name.replace(/\([^)]*\)/g, '').trim();
                    if (cleanName.length > 0) {
                        group.displayName = cleanName;
                    }
                }
            });
        }
    });

    return summaryMap;
}

// Helper: Get Icon based on coverage name
function getCoverageIcon(name) {
    // 1. Robot (Da Vinci)
    if (name.includes("?ㅻ퉰移?) || name.includes("濡쒕큸")) {
        // Robot Arm / Robot Icon
        return `<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1c1.1 0 2 .9 2 2v6h2v-2c0-1.1.9-2 2-2h1V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v2h1c1.1 0 2 .9 2 2v2h2V9c0-1.1.9-2 2-2h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5V19c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2v-3.5A2.5 2.5 0 0 0 9.5 13m0 2a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5m9 0A2.5 2.5 0 0 0 14 15.5V19c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2v-3.5A2.5 2.5 0 0 0 16.5 13m0 2a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5"/>`;
    }
    // 2. Targeted (Target/Syringe)
    if (name.includes("?쒖쟻")) {
        // Crosshair / Target
        return `<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8m0-14a6 6 0 1 0 6 6 6 6 0 0 0-6-6m0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4"/>`;
    }
    // 3. Immuno/Drug/Chemo (Pill/Medicine)
    if (name.includes("硫댁뿭") || name.includes("?쎈Ъ") || name.includes("26醫?)) {
        // Pill capsule
        return `<path d="M10.5 2a8.5 8.5 0 0 0 0 17 8.5 8.5 0 0 0 0-17m0 2.5a6 6 0 0 1 0 12 6 6 0 0 1 0-12m10.84 5.37-7.41 7.42a2 2 0 0 1-2.83 0l-1.42-1.42a2 2 0 0 1 0-2.83l7.42-7.41a2 2 0 0 1 2.83 0l1.42 1.42a2 2 0 0 1 0 2.83"/>`;
    }
    // 4. Radiation/Proton/Heavy Ion (Radioactive/Atom)
    if (name.includes("諛⑹궗??) || name.includes("?묒꽦??) || name.includes("以묒엯??)) {
        // Radiation / Atom
        return `<path d="M12 2L9 7h6l-3-5m0 20l3-5H9l3 5M4.93 4.93L7.5 9H2.5L4.93 4.93m14.14 0L16.5 9h5l-2.43-4.07M2.5 15h5l-2.57 4.07L2.5 15m19 0h-5l2.57 4.07L21.5 15"/>`;
    }
    // 5. Surgery (Scalpel/Hospital)
    if (name.includes("?섏닠")) {
        return `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14v14m-8.5-2h3v-3.5h3.5v-3h-3.5V6h-3v3.5H6.5v3h3.5z"/>`;
    }
    // 6. Diagnosis (Report/Clipboard)
    if (name.includes("吏꾨떒") || name.includes("移섎즺鍮?)) {
        return `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM6 20V4h8v4h4v12H6m8-10V4.5L18.5 9H14"/>`;
    }

    // Default (Shield/Guard)
    return `<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>`;
}

// Raw List Renderer (Updated for Hierarchical Summary)
function renderResults(results) {
    const listEl = document.getElementById('results-list');
    const summaryGrid = document.getElementById('summary-grid');
    const resultsSection = document.getElementById('results-section');
    const summarySection = document.getElementById('summary-section');
    const emptyState = document.getElementById('empty-state');

    if (!results || results.length === 0) {
        resultsSection.classList.add('hidden');
        summarySection.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    summarySection.classList.remove('hidden');

    // 1. Calculate Hierarchical Summary
    const summaryMap = calculateHierarchicalSummary(results);

    // Calculate Grand Total Range
    let grandTotalMin = 0;
    let grandTotalMax = 0;
    summaryMap.forEach(d => {
        grandTotalMin += d.totalMin;
        grandTotalMax += d.totalMax;
    });

    // 2. Render Summary Grid
    if (summaryMap.size > 0) {
        summaryGrid.innerHTML = '';
        summaryGrid.className = "grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12";

        // Header Title
        const header = document.createElement('div');
        header.className = "col-span-1 sm:col-span-3 text-lg font-black mb-2 flex items-center justify-between";
        header.style.color = "var(--primary-color)";

        let headerAmountStr = formatKoAmount(grandTotalMin);
        if (grandTotalMin !== grandTotalMax) {
            headerAmountStr = `${formatKoAmount(grandTotalMin)} ~ ${formatKoAmount(grandTotalMax)}`;
        }

        header.innerHTML = `?썳截?吏묎퀎????移섎즺 蹂댁옣湲덉븸 ?⑷퀎 <span style="font-size:1.1em; color:var(--primary-dark); margin-left:12px; font-family:'Outfit';">${headerAmountStr}</span>`;
        summaryGrid.appendChild(header);

        // Convert Map to Array and Sort
        const sortedItems = Array.from(summaryMap.entries()).sort((a, b) => {
            const priorities = ["?쒖쟻", "硫댁뿭", "?묒꽦??];
            const getPriority = (n) => {
                for (let i = 0; i < priorities.length; i++) {
                    if (n.includes(priorities[i])) return i;
                }
                return 99;
            };
            return getPriority(a[0]) - getPriority(b[0]);
        });

        sortedItems.forEach(([name, data]) => {
            const card = document.createElement('div');
            card.className = "premium-card p-5 rounded-3xl flex flex-col justify-start gap-4 transition-all duration-300 group";

            // Generate Sub-items HTML
            let subItemsHtml = '';
            data.items.forEach(sub => {
                let amtDisplay = sub.amount;
                if (!amtDisplay.includes('(') && !amtDisplay.includes('~')) {
                    amtDisplay = formatDisplayAmount(sub.amount);
                }
                if (sub.maxAmount && sub.maxAmount !== sub.amount && !amtDisplay.includes('(')) {
                    amtDisplay = `${formatDisplayAmount(sub.amount)}~${formatDisplayAmount(sub.maxAmount)}`;
                }

                subItemsHtml += `
                    <div class="mt-3 pl-4 border-l-3 border-red-500/10 text-xs text-left">
                        <div class="flex items-center justify-between font-bold text-gray-700">
                            <span class="truncate mr-2 flex-1" title="${sub.name}">${sub.name}</span>
                            <span class="text-red-600 whitespace-nowrap flex-shrink-0 font-black">${amtDisplay}</span>
                        </div>
                        <div class="text-[10px] mt-1 truncate font-medium text-gray-400">
                            ??${sub.source}
                        </div>
                    </div>`;
            });

            const icon = getCoverageIcon(name);
            let totalDisplay = formatKoAmount(data.totalMin);
            if (data.totalMin !== data.totalMax) {
                totalDisplay = `${formatKoAmount(data.totalMin)}~${formatKoAmount(data.totalMax)}`;
            }

            card.innerHTML = `
                <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm" style="background:rgba(230,0,0,0.05);">
                            ${icon}
                        </div>
                        <div class="text-right">
                            <p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">COVERAGE TOTAL</p>
                            <p class="text-2xl font-black text-red-600 font-outfit" style="color:var(--primary-bright);">
                                ${totalDisplay}
                            </p>
                        </div>
                    </div>
                    <div class="h-px w-full bg-gray-50"></div>
                    <div>
                        <h4 class="text-sm font-black text-gray-800 mb-1 leading-tight">${name}</h4>
                        <div class="sub-items-container">${subItemsHtml}</div>
                    </div>
                </div>`;
            summaryGrid.appendChild(card);
        });
    }

    // 3. Render Detail List
    listEl.innerHTML = '';

    // Sort results: Items with details come first
    results.sort((a, b) => {
        const hasDetailsA = !!findDetails(a.name);
        const hasDetailsB = !!findDetails(b.name);
        if (hasDetailsA && !hasDetailsB) return -1;
        if (!hasDetailsA && hasDetailsB) return 1;
        return 0;
    });

    results.forEach((item, idx) => {
        let details = findDetails(item.name);

        // Handle Variant Type (Amount-based selection)
        if (details && details.type === 'variant') {
            const amountVal = parseKoAmount(item.amount);
            let variantData = details.data[amountVal.toString()];
            if (!variantData) {
                if (amountVal > 6000) variantData = details.data["8000"] || details.data["10000"];
                else if (amountVal > 3000) variantData = details.data["5000"] || details.data["4000"];
                else if (amountVal > 1000) variantData = details.data["2000"] || details.data["1000"];
            }
            if (!variantData && details.data["10000"]) variantData = details.data["10000"];
            details = variantData;
        }
        // Handle Passthrough Type
        if (details && details.type === 'passthrough') {
            details = [{ name: details.displayName, amount: item.amount }];
        }
        // Handle 26jong Type
        if (details && details.type === '26jong') {
            details = [{ name: details.detailName, amount: item.amount }];
        }

        const itemCard = document.createElement('div');
        itemCard.className = "premium-card rounded-2xl p-4 flex flex-col gap-4 stagger-in cursor-pointer hover:border-red-500/30 transition-all";
        itemCard.style.animationDelay = `${idx * 40}ms`;

        const icon = getCoverageIcon(item.name);

        let detailHtml = '';
        if (details && Array.isArray(details)) {
            detailHtml = `
                <div class="detail-content hidden mt-4 pt-4 border-t border-gray-100">
                    <p class="text-[11px] font-black text-red-600 mb-3 flex items-center gap-1.5">
                        <span class="w-1 h-1 bg-red-600 rounded-full"></span> ?곸꽭 蹂댁옣 ?댁뿭
                    </p>
                    <div class="space-y-3">
            `;
            details.forEach(det => {
                let amtDisplay = det.amount;
                if (!amtDisplay.includes('(') && !amtDisplay.includes('~')) {
                    amtDisplay = formatDisplayAmount(det.amount);
                }
                detailHtml += `
                    <div class="flex flex-col text-[11px] group/sub">
                        <div class="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg">
                            <span class="font-bold text-gray-700 mr-2 flex-1">${det.name}</span>
                            <span class="font-black text-gray-900">${amtDisplay}</span>
                        </div>
                `;
                if (det.sub) {
                    det.sub.forEach(sub => {
                        const parts = sub.trim().split(' ');
                        const subAmount = parts.pop();
                        const subName = parts.join(' ');
                        detailHtml += `
                            <div class="flex justify-between pl-4 mt-1.5 text-[10px] text-gray-400 font-medium">
                                <span>??${subName}</span>
                                <span>${subAmount || ''}</span>
                            </div>
                         `;
                    });
                }
                detailHtml += `</div>`;
            });
            detailHtml += `</div></div>`;
        }

        itemCard.innerHTML = `
            <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 text-base shadow-inner">
                        ${icon}
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4 class="text-sm font-bold text-gray-800 truncate" title="${item.name}">${item.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[11px] font-medium text-gray-400">${item.desc || '媛?낅떞蹂대━?ㅽ듃 異붿텧 ??ぉ'}</p>
                            ${details ? '<span class="text-[9px] font-black text-red-400 bg-red-50 px-1.5 py-0.5 rounded leading-none">?몃??댁뿭 ??/span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <span class="text-lg font-black text-red-600 font-outfit">${formatDisplayAmount(item.amount)}</span>
                </div>
            </div>
            ${detailHtml}
        `;

        if (details) {
            itemCard.addEventListener('click', () => {
                const content = itemCard.querySelector('.detail-content');
                if (content) {
                    content.classList.toggle('hidden');
                    const badge = itemCard.querySelector('.text-red-400');
                    if (badge) badge.textContent = content.classList.contains('hidden') ? '?몃??댁뿭 ?? : '?몃??댁뿭 ??;
                }
            });
        }
        listEl.appendChild(itemCard);
    });
}

// [NEW] Toggle Results List
function toggleResultsList() {
    const list = document.getElementById('results-list');
    const icon = document.getElementById('results-toggle-icon');

    if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        // Add a micro-delay for opacity transition
        setTimeout(() => {
            list.classList.remove('opacity-0');
            list.classList.add('opacity-100');
        }, 10);
        icon.classList.add('rotate-180');
    } else {
        list.classList.add('opacity-0');
        list.classList.remove('opacity-100');
        // Wait for transition before hiding
        setTimeout(() => {
            list.classList.add('hidden');
        }, 400);
        icon.classList.remove('rotate-180');
    }
}



// Helper to find details (Global Scope)
function findDetails(itemName) {
    let details = coverageDetailsMap[itemName];
    if (!details) {
        if (itemName.includes("???듯빀移섎즺鍮?) && (itemName.includes("III") || itemName.includes("??))) {
            details = coverageDetailsMap["?붿쭊?⑤컦移섎즺鍮????듯빀移섎즺鍮껱II)"];
        }
        // [MOVED] 二쇱슂移섎즺 ?곗꽑 泥댄겕 (鍮꾧툒???꾩븸蹂몄씤遺???ㅼ썙?쒓? 寃뱀튂誘濡?癒쇱? ?뺤씤?댁빞 ??
        else if (itemName.includes("???듯빀移섎즺鍮?) && itemName.includes("二쇱슂移섎즺")) {
            details = coverageDetailsMap["???듯빀移섎즺鍮?二쇱슂移섎즺)(鍮꾧툒???꾩븸蹂몄씤遺???ы븿), ?붿쨷?먯튂猷뚭린愿(?곴툒 醫낇빀蹂묒썝 ?ы븿))"];
        }
        else if (itemName.includes("???듯빀移섎즺鍮?) && itemName.includes("鍮꾧툒??) && itemName.includes("?꾩븸蹂몄씤遺??)) {
            details = coverageDetailsMap["???듯빀移섎즺鍮?鍮꾧툒???꾩븸蹂몄씤遺???ы븿), ?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))"];
        }
        else if (itemName.includes("???듯빀移섎즺鍮?) && (itemName.includes("??) || itemName.includes("II")) && itemName.includes("鍮꾧툒??)) {
            details = coverageDetailsMap["???듯빀移섎즺鍮꾟뀫(鍮꾧툒??"];
        }
        else if (itemName.includes("???듯빀移섎즺鍮?) && itemName.includes("湲곕낯??)) {
            details = coverageDetailsMap["???듯빀移섎즺鍮?湲곕낯??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))"];
        }

        else if (itemName.includes("???듯빀移섎즺鍮?) && itemName.includes("?ㅼ냽??)) {
            details = coverageDetailsMap["???듯빀移섎즺鍮??ㅼ냽??(?붿쨷?먯튂猷뚭린愿(?곴툒醫낇빀蹂묒썝 ?ы븿))"];
        }
        else if (itemName.includes("以묒엯?먮갑?ъ꽑")) {
            details = coverageDetailsMap["??븫以묒엯?먮갑?ъ꽑移섎즺鍮?];
        } else if (itemName.includes("?멸린議곗젅諛⑹궗??)) {
            details = coverageDetailsMap["??븫?멸린議곗젅諛⑹궗?좎튂猷뚮퉬"];
        } else if (itemName.includes("硫댁뿭??븫?쎈Ъ") || itemName.includes("硫댁뿭??븫")) {
            details = coverageDetailsMap["?뱀젙硫댁뿭??븫?쎈Ъ?덇?移섎즺鍮?];
        } else if (itemName.includes("?쒖쟻??븫?쎈Ъ") || itemName.includes("?쒖쟻??븫")) {
            details = coverageDetailsMap["?쒖쟻??븫?쎈Ъ?덇?移섎즺鍮?];
        } else if (itemName.includes("?묒꽦?먮갑?ъ꽑") || itemName.includes("?묒꽦??)) {
            details = coverageDetailsMap["??븫?묒꽦?먮갑?ъ꽑移섎즺鍮?];
        } else if (itemName.includes("26醫?)) {
            details = coverageDetailsMap["26醫낇빆?붾갑?ъ꽑諛륁빟臾쇱튂猷뚮퉬"];
        } else if (itemName.includes("?ㅻ퉰移?) && itemName.includes("濡쒕큸")) {
            if (!itemName.includes("?뱀젙??) || itemName.includes("?쒖쇅")) {
                details = coverageDetailsMap["?ㅻ퉰移섎줈遊뉗븫?섏닠鍮?];
            }
        }
    }
    return details;
}

// ?? File Processing ??
async function processFile(file) {
    if (!file) return;

    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('upload-section').style.display = 'none';
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('summary-section').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');

    try {
        let text = '';
        const nameEl = document.getElementById('file-name');
        const sizeEl = document.getElementById('file-size');
        const infoEl = document.getElementById('file-info');

        if (nameEl) nameEl.textContent = file.name;
        if (sizeEl) sizeEl.textContent = (file.size / 1024).toFixed(1) + ' KB';
        if (infoEl) infoEl.classList.remove('hidden');

        const rawTextEl = document.getElementById('raw-text');
        const log = (msg) => {
            console.log(msg);
            if (rawTextEl) rawTextEl.textContent += msg + "\n";
        }

        // Image Mode
        if (file.type.startsWith('image/')) {
            updateProgress(0, '?대?吏 OCR 遺꾩꽍 以鍮?以?..');
            if (typeof Tesseract === 'undefined') throw new Error("Tesseract.js 濡쒕뱶 ?ㅽ뙣");

            const result = await Tesseract.recognize(file, 'kor+eng', {
                logger: m => {
                    if (m?.status === 'recognizing text') {
                        const p = Math.round((m.progress || 0) * 100);
                        updateProgress(p, `?대?吏 ?몄떇 以?.. ${p}%`);
                    }
                }
            });
            text = result?.data?.text || '';
            updateProgress(100, '遺꾩꽍 ?꾨즺!');
        }
        // PDF Mode
        else if (file.type === 'application/pdf') {
            updateProgress(5, 'PDF 遺꾩꽍 以鍮?以?..');
            if (typeof Tesseract === 'undefined') throw new Error("Tesseract.js 濡쒕뱶 ?ㅽ뙣");
            text = await extractTextFromPDF(file, log);
            updateProgress(100, '遺꾩꽍 ?꾨즺!');
        }
        // Debug output
        if (rawTextEl) {
            rawTextEl.textContent = text.substring(0, 5000) + (text.length > 5000 ? '\n...(?댄븯 ?앸왂)' : '');
            document.getElementById('debug-section').classList.remove('hidden');
        }

        // Run Raw Extraction
        const results = extractRawCoverages(text);

        await new Promise(r => setTimeout(r, 500));
        document.getElementById('progress-section').classList.add('hidden');

        renderResults(results);

        if (results.length > 0) {
            showToast(`${results.length}媛쒖쓽 ??ぉ??異붿텧?덉뒿?덈떎.`, false);
        } else {
            showToast('異붿텧????ぉ???놁뒿?덈떎. ?띿뒪???몄떇 寃곌낵瑜??뺤씤?댁＜?몄슂.', true);
        }

    } catch (err) {
        document.getElementById('progress-section').classList.add('hidden');
        document.getElementById('upload-section').style.display = '';
        showToast(err.message || '?ㅻ쪟 諛쒖깮', true);
        console.error(err);
    }
}

// ?? Event Handlers ??
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    const resetBtn = document.getElementById('reset-btn');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
        });
    }

    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('upload-section').style.display = '';
            document.getElementById('file-info').classList.add('hidden');
            document.getElementById('results-section').classList.add('hidden');
            document.getElementById('summary-section').classList.add('hidden');
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('debug-section').classList.add('hidden');
            document.getElementById('progress-section').classList.add('hidden');
            if (fileInput) fileInput.value = '';
        });
    }
});
window.exportToPDF = async function () {
    const { jsPDF } = window.jspdf;
    const summarySection = document.getElementById('summary-section');
    const fileName = document.getElementById('file-name').innerText || '遺꾩꽍寃곌낵';

    // PDF ?앹꽦 以?踰꾪듉 ?④린湲?
    const btn = document.getElementById('export-pdf-btn');
    btn.style.display = 'none';

    try {
        const canvas = await html2canvas(summarySection, {
            scale: 2, // 怨좏빐?곷룄
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // ?대?吏 鍮꾩쑉 怨꾩궛
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // ?쒕ぉ 異붽?
        pdf.setFontSize(16);
        pdf.text(fileName + ' - ??蹂댁옣 遺꾩꽍 寃곌낵', 10, 15);

        // ?대?吏 異붽? (?쒕ぉ ?꾨옒)
        pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, imgHeight);

        pdf.save(fileName + '_遺꾩꽍寃곌낵.pdf');

    } catch (err) {
        console.error('PDF Export Error:', err);
        alert('PDF ?앹꽦 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    } finally {
        // 踰꾪듉 ?ㅼ떆 ?쒖떆
        btn.style.display = 'flex';
    }
};

