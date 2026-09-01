// ── 슈린슈 AI 약관 검색 (화면) ──
// 검색은 clause_search.js가 브라우저에서 돌려 "힌트"만 만들고, 답변은 Edge Function이
// 만든다. 모델 키를 브라우저에 둘 수 없기 때문이다.
//
// 이용 코드도 같은 이유로 여기서 맞춰 보지 않는다. 코드를 이 파일에 적으면 소스
// 보기로 그대로 읽히므로, 입력값을 서버에 넘겨 서버가 판정한다.

const CHAT_FN = 'https://omgwvnibssizmhovporl.supabase.co/functions/v1/ask-clause';
const SB_ANON = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : '';

// ?test=1 로 들어오면 답변 아래에 토큰·왕복·힌트 적중을 같이 띄운다.
// 어떤 질문이 비싼지, 힌트가 빗나갔는지 눈으로 보고 고치기 위한 것이다.
const TEST_MODE = new URLSearchParams(location.search).get('test') === '1';

let accessCode = sessionStorage.getItem('sr_code') || '';
let history = [];                 // 모델에 넘길 최근 대화 (2턴만)
let busy = false;
const sessionId = (() => {
    let s = sessionStorage.getItem('sr_sid');
    if (!s) { s = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem('sr_sid', s); }
    return s;
})();

const $ = id => document.getElementById(id);

// ── 입장 ──
async function verify(code) {
    const res = await fetch(CHAT_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SB_ANON}` },
        body: JSON.stringify({ access_code: code, verify_only: true })
    });
    if (res.status === 401) return { ok: false, msg: '이용 코드가 올바르지 않습니다.' };
    if (!res.ok) return { ok: false, msg: '지금은 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
    return { ok: true };
}

async function unlock(e) {
    e.preventDefault();
    const btn = $('gate-btn'), err = $('gate-err');
    const code = $('code').value.trim();
    if (!code) return false;
    btn.disabled = true; err.textContent = '';
    const r = await verify(code);
    btn.disabled = false;
    if (!r.ok) { err.textContent = r.msg; $('code').select(); return false; }
    accessCode = code;
    sessionStorage.setItem('sr_code', code);
    openChat();
    return false;
}

function openChat() {
    $('gate').style.display = 'none';
    $('app').style.display = 'flex';
    $('q').focus();
}

// 이미 통과한 세션이면 잠금을 건너뛴다
if (accessCode) {
    verify(accessCode).then(r => { if (r.ok) openChat(); else sessionStorage.removeItem('sr_code'); });
}

// ── 입력 ──
function grow(t) {
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 170) + 'px';
    $('send').disabled = !t.value.trim() || busy;
}

function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
}

function resetChat() {
    history = [];
    $('thread').innerHTML = '';
    $('thread').appendChild(helloBlock());
}

let _hello = null;
function helloBlock() {
    if (!_hello) _hello = $('hello').cloneNode(true);
    return _hello.cloneNode(true);
}
_hello = $('hello') ? $('hello').cloneNode(true) : null;

// ── 아주 작은 마크다운 → HTML ──
// 모델이 표와 목록을 쓰므로 그 정도만 처리한다. 라이브러리를 더 얹을 이유가 없다.
function esc(s) {
    return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function md(src) {
    const lines = esc(src).split('\n');
    const out = [];
    let list = null, table = null;

    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const closeTable = () => {
        if (table) {
            const [head, ...rows] = table;
            out.push('<table><thead><tr>' + head.map(c => `<th>${c}</th>`).join('') +
                '</tr></thead><tbody>' +
                rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') +
                '</tbody></table>');
            table = null;
        }
    };
    const inline = s => s
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    for (const raw of lines) {
        const line = raw.trimEnd();
        const cells = line.trim().match(/^\|(.+)\|$/);
        if (cells) {
            const row = cells[1].split('|').map(c => inline(c.trim()));
            if (row.every(c => /^:?-{2,}:?$/.test(c))) continue;   // 구분선
            (table || (table = [])).push(row);
            continue;
        }
        closeTable();

        if (!line.trim()) { closeList(); continue; }
        let m;
        if ((m = line.match(/^#{1,4}\s+(.*)$/))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
        if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
            if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
            out.push(`<li>${inline(m[1])}</li>`); continue;
        }
        if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
            if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
            out.push(`<li>${inline(m[1])}</li>`); continue;
        }
        closeList();
        out.push(`<p>${inline(line)}</p>`);
    }
    closeList(); closeTable();
    return out.join('');
}

// ── 말풍선 ──
function bubble(who, html) {
    const t = document.createElement('div');
    t.className = 'turn ' + who;
    t.innerHTML = who === 'ai'
        ? `<span class="ava"><img src="surinsur.png" alt=""></span><div class="bub">${html}</div>`
        : `<div class="bub">${html}</div>`;
    $('thread').appendChild(t);
    const s = $('scroll');
    s.scrollTop = s.scrollHeight;
    return t.querySelector('.bub');
}

// ── 질문 ──
async function ask(preset) {
    if (busy) return;
    const box = $('q');
    const text = (preset || box.value).trim();
    if (!text) return;

    const hello = $('hello');
    if (hello) hello.remove();

    busy = true;
    box.value = ''; grow(box);
    $('send').disabled = true;
    bubble('me', esc(text).replace(/\n/g, '<br>'));

    // 규칙 검색이 만든 힌트. 답을 정하는 게 아니라 모델이 첫 시도에 맞출 확률을 올린다.
    // 색인이 무언가 찾았는지는 "약관 질문인가"를 가리는 데도 쓴다.
    let hint = null, found = false;
    try {
        const r = clauseSearch(text, 6);
        found = r.cards.length > 0 || r.terms.length > 0;
        hint = {
            담보: r.cards.map(c => `${c.card.n} ${c.card.t}`),
            분류표: r.terms.slice(0, 6).map(t =>
                `${t.code}${t.tier ? ` ${t.tier}종` : ''} ${t.name}`),
            읽을대목: [...new Set(r.read.map(x => x.sec))]
        };
        if (!hint.담보.length && !hint.분류표.length) hint = null;
    } catch (e) { /* 힌트는 없어도 답변은 가능하다 */ }

    // 약관과 무관한 질문은 여기서 끊는다. 서버도 다시 보지만, 부르지 않고 끝내면
    // 즉시 답이 나오고 호출 비용도 들지 않는다.
    const blocked = (typeof clauseGate === 'function') ? clauseGate(text, found) : null;
    if (blocked) {
        bubble('ai', `<div class="err">${blocked.message}</div>`);
        busy = false; grow(box);
        $('scroll').scrollTop = $('scroll').scrollHeight;
        return;
    }

    const slot = bubble('ai', '<div class="think"><i></i><i></i><i></i></div>');

    try {
        const res = await fetch(CHAT_FN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SB_ANON}` },
            body: JSON.stringify({
                question: text, history, hint, test: TEST_MODE,
                session_id: sessionId, access_code: accessCode
            })
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
            sessionStorage.removeItem('sr_code');
            slot.innerHTML = `<div class="err">이용 코드가 만료되었습니다. 새로고침 후 다시 입력해 주세요.</div>`;
        } else if (!res.ok || !data.answer) {
            slot.innerHTML = `<div class="err">${esc(data.error || '답변을 만들지 못했습니다.')}
                ${data.detail ? `<br><small>${esc(String(data.detail).slice(0, 160))}</small>` : ''}</div>`;
        } else if (data.blocked) {
            slot.innerHTML = `<div class="err">${data.answer}</div>`;
        } else {
            slot.innerHTML = md(data.answer) + (data.cached
                ? '<p style="margin-top:8px;font-size:11px;color:var(--faint)">이전에 받은 같은 질문의 답변입니다.</p>'
                : '') + (data.cards?.length
                ? `<div class="cite"><b>근거</b>${data.cards.map(n => `<span>${esc(n)}</span>`).join('')}</div>`
                : '') + traceHtml(data);
            history.push({ role: 'user', content: text });
            history.push({ role: 'assistant', content: data.answer });
            history = history.slice(-4);           // 최근 2턴만 — 토큰을 아낀다
        }
    } catch (e) {
        slot.innerHTML = `<div class="err">연결에 실패했습니다. 잠시 후 다시 시도해 주세요.</div>`;
    } finally {
        busy = false;
        grow(box);
        $('scroll').scrollTop = $('scroll').scrollHeight;
    }
}


