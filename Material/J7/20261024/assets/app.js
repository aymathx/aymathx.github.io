/* 國七。二段練習 — 學生端 */
'use strict';

let CFG = null;                         // 後端公開設定（要不要通行碼、訪客試用、出處、品牌…）
let TOKEN = store.get('token', null);
let USER = store.get('user', null);
let HOME = null;                        // 首頁資料
let Q = null;                           // 進行中的小節測驗
let M = null;                           // 進行中的模擬卷
let REPORT = null, rvMode = 'wrong', mockSel = 0;
let tick = null;

/* ---------- 畫面切換 ---------- */
function show(name) {
  $$('.screen').forEach(s => { s.hidden = s.id !== 's-' + name; });
  paintBrand(name);
  scrollTo({ top: 0 });
}

function paintBrand(screen) {
  const c = CFG || {};
  $('#loginLogo').hidden = !c.logo;
  $('#s-login .brand').classList.toggle('nologo', !c.logo);
  $('#loginEyebrow').textContent = (c.brand ? c.brandName + '｜' : '') + (c.term || '115年上學期');
  $('#siteTitle').textContent = c.site || '國七。二段練習';
  document.title = (c.term || '115年上學期') + '｜國七。二段';
  const parts = [];
  if (c.logo) parts.push(`<img src="${BRAND_LOGO}" alt="AY MATH 標誌">`);
  if (c.brand) parts.push(`<span class="bn">${esc(c.brandName)}</span>`);
  if (parts.length) parts.push('<span class="sep"></span>');
  parts.push(`<span class="ttl">${esc(c.site || '國七。二段練習')}</span>`);
  $('#appbar').innerHTML = parts.join('');
  $('#appbar').hidden = screen === 'login';
}

function stopTimer() { clearInterval(tick); tick = null; }

/* ---------- 啟動 ---------- */
async function boot() {
  if (TOKEN) {
    try {
      await loadHome();
      const cur = store.get('cur', null);
      if (cur && cur.kind === 'q') return startQuiz(cur.unit, true);
      if (cur && cur.kind === 'm') return startMock(cur.L, true);
      return show('home');
    } catch (e) {
      if (e.server) logoutLocal(e.message); else { showLoginErr(e.message); show('login'); return; }
    }
  }
  CFG = store.get('cfg', null);              // 先用上次存的設定馬上顯示登入頁，不用等伺服器
  renderLogin();
  show('login');
  try {
    CFG = (await api('config')).config; store.set('cfg', CFG);
    if (!$('#s-login').hidden) { renderLogin(); paintBrand('login'); }
  } catch (e) { if (!CFG) showLoginErr(e.message); }
}

function logoutLocal(msg) {
  TOKEN = null; USER = null; HOME = null;
  store.del('token'); store.del('user'); store.del('cur');
  $('#who').value = ''; $('#parse').innerHTML = '';   // 共用電腦：登出後不留上一位的姓名
  if (msg) showLoginErr(msg);
}

function showLoginErr(msg) { const b = $('#loginErr'); b.textContent = msg || ''; b.hidden = !msg; }

