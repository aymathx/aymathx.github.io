/* 國七。二段練習 — 老師端（teacher.html）與補習班主任唯讀檢視（director.html） */
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
  show('main');
  render();
}

/* ---------- 版面 ---------- */
const TABS = [['overview', '總覽'], ['students', '學生'], ['sections', '小節'], ['mocks', '模擬卷'], ['export', '匯出與權限'], ['settings', '網站設定'], ['bank', '題庫與名單']];
function render() {
  if (ROLE === 'teacher') {
    const base = view.split(':')[0];
    const cur = { student: 'students', section: 'sections' }[base] || base;
    $('#tnav').innerHTML = TABS.map(([k, l]) => `<button data-tv="${k}" aria-current="${cur === k}">${l}</button>`).join('');
  }
  const [base, arg] = view.split(':');
  $('#tBody').innerHTML = VIEWS[base](arg);
}
document.addEventListener('click', e => {
  const v = e.target.closest('[data-tv]');
  if (v) { view = v.dataset.tv; render(); scrollTo({ top: 0 }); }
});

function donut(lv) {
  const tot = sum(lv) || 1; let acc = 0;
  const vars = ['var(--ok)', 'var(--exam)', 'var(--warn)', 'var(--bad)'];
  const stops = lv.map((v, i) => { const a = acc; acc += v / tot * 100; return `${vars[i]} ${a}% ${acc}%`; }).join(',');
  return `<div class="donutwrap"><div class="donut" style="background:${sum(lv) ? `conic-gradient(${stops})` : '#E8EDF3'}"><span>${sum(lv)}<br>人次</span></div>
    <div class="legend2">${lv.map((v, i) => `<span><i class="c-${LVC[i]}"></i>${LVN[i]}　<span class="mono">${v}</span></span>`).join('')}</div></div>`;
}
const trendBars = list => list.length ? `<div class="trend">${list.map(t => `<div title="${esc(scopeLabel(t))} ${dt(t.start)}"><span>${t.score === null ? '逾時' : t.score}</span><i class="${t.score === null ? 'c-bad' : colorFor(t.score)}" style="height:${Math.max(t.score || 0, 6) * 0.8}px"></i><em>${esc(t.type === '模擬' ? t.scope + '卷' : t.scope)}</em></div>`).join('')}</div>` : '<p class="muted" style="margin-top:8px">還沒有紀錄。</p>';
const attList = (list, pdfAttr) => list.length ? `<div class="hist">${list.map(a => `<div class="h"><div><b>${esc(scopeLabel(a))}</b>　<span class="mono small muted">${dt(a.start)}</span>　<span class="small ${a.status === '逾時' ? 'x' : ''}">${a.status === '逾時' ? '逾時' : a.score + ' 分・' + a.level}</span></div>${a.status === '完成' ? `<button class="btn ghost sm" ${pdfAttr}="${a.aid}">${ICON.down}PDF</button>` : ''}</div>`).join('')}</div>` : '<p class="muted small">沒有紀錄。</p>';

