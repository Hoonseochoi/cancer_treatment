// ── 로그인 페이지 ──
// 왼쪽: 스마트가입제안서 샘플 지면이 엔딩 크레딧처럼 흘러간다.
// 오른쪽: Supabase Auth(이메일·비밀번호) 로그인 · 회원가입 · 비밀번호 재설정.
// 비밀번호 재설정은 메일 링크로 — 발송은 Supabase 커스텀 SMTP(Brevo, no-reply@surinsur.com).
// 이름·휴대폰 번호는 가입 시 user_metadata(name, phone)에 담는다 — 별도 테이블은 아직 없다.

// ── 왼쪽 전시 ──
(function showcase() {
    const host = document.getElementById('credits');
    if (!host || typeof LOGIN_SHOWCASE === 'undefined' || typeof sheetCss !== 'function') return;
    const C = SHEET_COLOR;

    // 지면 한 장을 그린다. 지면 CSS는 전역 클래스라 보험사마다 섞이지 않게 shadow DOM에 가둔다.
    const sheet = (brand, make, ac, acs) => {
        window.__insurerKey = brand;
        const d = LOGIN_SHOWCASE[brand];
        (d.cancerCards || []).forEach(c => { c.icon = getSheetIcon(c.nm); });
        let html = '';
        try { html = make(d); } catch (e) { return null; }
        const css = sheetCss() + (typeof caregiverSheetCss === 'function' ? caregiverSheetCss() : '');
        const page = document.createElement('div');
        page.className = 'page';
        const root = page.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>:host{display:block}${css}
            .sheet{transform-origin:0 0;transform:scale(var(--s))}</style>
            <div class="sheet" style="--ac:${ac};--acs:${acs}">${html}</div>`;
        return page;
    };
    const brandBlue = b => (SHEET_BRAND[b] || SHEET_BRAND.samsung).blue;
    const A = [
        () => sheet('samsung', sheetSummary, brandBlue('samsung'), '#EDF2FE'),
        () => sheet('meritz', sheetCancer, C.cancer, C.cancerSoft),
        () => sheet('samsung', sheetSurgery, C.surgery, C.surgerySoft),
        () => sheet('meritz', sheetCaregiver, CG_COLOR.c, CG_COLOR.s)
    ];
    const B = [
        () => sheet('meritz', sheetSummary, brandBlue('meritz'), '#FDEEEE'),
        () => sheet('samsung', sheetCancer, C.cancer, C.cancerSoft),
        () => sheet('meritz', sheetCirc, C.brain, C.brainSoft),
        () => sheet('samsung', sheetCirc, C.brain, C.brainSoft)
    ];
    const cols = host.querySelectorAll('.col');
    const fill = (col, list) => {
        const track = col.querySelector('.track');
        // 같은 목록을 두 번 이어 붙여 끊김 없이 돈다(트랙을 절반만큼 올리면 처음과 같은 그림)
        for (let round = 0; round < 2; round++) list.forEach(f => { const p = f(); if (p) track.appendChild(p); });
    };
    fill(cols[0], A);
    fill(cols[1], B);
    window.__insurerKey = '';

    // 칸 폭에 맞춰 지면을 줄인다(1240px 지면 → 칸 폭)
    const fit = () => {
        const W = Math.max(150, Math.min(250, (host.clientWidth - 48 - 18) / 2));
        host.style.setProperty('--w', W + 'px');
        host.querySelectorAll('.page').forEach(p => p.shadowRoot.host.style.setProperty('--s', W / 1240));
        cols[0].style.setProperty('--dur', '70s');
        cols[1].style.setProperty('--dur', '86s');
    };
    fit();
    window.addEventListener('resize', fit);
})();

// ── 로그인 · 회원가입 ──
(function auth() {
    // supabase.js와 같은 프로젝트의 공개(anon) 키 — 브라우저에 노출되는 값이다
    const URL_ = 'https://omgwvnibssizmhovporl.supabase.co';
    const KEY_ = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tZ3d2bmlic3Npem1ob3Zwb3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NzA4MDYsImV4cCI6MjA4NzE0NjgwNn0.Cx9OFo_UAJOB2AnsRUg1FbWAD8avU7ktYIea1z4hCDY';
    const sb = window.supabase ? window.supabase.createClient(URL_, KEY_) : null;

    const $ = id => document.getElementById(id);
    const forms = { login: $('f-login'), signup: $('f-signup'), reset: $('f-reset'), newpw: $('f-newpw') };
    const COPY = {
        login: ['다시 오셨네요', '이메일로 로그인하고 분석을 이어가세요.'],
        signup: ['슈린슈 시작하기', '가입도 분석도 계속 무료예요. 가입하면 하루 5건 제한 없이 쓸 수 있어요.'],
        reset: ['비밀번호 찾기', '가입한 이메일로 재설정 링크를 보내드려요.'],
        newpw: ['새 비밀번호', '앞으로 쓸 비밀번호를 정해 주세요.'],
        done: ['', '']
    };
    const next = new URLSearchParams(location.search).get('next') || 'index.html';

    function setMode(m) {
        Object.entries(forms).forEach(([k, f]) => { f.hidden = k !== m; });
        $('done').hidden = m !== 'done';
        $('seg').hidden = !(m === 'login' || m === 'signup');
        $('seg').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
        if (COPY[m][0]) { $('title').textContent = COPY[m][0]; $('lead').textContent = COPY[m][1]; }
        document.querySelectorAll('.msg').forEach(x => { x.textContent = ''; x.className = 'msg'; });
        const first = forms[m] && forms[m].querySelector('input');
        if (first) first.focus({ preventScroll: true });
    }
    $('seg').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.go)));

    const msg = (id, text, ok) => { const el = $(id); el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); };
    const busy = (form, on) => { const b = form.querySelector('.submit'); b.disabled = on; };

    // Supabase 오류를 사람이 읽는 말로
    function koError(err) {
        const m = String((err && err.message) || err || '');
        if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요.';
        if (/Email not confirmed/i.test(m)) return '메일함의 인증 링크를 먼저 눌러 주세요.';
        if (/already registered|already exists/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
        if (/Password should be/i.test(m)) return '비밀번호가 너무 짧아요. 8자 이상으로 정해 주세요.';
        if (/rate limit|too many/i.test(m)) return '요청이 많아 잠시 막혔어요. 조금 뒤 다시 시도해 주세요.';
        if (/network|fetch/i.test(m)) return '연결이 불안정해요. 인터넷 연결을 확인해 주세요.';
        return '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    }

    // ── 입력 검사 ──
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const pwOk = v => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
    const phoneDigits = v => v.replace(/\D/g, '');
    function fieldState(form, k, text) {
        const f = form.querySelector(`.field[data-k="${k}"]`);
        if (!f) return;
        f.classList.toggle('bad', !!text);
        const h = f.querySelector('.hint');
        if (h) h.textContent = text || '';
    }
    // 휴대폰 번호는 치는 대로 010-0000-0000 꼴로
    ['s-phone'].forEach(id => $(id).addEventListener('input', e => {
        const d = phoneDigits(e.target.value).slice(0, 11);
        e.target.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}`
            : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
    }));
    $('s-more').addEventListener('click', e => {
        e.preventDefault();
        const t = $('s-terms'); t.hidden = !t.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!t.hidden));
        e.currentTarget.textContent = t.hidden ? '내용 보기' : '접기';
    });

    // ── 중복 이메일 확인 ──
    // signup_email_status(DB 함수)는 none / confirmed / pending 셋 중 하나만 돌려준다.
    // 이메일 칸을 벗어날 때 한 번, 가입을 누를 때 한 번 더 본다.
    async function emailStatus(email) {
        if (!sb || !EMAIL_RE.test(email)) return 'none';
        try {
            const { data, error } = await sb.rpc('signup_email_status', { p_email: email });
            return error ? 'none' : (data || 'none');   // 확인이 안 되면 막지 않는다 — signUp이 다시 걸러낸다
        } catch (e) { return 'none'; }
    }
    function showEmailStatus(st) {
        const f = forms.signup.querySelector('.field[data-k="email"]');
        const h = f.querySelector('.hint');
        f.classList.remove('ok');
        if (st === 'confirmed') { fieldState(forms.signup, 'email', '이미 가입된 이메일이에요. 로그인해 주세요.'); return false; }
        if (st === 'pending') {
            fieldState(forms.signup, 'email', '가입 확인 메일을 기다리는 이메일이에요. 메일함의 「가입 확인」을 눌러 주세요.');
            return false;
        }
        fieldState(forms.signup, 'email', '');
        f.classList.add('ok');
        h.textContent = '사용할 수 있는 이메일이에요.';
        return true;
    }
    let lastChecked = '';
    $('s-email').addEventListener('blur', async () => {
        const email = $('s-email').value.trim();
        if (!EMAIL_RE.test(email) || email === lastChecked) return;
        lastChecked = email;
        showEmailStatus(await emailStatus(email));
    });
    $('s-email').addEventListener('input', () => {
        lastChecked = '';
        const f = forms.signup.querySelector('.field[data-k="email"]');
        f.classList.remove('ok', 'bad');
        f.querySelector('.hint').textContent = '';
    });

    function checkSignup() {
        const f = forms.signup;
        const v = { email: $('s-email').value.trim(), pw: $('s-pw').value, pw2: $('s-pw2').value,
                    name: $('s-name').value.trim(), phone: phoneDigits($('s-phone').value) };
        const bad = {
            email: !EMAIL_RE.test(v.email) && '이메일 주소를 확인해 주세요.',
            pw: !pwOk(v.pw) && '영문과 숫자를 섞어 8자 이상으로 정해 주세요.',
            pw2: v.pw2 !== v.pw && '비밀번호가 서로 달라요.',
            name: v.name.length < 2 && '이름을 적어 주세요.',
            phone: !/^01[016789]\d{7,8}$/.test(v.phone) && '휴대폰 번호를 확인해 주세요.'
        };
        Object.keys(bad).forEach(k => fieldState(f, k, bad[k]));
        if (Object.values(bad).some(Boolean)) return null;
        if (!$('s-agree').checked) { msg('s-msg', '개인정보 수집 · 이용에 동의해 주세요.'); return null; }
        return v;
    }

    forms.signup.addEventListener('submit', async e => {
        e.preventDefault();
        const v = checkSignup();
        if (!v || !sb) { if (!sb) msg('s-msg', '로그인 서버에 연결하지 못했어요.'); return; }
        busy(forms.signup, true);
        try {
            const st = await emailStatus(v.email);
            if (!showEmailStatus(st)) {
                msg('s-msg', st === 'pending' ? '가입 확인 메일을 기다리는 이메일이에요.' : '이미 가입된 이메일이에요. 로그인해 주세요.');
                if (st === 'pending') { pendingEmail = v.email; $('d-resend').hidden = true; }
                return;
            }
            const { data, error } = await sb.auth.signUp({
                email: v.email, password: v.pw,
                options: {
                    data: { name: v.name, phone: v.phone, privacy_agreed_at: new Date().toISOString() },
                    emailRedirectTo: location.origin + location.pathname
                }
            });
            if (error) throw error;
            // 이미 가입된 이메일이면 Supabase가 오류 대신 빈 identities를 돌려준다
            if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                msg('s-msg', '이미 가입된 이메일이에요. 로그인해 주세요.');
                return;
            }
            // 메일 인증을 끈 상태(Confirm email OFF)면 가입과 동시에 로그인된다 — 바로 분석 화면으로
            if (data.session) {
                msg('s-msg', '가입을 마쳤어요. 분석 화면으로 이동합니다.', true);
                setTimeout(() => { location.href = next; }, 700);
            }
            else {
                pendingEmail = v.email;
                showDone(null, '인증 메일을 보냈어요', `${v.email} 메일함에서 「가입 확인」 버튼을 누르면 가입이 끝나요. 메일이 안 보이면 스팸함도 확인해 주세요.`);
                $('d-resend').hidden = false;
            }
        } catch (err) { msg('s-msg', koError(err)); }
        finally { busy(forms.signup, false); }
    });

    forms.login.addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('l-email').value.trim(), password = $('l-pw').value;
        if (!EMAIL_RE.test(email) || !password) { msg('l-msg', '이메일과 비밀번호를 입력해 주세요.'); return; }
        if (!sb) { msg('l-msg', '로그인 서버에 연결하지 못했어요.'); return; }
        busy(forms.login, true);
        try {
            $('l-resend').hidden = true;
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) {
                // 메일 인증 전이면 인증 메일을 다시 보낼 수 있게 한다
                if (/Email not confirmed/i.test(error.message)) $('l-resend').hidden = false;
                throw error;
            }
            msg('l-msg', '로그인했어요. 분석 화면으로 이동합니다.', true);
            setTimeout(() => { location.href = next; }, 500);
        } catch (err) { msg('l-msg', koError(err)); }
        finally { busy(forms.login, false); }
    });

    forms.reset.addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('r-email').value.trim();
        if (!EMAIL_RE.test(email)) { msg('r-msg', '이메일 주소를 확인해 주세요.'); return; }
        if (!sb) { msg('r-msg', '로그인 서버에 연결하지 못했어요.'); return; }
        busy(forms.reset, true);
        try {
            const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
            if (error) throw error;
            // 가입 여부를 드러내지 않도록 결과는 같은 문장으로
            msg('r-msg', '가입된 이메일이면 재설정 메일이 도착해요. 메일함(스팸함 포함)을 확인해 주세요.', true);
        } catch (err) { msg('r-msg', koError(err)); }
        finally { busy(forms.reset, false); }
    });

    forms.newpw.addEventListener('submit', async e => {
        e.preventDefault();
        const pw = $('n-pw').value, pw2 = $('n-pw2').value;
        fieldState(forms.newpw, 'pw', !pwOk(pw) && '영문과 숫자를 섞어 8자 이상으로 정해 주세요.');
        fieldState(forms.newpw, 'pw2', pw !== pw2 && '비밀번호가 서로 달라요.');
        if (!pwOk(pw) || pw !== pw2) return;
        busy(forms.newpw, true);
        try {
            const { error } = await sb.auth.updateUser({ password: pw });
            if (error) throw error;
            msg('n-msg', '비밀번호를 바꿨어요. 분석 화면으로 이동합니다.', true);
            setTimeout(() => { location.href = next; }, 800);
        } catch (err) {
            msg('n-msg', /session|JWT|expired/i.test(String(err && err.message))
                ? '링크가 만료됐어요. 비밀번호 찾기에서 메일을 다시 받아 주세요.' : koError(err));
        }
        finally { busy(forms.newpw, false); }
    });

    // ── 인증 메일 다시 보내기 ──
    let pendingEmail = '';
    async function resend(email, msgId, btn) {
        if (!EMAIL_RE.test(email || '')) { msg(msgId, '이메일 주소를 확인해 주세요.'); return; }
        btn.disabled = true;
        try {
            const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: location.origin + location.pathname } });
            if (error) throw error;
            msg(msgId, '인증 메일을 다시 보냈어요. 메일함을 확인해 주세요.', true);
        } catch (err) { msg(msgId, koError(err)); }
        finally { setTimeout(() => { btn.disabled = false; }, 30000); }   // 연타 방지
    }
    $('l-resend').addEventListener('click', e => resend($('l-email').value.trim(), 'l-msg', e.currentTarget));
    $('d-resend').addEventListener('click', e => {
        const d = $('done-d');
        resend(pendingEmail, 'l-msg', e.currentTarget).then(() => { d.textContent = $('l-msg').textContent || d.textContent; });
    });

    function showDone(user, title, desc) {
        const name = user && user.user_metadata && user.user_metadata.name;
        $('done-t').textContent = title;
        $('done-d').textContent = desc || (name ? `${name}님, 이제 분석 횟수 제한 없이 쓸 수 있어요.` : '이제 분석 횟수 제한 없이 쓸 수 있어요.');
        $('logout').hidden = !user;
        $('d-resend').hidden = true;
        $('title').textContent = user ? '환영합니다' : '거의 다 됐어요';
        $('lead').textContent = '';
        setMode('done');
    }
    $('logout').addEventListener('click', async () => {
        if (sb) await sb.auth.signOut();
        setMode('login');
    });

    if (sb) {
        // 메일의 재설정 링크로 들어오면(#...type=recovery) 새 비밀번호 화면을 연다
        const fromRecovery = /type=recovery/.test(location.hash);
        // 가입 확인 메일의 링크로 들어오면(#...type=signup) 그 자리에서 로그인된다 — 환영하고 분석 화면으로
        const fromSignup = /type=(signup|email)/.test(location.hash);
        if (fromRecovery) setMode('newpw');
        sb.auth.onAuthStateChange(evt => { if (evt === 'PASSWORD_RECOVERY') setMode('newpw'); });
        sb.auth.getSession().then(({ data }) => {
            const u = data && data.session && data.session.user;
            if (u && fromSignup) {
                showDone(u, '가입을 마쳤어요');
                setTimeout(() => { location.href = next; }, 1500);
            } else if (u && !fromRecovery && forms.newpw.hidden) showDone(u, '이미 로그인되어 있어요');
        });
        // 링크가 만료됐거나 잘못된 경우 Supabase가 #error=...로 돌려보낸다
        const hp = new URLSearchParams(location.hash.slice(1));
        if (hp.get('error')) {
            setMode('reset');
            msg('r-msg', '링크가 만료됐거나 이미 쓴 링크예요. 메일을 다시 받아 주세요.');
        }
    }
    if (new URLSearchParams(location.search).get('mode') === 'signup') setMode('signup');

    // ── 오류 발생 신고 ──
    const rp = $('report-modal');
    const openReport = () => {
        rp.hidden = false;
        const guess = $('l-email').value.trim() || $('s-email').value.trim() || $('r-email').value.trim();
        if (guess && !$('rp-email').value) $('rp-email').value = guess;
        $('rp-msg').textContent = ''; $('rp-msg').className = 'msg';
        ($('rp-email').value ? $('rp-body') : $('rp-email')).focus();
    };
    const closeReport = () => { rp.hidden = true; $('report-open').focus(); };
    $('report-open').addEventListener('click', openReport);
    rp.addEventListener('click', e => { if (e.target === rp || e.target.closest('[data-close]')) closeReport(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !rp.hidden) closeReport(); });
    $('f-report').addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('rp-email').value.trim(), body = $('rp-body').value.trim();
        if (!EMAIL_RE.test(email)) { msg('rp-msg', '답장 받을 이메일을 확인해 주세요.'); return; }
        if (body.length < 5) { msg('rp-msg', '무슨 일이 있었는지 조금만 더 적어 주세요.'); return; }
        if (!sb) { msg('rp-msg', '서버에 연결하지 못했어요.'); return; }
        busy($('f-report'), true);
        try {
            const { error } = await sb.from('error_reports').insert([{
                email, content: `[로그인 화면] ${body}\n\n— ${navigator.userAgent}`
            }]);
            if (error) throw error;
            msg('rp-msg', '접수했어요. 확인 후 답장 드릴게요.', true);
            $('rp-body').value = '';
            setTimeout(closeReport, 1400);
        } catch (err) { msg('rp-msg', '보내지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
        finally { busy($('f-report'), false); }
    });
})();