/* ---------- 登入 ---------- */
function renderLogin() {
  const c = CFG || {};
  $('#codeBox').hidden = c.needCode === false;            // 還沒讀到設定時先顯示
  $('#guestGo').hidden = !c.guest;
  if (!$('#code').value) $('#code').value = store.get('code', '');
  showParse();
}
/** 通行碼：全形轉半形、去空白、轉大寫（上次登入成功的會記在這台裝置） */
const codeText = () => $('#code').value.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '').toUpperCase();
/** 姓名欄：全形數字轉半形（部分輸入法會打出全形）、拿掉空白 */
const whoText = () => $('#who').value.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '');
function showParse() {
  const v = whoText();
  if (!v) { $('#parse').innerHTML = ''; return false; }
  const m = v.match(/^(\d{3})(\d{2})(\S+)$/);
  $('#parse').innerHTML = m ? `<span class="ok">✓ ${m[1]} 班 ${m[2]} 號　${esc(m[3])}</span>` : '<span class="err">請輸入 5 碼班級座號，接著打姓名，例如 70101陳大田。</span>';
  return !!m;
}
$('#who').addEventListener('input', showParse);
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!showParse()) return;
  if (!$('#codeBox').hidden && !codeText()) return showLoginErr('請輸入老師給的通行碼。');
  showLoginErr('');
  try {
    const r = await run('登入中…', () => api('login', { who: whoText(), code: codeText() }));
    await afterLogin(r);
    if (r.joined) toast('已加入班級名單，以後用同樣的班級座號姓名登入。', 4500);
  } catch (err) { showLoginErr(err.message); }
});
$('#guestGo').onclick = async () => {
  if (!$('#codeBox').hidden && !codeText()) return showLoginErr('請輸入老師給的通行碼。');
  showLoginErr('');
  try { await afterLogin(await run('準備中…', () => api('guest', { code: codeText() }))); } catch (err) { showLoginErr(err.message); }
};
async function afterLogin(r) {
  TOKEN = r.token; USER = r.user; CFG = r.config;
  store.set('token', TOKEN); store.set('user', USER); store.set('code', codeText());
  if (r.home) setHome(r.home); else await run('載入中…', loadHome);
  show('home');
}
$('#logout').onclick = async () => {
  logoutLocal();
  renderLogin(); show('login');
  try { CFG = (await api('config')).config; store.set('cfg', CFG); renderLogin(); paintBrand('login'); } catch (e) { /* 沿用舊設定 */ }
};

/* ---------- 選小節 ---------- */
async function loadHome() { setHome(await api('home', { token: TOKEN })); }
function setHome(h) {
  HOME = h; CFG = HOME.config; USER = HOME.user;
  HOME.offset = HOME.now - Date.now();
  store.set('cfg', CFG);
  renderHome();
}
const leftOf = (deadline, offset) => Math.max(0, Math.round((deadline - (Date.now() + (offset || 0))) / 1000));

