// 질문 걸러내기와 캐시 키 만들기.
//
// 브라우저(js/clause_gate.js)에도 같은 성격의 검사가 있지만 그건 우회할 수 있어,
// 실제 차단은 이쪽이 한다. 다만 역할이 다르다 — 브라우저는 색인을 갖고 있어
// "약관 질문인가"를 제대로 판정할 수 있지만, 여기에는 색인이 없다.
//
// 그래서 어휘 목록으로 도메인을 판정하려던 것을 걷어냈다. 아무리 넓혀도 새는 게
// 생기고(실측: "특정감염병 종류"가 막혔다), 그때마다 낱말을 더하는 건 끝이 없다.
// 여기서는 누가 봐도 약관 질문이 아닌 것만 막고, 애매하면 통과시킨다.
// 진짜 약관 질문을 막는 쪽이 잡담 몇 개를 통과시키는 것보다 나쁘다.

const OTHER_INSURER =
  /메리츠|현대해상|디비손해|DB손해|KB손해|한화손해|롯데손해|MG손해|농협|NH손해|흥국|AXA|악사|하나손해|캐롯|라이나|AIA|처브|동양생명|교보|신한라이프|삼성생명|미래에셋생명|푸본|ABL|KDB생명/i;

// 인사말·의미 없는 입력. 그것만으로 이루어진 경우에만 막는다.
const GREETING =
  /^\s*(안녕|하이|헬로|ㅎㅇ|hi|hello|테스트|test|ㅋㅋ+|ㅎㅎ+|\?+|\.+|ㅇㅇ|ㄴㄴ|음+|아+)\s*[!?.~]*\s*$/i;

// 모델에게 다른 일을 시키려는 시도. 이 도구는 약관만 본다.
const OFFTASK =
  /(코드 ?(짜|써|작성)|파이썬|자바스크립트|프로그램 ?(짜|만들)|번역해|시 ?써|소설 ?써|레시피|요리법|주식|코인|비트코인|로또|운세|사주|게임 ?추천|영화 ?추천|노래 ?추천|그림 ?그려)/;

// 명백한 잡담. 짧은 입력일 때만 본다 — 긴 질문에 '밥' 한 글자가 섞였다고
// 막으면 안 된다.
const CHITCHAT =
  /(날씨|점심 ?뭐|저녁 ?뭐|밥 ?먹었|커피 ?마|기분 ?어|심심|뭐해|뭐할|누구야|이름이 ?뭐|사랑해|몇 ?시야)/i;

export function gate(q: string): { kind: string; message: string } | null {
  const t = q.trim();

  // 이 도구는 삼성화재 New내돈내삼(1640) 약관만 갖고 있다. 타사를 물으면
  // 답할 근거가 없어 지어내게 되므로 여기서 끊는다.
  if (OTHER_INSURER.test(t)) {
    return {
      kind: 'other_insurer',
      message: '이 도구는 삼성화재 New내돈내삼(1640) 약관만 담고 있어, 다른 보험사 약관은 답해드릴 수 없습니다.',
    };
  }
  if (GREETING.test(t)) {
    return { kind: 'greeting', message: '약관에서 궁금한 것을 물어봐 주세요.' };
  }
  if (OFFTASK.test(t)) {
    return { kind: 'offtask', message: '약관에 대한 질문만 답해드릴 수 있어요.' };
  }
  if (t.length <= 20 && CHITCHAT.test(t)) {
    return { kind: 'chitchat', message: '약관에서 궁금한 것을 물어봐 주세요.' };
  }
  return null;
}

// 캐시 조회 기준.
// 어절별 조사 제거를 시도했다가 되돌렸다. '했을'의 '을'은 조사가 아니라 어미라
// 함께 잘려, 띄어쓰기가 다르면 오히려 결과가 갈렸다("했을때" vs "했 때").
// 공백과 기호만 털고 문장 끝 말투만 정리한다.
const TAIL =
  /(입니까|인가요|일까요|은요|알려줘|알려주세요|궁금해요|궁금해|해줘|해주세요|되나요|되요|돼요|나요|나와요|나와|있어요|있어|있나요|있나|뭐야|뭔가요|어떤가요)$/;

export function normalize(q: string): string {
  return q.toLowerCase()
    .replace(/[?!.,·…"'()\[\]{}~\-]/g, '')
    .replace(/[\s　]+/g, '')
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
