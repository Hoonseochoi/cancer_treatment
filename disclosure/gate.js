// 자동고지AI 잠금 화면. 유료 회원에게만 비밀번호를 안내해 공개 범위를 제한한다.
// 정적 사이트라 소스를 뜯어보면 우회할 수 있어 보안장치는 아니다. 그래서 비밀번호 원문은 두지 않고 해시만 비교한다.
// 비밀번호 변경: node -e "console.log(require('crypto').createHash('sha256').update('새비밀번호').digest('hex'))" 결과로 아래 값을 바꾼다.
const UNLOCK_PASSWORD_SHA256 = '6a64129b5dc812a351f9542a65bcb5d3665cbcf149bcf65c373eca3ce486284c';
const UNLOCK_STORAGE_KEY = 'surinsur-disclosure-unlock';

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

(function initUnlockGate() {
  const body = document.body;
  // 비밀번호가 바뀌면 저장된 해시와 달라져 다시 잠긴다.
  let stored = null;
  try { stored = localStorage.getItem(UNLOCK_STORAGE_KEY); } catch (e) { stored = null; }
  if (stored === UNLOCK_PASSWORD_SHA256) {
    body.classList.remove('locked');
    return;
  }

  const input = document.getElementById('unlock-input');
  const button = document.getElementById('unlock-btn');
  const message = document.getElementById('unlock-message');
  const wrap = document.getElementById('unlock-input-wrap');

  const reset = () => {
    button.disabled = !input.value;
    message.textContent = '';
    wrap.classList.remove('is-error');
  };
  reset();
  input.addEventListener('input', reset);

  async function tryUnlock() {
    if (!input.value) return;
    button.classList.add('is-loading');
    const hash = await sha256Hex(input.value);
    button.classList.remove('is-loading');

    if (hash !== UNLOCK_PASSWORD_SHA256) {
      message.textContent = '비밀번호가 맞지 않아요. 안내받은 비밀번호를 다시 확인해주세요';
      wrap.classList.remove('is-error');
      void wrap.offsetWidth; // 연속으로 틀려도 흔들림 애니메이션이 다시 재생되게 한다
      wrap.classList.add('is-error');
      input.select();
      return;
    }

    try { localStorage.setItem(UNLOCK_STORAGE_KEY, hash); } catch (e) { /* 저장이 막혀도 이번 방문은 연다 */ }
    input.value = '';
    body.classList.add('unlocking');
    setTimeout(() => {
      body.classList.remove('locked', 'unlocking');
      document.getElementById('history-input')?.focus();
    }, 380);
  }

  button.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tryUnlock();
    }
  });
  input.focus();
})();