function renderHome() {
  const u = HOME.user, g = !!u.guest;
  $('#whoName').textContent = g ? '訪客' : u.name;
  $('#whoClass').textContent = g ? '訪客試用，不保存個人報告' : u.id;
  $('#logout').innerHTML = ICON.out + (g ? '離開' : '登出');
  $('#qminTxt').textContent = HOME.st.qmin;
  $('#mminTxt').textContent = HOME.st.mmin;
  $('#units').innerHTML = HOME.units.map(x => {
    const act = x.active && leftOf(x.active.deadline, HOME.offset) > 0;
    const btn = !x.ready ? '<button class="btn" disabled>題庫準備中</button>'
      : `<button class="btn" data-start="${x.no}">${act ? '繼續作答' : '開始測驗'}${ICON.go}</button>`;
    return `<div class="panel unit">
      <div class="no">${x.no}</div>
      <h3>${esc(x.name)}</h3>
      <div class="go">${btn}</div>
      <div class="meta">${act ? `<span class="resume">作答中，剩 ${mmss(leftOf(x.active.deadline, HOME.offset))}</span>` : ''}<span>${g ? '' : (x.times ? `練習 ${x.times} 次・最高 ${x.best} 分・` : '還沒練習・')}已完成 <b class="mono" style="color:var(--ink)">${g ? '—' : x.cover + '%'}</b></span><div class="bar"><i style="width:${g ? 0 : x.cover}%"></i></div></div>
      <div class="weak">${g ? '' : x.weak.map(w => `<span class="chip t-難">✕ ${esc(w)}</span>`).join('')}</div>
    </div>`;
  }).join('');
  const papers = HOME.papers || [];
  $('#mockPanel').hidden = !papers.length;
  $('#miniMocks').innerHTML = papers.map((p, i) => `<button class="mock" data-mock="${i}" aria-label="${esc(p.name)}">
    <span class="L">${esc(p.L)}</span><span class="lw small">${esc(p.word)}</span>
    <span class="meter">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= p.lv ? 'on' : ''}"></i>`).join('')}</span></button>`).join('');
  $('#histPanel').hidden = g;
  renderHist();
}

/** 我的測驗報告：依小節篩選（全部、2-1～2-4、模擬卷） */
let histSel = '全部';
function renderHist() {
  const tabs = ['全部'].concat(HOME.units.map(u => u.no), ['模擬卷']);
  $('#histTabs').innerHTML = tabs.map(t => `<button type="button" data-ht="${esc(t)}" aria-pressed="${t === histSel}">${esc(t)}</button>`).join('');
  const list = HOME.history.filter(h => histSel === '全部' || (histSel === '模擬卷' ? h.type === '模擬' : h.type !== '模擬' && h.scope === histSel));
  $('#hist').innerHTML = list.length ? list.map(h => {
    const label = h.type === '模擬' ? `模擬${h.scope}卷` : h.scope;
    const ok = h.status === '完成';
    return `<div class="h">
      <div><b>${esc(label)}</b>　<span class="mono small muted">${dt(h.start)}</span><br><span class="small ${ok ? '' : 'x'}">${ok ? h.score + ' 分・' + h.level : '逾時，沒有報告'}</span></div>
      ${ok ? `<div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn ghost sm" data-view="${h.aid}">查看</button><button class="btn ghost sm" data-pdf="${h.aid}">${ICON.down}PDF</button></div>` : ''}
    </div>`;
  }).join('') : `<p class="muted small" style="padding:8px 0">${HOME.history.length ? '這個範圍還沒有報告。' : '完成第一次測驗後，報告會列在這裡。'}</p>`;
}
$('#histTabs').addEventListener('click', e => { const b = e.target.closest('[data-ht]'); if (b) { histSel = b.dataset.ht; renderHist(); } });

$('#units').addEventListener('click', e => { const b = e.target.closest('[data-start]'); if (b) startQuiz(b.dataset.start); });
$('#miniMocks').addEventListener('click', e => { const b = e.target.closest('[data-mock]'); if (b) { mockSel = +b.dataset.mock; renderMocks(); show('mock'); } });
$('#hist').addEventListener('click', async e => {
  const v = e.target.closest('[data-view]');
  if (v) {                                   // 線上看舊的報告（錯題與解析）
    try { REPORT = (await run('讀取報告中…', () => api('report', { token: TOKEN, aid: v.dataset.view }))).report; } catch (err) { return; }
    rvMode = 'wrong'; renderReport(); show('report');
    return;
  }
  const b = e.target.closest('[data-pdf]');
  if (!b) return;
  try {
    await run('產生 PDF 中…', async () => {
      const r = (await api('report', { token: TOKEN, aid: b.dataset.pdf })).report;
      await savePdf(reportPdfHtml(r, CFG), reportFileName(r), pdfOpt(r));
    });
  } catch (err) { /* run 已提示 */ }
});

/* ---------- 小節測驗 ---------- */
async function startQuiz(unit, silent) {
  let r;
  try { r = await run(silent ? '回到作答中…' : '抽題中…', () => api('start', { token: TOKEN, unit })); } catch (e) {
    store.del('cur'); if (HOME) show('home'); return;
  }
  const saved = store.get('att.' + r.aid, null);
  const n = r.questions.length;
  Q = {
    aid: r.aid, unit, deadline: r.deadline, offset: r.now - Date.now(), questions: r.questions,
    answers: saved && saved.answers && saved.answers.length === n ? saved.answers : Array(n).fill(null),
    times: saved && saved.times && saved.times.length === n ? saved.times : Array(n).fill(0),
    cur: 0, enter: Date.now(), done: false
  };
  store.set('cur', { kind: 'q', unit });
  const un = (CFG.units || []).find(x => x.no === unit);
  $('#qSec').textContent = un ? `${un.no} ${un.name}` : unit;
  show('quiz');
  if (r.resumed && !silent) toast('這一節還在作答中，接著上次的進度。');
  renderQ();
  runTimer('#timer', () => Q && leftOf(Q.deadline, Q.offset), timeUp);
}

function runTimer(sel, leftFn, onEnd) {
  stopTimer();
  const paint = () => {
    const left = leftFn();
    if (left === undefined || left === null) return;
    const t = $(sel);
    t.textContent = mmss(left);
    t.className = 'timer' + (left <= 60 ? ' bad' : left <= 300 ? ' warn' : '');
    if (left <= 0) { stopTimer(); onEnd(); }
  };
  paint();
  tick = setInterval(paint, 1000);
}

function saveLocal(att) { store.set('att.' + att.aid, { answers: att.answers, times: att.times || [] }); }
const filled = a => Array.isArray(a) ? a.some(v => v && String(v).trim()) : a !== null && a !== undefined && a !== '';
const answeredN = att => att.answers.filter(filled).length;

function commitTime() {
  if (!Q) return;
  const now = Date.now();
  Q.times[Q.cur] = (Q.times[Q.cur] || 0) + Math.round((now - Q.enter) / 1000);
  Q.enter = now;
}

function paintNav() {
  const n = answeredN(Q), N = Q.questions.length;
  $('#pos').textContent = `已答 ${n} / ${N}`;
  $('#progBar').style.width = (n / N * 100) + '%';
  $('#nav10').innerHTML = Q.questions.map((x, i) => `<button class="qn${filled(Q.answers[i]) ? ' done' : ''}${i === Q.cur ? ' cur' : ''}" data-i="${i}" aria-label="第 ${i + 1} 題">${i + 1}</button>`).join('');
}

const KEYS = ['－', '／', '^', '×', '、', '又', '(', ')'];
function keypad() { return `<div class="keys">${KEYS.map(k => `<button type="button" data-k="${k}" aria-label="輸入 ${k}">${k}</button>`).join('')}</div>`; }
const HINT = '分數打 ／（例：－3／4），帶分數打「又」（例：3又1／4），次方打 ^（例：2^3）。';

/** 填充題的作答區：作答格式「答：⑴{U}單位　⑵{U}公尺」中的 {U} 換成輸入框 */
function fillArea(q, vals, idPrefix) {
  vals = Array.isArray(vals) ? vals : [];
  const parts = String(q.aline || '{U}').split('{U}');
  const single = q.nb === 1 && (q.aline === '{U}' || !q.aline);
  let h;
  if (single) {
    h = `<div class="fill"><label for="${idPrefix}0">你的答案</label><input class="bk wide" id="${idPrefix}0" data-b="0" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(vals[0] || '')}" placeholder="在這裡輸入"><div class="bkpv" data-pv="0"></div></div>`;
  } else {
    // 每一格一列（像選擇題選項一樣直排）：前面是小題代號（⑴、①…），後面是單位
    const n = parts.length - 1, lab = [], unit = [];
    parts.forEach((p, i) => {
      if (i === 0) { lab[0] = p.replace(/^\s*答\s*[：:]\s*/, ''); return; }
      if (i === n) { unit[i - 1] = p; return; }
      const m = p.search(/[①-⑳⑴-⒇]/);
      const s = m >= 0 ? m : Math.max(p.lastIndexOf('，'), p.lastIndexOf('、'), p.lastIndexOf('；'), p.lastIndexOf('　'), p.lastIndexOf(' '));
      unit[i - 1] = s >= 0 ? p.slice(0, s) : p;
      lab[i] = s >= 0 ? p.slice(m >= 0 ? s : s + 1) : '';
    });
    const clean = t => String(t || '').replace(/^[\s　，、；]+|[\s　，、；。]+$/g, '');
    h = '<div class="aline"><span class="lbl">你的答案</span>' + Array.from({ length: n }, (_, i) => {
      const l = clean(lab[i]), u = clean(unit[i]);
      return `<div class="bkrow">${l ? `<span class="bkl">${fmt(l)}</span>` : ''}<input class="bk" id="${idPrefix}${i}" data-b="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(vals[i] || '')}" aria-label="第 ${i + 1} 格">${u ? `<span class="bku">${fmt(u)}</span>` : ''}</div>`;
    }).join('') + '</div><div class="bkpv" data-pv="all"></div>';
  }
  return h;
}

