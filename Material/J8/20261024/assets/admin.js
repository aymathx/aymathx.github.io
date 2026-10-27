/* 國八。二段練習 — 老師端（teacher.html）與補習班主任唯讀檢視（director.html） */
'use strict';

const ROLE = document.body.dataset.role;              // teacher | director
const TK = ROLE === 'teacher' ? 't.token' : 'd.token';
let TOKEN = store.get(TK, null);
let D = null;                                          // tAll／dAll 回傳的資料
let view = ROLE === 'teacher' ? 'overview' : 'dir';
const LVN = ['精熟', '穩定', '待加強', '需補強'], LVC = ['ok', 'st', 'warn', 'bad'];

function show(name) { $$('.screen').forEach(s => { s.hidden = s.id !== 's-' + name; }); scrollTo({ top: 0 }); }
const unitName = no => { const u = (D.units || []).find(x => x.no === no); return u ? `${u.no} ${u.name}` : no; };
const scopeLabel = a => a.type === '模擬' ? `模擬${a.scope}卷` : a.scope;
const sum = arr => (arr || []).reduce((t, v) => t + (v || 0), 0);

/* ---------- 登入 ---------- */
async function boot() {
  if (TOKEN) { try { await load(); return; } catch (e) { if (e.server) { TOKEN = null; store.del(TK); } else { showErr(e.message); } } }
  show('login');
}
function showErr(m) { const b = $('#loginErr'); b.textContent = m || ''; b.hidden = !m; }
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); showErr('');
  try {
    const r = await run('登入中…', () => api(ROLE === 'teacher' ? 'tLogin' : 'dLogin', ROLE === 'teacher' ? { pass: $('#pass').value } : { code: $('#pass').value }));
    TOKEN = r.token; store.set(TK, TOKEN);
    await load();
  } catch (err) { showErr(err.message); }
});
$('#logout').onclick = () => { TOKEN = null; store.del(TK); D = null; $('#pass').value = ''; show('login'); };
$('#reload').onclick = () => load().catch(() => { });

async function load() {
  D = await run('讀取資料中…', () => api(ROLE === 'teacher' ? 'tAll' : 'dAll', { token: TOKEN }));
  if (ROLE === 'teacher') $('#tSub').textContent = `名單 ${D.students.length} 人・題庫 ${Object.keys(D.bank).reduce((t, k) => t + D.bank[k].all, 0)} 題・資料時間 ${dt(Date.now())}`;
  const term = (ROLE === 'teacher' ? D.config && D.config.term : D.term) || '115年上學期';
  document.title = `${term}｜國八。二段 ( ${ROLE === 'teacher' ? '系統管理者' : '學習狀況'} )`;
  show('main');
  const h = decodeURIComponent(location.hash.slice(1));
  if (h && okView(h)) view = h;
  history.replaceState({ v: view, prev: null }, '', '#' + view);
  render();
}

/* ---------- 換頁與瀏覽器「上一頁」 ---------- */
const MY_VIEWS = ROLE === 'teacher' ? ['overview', 'students', 'student', 'stusec', 'sections', 'section', 'mocks', 'mock', 'export', 'settings', 'bank'] : ['dir', 'dstu', 'dstusec'];
const okView = v => MY_VIEWS.indexOf(v.split(':')[0]) >= 0;
function go(v) {
  history.pushState({ v, prev: view }, '', '#' + v);
  view = v; render(); scrollTo({ top: 0 });
}
window.addEventListener('popstate', e => {
  if (!D) return;
  const v = e.state && e.state.v ? e.state.v : decodeURIComponent(location.hash.slice(1));
  view = v && okView(v) ? v : (ROLE === 'teacher' ? 'overview' : 'dir');
  render(); scrollTo({ top: 0 });
});

/* ---------- 版面 ---------- */
const TABS = [['overview', '總覽'], ['students', '學生'], ['sections', '小節'], ['mocks', '模擬卷'], ['export', '匯出與權限'], ['settings', '網站設定'], ['bank', '題庫與名單']];
function render() {
  const [base, ...args] = view.split(':');
  if (ROLE === 'teacher') {
    const cur = { student: 'students', stusec: 'students', section: 'sections', mock: 'mocks' }[base] || base;
    $('#tnav').innerHTML = TABS.map(([k, l]) => `<button data-tv="${k}" aria-current="${cur === k}">${l}</button>`).join('');
  }
  $('#tBody').innerHTML = VIEWS[base](...args);
  const all = $('#dirAll');
  if (all) { const n = D.students.filter(x => DSEL.has(x.id)).length; all.indeterminate = n > 0 && n < D.students.length; }
}
document.addEventListener('click', e => {
  if (e.target.closest('.ck')) return;                  // 勾選格不要觸發整列的連結
  const v = e.target.closest('[data-tv]');
  if (!v) return;
  const to = v.dataset.tv;
  if (v.classList.contains('back') && history.state && history.state.prev === to) history.back();
  else go(to);
});

function donut(lv, unit) {
  const tot = sum(lv) || 1; let acc = 0;
  const vars = ['var(--ok)', 'var(--exam)', 'var(--warn)', 'var(--bad)'];
  const stops = lv.map((v, i) => { const a = acc; acc += v / tot * 100; return `${vars[i]} ${a}% ${acc}%`; }).join(',');
  return `<div class="donutwrap"><div class="donut" style="background:${sum(lv) ? `conic-gradient(${stops})` : '#E8EDF3'}"><span>${sum(lv)}<br>${unit || '人次'}</span></div>
    <div class="legend2">${lv.map((v, i) => `<span><i class="c-${LVC[i]}"></i>${LVN[i]}　<span class="mono">${v}</span></span>`).join('')}</div></div>`;
}
const trendBars = list => list.length ? `<div class="trend">${list.map(t => `<div title="${esc(scopeLabel(t))} ${dt(t.start)}"><span>${t.score === null ? '逾時' : t.score}</span><i class="${t.score === null ? 'c-bad' : colorFor(t.score)}" style="height:${Math.max(t.score || 0, 6) * 0.8}px"></i><em>${esc(t.type === '模擬' ? t.scope + '卷' : t.scope)}</em></div>`).join('')}</div>` : '<p class="muted" style="margin-top:8px">還沒有紀錄。</p>';
const attList = (list, pdfAttr, who) => list.length ? `<div class="hist">${list.map(a => `<div class="h"><div>${who ? `<b>${esc(a.name)}</b> <span class="mono small muted">${esc(a.uid)}</span>　` : ''}<b>${esc(scopeLabel(a))}</b>　<span class="mono small muted">${dt(a.start)}</span>　<span class="small ${a.status === '逾時' ? 'x' : ''}">${a.status === '逾時' ? '逾時' : a.score + ' 分・' + a.level}</span></div>${a.status === '完成' ? `<button class="btn ghost sm" ${pdfAttr}="${a.aid}">${ICON.down}PDF</button>` : ''}</div>`).join('')}</div>` : '<p class="muted small">沒有紀錄。</p>';

