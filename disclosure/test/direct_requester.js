// 로컬 평가용: 서버 함수를 거치지 않고 OpenRouter를 바로 부른다(서버와 같은 프롬프트·호출 코드). 브라우저에서는 쓰지 않는다.
const { buildRecordPrompt, numberLines } = require('../shared/prompt.mjs');
const { OPENROUTER_MODEL, requestCompletion } = require('../shared/openrouter.mjs');

function directRequester({ rawText, today, apiKey, model = OPENROUTER_MODEL }) {
  const lines = rawText.split('\n');
  const whole = numberLines(lines);
  return targetLines => requestCompletion(
    buildRecordPrompt(whole, today, targetLines ? targetLines.map(n => `${n}: ${lines[n - 1]}`).join('\n') : ''),
    apiKey,
    model,
  );
}

module.exports = { directRequester, OPENROUTER_MODEL };