function preview(box, inputs) {
  const items = inputs.map(inp => inp.value).filter(v => /[\^\/／]/.test(v));
  box.innerHTML = items.length ? '顯示為：' + items.map(v => `<b>${fmtTyped(v.replace(/／/g, '/').replace(/－/g, '-'))}</b>`).join('　') : '';
}

function renderQ() {
  const q = Q.questions[Q.cur], N = Q.questions.length;
  paintNav();
  let body;
  if (q.type === 'mc') {
    body = `<div class="opts">${q.opts.map((o, i) => `<button class="opt" data-o="${i}" aria-pressed="${Q.answers[Q.cur] === i}"><b>${LETTERS.charAt(i)}</b><span>${fmt(o)}</span>${ICON.check}</button>`).join('')}</div>`;
  } else {
    body = fillArea(q, Q.answers[Q.cur], 'f') + keypad() + `<p class="hint">${q.set ? '答案不只一個，用「、」隔開。' : ''}${HINT}</p>`;
  }
  const src = CFG.src && q.src ? `<span class="src">【${esc(q.src)}】</span>` : '';
  $('#qcard').innerHTML = `<div class="qhead"><span class="qno">第 ${Q.cur + 1} 題</span>${tierChip(q.tier, CFG.src)}${src}</div>
    <div class="stem">${fmt(q.stem)}</div>${q.fig ? `<img class="fig" src="assets/fig/${esc(q.fig)}" alt="題目附圖"><div class="figtip">點圖可放大</div>` : ''}${body}`;
  $('#prev').disabled = Q.cur === 0;
  $('#nextLabel').textContent = Q.cur === N - 1 ? '完成交卷' : '下一題';
  $('#confirmBox').innerHTML = '';
  if (q.type !== 'mc') { const box = $('#qcard .bkpv'); if (box) preview(box, $$('#qcard .bk')); }
}

