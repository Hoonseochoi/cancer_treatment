// 질문 걸러내기와 캐시 키 만들기. index.ts가 커져 배포가 한 번 실패해 갈라 두었다.
// 브라우저(js/clause_gate.js)에도 같은 규칙이 있지만 그건 우회할 수 있어,
// 실제 차단은 이쪽이 한다.

// ── 남용 차단 ──
// 브라우저에서도 한 번 거르지만 그건 우회할 수 있다. 실제 차단은 여기서 한다.
// 서버에는 색인이 없어 정규식만 쓰므로, 명백한 것만 막고 애매하면 통과시킨다 —
// 진짜 약관 질문을 막는 쪽이 잡담 몇 개를 통과시키는 것보다 나쁘다.
const OTHER_INSURER =
  /메리츠|현대해상|디비손해|DB손해|KB손해|한화손해|롯데손해|MG손해|농협|NH손해|흥국|AXA|악사|하나손해|캐롯|라이나|AIA|처브|동양생명|교보|신한라이프|삼성생명|미래에셋생명|푸본|ABL|KDB생명/i;
const GREETING =
  /^\s*(안녕|하이|헬로|ㅎㅇ|hi|hello|테스트|test|ㅋㅋ+|ㅎㅎ+|\?+|\.+|ㅇㅇ|ㄴㄴ)\s*[!?.~]*\s*$/i;
const OFFTASK = /(코드|파이썬|자바스크립트|번역|시 ?써|소설|레시피|요리|주식|코인|비트코인|로또|운세|게임|영화 ?추천|노래)/;
const CHITCHAT = /(날씨|점심|저녁|밥 ?먹|커피|기분|심심|뭐해|뭐할|누구야|이름이|사랑|시간 ?몇|몇 ?시)/i;
const DOMAIN =
  /담보|특약|약관|보험|보장|진단비|수술비|치료비|입원|통원|일당|면책|감액|보험금|지급|청구|가입금액|갱신|보장개시|[0-9]\s*종|분류표|별표|암|뇌|심장|수술|시술|질병|상해|후유장해|간병|검사비|지원금|한도|소멸|골절|화상|진단|절제|이식|제거술|성형술|치환|감염|전염|합병증|장해|재활|중환자|응급|양성|악성|종양|신생물|탈구|인대|연골|결석|용종|염증|증후군|장애|부전|경화|협착|파열|출혈|경색|색전|혈전|치매|자궁|유방|전립선|갑상선/;

export function gate(q: string): { kind: string; message: string } | null {
  if (OTHER_INSURER.test(q)) {
    return { kind: 'other_insurer',
      message: '이 도구는 삼성화재 New내돈내삼(1640) 약관만 담고 있어, 다른 보험사 약관은 답해드릴 수 없습니다.' };
  }
  if (GREETING.test(q)) {
    return { kind: 'greeting', message: '약관에서 궁금한 것을 물어봐 주세요.' };
  }
  const dom = DOMAIN.test(q);
  if (!dom && OFFTASK.test(q)) {
    return { kind: 'offtask', message: '약관에 대한 질문만 답해드릴 수 있어요.' };
  }
  if (!dom && CHITCHAT.test(q)) {
    return { kind: 'chitchat', message: '약관에서 궁금한 것을 물어봐 주세요.' };
  }
  return null;
}

// 캐시 조회 기준.
// 어절별 조사 제거를 시도했다가 되돌렸다. '했을'의 '을'은 조사가 아니라 어미라
// 함께 잘려, 띄어쓰기가 다르면 오히려 결과가 갈렸다("했을때" vs "했 때").
// 공백과 기호만 털고 문장 끝 말투만 정리한다.
const TAIL = /(입니까|인가요|일까요|은요|알려줘|알려주세요|궁금해요|궁금해|해줘|해주세요|되나요|되요|돼요|나요|나와요|나와|있어요|있어|있나요|있나|뭐야|뭔가요|어떤가요)$/;

export function normalize(q: string): string {
  return q.toLowerCase()
    .replace(/[?!.,·…"'()\[\]{}~\-]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .replace(TAIL, '');
}

// 숫자는 담보를 가른다. "2-109 면책"과 "2-110 면책"은 글자로는 거의 같지만
// 완전히 다른 특약이라, 캐시를 그대로 돌려주면 틀린 답을 준다.
// 실측에서 trigram 유사도만으로는 같은 질문과 다른 질문의 구간이 겹쳤다
// (같은 질문 0.29~0.83 / 다른 질문 0.25~0.47). 그래서 숫자가 다르면 재활용하지 않는다.
export function digitsOf(s: string): string {
  return (s.match(/\d+/g) ?? []).join(',');
}

export async function sha(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

