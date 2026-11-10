// 자동고지AI 이용 권한 — 로그인한 회원만 쓰고, 승인 회원이 아니면 평생 3회까지 무료다(초기화 없음).
// 이 화면 잠금은 안내일 뿐이고, 실제 차단과 횟수 차감은 서버(Edge Function disclosure-extract)가 한다.
// 로그인 세션은 메인 사이트(login.html)와 같은 수파베이스 프로젝트라 브라우저에 저장된 것을 그대로 쓴다.
const ACCESS_SUPABASE_URL = 'https://omgwvnibssizmhovporl.supabase.co';
// js/supabase.js와 같은 공개(anon) 키 — 로그인 세션을 읽고 함수 게이트웨이를 통과하는 데만 쓴다
const ACCESS_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZ3d2bmlic3Npem1ob3Zwb3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzA4MDYsImV4cCI6MjA4NzE0NjgwNn0.Cx9OFo_UAJOB2AnsRUg1FbWAD8avU7ktYIea1z4hCDY';
const ACCESS_LOGIN_URL = '../login.html?next=disclosure/';
const ACCESS_SIGNUP_URL = '../login.html?mode=signup&next=disclosure/';

const DisclosureAccess = (function () {
  const sb = window.supabase ? window.supabase.createClient(ACCESS_SUPABASE_URL, ACCESS_SUPABASE_ANON) : null;
  const $ = id => document.getElementById(id);
  let status = null; // { approved, used, limit, remaining }

  function lock(message, { login = false, contact = false } = {}) {
    // 이미 정리 결과를 보고 있으면 화면을 잠가 결과를 가리지 않는다(안내는 토스트·이용 안내 줄로)
    const content = $('al-content');
    if (content && !content.classList.contains('landing-mode')) return;
    document.body.classList.add('locked');
    $('lock-message').innerHTML = message;
    $('lock-actions').hidden = !login;
    $('lock-contact').hidden = !contact;
  }

  function unlock() {
    if (!document.body.classList.contains('locked')) return;
    document.body.classList.add('unlocking');
    setTimeout(() => {
      document.body.classList.remove('locked', 'unlocking');
      const input = $('history-input');
      if (input) input.focus();
    }, 380);
  }

  function renderUsage() {
    const note = $('usage-note');
    if (!note || !status) return;
    note.hidden = false;
    if (status.approved) {
      note.textContent = '승인 회원 · 횟수 제한 없이 이용할 수 있어요';
      return;
    }
    const contact = '승인 문의 <a href="mailto:contact@surinsur.com">contact@surinsur.com</a>';
    note.innerHTML = status.remaining > 0
      ? `무료 이용 <b>${status.remaining}회</b> 남음 · ${contact}`
      : `무료 이용을 모두 사용했어요 · ${contact}`;
  }

  const showLogin = () => lock('로그인한 회원만 이용할 수 있어요.<br>모든 회원은 <b>3회</b>까지 무료로 이용할 수 있어요.', { login: true });
  const showLimit = () => lock('무료 이용 3회를 모두 사용했어요.<br><b>승인된 회원만 이용가능합니다</b>', { contact: true });
  const showError = () => lock('이용 정보를 확인하지 못했어요.<br>잠시 후 새로고침해주세요.');

  async function token() {
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      return (data && data.session && data.session.access_token) || null;
    } catch (e) {
      return null;
    }
  }

  async function init() {
    $('lock-login').href = ACCESS_LOGIN_URL;
    $('lock-signup').href = ACCESS_SIGNUP_URL;
    const accessToken = await token();
    if (!accessToken) {
      showLogin();
      return;
    }
    try {
      const res = await fetch(DISCLOSURE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, apikey: ACCESS_SUPABASE_ANON },
        body: JSON.stringify({ action: 'status' }),
      });
      if (res.status === 401) {
        showLogin();
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      status = await res.json();
    } catch (e) {
      console.error('이용 정보 확인 실패:', e);
      showError();
      return;
    }
    renderUsage();
    if (!status.approved && status.remaining <= 0) {
      showLimit();
      return;
    }
    unlock();
  }

  const ready = init();

  return {
    ready,
    token,
    anonKey: ACCESS_SUPABASE_ANON,
    newRunId: () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`),
    // 정리를 마친 뒤 서버가 알려준 남은 횟수로 안내를 고친다(0회가 돼도 지금 결과는 그대로 둔다)
    applyResult(meta) {
      if (!meta || !status) return;
      if (typeof meta.approved === 'boolean') status.approved = meta.approved;
      if (meta.remaining !== undefined) status.remaining = meta.remaining;
      renderUsage();
    },
    showLimit() {
      if (status) status.remaining = 0;
      renderUsage();
      showLimit();
    },
    showLogin,
  };
})();