function goQ(i) { commitTime(); Q.cur = i; renderQ(); scrollTo({ top: 0 }); }

let lastInput = null;
function readFill(scope) {
  const vals = $$(scope + ' .bk').map(inp => inp.value.trim());
  return vals.some(Boolean) ? vals : null;
}
function insertKey(inp, k) {
  if (!inp) return;
  const s = inp.selectionStart === null ? inp.value.length : inp.selectionStart, en = inp.selectionEnd === null ? s : inp.selectionEnd;
  inp.value = inp.value.slice(0, s) + k + inp.value.slice(en);
  inp.focus(); inp.setSelectionRange(s + k.length, s + k.length);
  inp.dispatchEvent(new Event('input', { bubbles: true }));
}

$('#nav10').addEventListener('click', e => { const d = e.target.closest('.qn'); if (d) goQ(+d.dataset.i); });
$('#qcard').addEventListener('click', e => {
  const o = e.target.closest('.opt');
  if (o) { Q.answers[Q.cur] = +o.dataset.o; saveLocal(Q); renderQ(); return; }
  const k = e.target.closest('[data-k]');
  if (k) insertKey(lastInput && $('#qcard').contains(lastInput) ? lastInput : $('#qcard .bk'), k.dataset.k);
});
$('#qcard').addEventListener('focusin', e => { if (e.target.classList.contains('bk')) lastInput = e.target; });
$('#qcard').addEventListener('input', e => {
  if (!e.target.classList.contains('bk')) return;
  Q.answers[Q.cur] = readFill('#qcard'); saveLocal(Q); paintNav();
  const box = $('#qcard .bkpv'); if (box) preview(box, $$('#qcard .bk'));
});
$('#qcard').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList.contains('bk')) return;
  e.preventDefault();
  const all = $$('#qcard .bk'), i = all.indexOf(e.target);
  if (i < all.length - 1) all[i + 1].focus(); else $('#next').click();
});
$('#prev').onclick = () => { if (Q.cur > 0) goQ(Q.cur - 1); };
$('#next').onclick = () => {
  const N = Q.questions.length;
  if (Q.cur < N - 1) { goQ(Q.cur + 1); return; }
  const miss = N - answeredN(Q);
  $('#confirmBox').innerHTML = `<div class="confirm"><b>${miss ? `還有 ${miss} 題沒作答，確定交卷？` : '已全部作答，確定交卷？'}</b><div class="row"><button class="btn ghost" id="backQ">回去作答</button><button class="btn" id="sureQ">確定交卷</button></div></div>`;
  $('#backQ').onclick = () => { if (miss) goQ(Q.answers.findIndex(a => !filled(a))); else $('#confirmBox').innerHTML = ''; };
  $('#sureQ').onclick = submitQuiz;
};

async function submitQuiz() {
  if (!Q || Q.done) return;
  commitTime();
  let r;
  try { r = await run('改分中…', () => api('submit', { token: TOKEN, aid: Q.aid, answers: Q.answers, times: Q.times })); } catch (e) { return; }
  stopTimer();
  Q.done = true;
  store.del('att.' + Q.aid); store.del('cur');
  if (r.timeout) return timeUp();
  REPORT = r.report; rvMode = 'wrong';
  renderReport(); show('report');
  loadHome().catch(() => { });
}