const VIEWS = {
  overview: () => {
    const o = D.overview;
    const recent = D.attempts.slice().sort((a, b) => b.start - a.start).slice(0, 8);
    return `<div class="kpis">
      <div class="kpi"><b>${o.weekTries}</b><span>本週練習人次</span></div>
      <div class="kpi"><b>${o.avg === null ? '—' : o.avg}</b><span>小節練習平均分數</span></div>
      <div class="kpi"><b>${o.weekTimeouts}</b><span>本週逾時次數</span></div>
      <div class="kpi"><b>${o.never}<small style="font-size:14px;color:var(--muted)">／${o.students}</small></b><span>還沒練習的人</span></div></div>
    <div class="cols">
      <div class="panel"><h3>各小節平均分數</h3><div style="margin-top:8px">${D.unitStats.map(s => hbar(`${s.no} ${s.name}`, s.avg || 0, colorFor(s.avg || 0), s.avg === null ? '—' : s.avg + ' 分')).join('')}</div><p class="small muted" style="margin-top:6px">只算完成的小節練習。</p></div>
      <div class="panel"><h3>全班最弱的 3 個觀念</h3><div style="margin-top:8px">${o.weakest.map(w => hbar(`${w.name}（${w.sec}）`, pct(w.c, w.n), colorFor(pct(w.c, w.n)))).join('') || '<p class="muted">資料還不夠。</p>'}</div><p class="small muted" style="margin-top:6px">百分比＝全班在這個觀念的答對率。</p></div>
    </div>
    <div class="panel" style="display:grid;gap:4px"><h3>最近的測驗</h3>${recent.length ? `<div class="hist">${recent.map(a => `<div class="h"><div><b>${esc(a.name)}</b> <span class="mono small muted">${esc(a.uid)}</span>　${esc(scopeLabel(a))}　<span class="mono small muted">${dt(a.start)}</span></div><span class="small ${a.status === '逾時' ? 'x' : ''}">${a.status === '逾時' ? '逾時' : a.score + ' 分'}</span></div>`).join('')}</div>` : '<p class="muted small">還沒有學生作答。</p>'}</div>`;
  },

  students: () => `<p class="small muted">點一位學生，看他的詳細表現。</p>
    <div class="tbl"><table><thead><tr><th>座號</th><th>姓名</th><th>練習次數</th><th>模擬卷</th><th>平均分數</th><th>最近練習</th><th>需加強</th></tr></thead><tbody>
    ${D.students.map(s => `<tr class="link" data-tv="student:${s.id}"><td class="mono">${s.id}</td><td>${esc(s.name)}</td><td>${sum(s.cnt) || '<span class="x">0</span>'}</td><td>${s.mock || 0}</td><td>${s.avg === null ? '—' : s.avg}</td><td>${dshort(s.last)}</td><td>${esc(s.weak.slice(0, 2).join('、')) || '—'}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">名單是空的，請到「題庫與名單」貼上名單。</td></tr>'}
    </tbody></table></div>`,

  student: id => {
    const s = D.students.find(x => x.id === id);
    if (!s) return '<p class="muted">找不到這位學生。</p>';
    const atts = D.attempts.filter(a => a.uid === id).sort((a, b) => b.start - a.start);
    const goalBars = D.goals.filter(g => s.goals[g.code]).map(g => { const v = s.goals[g.code]; return [g, pct(v.c, v.n), v]; }).sort((a, b) => a[1] - b[1]);
    return `<button class="back" data-tv="students">${ICON.back}學生列表</button>
    <div class="row between"><h3 style="font-size:20px">${esc(s.name)} <span class="muted small mono">${esc(s.id)}</span></h3><button class="btn ghost sm" data-spdf="${s.id}">${ICON.down}匯出這位學生的報告</button></div>
    <div class="cards4">${D.units.map((u, i) => `<div class="card"><span class="small muted">${u.no} ${esc(u.name)}</span><b>${s.cnt[i]} 次</b><span class="small">${s.best[i] === null ? '還沒完成' : '最高 ' + s.best[i] + ' 分'}</span></div>`).join('')}</div>
    <div class="cols">
      <div class="panel"><h3>最近幾次分數</h3>${trendBars(s.trend)}</div>
      <div class="panel"><h3>需加強的觀念</h3><div class="weak" style="margin-top:10px">${s.weak.map(w => `<span class="chip t-難">✕ ${esc(w)}</span>`).join('') || '<span class="muted">目前沒有</span>'}</div></div>
    </div>
    <div class="panel"><h3>各觀念答對率（小節練習累計）</h3><div style="margin-top:8px">${goalBars.map(([g, p, v]) => hbar(`${g.sec} ${g.name}`, p, colorFor(p), `${v.c}／${v.n}`)).join('') || '<p class="muted">還沒有資料。</p>'}</div></div>
    <div class="panel" style="display:grid;gap:4px"><h3>測驗紀錄</h3>${attList(atts, 'data-apdf')}</div>`;
  },

  sections: () => `<p class="small muted">點一個小節，看全班在哪些觀念比較弱。</p>
    <div class="cards4">${D.unitStats.map(s => `<button class="card" data-tv="section:${s.no}"><b>${s.no}</b><span>${esc(s.name)}</span><span class="small muted">${s.tries} 人次・平均 ${s.avg === null ? '—' : s.avg + ' 分'}</span></button>`).join('')}</div>`,

  section: no => {
    const s = D.unitStats.find(x => x.no === no);
    return `<button class="back" data-tv="sections">${ICON.back}小節列表</button>
    <div class="row between"><h3 style="font-size:20px">${s.no} ${esc(s.name)}</h3><button class="btn ghost sm" data-secpdf="${s.no}">${ICON.down}匯出這個小節的報告</button></div>
    <p class="small muted">${s.tries} 人次（其中逾時 ${s.timeouts}）・平均 ${s.avg === null ? '—' : s.avg + ' 分'}</p>
    <div class="cols">
      <div class="panel"><h3>各觀念答對率</h3><div style="margin-top:8px">${s.goals.slice().sort((a, b) => pct(a.c, a.n) - pct(b.c, b.n)).map(g => hbar(g.name, pct(g.c, g.n), colorFor(pct(g.c, g.n)), `${pct(g.c, g.n)}%`)).join('') || '<p class="muted">資料還不夠。</p>'}</div></div>
      <div class="panel"><h3>等第分布</h3><div style="margin-top:10px">${donut(s.lv)}</div></div>
    </div>
    <div class="cols">
      <div class="panel"><h3>最常錯的題目</h3><div style="margin-top:8px;display:grid;gap:10px">${s.miss.map(m => `<div>${hbar(`${m.qid}（${m.src}）`, pct(m.c, m.n), colorFor(pct(m.c, m.n)), `${m.c}／${m.n}`)}<div class="small muted">${fmt(m.stem)}…</div></div>`).join('') || '<p class="muted">資料還不夠（每題至少 2 人次才列）。</p>'}</div></div>
      <div class="panel"><h3>需要關心的學生</h3><p class="small muted">最近一次這節練習不到 60 分</p><div class="weak" style="margin-top:10px">${s.watch.map(w => `<button class="chip t-中" style="border:0" data-tv="student:${w.id}">${esc(w.name)}（${w.score} 分）</button>`).join('') || '<span class="muted">目前沒有</span>'}</div></div>
    </div>`;
  },

  mocks: () => `<div class="tbl"><table><thead><tr><th>卷別</th><th>來源（學生看不到）</th><th>難度</th><th>作答人次</th><th>平均分數</th></tr></thead><tbody>
    ${D.mocks.map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.src)}</td><td>${esc(m.word)}</td><td>${m.tries}</td><td>${m.avg === null ? '—' : m.avg}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">還沒有匯入模擬卷。</td></tr>'}
    </tbody></table></div>
    <div class="panel" style="display:grid;gap:4px"><h3>模擬卷作答紀錄</h3>${attList(D.attempts.filter(a => a.type === '模擬').sort((a, b) => b.start - a.start).slice(0, 30).map(a => Object.assign({}, a, { scope: a.scope })), 'data-apdf')}</div>`,

  export: () => `<div class="cols">
      <div class="panel" style="display:grid;gap:10px"><h3>個別學生報告</h3><select id="exStu" aria-label="選擇學生">${D.students.map(s => `<option value="${s.id}">${s.id} ${esc(s.name)}</option>`).join('')}</select><div class="row"><button class="btn sm" id="exStuBtn">${ICON.down}匯出 PDF</button></div></div>
      <div class="panel" style="display:grid;gap:10px"><h3>全體學生報告</h3><p class="small muted">PDF 每人一頁，含練習次數、分數、需加強的觀念；Excel 含每次測驗明細。</p><div class="row"><button class="btn sm" id="exAllPdf">${ICON.down}匯出 PDF</button><button class="btn ghost sm" id="exAllXlsx">匯出 Excel</button></div></div>
      <div class="panel" style="display:grid;gap:10px"><h3>小節報告</h3><select id="exSec" aria-label="選擇小節">${D.unitStats.map(s => `<option value="${s.no}">${s.no} ${esc(s.name)}</option>`).join('')}</select><div class="row"><button class="btn sm" id="exSecBtn">${ICON.down}匯出 PDF</button></div></div>
      <div class="panel" style="display:grid;gap:10px">
        <div class="row between"><h3>補習班主任權限</h3><button class="sw" role="switch" aria-checked="${D.config.dir}" data-set="dir" aria-label="開放主任檢視"></button></div>
        <p class="small muted">主任用存取碼登入「學習動態」網頁，只能看、不能改，看不到題目和答案。</p>
        <div>存取碼　<span class="code">${esc(D.dcode)}</span></div>
        <div class="small">網址　<span class="mono">${esc(location.href.replace(/teacher\.html.*$/, 'director.html'))}</span>　<button class="btn ghost sm" id="copyDir">複製</button></div>
        <div class="checks">${['練習次數', '最近練習', '平均分數', '學習報告', '需加強'].map(k => `<label><input type="checkbox" data-field="${k}"${D.dfields.indexOf(k) >= 0 ? ' checked' : ''}> ${k === '學習報告' ? '下載學習報告' : k === '需加強' ? '需加強的觀念' : k}</label>`).join('')}<label class="muted"><input type="checkbox" disabled> 題目與答案（不開放）</label></div>
        <p class="small muted">存取碼要改的話，到試算表「設定」改「主任存取碼」。</p>
      </div>
    </div>`,

  settings: () => {
    const c = D.config;
    const onOff = (on, a, b) => on ? `<span class="state" style="color:var(--ok)">${a}</span>` : `<span class="state muted">${b}</span>`;
    return `<div class="panel">
      <div class="setrow"><b>測驗登入</b><button class="sw" role="switch" aria-checked="${!c.open}" data-set="open" aria-label="鎖定登入"></button>
        <span class="small muted">${c.open ? '<span class="state" style="color:var(--warn)">開放中</span>：不用輸入姓名就能直接測驗，作答記為「訪客」。' : '<span class="state" style="color:var(--ok)">鎖定中</span>：要輸入名單內的班級座號姓名才能測驗。'}</span></div>
      <div class="setrow"><b>顯示題目出處</b><button class="sw" role="switch" aria-checked="${c.src}" data-set="src" aria-label="顯示題目出處"></button>
        <span class="small muted">${onOff(c.src, '顯示中', '隱藏中')}：${c.src ? '學生會看到【學校名】或【會考年度】。' : '學生看不到出處和「會考」標籤，系統照樣記錄。'}</span></div>
      <div class="setrow"><b>顯示品牌 LOGO</b><button class="sw" role="switch" aria-checked="${c.logo}" data-set="logo" aria-label="顯示品牌 LOGO"></button>
        <span class="small muted">${onOff(c.logo, '顯示中', '隱藏中')}：放在登入頁、頁首和分析報告。</span>
        <div class="pv"><img src="${BRAND_LOGO}" alt="AY MATH 標誌"><span class="small muted">講義同款的藍色 AY 標誌</span></div></div>
      <div class="setrow"><b>顯示品牌名稱</b><button class="sw" role="switch" aria-checked="${c.brand}" data-set="brand" aria-label="顯示品牌名稱"></button>
        <span class="small muted">${onOff(c.brand, '顯示中', '隱藏中')}：學校學生使用時關閉，只給補習班使用時再打開。</span>
        <div class="pv"><span style="font-weight:900;letter-spacing:.06em;color:var(--primary)">${esc(c.brandName)}</span></div></div>
    </div>
    <p class="small muted">切換後立即生效（學生重新整理網頁就會看到）。作答時間、重複題上限、老師密碼請在試算表「設定」修改。</p>`;
  },

  bank: () => {
    const rows = Object.keys(D.bank).sort().map(k => { const b = D.bank[k]; return `<tr><td><b>${esc(/^2-/.test(k) ? unitName(k) : k)}</b></td><td>${b['易']}</td><td>${b['中']}</td><td>${b['難']}</td><td>${b['會考']}</td><td>${b.all}</td><td>${b.ex}／${b.all}</td></tr>`; }).join('');
    return `<div class="tbl"><table><thead><tr><th>範圍</th><th>易</th><th>中</th><th>難</th><th>會考</th><th>合計</th><th>有解析</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">還沒有匯入題庫。</td></tr>'}</tbody></table></div>
    <div class="cols">
      <div class="panel" style="display:grid;gap:10px"><h3>匯入題庫</h3><p class="small muted">選擇 Claude 產生的 <span class="mono">bank.json</span>。會整份取代試算表的「題庫」「學習目標」「模擬卷」；學生的作答紀錄不受影響。</p>
        <input type="file" id="bankFile" accept=".json,application/json"><div class="row"><button class="btn sm" id="bankGo">匯入</button></div></div>
      <div class="panel" style="display:grid;gap:10px"><h3>學生名單</h3><p class="small muted">一行一位，例如 <span class="mono">70101陳大田</span>。目前 ${D.students.length} 人。</p>
        <textarea id="rosterTxt" rows="8" style="width:100%;border:1px solid var(--line-strong);border-radius:10px;padding:10px;font:15px/1.6 var(--f-mono)" placeholder="70101陳大田&#10;70102林小美"></textarea>
        <div class="row"><button class="btn sm" data-roster="append">加入名單</button><button class="btn ghost sm" data-roster="replace">整份取代</button></div></div>
    </div>`;
  },

  /* ---- 主任 ---- */
  dir: () => {
    const F = D.fields;
    const has = k => F.indexOf(k) >= 0;
    return `<div class="tbl"><table><thead><tr><th>座號</th><th>姓名</th>${has('練習次數') ? '<th>練習次數</th><th>模擬卷</th>' : ''}${has('最近練習') ? '<th>最近練習</th>' : ''}${has('平均分數') ? '<th>平均分數</th>' : ''}${has('需加強') ? '<th>需加強</th>' : ''}${has('學習報告') ? '<th>學習報告</th>' : ''}</tr></thead><tbody>
    ${D.students.map(s => `<tr${has('學習報告') ? ` class="link" data-tv="dstu:${s.id}"` : ''}><td class="mono">${esc(s.id)}</td><td>${esc(s.name)}</td>${has('練習次數') ? `<td>${sum(s.cnt)}</td><td>${s.mock || 0}</td>` : ''}${has('最近練習') ? `<td>${dshort(s.last)}</td>` : ''}${has('平均分數') ? `<td>${s.avg === null || s.avg === undefined ? '—' : s.avg}</td>` : ''}${has('需加強') ? `<td>${esc((s.weak || []).slice(0, 2).join('、')) || '—'}</td>` : ''}${has('學習報告') ? `<td><span class="small" style="color:var(--primary);font-weight:700">查看</span></td>` : ''}</tr>`).join('')}
    </tbody></table></div>`;
  },
  dstu: id => {
    const s = D.students.find(x => x.id === id);
    const atts = D.attempts.filter(a => a.uid === id).sort((a, b) => b.start - a.start);
    return `<button class="back" data-tv="dir">${ICON.back}學生列表</button>
    <div class="row between"><h3 style="font-size:20px">${esc(s.name)} <span class="muted small mono">${esc(s.id)}</span></h3><button class="btn ghost sm" data-spdf="${s.id}">${ICON.down}學習報告 PDF</button></div>
    <div class="panel" style="display:grid;gap:4px"><h3>每次測驗的報告</h3>${attList(atts, 'data-apdf')}</div>`;
  }
};

/* ---------- 互動 ---------- */
$('#tBody').addEventListener('click', async e => {
  const t = e.target;
  const sw = t.closest('[data-set]');
  if (sw) {
    const k = sw.dataset.set;
    const val = k === 'open' ? !D.config.open : !D.config[k];
    try {
      const r = await run('儲存中…', () => api('tSet', { token: TOKEN, key: k, value: val }));
      D.config = r.config; D.dfields = r.dfields; render();
      toast({ open: val ? '已開放：學生不用輸入姓名' : '已鎖定：要輸入名單內姓名', src: val ? '已顯示題目出處' : '已隱藏題目出處', logo: val ? '已顯示品牌 LOGO' : '已隱藏品牌 LOGO', brand: val ? '已顯示品牌名稱' : '已隱藏品牌名稱', dir: val ? '已開放主任檢視' : '已關閉主任檢視' }[k]);
    } catch (err) { /* 已提示 */ }
    return;
  }
  const ap = t.closest('[data-apdf]');
  if (ap) return attemptPdf(ap.dataset.apdf);
  const sp = t.closest('[data-spdf]');
  if (sp) return run('產生 PDF 中…', () => savePdf(`<div>${studentPage(sp.dataset.spdf)}</div>`, `國七二段_學習報告_${sp.dataset.spdf}${D.students.find(s => s.id === sp.dataset.spdf).name}.pdf`)).catch(() => { });
  const sc = t.closest('[data-secpdf]');
  if (sc) return sectionPdf(sc.dataset.secpdf);
  if (t.id === 'exStuBtn') { const id = $('#exStu').value; return run('產生 PDF 中…', () => savePdf(`<div>${studentPage(id)}</div>`, `國七二段_學習報告_${id}${D.students.find(s => s.id === id).name}.pdf`)).catch(() => { }); }
  if (t.id === 'exAllPdf') return run('產生 PDF 中（人數多會比較久）…', () => savePdf(`<div>${D.students.map((s, i) => `<div class="${i ? 'pb' : ''}">${studentPage(s.id)}</div>`).join('')}</div>`, `國七二段_全體學生報告_${dshort(Date.now()).replace('/', '')}.pdf`)).catch(() => { });
  if (t.id === 'exAllXlsx') return exportXlsx();
  if (t.id === 'exSecBtn') return sectionPdf($('#exSec').value);
  if (t.id === 'copyDir') { try { await navigator.clipboard.writeText(location.href.replace(/teacher\.html.*$/, 'director.html')); toast('已複製主任網址'); } catch (err) { toast('不能自動複製，請手動選取網址'); } return; }
  if (t.id === 'bankGo') return importBank();
  const ro = t.closest('[data-roster]');
  if (ro) return importRoster(ro.dataset.roster);
});
$('#tBody').addEventListener('change', async e => {
  const f = e.target.dataset.field;
  if (!f) return;
  const fields = $$('[data-field]').filter(x => x.checked).map(x => x.dataset.field);
  try { const r = await run('儲存中…', () => api('tSet', { token: TOKEN, key: 'dfields', value: fields.join(',') })); D.dfields = r.dfields; toast('主任可看欄位已更新'); } catch (err) { /* 已提示 */ }
});

async function attemptPdf(aid) {
  try {
    await run('產生 PDF 中…', async () => {
      const r = (await api(ROLE === 'teacher' ? 'tReport' : 'dReport', { token: TOKEN, aid })).report;
      await savePdf(reportPdfHtml(r, D.config || {}), reportFileName(r));
    });
  } catch (e) { /* 已提示 */ }
}

/* ---------- PDF 內容 ---------- */
function pdfHead(title, right) {
  const c = D.config || {};
  return `<div class="ph"><div><div style="font-size:12px;color:#E8692A;font-weight:700;letter-spacing:.08em">${esc(c.term || '')} ${esc(title)}</div><h1>${esc(c.site || '國七。二段練習')}</h1></div>
    <div class="r">${c.logo ? `<img src="${BRAND_LOGO}" alt="">` : ''}${c.brand ? `<b style="color:#1D63B8;letter-spacing:.08em">${esc(c.brandName)}</b><br>` : ''}${right}<br>製表 ${dt(Date.now(), true)}</div></div>`;
}

function studentPage(id) {
  const s = D.students.find(x => x.id === id);
  const atts = D.attempts.filter(a => a.uid === id).sort((a, b) => b.start - a.start);
  const F = ROLE === 'director' ? D.fields : ['練習次數', '最近練習', '平均分數', '學習報告', '需加強'];
  const has = k => F.indexOf(k) >= 0;
  const unitRows = D.units.map((u, i) => `<tr><td>${u.no} ${esc(u.name)}</td><td>${s.cnt ? s.cnt[i] : '—'}</td><td>${s.best && s.best[i] !== null ? s.best[i] : '—'}</td></tr>`).join('');
  const goals = ROLE === 'teacher' && s.goals ? D.goals.filter(g => s.goals[g.code]).map(g => { const v = s.goals[g.code]; return [g, pct(v.c, v.n), v]; }).sort((a, b) => a[1] - b[1]) : [];
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
    <div class="box"><h2>學生最高分</h2><table><thead><tr><th>座號</th><th>姓名</th><th>練習次數</th><th>最高分</th></tr></thead><tbody>${D.students.map(st => { const i = D.units.findIndex(u => u.no === no); return `<tr><td>${esc(st.id)}</td><td>${esc(st.name)}</td><td>${st.cnt[i]}</td><td>${st.best[i] === null ? '—' : st.best[i]}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  return run('產生 PDF 中…', () => savePdf(html, `國七二段_小節報告_${no}.pdf`)).catch(() => { });
}

