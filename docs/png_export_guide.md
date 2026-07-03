# PNG 내보내기 기능 가이드 (PNG Export Guide)

GA 암보장 분석기의 분석 결과 보고서를 PNG 이미지로 내보내는 기능에 대한 명세입니다.

## 1. 개요
브라우저에서 보이는 분석 결과 보고서 중 파일 정보(`#file-info`), 인사이트(`#insight-section`), 요약(`#summary-section`) 영역만 오프스크린 클론으로 재구성한 뒤, 이를 이미지로 캡처하여 PNG 파일(.png)로 다운로드할 수 있도록 합니다.

## 2. 주요 기술 및 라이브러리
- **dom-to-image-more** (1차/주 캡처 엔진): 브라우저가 실제로 렌더링한 DOM을 SVG `foreignObject` 기반으로 캡처하여, 화면에 보이는 모습과 결과물이 최대한 일치하도록 합니다.
- **html2canvas** (2차/폴백 캡처 엔진): dom-to-image-more가 실패하거나 타임아웃되거나 결과 이미지가 비정상적으로 작을 경우 대신 사용됩니다. html2canvas는 CSS를 자체적으로 재해석(근사)하여 캔버스에 그리기 때문에, 일부 스타일(그라디언트, 그림자, 폰트 렌더링 등)이 화면과 미묘하게 다르게 나올 수 있어 1차 수단에서 2차 수단으로 격하되었습니다.
- **Vanilla JavaScript**: 오프스크린 클론 생성, Blob 변환, 다운로드 트리거 등 전체 로직을 처리합니다.

> 참고: 과거에는 html2canvas 단독으로 캡처했으나, html2canvas의 CSS 근사 렌더링 방식 때문에 내보낸 이미지가 실제 화면 렌더링과 시각적으로 어긋나는 문제가 있었습니다. 이를 해결하기 위해 실제 브라우저 렌더링을 그대로 보존하는 dom-to-image-more를 주 캡처 엔진으로 도입하고, html2canvas는 안전망(폴백)으로만 남겼습니다. 이 과정에서 실제로는 사용되지 않던 `jspdf`(PDF 저장) 라이브러리도 함께 제거되었습니다 — 현재 이 앱에는 PDF 내보내기 기능이 없고, 이미지(PNG) 내보내기만 존재합니다.

## 3. 구현 상세
- **함수명**: `window.exportAsImage()` (`js/ui_renderer.js`)
- **타겟 요소**: `document.querySelector('main')` 전체를 클론한 뒤, `buildCaptureClone()` 함수가 그 안에서 `#file-info`, `#insight-section`, `#summary-section` 세 영역만 남기고 나머지 자식 요소는 숨깁니다. 각 섹션 내부의 버튼(초기화 버튼, PDF/이미지 저장 버튼)이나 오류 제보 아일랜드처럼 캡처에 불필요한 UI 요소도 함께 숨깁니다.
- **동작 방식**:
  1. 업로드된 파일명, 전문가 이름을 DOM에서 읽고, surinsur.com QR 코드를 미리 생성(Base64)합니다.
  2. `buildCaptureClone()`으로 화면 밖(`position: fixed; left: -99999px`)에 오프스크린 클론을 만들고, 지정된 3개 섹션만 노출시킨 뒤 `<details>` 요소를 모두 펼치고 애니메이션/트랜지션을 제거합니다. QR 코드는 인사이트 카드에 삽입됩니다.
  3. 레이아웃과 이미지가 안정화되도록 두 프레임(`requestAnimationFrame`)을 대기합니다.
  4. **1차**: `domtoimage.toBlob(clone, { scale: 3, bgcolor: '#EBEBEB', ... })`을 최대 20초 타임아웃(`raceWithTimeout`)으로 시도합니다. 결과 Blob이 없거나 5000바이트 미만이면 실패로 간주합니다.
  5. **2차(폴백)**: 1차가 실패/타임아웃되면 동일한 클론에 대해 `html2canvas(clone, { scale: 3, useCORS: true, backgroundColor: '#EBEBEB', ... })`로 캡처한 뒤 `canvas.toBlob()`으로 PNG Blob을 얻습니다.
  6. 얻어진 Blob으로 `URL.createObjectURL()`을 생성하고, 가상 `<a>` 태그의 `download` 속성에 파일명을 지정해 클릭 이벤트로 다운로드를 트리거합니다. 다운로드 후 10초 뒤 `URL.revokeObjectURL()`로 메모리를 정리합니다.
  7. 캡처 성공/실패와 무관하게 `finally` 블록에서 오프스크린 클론을 DOM에서 제거(`cleanup()`)합니다.

## 4. 파일명 규칙
- 파일명은 고정값이 아니라 업로드된 원본 PDF 파일명을 기준으로 동적으로 생성됩니다.
- `#file-name` 요소의 텍스트에서 `.pdf` 확장자를 제거한 값을 `originalName`으로 사용하고, 최종 파일명은 `${originalName} 분석.png` 형태입니다. (예: `홍길동_제안서.pdf` 업로드 시 → `홍길동_제안서 분석.png`)
- 파일명을 읽어올 수 없는 경우 기본값 `분석결과`를 사용하여 `분석결과 분석.png`로 저장됩니다.

## 5. 위치 정보
- 로직: [/js/ui_renderer.js](file:///c:/Users/chlgn/OneDrive/Desktop/%EA%B0%80%EC%9E%85%EC%A0%9C%EC%95%88%EC%84%9CPJ/js/ui_renderer.js) — `buildCaptureClone()`, `raceWithTimeout()`, `window.exportAsImage()`
- 라이브러리 로드: [/index.html](file:///c:/Users/chlgn/OneDrive/Desktop/%EA%B0%80%EC%9E%85%EC%A0%9C%EC%95%88%EC%84%9CPJ/index.html) — `html2canvas`, `dom-to-image-more` CDN `<script>` 태그