function timeUp() {
  stopTimer();
  const kind = M && !M.done ? 'm' : 'q';
  const att = kind === 'm' ? M : Q;
  if (att) { att.done = true; store.del('att.' + att.aid); }
  store.del('cur');
  $('#toMsg').textContent = kind === 'm' ? `${HOME.st.mmin} 分鐘內沒有交卷，這次不計分。` : `${HOME.st.qmin} 分鐘內沒有交卷，這次不計分。`;
  $('#timeout').dataset.kind = kind;
  $('#timeout').hidden = false;
}
$('#retry').onclick = () => {
  $('#timeout').hidden = true;
  if ($('#timeout').dataset.kind === 'm') startMock(M.L); else startQuiz(Q.unit);
};
$('#toHome2').onclick = async () => { $('#timeout').hidden = true; await run('載入中…', loadHome).catch(() => { }); show('home'); };

/* ---------- 分析報告 ---------- */
function renderReport() {
  const r = REPORT, guest = HOME && HOME.user.guest;
  $('#rScore').innerHTML = `${r.score}<small>／100</small>`;
  $('#rLevel').textContent = r.level; $('#rLevel').className = 'level lv-' + r.level;
  $('#rMeta').innerHTML = `${esc(r.title)}<br>用時 <span class="mono">${mmss(r.used)}</span>・答對 ${r.nRight}／${r.n}<br>平均每題 <span class="mono">${r.avgSec}</span> 秒${r.type === '練習' ? `・快速作答 <span class="mono">${r.fast}</span> 題` : ''}`;
  $('#rLine').textContent = r.line;
  $('#rNextPanel').hidden = !(r.next && r.next.length);
  $('#rNext').innerHTML = (r.next || []).map(x => `<li>${esc(x)}</li>`).join('');
  const tr = trendHtml(r.trend, r.start);
  $('#rTrend').hidden = !tr;
  $('#rTrend').innerHTML = tr ? `<h2>近幾次分數</h2>${tr}` : '';
  $('#rSecs').hidden = !r.secs;
  if (r.secs) $('#rSecs').innerHTML = `<h2 style="margin-bottom:6px">各小節答對率</h2>${r.secs.map(s => hbar(`${s.no} ${s.name}`, pct(s.c, s.n), colorFor(pct(s.c, s.n)), `${s.c}／${s.n}`)).join('')}`;
  $('#rGoalPanel').hidden = !r.goals.length || r.type === '模擬';
  $('#rGoals').innerHTML = r.goals.map(goalRow).join('');
  $('#rvAll').textContent = `全部 ${r.n} 題`;
  $$('#rvSeg button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.rv === rvMode)));
  renderReview();
  $('#again').innerHTML = ICON.redo + (r.type === '模擬' ? '再寫一次這份' : '再練 10 題');
  $('#dl').hidden = !!guest;
}
function renderReview() {
  const r = REPORT;
  $('#rvList').style.backgroundImage = wmBg((r.uid.indexOf('G-') === 0 ? '訪客試用' : r.uid + ' ' + r.name) + '　' + dshort(Date.now()));
  const items = r.items.map((it, i) => ({ it, i })).filter(({ it }) => rvMode === 'all' || !it.right);
  $('#rvList').innerHTML = items.map(({ it, i }) => reviewItem(it, i + 1, r.src)).join('') || '<p class="muted" style="padding:8px 0">全對，沒有錯題。</p>';
}
$('#rvSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-rv]'); if (!b) return;
  rvMode = b.dataset.rv;
  $$('#rvSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderReview();
});
/** 學生下載的 PDF：每頁學號姓名浮水印、頁尾警語 */
function pdfOpt(r) {
  return { wm: `${r.uid} ${r.name}　${dt(Date.now(), true)}`, note: '僅供本班學生個人練習，請勿轉傳或公開' };
}
$('#again').onclick = () => { if (REPORT.type === '模擬') startMock(REPORT.scope); else startQuiz(REPORT.scope); };
$('#dl').onclick = async () => {
  try { await run('產生 PDF 中…', () => savePdf(reportPdfHtml(REPORT, CFG), reportFileName(REPORT), pdfOpt(REPORT))); } catch (e) { /* run 已提示 */ }
};
$('#toHome').onclick = () => { renderHome(); show('home'); };

