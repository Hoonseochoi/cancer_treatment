// ── Configuration & PDF.js ──
// PDF.js worker setup
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
const defaultConfig = {
    main_title: "암 치료비 보장금액 분석 ( 테스트 )",
    subtitle_text: "가입제안서 PDF를 업로드하면, 보장내역 중 암 치료비 파트만 추출 합니다",
    upload_button_text: "PDF 파일을 드래그하거나 클릭하세요",
    result_header_text: "전체 보장 내역 분석 결과",
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
// ── RAW Extraction Logic ──
// 모든 텍스트 줄을 분석하되, 특정 범위(가입담보리스트 ~ 주의사항) 내에서만 추출
// + 노이즈 필터링 강화

let currentFileName = ""; // Global state for conditional mapping

const coverageDetailsMap = {
    // 4. 비급여(상급종합병원 포함)형
    "암 통합치료비(비급여(전액본인부담 포함), 암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "8000": [
                { name: "(매회) (비급여)다빈치로봇수술비", amount: "1,000만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "3,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "6,000만" },
                { name: "(연1회) (비급여) 양성자방사선 치료비", amount: "3,000만" }
            ],
            "5000": [
                { name: "(매회) (비급여)다빈치로봇수술비", amount: "750만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "2,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "4,000만" },
                { name: "(연1회) (비급여) 양성자방사선 치료비", amount: "2,000만" }
            ],
            "2000": [
                { name: "(매회) (비급여)다빈치로봇수술비", amount: "500만" },
                { name: "(연1회) (비급여) 표적항암약물치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 면역항암약물치료비", amount: "2,000만" },
                { name: "(연1회) (비급여) 양성자방사선 치료비", amount: "1,000만" }
            ]
        }
    },
    // 1. 기본형 (사용자 요청 통일 + 금액별 분기)
    "암 통합치료비(기본형)(암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "10000": [ // 1억원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "2,000만",
                    sub: ["(매회) (급여/비급여) 암 수술비 1,000만", "(매회) (비급여) 다빈치 로봇 수술 1,000만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "1,000만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "7,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만", "(연1회) (비급여) 면역 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자 방사선 치료비 3,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                }
            ],
            "8000": [ // 8천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "750만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "1,500만",
                    sub: ["(매회) (급여/비급여) 암 수술비 750만", "(매회) (비급여) 다빈치 로봇 수술 750만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "750만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "4,750만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 2,000만", "(연1회) (비급여) 면역 항암 약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만", "(연1회) (비급여) 양성자 방사선 치료비 2,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                }
            ],
            "4000": [ // 4천만원 (기존 데이터)
                { name: "(매회) (급여/비급여) 암 수술비", amount: "500만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (급여/비급여) 암 수술비 500만", "(매회) (비급여) 다빈치 로봇 수술 500만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "500만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "2,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만", "(연1회) (비급여) 면역 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만", "(연1회) (비급여) 양성자 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                }
            ]
        }
    },
    // 1-1. 실속형
    "암 통합치료비(실속형)(암중점치료기관(상급종합병원 포함))": {
        "type": "variant",
        "data": {
            "7000": [ // 7천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (급여/비급여) 암 수술비 1,000만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "1,000만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "1,000만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "2,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "3,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 1,000만", "(연1회) (비급여) 면역 항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "2,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 1,000만"]
                }
            ],
            "5000": [ // 5천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "750만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "750만",
                    sub: ["(매회) (급여/비급여) 암 수술비 750만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "750만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "750만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 750만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "2,150만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적 항암 약물 치료비 750만", "(연1회) (비급여) 면역 항암 약물 치료비 750만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만", "(연1회) (비급여) 양성자 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 750만"]
                }
            ],
            "3000": [ // 3천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "500만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "500만",
                    sub: ["(매회) (급여/비급여) 암 수술비 500만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "500만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "500만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 500만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적 항암 약물 치료비 500만", "(연1회) (비급여) 면역 항암 약물 치료비 500만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만", "(연1회) (비급여) 양성자 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 500만"]
                }
            ],
            "1000": [ // 1천만원
                { name: "(매회) (급여/비급여) 암 수술비", amount: "250만" },
                {
                    name: "(매회) 다빈치 로봇 수술비",
                    amount: "250만",
                    sub: ["(매회) (급여/비급여) 암 수술비 250만"]
                },
                { name: "(연1회) (급여/비급여) 항암 약물 치료비", amount: "250만" },
                { name: "(연1회) (급여/비급여) 항암 방사선 치료비", amount: "250만" },
                {
                    name: "(연1회) 표적 항암 약물 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 250만", "(연1회) (비급여) 표적 항암 약물 치료비 250만"]
                },
                {
                    name: "(연1회) 면역 항암 약물 치료비",
                    amount: "750만",
                    sub: ["(연1회) (급여/비급여) 항암 약물 치료비 250만", "(연1회) (비급여) 표적 항암 약물 치료비 250만", "(연1회) (비급여) 면역 항암 약물 치료비 250만"]
                },
                {
                    name: "(연1회) 양성자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 250만", "(연1회) (비급여) 양성자 방사선 치료비 250만"]
                },
                {
                    name: "(연1회) 중입자 방사선 치료비",
                    amount: "250만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 250만"]
                },
                {
                    name: "(연1회) 세기조절방사선치료비",
                    amount: "250만",
                    sub: ["(연1회) (급여/비급여) 항암 방사선 치료비 250만"]
                }
            ]
        }
    },
    // 2. 비급여형
    "암 통합치료비Ⅱ(비급여)": {
        "type": "variant",
        "data": {
            "10000": [ // 1억원
                { name: "(매회) (비급여) 암 수술비", amount: "1,000만" },
                {
                    name: "(매회) (비급여) 다빈치 로봇 수술비",
                    amount: "2,000만",
                    sub: ["(매회) (비급여) 암 수술비 1,000만", "(매회) (비급여) 다빈치 로봇수술 1,000만"]
                },
                { name: "(연1회) (비급여) 항암 방사선 치료비", amount: "1,000만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "1,000만" },
                {
                    name: "(연1회) (비급여) 표적 항암 약물 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) (비급여) 면역 항암 약물 치료비",
                    amount: "7,000만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적 항암 약물 치료비 3,000만", "(연1회) (비급여) 면역 항암 약물 치료비 3,000만"]
                },
                {
                    name: "(연1회) (비급여) 양성자 방사선 치료비",
                    amount: "4,000만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자 방사선 치료비 3,000만"]
                },
                {
                    name: "(연1회) (비급여) 중입자 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 세기조절 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 1,000만"]
                }
            ],
            "7000": [ // 7천만원
                { name: "(매회) (비급여) 암 수술비", amount: "750만" },
                {
                    name: "(매회) (비급여) 다빈치 로봇 수술비",
                    amount: "1,500만",
                    sub: ["(매회) (비급여) 암 수술비 750만", "(매회) (비급여) 다빈치 로봇수술 750만"]
                },
                { name: "(연1회) (비급여) 항암방사선 치료비", amount: "750만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "750만" },
                {
                    name: "(연1회) (비급여) 표적항암약물치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적항암약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) (비급여) 면역항암 약물 치료비",
                    amount: "4,750만",
                    sub: ["(연1회) (비급여) 항암약물 치료비 750만", "(연1회) (비급여) 표적항암 약물치료비 2,000만", "(연1회) (비급여) 면역항암 약물 치료비 2,000만"]
                },
                {
                    name: "(연1회) (비급여) 양성자 방사선 치료비",
                    amount: "2,750만",
                    sub: ["(연1회) (비급여) 항암방사선 치료비 750만", "(연1회) (비급여) 양성자 방사선 치료비 2,000만"]
                },
                {
                    name: "(연1회) (비급여) 중입자 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 750만"]
                },
                {
                    name: "(연1회) (비급여) 세기조절 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 750만"]
                }
            ],
            "4000": [ // 4천만원
                { name: "(매회) (비급여) 암 수술비", amount: "500만" },
                {
                    name: "(매회) (비급여) 다빈치 로봇 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (비급여) 암 수술비 500만", "(매회) (비급여) 다빈치 로봇수술 500만"]
                },
                { name: "(연1회) (비급여) 항암방사선 치료비", amount: "500만" },
                { name: "(연1회) (비급여) 항암 약물 치료비", amount: "500만" },
                {
                    name: "(연1회) (비급여) 표적항암약물치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적항암약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 면역항암 약물 치료비",
                    amount: "2,500만",
                    sub: ["(연1회) (비급여) 항암약물 치료비 500만", "(연1회) (비급여) 표적항암 약물치료비 1,000만", "(연1회) (비급여) 면역항암 약물 치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 양성자 방사선 치료비",
                    amount: "1,500만",
                    sub: ["(연1회) (비급여) 항암방사선 치료비 500만", "(연1회) (비급여) 양성자 방사선 치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 중입자 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 500만"]
                },
                {
                    name: "(연1회) (비급여) 세기조절 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 500만"]
                }
            ]
        }
    },
    // 3. 암 통합치료비 III (Range Type)
    "암진단및치료비(암 통합치료비III)": {
        "type": "variant",
        "data": {
            "5000": [
                { name: "(연1회) 표적항암약물치료비", amount: "2,000만(3,000만)", maxAmount: "3,000만" },
                { name: "(연1회) 면역항암약물치료비", amount: "2,000만(3,000만)", maxAmount: "3,000만", hiddenInDetail: true },
                { name: "(연1회) 양성자 방사선 치료비", amount: "2,000만(3,000만)", maxAmount: "3,000만" }
            ],
            "4000": [
                { name: "(연1회) 표적항암약물치료비", amount: "1,000만(3,000만)", maxAmount: "3,000만" },
                { name: "(연1회) 면역항암약물치료비", amount: "1,000만(3,000만)", maxAmount: "3,000만", hiddenInDetail: true },
                { name: "(연1회) 양성자 방사선 치료비", amount: "1,000만(3,000만)", maxAmount: "3,000만" }
            ]
        }
    },
    // 4. 10년갱신 개별 담보 (passthrough: 자기 자신의 금액을 그대로 사용)
    "항암중입자방사선치료비": {
        type: "passthrough",
        displayName: "(최초1회) 중입자방사선치료비"
    },
    "항암세기조절방사선치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 세기조절방사선치료비"
    },
    "특정면역항암약물허가치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 면역항암약물치료비"
    },
    "표적항암약물허가치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 표적항암약물치료비"
    },
    "항암양성자방사선치료비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 양성자방사선치료비"
    },
    // [NEW] 다빈치로봇 암수술비
    "다빈치로봇암수술비": {
        type: "passthrough",
        displayName: "(10년갱신)(최초1회) 다빈치 로봇 수술비"
    },
    // [NEW] 암 통합치료비 (주요치료) - 비급여 (7천/5천/3천)
    "암 통합치료비(주요치료)(비급여(전액본인부담 포함), 암중점치료기관(상급 종합병원 포함))": {
        "type": "variant",
        "data": {
            "7000": [
                {
                    name: "(매회) (비급여) 암 수술비",
                    amount: "1,000만",
                    sub: ["(매회) (비급여) 암 수술비 1,000만", "(매회) (비급여) 다빈치 로봇수술 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 항암 방사선 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 1,000만", "(연1회) (비급여) 양성자방사선치료비 1,000만", "(연1회) (비급여) 중입자방사선치료비 1,000만", "(연1회) (비급여) 세기조절방사선치료비 1,000만"]
                },
                {
                    name: "(연1회) (비급여) 항암 약물 치료비",
                    amount: "1,000만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 1,000만", "(연1회) (비급여) 표적항암약물치료비 1,000만", "(연1회) (비급여) 면역항암약물치료비 1,000만"]
                }
            ],
            "5000": [
                {
                    name: "(매회) (비급여) 암 수술비",
                    amount: "750만",
                    sub: ["(매회) (비급여) 암 수술비 750만", "(매회) (비급여) 다빈치 로봇수술 750만"]
                },
                {
                    name: "(연1회) (비급여) 항암 방사선 치료비",
                    amount: "750만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 750만", "(연1회) (비급여) 양성자방사선치료비 750만", "(연1회) (비급여) 중입자방사선치료비 750만", "(연1회) (비급여) 세기조절방사선치료비 750만"]
                },
                {
                    name: "(연1회) (비급여) 항암 약물 치료비",
                    amount: "750만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 750만", "(연1회) (비급여) 표적항암약물치료비 750만", "(연1회) (비급여) 면역항암약물치료비 750만"]
                }
            ],
            "3000": [
                {
                    name: "(매회) (비급여) 암 수술비",
                    amount: "500만",
                    sub: ["(매회) (비급여) 암 수술비 500만", "(매회) (비급여) 다빈치 로봇수술 500만"]
                },
                {
                    name: "(연1회) (비급여) 항암 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 500만", "(연1회) (비급여) 양성자방사선치료비 500만", "(연1회) (비급여) 중입자방사선치료비 500만", "(연1회) (비급여) 세기조절방사선치료비 500만"]
                },
                {
                    name: "(연1회) (비급여) 항암 약물 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적항암약물치료비 500만", "(연1회) (비급여) 면역항암약물치료비 500만"]
                }
            ],
            "2000": [
                {
                    name: "(매회) (비급여) 암 수술비",
                    amount: "500만",
                    sub: ["(매회) (비급여) 암 수술비 500만", "(매회) (비급여) 다빈치 로봇수술 500만"]
                },
                {
                    name: "(연1회) (비급여) 항암 방사선 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 방사선 치료비 500만", "(연1회) (비급여) 양성자방사선치료비 500만", "(연1회) (비급여) 중입자방사선치료비 500만", "(연1회) (비급여) 세기조절방사선치료비 500만"]
                },
                {
                    name: "(연1회) (비급여) 항암 약물 치료비",
                    amount: "500만",
                    sub: ["(연1회) (비급여) 항암 약물 치료비 500만", "(연1회) (비급여) 표적항암약물치료비 500만", "(연1회) (비급여) 면역항암약물치료비 500만"]
                }
            ]
        }
    },
    // 4. 26종 항암방사선및약물치료비 (여러 카테고리에 동시 반영)
    "26종항암방사선및약물치료비": {
        type: "26jong",
        detailName: "26종 항암방사선 및 약물 치료비",
        summaryItems: [
            { name: "(최대 26회) 26종 항암 방사선 치료비", targetName: "항암방사선치료비" },
            { name: "(최대 26회) 26종 항암 약물 치료비", targetName: "항암약물치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "표적항암약물치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "면역항암약물치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "양성자방사선치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "중입자방사선치료비" },
            { name: "(최대 26회) 26종항암방사선치료비", targetName: "세기조절방사선치료비" }
        ]
    }
};