/* ---------- 篩選鈕、學生各小節分析 ---------- */
const FSEL = { list: '全部', att: '全部' };            // 主任學生列表、測驗紀錄的篩選
const DSEL = new Set();                                 // 主任勾選的學生
const nv = v => v === null || v === undefined ? '—' : v;
const fTabs = key => `<div class="hist-tabs" role="group" aria-label="依範圍篩選">${['全部'].concat(D.units.map(u => u.no), ['模擬卷']).map(t => `<button type="button" data-hk="${key}" data-ht="${esc(t)}" aria-pressed="${FSEL[key] === t}">${esc(t)}</button>`).join('')}</div>`;
const fAtts = (list, key) => list.filter(a => FSEL[key] === '全部' || (FSEL[key] === '模擬卷' ? a.type === '模擬' : a.type !== '模擬' && a.scope === FSEL[key]));

/** 學生的四個小節卡片：點了進入這一節的分析頁（看完按上一頁回來） */
const secCards = (s, base) => `<div class="cards4">${D.units.map((u, i) => `<button class="card" data-tv="${base}:${s.id}:${u.no}"><span class="small muted">${u.no} ${esc(u.name)}</span>${s.cnt ? `<b>${s.cnt[i]} 次</b>` : ''}${s.best ? `<span class="small">${s.best[i] === null ? '還沒完成' : '最高 ' + s.best[i] + ' 分'}</span>` : ''}<span class="small" style="color:var(--primary);font-weight:700">${ROLE === 'teacher' ? '看觀念分析與錯題' : '看觀念分析'} ›</span></button>`).join('')}</div>`;

/** 一位學生在某一小節的分析：各觀念答對率、等第分布；老師另外看得到答錯過的題目 */
function secPage(id, no, base) {
  const s = D.students.find(x => x.id === id);
  if (!s) return '<p class="muted">找不到這位學生。</p>';
  const i = D.units.findIndex(u => u.no === no), x = s.bySec && s.bySec[i];
  const head = `<button class="back" data-tv="${base}:${s.id}">${ICON.back}${esc(s.name)}</button>
    <div class="row between"><h3 style="font-size:20px">${esc(unitName(no))}</h3><span class="small muted">${esc(s.name)} <span class="mono">${esc(s.id)}</span> 的觀念分析</span></div>`;
  if (!x) return head + '<p class="muted">沒有資料。</p>';
  const goals = x.goals.slice().sort((a, b) => pct(a.c, a.n) - pct(b.c, b.n));
  const wrong = ROLE === 'teacher' ? x.wrong || [] : null;
  const sub = t => `<div class="small muted" style="font-weight:700">${t}</div>`;
  return `${head}<div class="panel" style="display:grid;gap:14px">
    <div class="cols">
      <div>${sub('各觀念答對率')}<div style="margin-top:6px">${goals.map(g => hbar(g.name, pct(g.c, g.n), colorFor(pct(g.c, g.n)), `${g.c}／${g.n}`)).join('') || '<p class="muted">這一節還沒有完成的練習。</p>'}</div></div>
      <div>${sub('等第分布（這一節完成的練習）')}<div style="margin-top:8px">${donut(x.lv, '次')}</div></div>
    </div>
    ${wrong ? `<div>${sub(`答錯過的題目（${wrong.length} 題，答錯次數多的在前）`)}${wrong.length ? `<div class="wqs">${wrong.map(w => `<div class="wq">
      <div class="qhead" style="margin:0">${tierChip(w.tier, true)}<span class="small muted">${esc(w.src)}　${esc(w.qid)}</span><span class="x small">錯 ${w.w}／${w.n} 次</span></div>
      <div class="stem">${fmt(w.stem)}</div>${w.fig ? `<img class="fig small" src="assets/fig/${esc(w.fig)}" alt="題目附圖">` : ''}</div>`).join('')}</div>` : '<p class="muted" style="margin-top:6px">這一節沒有答錯過的題目。</p>'}</div>` : ''}
  </div>`;
}

/** 小節或模擬卷的全班分析（老師端） */
function groupBody(s, kind) {
  return `<div class="cols">
      <div class="panel"><h3>各觀念答對率</h3><div style="margin-top:8px">${s.goals.slice().sort((a, b) => pct(a.c, a.n) - pct(b.c, b.n)).map(g => hbar(g.name, pct(g.c, g.n), colorFor(pct(g.c, g.n)), `${pct(g.c, g.n)}%`)).join('') || '<p class="muted">資料還不夠。</p>'}</div></div>
      <div class="panel"><h3>等第分布</h3><div style="margin-top:10px">${donut(s.lv)}</div></div>
    </div>
    ${kind === 'mock' ? `<div class="panel"><h3>各小節答對率</h3><div style="margin-top:8px">${(s.secs || []).map(x => hbar(`${x.no} ${x.name}`, pct(x.c, x.n), colorFor(pct(x.c, x.n)), `${pct(x.c, x.n)}%`)).join('') || '<p class="muted">資料還不夠。</p>'}</div></div>` : ''}
    <div class="cols">
      <div class="panel"><h3>最常錯的題目</h3><div style="margin-top:8px;display:grid;gap:10px">${s.miss.map(m => `<div>${hbar(`${m.qid}（${m.src}）`, pct(m.c, m.n), colorFor(pct(m.c, m.n)), `${m.c}／${m.n}`)}<div class="small muted">${fmt(m.stem)}…</div></div>`).join('') || '<p class="muted">資料還不夠（每題至少 2 人次才列）。</p>'}</div></div>
      <div class="panel"><h3>需要關心的學生</h3><p class="small muted">最近一次${kind === 'mock' ? '這份模擬卷' : '這節練習'}不到 60 分</p><div class="weak" style="margin-top:10px">${s.watch.map(w => `<button class="chip t-中" style="border:0" data-tv="student:${w.id}">${esc(w.name)}（${w.score} 分）</button>`).join('') || '<span class="muted">目前沒有</span>'}</div></div>
    </div>`;
}