/* ---------- 段考模擬：選卷 ---------- */
function renderMocks() {
  const papers = HOME.papers || [];
  if (!papers.length) { $('#mocks').innerHTML = ''; $('#paper').innerHTML = '<p class="muted">模擬卷準備中。</p>'; return; }
  mockSel = Math.min(mockSel, papers.length - 1);
  $('#mocks').innerHTML = papers.map((m, i) => `<button class="mock" data-mi="${i}" aria-pressed="${i === mockSel}">
    <span class="L">${esc(m.L)}</span><span class="lw small">${esc(m.word)}</span>
    <span class="meter">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= m.lv ? 'on' : ''}"></i>`).join('')}</span>
    ${m.best !== null ? `<span class="best">最高 ${m.best}</span>` : ''}</button>`).join('');
  const m = papers[mockSel];
  const act = m.active && leftOf(m.active.deadline, HOME.offset) > 0;
  $('#paper').innerHTML = `<h3>${esc(m.name)}</h3>
    <div class="hd"><span>範圍 <b>2-1～2-4</b></span><span>時間 <b>${HOME.st.mmin} 分鐘</b></span><span>滿分 <b>100 分</b></span><span>難度 <b>${esc(m.word)}</b></span></div>
    ${m.times ? `<p class="small muted" style="text-align:center">已寫過 ${m.times} 次，最高 ${m.best} 分</p>` : ''}
    <div><button class="btn wide" data-mstart="${esc(m.L)}">${act ? '繼續作答（剩 ' + mmss(leftOf(m.active.deadline, HOME.offset)) + '）' : '開始作答'}${ICON.go}</button></div>
    <p class="small muted" style="text-align:center">按下開始就計時，中途離開時間照樣會走。</p>`;
}
$('#mocks').addEventListener('click', e => { const b = e.target.closest('.mock'); if (b) { mockSel = +b.dataset.mi; renderMocks(); } });
$('#paper').addEventListener('click', e => { const b = e.target.closest('[data-mstart]'); if (b) startMock(b.dataset.mstart); });
$('#mockBack').onclick = () => show('home');

/* ---------- 段考模擬：作答 ---------- */
async function startMock(L, silent) {
  let r;
  try { r = await run(silent ? '回到作答中…' : '準備試卷中…', () => api('mockStart', { token: TOKEN, paper: L })); } catch (e) {
    store.del('cur'); if (HOME) show('home'); return;
  }
  const saved = store.get('att.' + r.aid, null);
  const n = r.questions.length;
  M = {
    aid: r.aid, L, deadline: r.deadline, offset: r.now - Date.now(), questions: r.questions, paper: r.paper,
    answers: saved && saved.answers && saved.answers.length === n ? saved.answers : Array(n).fill(null), times: [], done: false
  };
  store.set('cur', { kind: 'm', L });
  $('#mqName').textContent = r.paper.name;
  renderMockPaper();
  show('mquiz');
  if (r.resumed && !silent) toast('這份模擬卷還在作答中，接著上次的進度。');
  runTimer('#mtimer', () => M && leftOf(M.deadline, M.offset), timeUp);
}

function renderMockPaper() {
  const idx = {};
  M.questions.forEach((q, i) => { idx[q.qid] = i; });
  let no = 0;
  $('#mpaper').innerHTML = `<div class="paper" style="padding:16px 18px"><h3>${esc(M.paper.name)}</h3>
    <div class="hd"><span>範圍 <b>2-1～2-4</b></span><span>時間 <b>${HOME.st.mmin} 分鐘</b></span><span>滿分 <b>100 分</b></span></div></div>` +
    M.paper.parts.map(pt => `<div class="panel mpart"><h3>${esc(pt.title)}</h3>${pt.qids.map(id => {
      const i = idx[id], q = M.questions[i];
      if (!q) return '';
      no++;
      const body = q.type === 'mc'
        ? `<div class="opts">${q.opts.map((o, j) => `<button class="opt" data-q="${i}" data-o="${j}" aria-pressed="${M.answers[i] === j}"><b>${LETTERS.charAt(j)}</b><span>${fmt(o)}</span>${ICON.check}</button>`).join('')}</div>`
        : `<div data-fq="${i}">${fillArea(q, M.answers[i], 'm' + i + '_')}</div>`;
      return `<div class="mq rv" id="mq${i}"><div class="stem"><span class="qno">${no}.</span>${fmt(q.stem)}</div>${q.fig ? `<img class="fig" src="assets/fig/${esc(q.fig)}" alt="題目附圖"><div class="figtip">點圖可放大</div>` : ''}${body}</div>`;
    }).join('')}</div>`).join('');
  $('#mkeys').innerHTML = KEYS.map(k => `<button type="button" data-k="${k}" aria-label="輸入 ${k}">${k}</button>`).join('');
  paintMockPos();
}
function paintMockPos() { $('#mpos').textContent = `已答 ${answeredN(M)} / ${M.questions.length}`; }

$('#mpaper').addEventListener('click', e => {
  const o = e.target.closest('.opt');
  if (!o) return;
  const i = +o.dataset.q;
  M.answers[i] = +o.dataset.o; saveLocal(M);
  o.parentElement.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-pressed', String(b === o)));
  paintMockPos();
});
$('#mpaper').addEventListener('input', e => {
  const box = e.target.closest('[data-fq]');
  if (!box || !e.target.classList.contains('bk')) return;
  const i = +box.dataset.fq;
  const vals = Array.from(box.querySelectorAll('.bk')).map(inp => inp.value.trim());
  M.answers[i] = vals.some(Boolean) ? vals : null; saveLocal(M); paintMockPos();
  const pv = box.querySelector('.bkpv'); if (pv) preview(pv, Array.from(box.querySelectorAll('.bk')));
});
let mLast = null;
$('#mpaper').addEventListener('focusin', e => { if (e.target.classList.contains('bk')) { mLast = e.target; $('#mkeys').hidden = false; } });
$('#mkeys').addEventListener('mousedown', e => e.preventDefault());
$('#mkeys').addEventListener('click', e => { const k = e.target.closest('[data-k]'); if (k && mLast) insertKey(mLast, k.dataset.k); });
$('#msubmit').onclick = () => {
  const miss = M.questions.length - answeredN(M);
  $('#mconfirm').innerHTML = `<div class="confirm"><b>${miss ? `還有 ${miss} 題沒作答，確定交卷？` : '已全部作答，確定交卷？'}</b><div class="row"><button class="btn ghost" id="mback">回去作答</button><button class="btn" id="msure">確定交卷</button></div></div>`;
  $('#mback').onclick = () => { $('#mconfirm').innerHTML = ''; const i = M.answers.findIndex(a => !filled(a)); const el = $('#mq' + i); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  $('#msure').onclick = submitMock;
};
async function submitMock() {
  if (!M || M.done) return;
  let r;
  try { r = await run('改分中…', () => api('mockSubmit', { token: TOKEN, aid: M.aid, answers: M.answers, times: [] })); } catch (e) { return; }
  stopTimer();
  M.done = true;
  store.del('att.' + M.aid); store.del('cur');
  $('#mconfirm').innerHTML = '';
  if (r.timeout) return timeUp();
  REPORT = r.report; rvMode = 'wrong';
  renderReport(); show('report');
  loadHome().catch(() => { });
}

/* ---------- 附圖：點了放大（手機上小字看不清楚時用） ---------- */
document.addEventListener('click', e => {
  const im = e.target.closest('img.fig');
  if (!im || im.closest('#pdfStage')) return;
  const ov = document.createElement('div');
  ov.className = 'zoomov';
  ov.innerHTML = `<span>點一下關閉</span><img src="${im.src}" alt="放大的題目附圖">`;
  const w = im.naturalWidth || im.width;
  const fit = innerWidth - 24;                       // 小圖放大到最多兩倍；大圖最多到螢幕寬的 1.8 倍，再大可以手指放大
  ov.querySelector('img').style.width = (w < fit ? Math.min(w * 2, fit) : Math.min(w, Math.round(innerWidth * 1.8))) + 'px';
  ov.onclick = () => ov.remove();
  document.body.appendChild(ov);
});

boot();