// Helper: Get Icon based on coverage name
function getCoverageIcon(name) {
    // 1. Robot (Da Vinci)
    if (name.includes("다빈치") || name.includes("로봇")) {
        // Robot Arm / Robot Icon
        return `<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1c1.1 0 2 .9 2 2v6h2v-2c0-1.1.9-2 2-2h1V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v2h1c1.1 0 2 .9 2 2v2h2V9c0-1.1.9-2 2-2h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5V19c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2v-3.5A2.5 2.5 0 0 0 9.5 13m0 2a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5m9 0A2.5 2.5 0 0 0 14 15.5V19c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2v-3.5A2.5 2.5 0 0 0 16.5 13m0 2a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-.5.5.5.5 0 0 1-.5-.5v-3.5a.5.5 0 0 1 .5-.5"/>`;
    }
    // 2. Targeted (Target/Syringe)
    if (name.includes("표적")) {
        // Crosshair / Target
        return `<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8m0-14a6 6 0 1 0 6 6 6 6 0 0 0-6-6m0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4"/>`;
    }
    // 3. Immuno/Drug/Chemo (Pill/Medicine)
    if (name.includes("면역") || name.includes("약물") || name.includes("26종")) {
        // Pill capsule
        return `<path d="M10.5 2a8.5 8.5 0 0 0 0 17 8.5 8.5 0 0 0 0-17m0 2.5a6 6 0 0 1 0 12 6 6 0 0 1 0-12m10.84 5.37-7.41 7.42a2 2 0 0 1-2.83 0l-1.42-1.42a2 2 0 0 1 0-2.83l7.42-7.41a2 2 0 0 1 2.83 0l1.42 1.42a2 2 0 0 1 0 2.83"/>`;
    }
    // 4. Radiation/Proton/Heavy Ion (Radioactive/Atom)
    if (name.includes("방사선") || name.includes("양성자") || name.includes("중입자")) {
        // Radiation / Atom
        return `<path d="M12 2L9 7h6l-3-5m0 20l3-5H9l3 5M4.93 4.93L7.5 9H2.5L4.93 4.93m14.14 0L16.5 9h5l-2.43-4.07M2.5 15h5l-2.57 4.07L2.5 15m19 0h-5l2.57 4.07L21.5 15"/>`;
    }
    // 5. Surgery (Scalpel/Hospital)
    if (name.includes("수술")) {
        return `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14v14m-8.5-2h3v-3.5h3.5v-3h-3.5V6h-3v3.5H6.5v3h3.5z"/>`;
    }
    // 6. Diagnosis (Report/Clipboard)
    if (name.includes("진단") || name.includes("치료비")) {
        return `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM6 20V4h8v4h4v12H6m8-10V4.5L18.5 9H14"/>`;
    }
    // Default (Shield/Guard)
    return `<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4m0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>`;
}