// ── 테스트 모드 표시 ──
// 답이 이상할 때 무엇 때문인지 바로 보이게 한다. 힌트가 빗나갔는지, 모델이 엉뚱한
// 대목을 읽었는지, 원문을 얼마나 실어 보냈는지가 한 줄에 다 있어야 고칠 수 있다.
function traceHtml(data) {
    if (!TEST_MODE) return '';
    const t = data.trace;
    const el = [];
    if (data.cached) {
        el.push(`캐시 재사용 · 유사도 ${data.sim ?? '-'}`);
    } else if (t) {
        el.push(`입력 ${(data.tokens?.in ?? 0).toLocaleString()} · 출력 ${(data.tokens?.out ?? 0).toLocaleString()} 토큰`);
        el.push(`지침 ${t.prompt_chars.toLocaleString()}자 · 원문 ${t.evidence_chars.toLocaleString()}자`);
        el.push(`왕복 ${t.hops}회 · ${data.latency_ms}ms`);
        if (t.hint_hit === true) el.push('힌트 적중');
        else if (t.hint_hit === false) el.push(`<b style="color:#B4392F">힌트 빗나감</b> (${(t.hint_cards || []).join(', ') || '없음'})`);
        (t.tool_calls || []).forEach(c => {
            el.push(`읽음: ${(c.no || []).join(',')} / ${(c.section || []).join(',')}` +
                    (c.found ? ` → ${c.chars.toLocaleString()}자` : ' → <b style="color:#B4392F">못 찾음</b>'));
        });
    } else {
        return '';
    }
    return `<div style="margin-top:10px;padding:9px 12px;border:1px dashed var(--line);
        border-radius:10px;background:var(--panel);font-size:11px;line-height:1.85;color:var(--muted)">
        <b style="color:var(--ink-2)">TEST</b> ${el.join(' · ')}</div>`;
}
