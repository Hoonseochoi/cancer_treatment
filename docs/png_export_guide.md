# PNG 내보내기 기능 가이드 (PNG Export Guide)

메리츠 암보장 분석기의 분석 결과 보고서를 PNG 이미지로 내보내는 기능에 대한 명세입니다.

## 1. 개요
브라우저에서 보이는 분석 결과 보고서 영역(`#analysis-report-content`)을 캔버스로 변환하여 이미지 파일(.png)로 다운로드할 수 있도록 합니다.

## 2. 주요 기술 및 라이브러리
- **html2canvas**: DOM 요소를 Canvas 객체로 렌더링하는 데 사용됩니다.
- **Vanilla JavaScript**: 이미지 데이터 생성 및 다운로드 로직을 처리합니다.

## 3. 구현 상세
- **함수명**: `uiRenderer.exportAsImage()` 
- **타겟 요소**: `id="analysis-report-content"`
- **동작 방식**:
  1. `html2canvas`를 사용하여 타겟 요소의 스냅샷을 찍습니다.
  2. 생성된 `canvas`를 데이터 URL(`image/png`)로 변환합니다.
  3. 가상 `<a>` 태그를 생성하여 클라이언트 측에서 즉시 다운로드를 트리거합니다.

## 4. 파일명 규칙
- 저장되는 파일명은 `메리츠_암보장_분석결과.png`로 고정되어 있습니다.

## 5. 위치 정보
- 로직: [/js/ui_renderer.js](file:///c:/Users/chlgn/OneDrive/Desktop/%EA%B0%80%EC%9E%85%EC%A0%9C%EC%95%88%EC%84%9CPJ/js/ui_renderer.js)
- 호출부: [/index.html](file:///c:/Users/chlgn/OneDrive/Desktop/%EA%B0%80%EC%9E%85%EC%A0%9C%EC%95%88%EC%84%9CPJ/index.html)