function exportXlsx() {
  const head = ['座號', '姓名'].concat(D.units.map(u => u.no + ' 次數'), D.units.map(u => u.no + ' 最高'), ['模擬卷次數', '小節平均', '最近練習', '需加強']);
  const stu = [head].concat(D.students.map(s => [s.id, s.name].concat(s.cnt, s.best.map(v => v === null ? '' : v), [s.mock || 0, s.avg === null ? '' : s.avg, s.last ? dt(s.last, true) : '', s.weak.join('、')])));
  const att = [['時間', '座號', '姓名', '類型', '範圍', '分數', '答對', '題數', '狀態', '等第', '用時(秒)']].concat(
    D.attempts.slice().sort((a, b) => a.start - b.start).map(a => [dt(a.start, true), a.uid, a.name, a.type, scopeLabel(a), a.score === null ? '' : a.score, a.nRight, a.n, a.status, a.level, a.used]));
  return run('產生 Excel 中…', () => saveXlsx([['學生總表', stu], ['測驗明細', att]], `國七二段_全體學生_${dshort(Date.now()).replace('/', '')}.xlsx`)).catch(() => { });
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
  if (mode === 'replace' && !confirm('確定要用這份名單整份取代目前的名單？（作答紀錄不會刪除）')) return;
  try {
    const r = await run('更新名單中…', () => api('tRoster', { token: TOKEN, text, mode }));
    toast(`名單共 ${r.count} 人` + (r.bad.length ? `，${r.bad.length} 行格式不對沒加入` : ''), 5000);
    await load(); view = 'bank'; render();
  } catch (e) { /* 已提示 */ }
}

boot();