const VIEWS = {
  stusec: (id, no) => secPage(id, no, 'student'),
  dstusec: (id, no) => secPage(id, no, 'dstu'),
  overview: () => {
    const o = D.overview;
    const recent = D.attempts.slice().sort((a, b) => b.start - a.start).slice(0, 8);
    const nNew = D.students.filter(s => s.isNew).length;
    return `${nNew ? `<div class="panel row between"><span><b>${nNew}</b> 位新同學第一次登入，已自動加入名單。</span><button class="btn ghost sm" data-tv="students">到學生頁確認</button></div>` : ''}<div class="kpis">
      <div class="kpi"><b>${o.weekTries}</b><span>近 7 天測驗人次</span></div>
      <div class="kpi"><b>${o.avg === null ? '—' : o.avg}</b><span>小節練習平均分數</span></div>
      <div class="kpi"><b>${o.weekTimeouts}</b><span>近 7 天逾時次數</span></div>
      <div class="kpi"><b>${o.never}<small style="font-size:14px;color:var(--muted)">／${o.students}</small></b><span>還沒練習的人</span></div></div>
    <div class="cols">
      <div class="panel"><h3>各小節平均分數</h3><div style="margin-top:8px">${D.unitStats.map(s => hbar(`${s.no} ${s.name}`, s.avg || 0, colorFor(s.avg || 0), s.avg === null ? '—' : s.avg + ' 分')).join('')}</div></div>
      <div class="panel"><h3>全班最弱的 3 個觀念</h3><div style="margin-top:8px">${o.weakest.map(w => hbar(`${w.name}（${w.sec}）`, pct(w.c, w.n), colorFor(pct(w.c, w.n)))).join('') || '<p class="muted">資料還不夠。</p>'}</div></div>
    </div>
    <div class="panel" style="display:grid;gap:4px"><h3>最近的測驗</h3>${recent.length ? `<div class="hist">${recent.map(a => `<div class="h"><div><b>${esc(a.name)}</b> <span class="mono small muted">${esc(a.uid)}</span>　${esc(scopeLabel(a))}　<span class="mono small muted">${dt(a.start)}</span></div><span class="small ${a.status === '逾時' ? 'x' : ''}">${a.status === '逾時' ? '逾時' : a.score + ' 分'}</span></div>`).join('')}</div>` : '<p class="muted small">還沒有學生作答。</p>'}</div>`;
  },

  students: () => {
    const nNew = D.students.filter(s => s.isNew).length, n = D.students.filter(s => DSEL.has(s.id)).length;
    const opts = D.students.map(s => `<option value="${esc(s.id)}">${esc(s.id)} ${esc(s.name)}</option>`).join('');
    return `${nNew ? `<div class="panel row between"><span><b>${nNew}</b> 位新同學自動加入名單（標「新加入」）。名字打錯的用下面的「合併」，亂打的假名勾選後刪除。</span><button class="btn ghost sm" id="ackAll">全部確認</button></div>` : ''}
    <div class="tbl"><table><thead><tr><th class="ck"><input type="checkbox" id="dirAll" aria-label="全選"${n && n === D.students.length ? ' checked' : ''}></th><th>學號</th><th>姓名</th><th>練習次數</th><th>模擬卷</th><th>平均分數</th><th>最近練習</th><th>需加強</th></tr></thead><tbody>
    ${D.students.map(s => `<tr class="link" data-tv="student:${esc(s.id)}"><td class="ck"><input type="checkbox" data-dsel="${esc(s.id)}" aria-label="勾選 ${esc(s.name)}"${DSEL.has(s.id) ? ' checked' : ''}></td><td class="mono">${esc(s.id)}</td><td>${esc(s.name)}${s.isNew ? ' <span class="chip t-易">新加入</span>' : ''}${s.aka && s.aka.length ? `<div class="small muted">別名 ${esc(s.aka.join('、'))}</div>` : ''}</td><td>${sum(s.cnt) || '<span class="x">0</span>'}</td><td>${s.mock || 0}</td><td>${s.avg === null ? '—' : s.avg}</td><td>${dshort(s.last)}</td><td>${esc(s.weak.slice(0, 2).join('、')) || '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">名單是空的。學生第一次登入會自動加入，也可以到「題庫與名單」貼上名單。</td></tr>'}
    </tbody></table></div>
    ${D.students.length ? `<div class="cols">
      <div class="panel" style="display:grid;gap:10px;align-content:start"><h3>合併學生</h3><p class="small muted">同一個人用不同名字登入（例如打錯字）：把錯的那筆併到正確的人。作答紀錄會搬過去，以後用錯的名字登入也會對到正確的人。</p>
        <div class="row" style="flex-wrap:wrap"><select id="mgFrom" aria-label="要併掉的那筆">${opts}</select><span class="small">併到</span><select id="mgTo" aria-label="正確的學生">${opts}</select><button class="btn sm" id="mgGo">合併</button></div></div>
      <div class="panel" style="display:grid;gap:10px;align-content:start"><h3>刪除學生</h3><p class="small muted">在上面的表格勾選（例如亂打的假名）。會連同作答紀錄一起刪除，不能復原。</p>
        <div class="row"><button class="btn ghost sm" id="stuDel"${n ? '' : ' disabled'}>刪除勾選的學生（${n} 人）</button></div></div>
    </div>` : ''}`;
  },

  student: id => {
    const s = D.students.find(x => x.id === id);
    if (!s) return '<p class="muted">找不到這位學生。</p>';
    const atts = D.attempts.filter(a => a.uid === id).sort((a, b) => b.start - a.start);
    const goalBars = D.goals.filter(g => s.goals[g.code]).map(g => { const v = s.goals[g.code]; return [g, pct(v.c, v.n), v]; }).sort((a, b) => a[1] - b[1]);
    return `<button class="back" data-tv="students">${ICON.back}學生列表</button>
    <div class="row between"><h3 style="font-size:20px">${esc(s.name)} <span class="muted small mono">${esc(s.id)}</span></h3><button class="btn ghost sm" data-spdf="${s.id}">${ICON.down}匯出這位學生的報告</button></div>
    ${secCards(s, 'stusec')}
    <div class="cols">
      <div class="panel"><h3>最近幾次分數</h3>${trendBars(s.trend)}</div>
      <div class="panel"><h3>需加強的觀念</h3><div class="weak" style="margin-top:10px">${s.weak.map(w => `<span class="chip t-難">✕ ${esc(w)}</span>`).join('') || '<span class="muted">目前沒有</span>'}</div></div>
    </div>
    <div class="panel"><h3>各觀念答對率（小節練習累計）</h3><div style="margin-top:8px">${goalBars.map(([g, p, v]) => hbar(`${g.sec} ${g.name}`, p, colorFor(p), `${v.c}／${v.n}`)).join('') || '<p class="muted">還沒有資料。</p>'}</div></div>
    <div class="panel" style="display:grid;gap:4px"><h3>測驗紀錄</h3>${fTabs('att')}${attList(fAtts(atts, 'att'), 'data-apdf')}</div>`;
  },

  sections: () => `
    <div class="cards4">${D.unitStats.map(s => `<button class="card" data-tv="section:${s.no}"><b>${s.no}</b><span>${esc(s.name)}</span><span class="small muted">${s.tries} 人次・平均 ${s.avg === null ? '—' : s.avg + ' 分'}</span></button>`).join('')}</div>`,

  section: no => {
    const s = D.unitStats.find(x => x.no === no);
    return `<button class="back" data-tv="sections">${ICON.back}小節列表</button>
    <div class="row between"><h3 style="font-size:20px">${s.no} ${esc(s.name)}</h3><button class="btn ghost sm" data-secpdf="${s.no}">${ICON.down}匯出這個小節的報告</button></div>
    <p class="small muted">${s.tries} 人次（其中逾時 ${s.timeouts}）・平均 ${s.avg === null ? '—' : s.avg + ' 分'}</p>
    ${groupBody(s, 'unit')}`;
  },

  mocks: () => `
    <div class="tbl"><table><thead><tr><th>卷別</th><th>來源</th><th>難度</th><th>作答人次</th><th>平均分數</th><th>分析報告</th></tr></thead><tbody>
    ${D.mocks.map(m => `<tr class="link" data-tv="mock:${esc(m.L)}"><td><b>${esc(m.name)}</b></td><td>${esc(m.src)}</td><td>${esc(m.word)}</td><td>${m.tries}</td><td>${m.avg === null ? '—' : m.avg}</td><td><span class="small" style="color:var(--primary);font-weight:700">查看</span></td></tr>`).join('') || '<tr><td colspan="6" class="muted">還沒有匯入模擬卷。</td></tr>'}
    </tbody></table></div>
    <div class="panel" style="display:grid;gap:4px"><h3>模擬卷作答紀錄</h3>${attList(D.attempts.filter(a => a.type === '模擬').sort((a, b) => b.start - a.start).slice(0, 30).map(a => Object.assign({}, a, { scope: a.scope })), 'data-apdf', true)}</div>`,

  mock: L => {
    const m = D.mocks.find(x => x.L === L);
    if (!m) return '<p class="muted">找不到這份模擬卷。</p>';
    return `<button class="back" data-tv="mocks">${ICON.back}模擬卷列表</button>
    <div class="row between"><h3 style="font-size:20px">${esc(m.name)} <span class="small muted">${esc(m.word)}・${esc(m.src)}</span></h3><button class="btn ghost sm" data-mockpdf="${esc(m.L)}">${ICON.down}匯出這份模擬卷的報告</button></div>
    <p class="small muted">${m.tries} 人次（其中逾時 ${m.timeouts}）・平均 ${m.avg === null ? '—' : m.avg + ' 分'}</p>
    ${groupBody(m, 'mock')}
    <div class="panel" style="display:grid;gap:4px"><h3>這份模擬卷的作答紀錄</h3>${attList(D.attempts.filter(a => a.type === '模擬' && a.scope === m.L).sort((a, b) => b.start - a.start), 'data-apdf', true)}</div>`;
  },

  export: () => `<div class="cols">
      <div class="panel" style="display:grid;gap:10px"><h3>個別學生報告</h3><select id="exStu" aria-label="選擇學生">${D.students.map(s => `<option value="${s.id}">${s.id} ${esc(s.name)}</option>`).join('')}</select><div class="row"><button class="btn sm" id="exStuBtn">${ICON.down}匯出 PDF</button></div></div>
      <div class="panel" style="display:grid;gap:10px;align-content:start"><h3 style="margin:0">全體學生報告</h3><div class="row"><button class="btn sm" id="exAllPdf">${ICON.down}匯出 PDF</button><button class="btn ghost sm" id="exAllXlsx">匯出 Excel</button></div></div>
      <div class="panel" style="display:grid;gap:10px"><h3>小節報告</h3><select id="exSec" aria-label="選擇小節">${D.unitStats.map(s => `<option value="${s.no}">${s.no} ${esc(s.name)}</option>`).join('')}</select><div class="row"><button class="btn sm" id="exSecBtn">${ICON.down}匯出 PDF</button></div></div>
      <div class="panel" style="display:grid;gap:10px">
        <div class="row between"><h3>補習班主任權限</h3><button class="sw" role="switch" aria-checked="${D.config.dir}" data-set="dir" aria-label="開放主任檢視"></button></div>
        <div>登入碼　<span class="code">${esc(D.dcode)}</span></div>
        <div class="small">網址　<span class="mono" style="overflow-wrap:anywhere">${esc(location.href.replace(/teacher\.html.*$/, 'director.html'))}</span>　<button class="btn ghost sm" id="copyDir">複製</button></div>
        <div class="checks">${['練習次數', '最近練習', '平均分數', '學習報告', '需加強', '觀念分析'].map(k => `<label><input type="checkbox" data-field="${k}"${D.dfields.indexOf(k) >= 0 ? ' checked' : ''}> ${{ 學習報告: '下載學習報告', 需加強: '需加強的觀念', 觀念分析: '個別學生各小節觀念分析' }[k] || k}</label>`).join('')}<label class="muted"><input type="checkbox" disabled> 題目與答案（不開放）</label></div>
      </div>
    </div>`,

  settings: () => {
    const c = D.config;
    const onOff = (on, a, b) => on ? `<span class="state" style="color:var(--ok)">${a}</span>` : `<span class="state muted">${b}</span>`;
    return `<div class="panel">
      <div class="setrow"><b>班級通行碼</b><span class="code">${esc(D.code || '不需要')}</span>
        <span class="small muted" style="grid-column:1 / 3">學生登入時要輸入（不分大小寫）。換了以後，所有學生都要用新通行碼重新登入。</span>
        <div class="row" style="grid-column:1 / 3"><input id="codeIn" class="cin" maxlength="20" autocomplete="off" placeholder="新的通行碼（英文或數字 3～20 個）" aria-label="新的通行碼"><button class="btn sm" id="codeSave">更換通行碼</button></div></div>
      <div class="setrow"><b>鎖定名單</b><button class="sw" role="switch" aria-checked="${c.lock}" data-set="lock" aria-label="鎖定名單"></button>
        <span class="small muted">${c.lock ? '<span class="state" style="color:var(--ok)">鎖定中</span>：只有名單上的學生能登入。' : '<span class="state" style="color:var(--warn)">開放加入</span>：新同學第一次登入時自動加入名單，到「學生」頁確認。'}</span></div>
      <div class="setrow"><b>允許訪客試用</b><button class="sw" role="switch" aria-checked="${c.guest}" data-set="guest" aria-label="允許訪客試用"></button>
        <span class="small muted">${onOff(c.guest, '開放中', '關閉中')}：${c.guest ? '登入頁有「訪客試用」，給試聽生用；不記名、不能下載 PDF、不算全班統計。' : '一定要輸入班級座號姓名才能測驗。'}</span></div>
      <div class="setrow"><b>學生 PDF 附題目</b><div class="seg" role="group" aria-label="學生 PDF 附題目">${['不附', '只附錯題', '全部'].map(k => `<button type="button" data-pdfq="${k}" aria-pressed="${c.pdfQ === k}">${k}</button>`).join('')}</div>
        <span class="small muted" style="grid-column:1 / 3">${{ 不附: '不附：PDF 只列錯題清單（題號、學習目標、你的答案、正解），完整題目和解析在網站上看。', 只附錯題: '只附錯題：PDF 印出答錯的題目和解析。', 全部: '全部：PDF 印出這次每一題的題目和解析。' }[c.pdfQ] || ''}每份 PDF 都有 LOGO 浮水印，頁尾印學號姓名和報告編號。</span></div>
      <div class="setrow"><b>報告顯示全班位置</b><button class="sw" role="switch" aria-checked="${c.cls}" data-set="cls" aria-label="報告顯示全班位置"></button>
        <span class="small muted">${onOff(c.cls, '顯示中', '隱藏中')}：學生報告列出這一節各等第的人數和全班平均（不排名；練過的人少於 3 人時不顯示）。</span></div>
      <div class="setrow"><b>顯示題目出處</b><button class="sw" role="switch" aria-checked="${c.src}" data-set="src" aria-label="顯示題目出處"></button>
        <span class="small muted">${onOff(c.src, '顯示中', '隱藏中')}：${c.src ? '學生會看到【學校名】或【會考年度】。' : '學生看不到出處和「會考」標籤，系統照樣記錄。'}</span></div>
      <div class="setrow"><b>顯示品牌 LOGO</b><button class="sw" role="switch" aria-checked="${c.logo}" data-set="logo" aria-label="顯示品牌 LOGO"></button>
        <span class="small muted">${onOff(c.logo, '顯示中', '隱藏中')}：放在登入頁、頁首和分析報告。</span>
        <div class="pv"><img src="${BRAND_LOGO}" alt="AY MATH 標誌"><span class="small muted">講義同款的藍色 AY 標誌</span></div></div>
      <div class="setrow"><b>顯示品牌名稱</b><button class="sw" role="switch" aria-checked="${c.brand}" data-set="brand" aria-label="顯示品牌名稱"></button>
        <span class="small muted">${onOff(c.brand, '顯示中', '隱藏中')}：學校學生使用時關閉，只給補習班使用時再打開。</span>
        <div class="pv"><span style="font-weight:900;letter-spacing:.06em;color:var(--primary)">${esc(c.brandName)}</span></div></div>
    </div>
    `;
  },

  bank: () => {
    const rows = Object.keys(D.bank).sort().map(k => { const b = D.bank[k]; return `<tr><td><b>${esc(D.units.some(u => u.no === k) ? unitName(k) : k)}</b></td><td>${b['易']}</td><td>${b['中']}</td><td>${b['難']}</td><td>${b['會考']}</td><td>${b.all}</td><td>${b.ex}／${b.all}</td></tr>`; }).join('');
    return `<div class="tbl"><table><thead><tr><th>範圍</th><th>易</th><th>中</th><th>難</th><th>會考</th><th>合計</th><th>有解析</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">還沒有匯入題庫。</td></tr>'}</tbody></table></div>
    <div class="cols">
      <div class="panel" style="display:grid;gap:10px"><h3>匯入題庫</h3><p class="small muted">選擇 Claude 產生的 <span class="mono">bank.json</span>。會整份取代試算表的「題庫」「學習目標」「模擬卷」；學生的作答紀錄不受影響。</p>
        <input type="file" id="bankFile" accept=".json,application/json"><div class="row"><button class="btn sm" id="bankGo">匯入</button></div></div>
      <div class="panel" style="display:grid;gap:10px"><h3>學生名單</h3><p class="small muted">一行一位，例如 <span class="mono">80101陳大田</span>。目前 ${D.students.length} 人。同一個班級座號、不同姓名（不同學校）會自動編成 <span class="mono">80101-2</span>；學生第一次登入也會自動加入（網站設定可以鎖定名單）。</p>
        <textarea id="rosterTxt" rows="8" style="width:100%;border:1px solid var(--line-strong);border-radius:10px;padding:10px;font:15px/1.6 var(--f-mono)" placeholder="80101陳大田&#10;80102林小美"></textarea>
        <div class="row"><button class="btn sm" data-roster="append">加入名單</button><button class="btn ghost sm" data-roster="replace">整份取代</button></div></div>
    </div>
    <div class="panel" style="display:grid;gap:10px"><h3>清除作答紀錄</h3><p class="small muted">上線前清掉測試資料用。會刪除試算表「測驗紀錄」「逐題紀錄」「逐題統計」裡的資料，刪了不能復原；名單、題庫、設定不受影響。</p>
      <div class="row"><button class="btn ghost sm" data-clear="guest">只清訪客紀錄</button><button class="btn ghost sm" data-clear="all">清除全部作答紀錄</button></div></div>`;
  },

  /* ---- 主任 ---- */
  dir: () => {
    const F = D.fields, has = k => F.indexOf(k) >= 0, sel = FSEL.list;
    const i = D.units.findIndex(u => u.no === sel), mk = sel === '模擬卷';
    const cols = [];                                     // [欄名, 取值]
    if (sel === '全部') {
      if (has('練習次數')) cols.push(['練習次數', s => sum(s.cnt)], ['模擬卷', s => s.mock || 0]);
      if (has('最近練習')) cols.push(['最近練習', s => dshort(s.last)]);
      if (has('平均分數')) cols.push(['平均分數', s => nv(s.avg)]);
      if (has('需加強')) cols.push(['需加強', s => esc((s.weak || []).slice(0, 2).join('、')) || '—']);
    } else {
      if (has('練習次數')) cols.push([mk ? '作答次數' : '練習次數', s => mk ? s.mock || 0 : (s.cnt || [])[i]]);
      if (has('平均分數')) cols.push(['最高分', s => nv(mk ? s.mockBest : (s.best || [])[i])], ['平均分數', s => nv(mk ? s.mockAvg : (s.avgBy || [])[i])]);
      if (has('最近練習')) cols.push(['最近練習', s => dshort(mk ? s.mockLast : (s.lastBy || [])[i])]);
    }
    const rep = has('學習報告'), link = rep || has('觀念分析');
    const n = D.students.filter(s => DSEL.has(s.id)).length;
    return `<div class="dirbar">${fTabs('list')}${rep ? `<button class="btn sm" id="dirPdf"${n ? '' : ' disabled'}>${ICON.down}下載勾選學生的學習報告（${n} 人）</button>` : ''}</div>
    <div class="tbl"><table><thead><tr>${rep ? `<th class="ck"><input type="checkbox" id="dirAll" aria-label="全選"${n && n === D.students.length ? ' checked' : ''}></th>` : ''}<th>學號</th><th>姓名</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}${link ? '<th>詳細</th>' : ''}</tr></thead><tbody>
    ${D.students.map(s => `<tr${link ? ` class="link" data-tv="dstu:${s.id}"` : ''}>${rep ? `<td class="ck"><input type="checkbox" data-dsel="${esc(s.id)}" aria-label="勾選 ${esc(s.name)}"${DSEL.has(s.id) ? ' checked' : ''}></td>` : ''}<td class="mono">${esc(s.id)}</td><td>${esc(s.name)}</td>${cols.map(c => `<td>${c[1](s)}</td>`).join('')}${link ? '<td><span class="small" style="color:var(--primary);font-weight:700">查看</span></td>' : ''}</tr>`).join('')}
    </tbody></table></div>`;
  },
  dstu: id => {
    const s = D.students.find(x => x.id === id);
    if (!s) return '<p class="muted">找不到這位學生。</p>';
    const has = k => D.fields.indexOf(k) >= 0;
    const atts = D.attempts.filter(a => a.uid === id).sort((a, b) => b.start - a.start);
    return `<button class="back" data-tv="dir">${ICON.back}學生列表</button>
    <div class="row between"><h3 style="font-size:20px">${esc(s.name)} <span class="muted small mono">${esc(s.id)}</span></h3>${has('學習報告') ? `<button class="btn ghost sm" data-spdf="${s.id}">${ICON.down}學習報告 PDF</button>` : ''}</div>
    ${s.bySec ? secCards(s, 'dstusec') : ''}
    ${has('學習報告') ? `<div class="panel" style="display:grid;gap:4px"><h3>每次測驗的報告</h3>${fTabs('att')}${attList(fAtts(atts, 'att'), 'data-apdf')}</div>` : ''}`;
  }
};

/* ---------- 互動 ---------- */
$('#tBody').addEventListener('click', async e => {
  const t = e.target;
  const ht = t.closest('[data-ht]');
  if (ht) { FSEL[ht.dataset.hk] = ht.dataset.ht; render(); return; }
  if (t.id === 'dirPdf') {
    const list = D.students.filter(x => DSEL.has(x.id));
    if (!list.length) return;
    return run(`產生 PDF 中（${list.length} 人）…`, () => savePdf(`<div>${list.map((x, k) => `<div class="${k ? 'pb' : ''}">${studentPage(x.id)}</div>`).join('')}</div>`,
      `國八二段_學習報告_${list.length === 1 ? list[0].id + list[0].name : '勾選' + list.length + '人'}_${dshort(Date.now()).replace('/', '')}.pdf`)).catch(() => { });
  }
  const mp = t.closest('[data-mockpdf]');
  if (mp) return mockPdf(mp.dataset.mockpdf);
  if (t.id === 'ackAll') return ackAll();
  if (t.id === 'mgGo') return mergeStu();
  if (t.id === 'stuDel') return delStu();
  if (t.id === 'codeSave') return saveCode();
  const pq = t.closest('[data-pdfq]');
  if (pq) return setPdfQ(pq.dataset.pdfq);
  const sw = t.closest('[data-set]');
  if (sw) {
    const k = sw.dataset.set;
    const val = !D.config[k];
    try {
      const r = await run('儲存中…', () => api('tSet', { token: TOKEN, key: k, value: val }));
      D.config = r.config; D.dfields = r.dfields; render();
      toast({ lock: val ? '已鎖定名單：只有名單上的學生能登入' : '已開放加入：新同學第一次登入自動加入名單', guest: val ? '已開放訪客試用' : '已關閉訪客試用', cls: val ? '報告會顯示全班位置' : '報告不顯示全班位置', src: val ? '已顯示題目出處' : '已隱藏題目出處', logo: val ? '已顯示品牌 LOGO' : '已隱藏品牌 LOGO', brand: val ? '已顯示品牌名稱' : '已隱藏品牌名稱', dir: val ? '已開放主任檢視' : '已關閉主任檢視' }[k]);
    } catch (err) { /* 已提示 */ }
    return;
  }
  const ap = t.closest('[data-apdf]');
  if (ap) return attemptPdf(ap.dataset.apdf);
  const sp = t.closest('[data-spdf]');
  if (sp) return run('產生 PDF 中…', () => savePdf(`<div>${studentPage(sp.dataset.spdf)}</div>`, `國八二段_學習報告_${sp.dataset.spdf}${D.students.find(s => s.id === sp.dataset.spdf).name}.pdf`)).catch(() => { });
  const sc = t.closest('[data-secpdf]');
  if (sc) return sectionPdf(sc.dataset.secpdf);
  if (t.id === 'exStuBtn') { const id = $('#exStu').value; return run('產生 PDF 中…', () => savePdf(`<div>${studentPage(id)}</div>`, `國八二段_學習報告_${id}${D.students.find(s => s.id === id).name}.pdf`)).catch(() => { }); }
  if (t.id === 'exAllPdf') return run('產生 PDF 中（人數多會比較久）…', () => savePdf(`<div>${D.students.map((s, i) => `<div class="${i ? 'pb' : ''}">${studentPage(s.id)}</div>`).join('')}</div>`, `國八二段_全體學生報告_${dshort(Date.now()).replace('/', '')}.pdf`)).catch(() => { });
  if (t.id === 'exAllXlsx') return exportXlsx();
  if (t.id === 'exSecBtn') return sectionPdf($('#exSec').value);
  if (t.id === 'copyDir') { try { await navigator.clipboard.writeText(location.href.replace(/teacher\.html.*$/, 'director.html')); toast('已複製主任網址'); } catch (err) { toast('不能自動複製，請手動選取網址'); } return; }
  if (t.id === 'bankGo') return importBank();
  const cl = t.closest('[data-clear]');
  if (cl) return clearRecords(cl.dataset.clear);
  const ro = t.closest('[data-roster]');
  if (ro) return importRoster(ro.dataset.roster);
});
$('#tBody').addEventListener('change', async e => {
  const ds = e.target.dataset.dsel;
  if (ds) { if (e.target.checked) DSEL.add(ds); else DSEL.delete(ds); render(); return; }
  if (e.target.id === 'dirAll') { if (e.target.checked) D.students.forEach(x => DSEL.add(x.id)); else DSEL.clear(); render(); return; }
  const f = e.target.dataset.field;
  if (!f) return;
  const fields = $$('[data-field]').filter(x => x.checked).map(x => x.dataset.field);
  try { const r = await run('儲存中…', () => api('tSet', { token: TOKEN, key: 'dfields', value: fields.join(',') })); D.dfields = r.dfields; toast('主任可看欄位已更新'); } catch (err) { /* 已提示 */ }
});

async function attemptPdf(aid) {
  try {
    await run('產生 PDF 中…', async () => {
      const r = (await api(ROLE === 'teacher' ? 'tReport' : 'dReport', { token: TOKEN, aid })).report;
      if (ROLE !== 'teacher') r.items = [];             // 主任只看分數與觀念分析，不給題目、正解、解析
      await savePdf(reportPdfHtml(r, D.config || {}, '全部'), reportFileName(r), { logo: !!(D.config && D.config.logo), note: `${r.uid} ${r.name}｜報告編號 ${r.aid}` });
    });
  } catch (e) { /* 已提示 */ }
}

/* ---------- PDF 內容 ---------- */
function pdfHead(title, right) {
  const c = D.config || {};
  return `<div class="ph"><div><div style="font-size:12px;color:#E8692A;font-weight:700;letter-spacing:.08em">${esc(c.term || '')} ${esc(title)}</div><h1>${esc(c.site || '國八。二段練習')}</h1></div>
    <div class="r">${c.logo ? `<img src="${BRAND_LOGO}" alt="">` : ''}${c.brand ? `<b style="color:#1D63B8;letter-spacing:.08em">${esc(c.brandName)}</b><br>` : ''}${right}<br>製表 ${dt(Date.now(), true)}</div></div>`;
}

function studentPage(id) {
  const s = D.students.find(x => x.id === id);
  const atts = D.attempts.filter(a => a.uid === id).sort((a, b) => b.start - a.start);
  const F = ROLE === 'director' ? D.fields : ['練習次數', '最近練習', '平均分數', '學習報告', '需加強'];
  const has = k => F.indexOf(k) >= 0;
  const unitRows = D.units.map((u, i) => `<tr><td>${u.no} ${esc(u.name)}</td><td>${s.cnt ? s.cnt[i] : '—'}</td><td>${s.best && s.best[i] !== null ? s.best[i] : '—'}</td></tr>`).join('');
  const goals = ROLE === 'teacher' && s.goals ? D.goals.filter(g => s.goals[g.code]).map(g => { const v = s.goals[g.code]; return [g, pct(v.c, v.n), v]; }).sort((a, b) => a[1] - b[1]) : [];
  const secGoals = ROLE === 'director' && has('觀念分析') && s.bySec ? D.units.map((u, i) => [u, s.bySec[i]]).filter(([u, x]) => x && x.goals.length) : [];
  return `${pdfHead('學習報告', esc(s.id + ' ' + s.name))}
    <div class="box" style="display:flex;gap:24px;flex-wrap:wrap">
      <div><div class="small" style="color:#5E6E80">學生</div><b style="font-size:20px">${esc(s.name)}</b> <span class="mono">${esc(s.id)}</span></div>
      ${has('練習次數') ? `<div><div class="small" style="color:#5E6E80">小節練習</div><b style="font-size:20px">${sum(s.cnt)}</b> 次</div><div><div class="small" style="color:#5E6E80">模擬卷</div><b style="font-size:20px">${s.mock || 0}</b> 次</div>` : ''}
      ${has('平均分數') ? `<div><div class="small" style="color:#5E6E80">小節平均</div><b style="font-size:20px">${s.avg === null || s.avg === undefined ? '—' : s.avg}</b> 分</div>` : ''}
      ${has('最近練習') ? `<div><div class="small" style="color:#5E6E80">最近練習</div><b style="font-size:16px">${dt(s.last)}</b></div>` : ''}
    </div>
    ${has('練習次數') || has('平均分數') ? `<div class="box"><h2>各小節</h2><table><thead><tr><th>小節</th><th>練習次數</th><th>最高分</th></tr></thead><tbody>${unitRows}</tbody></table></div>` : ''}
    ${has('需加強') && s.weak ? `<div class="box"><h2>需加強的觀念</h2>${s.weak.length ? s.weak.map(w => `<span class="chip t-難" style="margin:2px 6px 2px 0">✕ ${esc(w)}</span>`).join('') : '<span style="color:#5E6E80">目前沒有</span>'}</div>` : ''}
    ${goals.length ? `<div class="box"><h2>各觀念答對率</h2>${goals.map(([g, p, v]) => hbar(`${g.sec} ${g.name}`, p, colorFor(p), `${v.c}／${v.n}`)).join('')}</div>` : ''}
    ${secGoals.length ? `<div class="box"><h2>各小節觀念答對率</h2>${secGoals.map(([u, x]) => `<div style="font-weight:700;margin:8px 0 2px">${u.no} ${esc(u.name)}</div>` + x.goals.slice().sort((a, b) => pct(a.c, a.n) - pct(b.c, b.n)).map(g => hbar(g.name, pct(g.c, g.n), colorFor(pct(g.c, g.n)), `${g.c}／${g.n}`)).join('')).join('')}</div>` : ''}
    ${atts.length ? `<div class="box"><h2>測驗紀錄</h2><table><thead><tr><th>時間</th><th>範圍</th><th>分數</th><th>等第</th><th>用時</th></tr></thead><tbody>${atts.map(a => `<tr><td>${dt(a.start)}</td><td>${esc(scopeLabel(a))}</td><td>${a.status === '逾時' ? '逾時' : a.score}</td><td>${a.level || '—'}</td><td>${mmss(a.used)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
}

function sectionPdf(no) {
  const s = D.unitStats.find(x => x.no === no);
  const html = `<div>${pdfHead('小節報告', esc(s.no + ' ' + s.name))}
    <div class="box"><b style="font-size:18px">${s.no} ${esc(s.name)}</b>　${s.tries} 人次（逾時 ${s.timeouts}）・平均 ${s.avg === null ? '—' : s.avg + ' 分'}
      <div style="margin-top:8px">${LVN.map((n, i) => `<span class="chip lv-${n}" style="margin-right:6px">${n} ${s.lv[i]}</span>`).join('')}</div></div>
    <div class="box"><h2>各觀念答對率</h2>${s.goals.slice().sort((a, b) => pct(a.c, a.n) - pct(b.c, b.n)).map(g => hbar(g.name, pct(g.c, g.n), colorFor(pct(g.c, g.n)), `${g.c}／${g.n}`)).join('') || '資料還不夠。'}</div>
    <div class="box"><h2>最常錯的題目</h2>${s.miss.map(m => `<div style="margin-bottom:8px">${hbar(`${m.qid}（${m.src}）`, pct(m.c, m.n), colorFor(pct(m.c, m.n)), `${m.c}／${m.n}`)}<div class="small" style="color:#5E6E80">${fmt(m.stem)}…</div></div>`).join('') || '資料還不夠。'}</div>
    <div class="box"><h2>需要關心的學生</h2>${s.watch.map(w => `${esc(w.name)}（${w.score} 分）`).join('、') || '目前沒有'}</div>
    <div class="box"><h2>學生最高分</h2><table><thead><tr><th>學號</th><th>姓名</th><th>練習次數</th><th>最高分</th></tr></thead><tbody>${D.students.map(st => { const i = D.units.findIndex(u => u.no === no); return `<tr><td>${esc(st.id)}</td><td>${esc(st.name)}</td><td>${st.cnt[i]}</td><td>${st.best[i] === null ? '—' : st.best[i]}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  return run('產生 PDF 中…', () => savePdf(html, `國八二段_小節報告_${no}.pdf`)).catch(() => { });
}

function mockPdf(L) {
  const m = D.mocks.find(x => x.L === L);
  const bars = (list, val) => list.map(x => hbar(x.label, pct(x.c, x.n), colorFor(pct(x.c, x.n)), val(x))).join('') || '資料還不夠。';
  const html = `<div>${pdfHead('模擬卷報告', esc(m.name))}
    <div class="box"><b style="font-size:18px">${esc(m.name)}</b>　${esc(m.word)}・${esc(m.src)}　${m.tries} 人次（逾時 ${m.timeouts}）・平均 ${m.avg === null ? '—' : m.avg + ' 分'}
      <div style="margin-top:8px">${LVN.map((n, i) => `<span class="chip lv-${n}" style="margin-right:6px">${n} ${m.lv[i]}</span>`).join('')}</div></div>
    <div class="box"><h2>各觀念答對率</h2>${bars(m.goals.slice().sort((a, b) => pct(a.c, a.n) - pct(b.c, b.n)).map(g => Object.assign({ label: g.name }, g)), x => `${x.c}／${x.n}`)}</div>
    <div class="box"><h2>各小節答對率</h2>${bars((m.secs || []).map(x => Object.assign({ label: `${x.no} ${x.name}` }, x)), x => `${x.c}／${x.n}`)}</div>
    <div class="box"><h2>最常錯的題目</h2>${m.miss.map(q => `<div style="margin-bottom:8px">${hbar(`${q.qid}（${q.src}）`, pct(q.c, q.n), colorFor(pct(q.c, q.n)), `${q.c}／${q.n}`)}<div class="small" style="color:#5E6E80">${fmt(q.stem)}…</div></div>`).join('') || '資料還不夠。'}</div>
    <div class="box"><h2>需要關心的學生</h2>${m.watch.map(w => `${esc(w.name)}（${w.score} 分）`).join('、') || '目前沒有'}</div></div>`;
  return run('產生 PDF 中…', () => savePdf(html, `國八二段_模擬卷報告_${m.L}卷.pdf`)).catch(() => { });
}

function exportXlsx() {
  const head = ['學號', '姓名'].concat(D.units.map(u => u.no + ' 次數'), D.units.map(u => u.no + ' 最高'), ['模擬卷次數', '小節平均', '最近練習', '需加強']);
  const stu = [head].concat(D.students.map(s => [s.id, s.name].concat(s.cnt, s.best.map(v => v === null ? '' : v), [s.mock || 0, s.avg === null ? '' : s.avg, s.last ? dt(s.last, true) : '', s.weak.join('、')])));
  const att = [['時間', '學號', '姓名', '類型', '範圍', '分數', '答對', '題數', '狀態', '等第', '用時(秒)']].concat(
    D.attempts.slice().sort((a, b) => a.start - b.start).map(a => [dt(a.start, true), a.uid, a.name, a.type, scopeLabel(a), a.score === null ? '' : a.score, a.nRight, a.n, a.status, a.level, a.used]));
  return run('產生 Excel 中…', () => saveXlsx([['學生總表', stu], ['測驗明細', att]], `國八二段_全體學生_${dshort(Date.now()).replace('/', '')}.xlsx`)).catch(() => { });
}

/* ---------- 匯入 ---------- */
async function importBank() {
  const f = $('#bankFile').files[0];
  if (!f) return toast('請先選擇 bank.json');
  let bank;
  try { bank = JSON.parse(await f.text()); } catch (e) { return toast('檔案不是正確的 JSON'); }
  if (!bank.questions) return toast('這不是題庫檔（找不到 questions）');
  try {
    const r = await run(`匯入 ${bank.questions.length} 題中…`, () => api('tImport', { token: TOKEN, bank }));
    toast(`已匯入 ${r.imported} 題`);
    await load();
    view = 'bank'; render();
  } catch (e) { /* 已提示 */ }
}
async function importRoster(mode) {
  const text = $('#rosterTxt').value.trim();
  if (!text) return toast('請先貼上名單');
  if (mode === 'replace' && !confirm('確定要用這份名單整份取代目前的名單？\n不在新名單裡的學生（包括自動加入的）會移出名單；作答紀錄不會刪除。')) return;
  try {
    const r = await run('更新名單中…', () => api('tRoster', { token: TOKEN, text, mode }));
    toast(`名單共 ${r.count} 人` + (r.bad.length ? `，${r.bad.length} 行格式不對沒加入` : ''), 5000);
    await load(); view = 'bank'; render();
  } catch (e) { /* 已提示 */ }
}

async function clearRecords(mode) {
  if (mode === 'all') {
    if ((prompt('會刪除所有學生與訪客的作答紀錄，不能復原。\n確定要清除，請輸入「清除」：') || '').trim() !== '清除') return toast('沒有清除');
  } else if (!confirm('確定要清除所有訪客的作答紀錄？（不能復原）')) return;
  try {
    const r = await run('清除中…', () => api('tClear', { token: TOKEN, mode }));
    toast(`已清除 ${r.removed} 筆測驗紀錄`, 4000);
    await load(); view = 'bank'; render();
  } catch (e) { /* 已提示 */ }
}

/* ---------- 名單整理與網站設定 ---------- */
async function saveCode() {
  const v = $('#codeIn').value.replace(/\s+/g, '').toUpperCase();
  if (!v) return toast('請先輸入新的通行碼');
  if (!confirm(`通行碼要改成「${v}」？\n改了以後，所有學生都要用新通行碼重新登入。`)) return;
  try {
    const r = await run('儲存中…', () => api('tSet', { token: TOKEN, key: 'code', value: v }));
    D.config = r.config; D.code = r.code; render();
    toast(`通行碼已改成 ${r.code}`, 4000);
  } catch (e) { /* 已提示 */ }
}
async function setPdfQ(v) {
  try {
    const r = await run('儲存中…', () => api('tSet', { token: TOKEN, key: 'pdfQ', value: v }));
    D.config = r.config; render(); toast('學生 PDF 附題目：' + v);
  } catch (e) { /* 已提示 */ }
}
async function ackAll() {
  try { const r = await run('更新名單中…', () => api('tAck', { token: TOKEN, ids: 'all' })); toast(`已確認 ${r.acked} 位新同學`); await load(); } catch (e) { /* 已提示 */ }
}
async function mergeStu() {
  const from = $('#mgFrom').value, to = $('#mgTo').value;
  if (!from || from === to) return toast('請選兩位不同的學生');
  const nm = id => { const s = D.students.find(x => x.id === id); return s ? `${s.id} ${s.name}` : id; };
  if (!confirm(`把「${nm(from)}」併到「${nm(to)}」？\n「${nm(from)}」的作答紀錄會搬過去，並移出名單。`)) return;
  try { const r = await run('合併中…', () => api('tMerge', { token: TOKEN, from, to })); DSEL.clear(); toast(`已合併，搬了 ${r.moved} 次測驗紀錄`, 4000); await load(); } catch (e) { /* 已提示 */ }
}
async function delStu() {
  const list = D.students.filter(s => DSEL.has(s.id));
  if (!list.length) return toast('請先勾選學生');
  if (!confirm(`刪除這 ${list.length} 位學生？\n${list.slice(0, 10).map(s => s.id + ' ' + s.name).join('、')}${list.length > 10 ? '…' : ''}\n會連同作答紀錄一起刪除，不能復原。`)) return;
  try { const r = await run('刪除中…', () => api('tDelStu', { token: TOKEN, ids: list.map(s => s.id) })); DSEL.clear(); toast(`已刪除 ${r.students} 位學生、${r.removed} 次測驗紀錄`, 4000); await load(); } catch (e) { /* 已提示 */ }
}

boot();
