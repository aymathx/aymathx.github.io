/* 國七。二段練習區 — 學生端、老師端共用的工具（API、數學排版、PDF、提示） */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const LETTERS = 'ABCD';
const BRAND_LOGO = 'assets/ay-logo-blue.png?v=2';

/* ---------- 本機儲存（無痕模式等情況可能不能用，一律包 try） ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('g7.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('g7.' + k, JSON.stringify(v)); } catch (e) { /* 不能存就算了 */ } },
  del(k) { try { localStorage.removeItem('g7.' + k); } catch (e) { /* 同上 */ } }
};

/* ---------- 後端 ---------- */
const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const API_URL = LOCAL ? '/api' : ((window.G7_CONFIG && window.G7_CONFIG.api) || '');

async function api(a, data) {
  if (!API_URL || API_URL.indexOf('https://script.google.com/') !== 0 && !LOCAL) {
    throw new Error('網站還沒接上後端：請老師在 assets/config.js 貼上 Apps Script 網址。');
  }
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ a }, data || {}))
    });
  } catch (e) {
    throw new Error('網路連線失敗，請確認網路後再試一次。');
  }
  if (!res.ok) throw new Error('伺服器忙碌中（' + res.status + '），請稍後再試。');
  let j;
  try { j = await res.json(); } catch (e) { throw new Error('伺服器回應格式錯誤，請稍後再試。'); }
  if (!j.ok) { const err = new Error(j.error || '發生錯誤'); err.server = true; throw err; }
  return j;
}

/* ---------- 提示與忙碌 ---------- */
let toastT;
function toast(msg, ms) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2800);
}
let busyN = 0;
function busy(on, msg) {
  busyN = Math.max(0, busyN + (on ? 1 : -1));
  let b = $('#busy');
  if (!b) { b = document.createElement('div'); b.id = 'busy'; b.className = 'busy'; b.innerHTML = '<div><span class="spin"></span><span></span></div>'; document.body.appendChild(b); }
  if (on && msg) b.querySelector('span:last-child').textContent = msg;
  b.hidden = busyN === 0;
}
async function run(msg, fn) {
  busy(true, msg);
  try { return await fn(); } catch (e) { toast(e.message || String(e), 4200); throw e; } finally { busy(false); }
}

/* ---------- 數學排版 ----------
   題目記號：^{..} 上標、a／b 分數、3又1／4 帶分數、{U} 填答格、‹..› 底線、‾{AB} 線段上橫線、«..» 原樣文字 */
// 分子、分母：一串數字字母，或一組括號；後面可帶次方
const ATOM = '(?:\\([^()]*\\)|[0-9A-Za-zα-ω甲乙丙丁戊□△○☆？?.]+)(?:\\^\\{[^{}]*\\})?';
const FRAC_RE = new RegExp('(' + ATOM + ')／(' + ATOM + ')', 'g');
const sup = s => s.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>');
function fmt(s, opt) {
  opt = opt || {};
  let k = 0;
  const nb = (String(s).match(/\{U\}/g) || []).length;
  let h = esc(s)
    .replace(/«([^»]*)»/g, '$1')
    .replace(/\{((?:[^{}]|\{[^{}]*\})+)\}／\{((?:[^{}]|\{[^{}]*\})+)\}/g, (m, a, b) => `<span class="frac"><span>${sup(a)}</span><span>${sup(b)}</span></span>`)
    .replace(FRAC_RE, (m, a, b) => `<span class="frac"><span>${sup(a)}</span><span>${sup(b)}</span></span>`);
  h = sup(sup(h))
    .replace(/(\d)又(?=<span class="frac">)/g, '$1')
    .replace(/‹([^›]*)›/g, '<u>$1</u>')
    .replace(/‾\{([^{}]*)\}/g, '<span style="text-decoration:overline">$1</span>')
    .replace(/\{U\}/g, () => { k++; return `<span class="blank">${nb > 1 || opt.num ? '①②③④⑤⑥'.charAt(k - 1) : ''}</span>`; })
    .replace(/\n/g, '<br>');
  return h;
}
/** 學生打的答案（2^3×3^2、-3/4）轉成排版預覽 */
function fmtTyped(s) {
  const t = String(s || '').replace(/\^\(([^)]*)\)/g, '^{$1}').replace(/\^([0-9a-z]+)/gi, '^{$1}').replace(/\//g, '／').replace(/-/g, '－');
  return fmt(t);
}
const tierChip = (tier, showSrc) => tier === '會考' ? (showSrc ? '<span class="chip t-會考">會考</span>' : '') : `<span class="chip t-${tier}">${tier}</span>`;

/* ---------- 日期 ---------- */
const pad2 = n => String(n).padStart(2, '0');
function dt(ms, withYear) {
  if (!ms) return '—';
  const d = new Date(ms);
  return (withYear ? d.getFullYear() + '/' : '') + `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const dshort = ms => { if (!ms) return '—'; const d = new Date(ms); return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`; };

/* ---------- 外部函式庫（用到才載入） ---------- */
const LIBS = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
};
const loaded = {};
function lib(name) {
  if (!loaded[name]) {
    loaded[name] = new Promise((ok, bad) => {
      const s = document.createElement('script');
      s.src = LIBS[name]; s.onload = ok; s.onerror = () => { delete loaded[name]; bad(new Error('下載元件失敗，請確認網路後再試。')); };
      document.head.appendChild(s);
    });
  }
  return loaded[name];
}

/** 把一段 HTML 排成 A4 PDF 下載 */
async function savePdf(html, filename) {
  await lib('pdf');
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  let st = $('#pdfStage');
  if (!st) { st = document.createElement('div'); st.id = 'pdfStage'; document.body.appendChild(st); }
  st.innerHTML = html;
  await Promise.all(Array.from(st.querySelectorAll('img')).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  try {
    await window.html2pdf().set({
      margin: [10, 10, 12, 10], filename,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.rv', '.box', '.goal', 'tr'] }
    }).from(st.firstElementChild || st).save();
  } finally { st.innerHTML = ''; }
}

async function saveXlsx(sheets, filename) {
  await lib('xlsx');
  const wb = window.XLSX.utils.book_new();
  sheets.forEach(([name, rows]) => window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31)));
  window.XLSX.writeFile(wb, filename);
}

/* ---------- 報告（學生端畫面、PDF、老師端共用） ---------- */
const ICON = {
  down: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  go: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  check: '<svg class="i ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  out: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  redo: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>'
};
const ST_ICON = { '需加強': '✕', '不穩': '▲', '掌握': '●' };

function yourText(it) {
  const y = it.yours;
  if (y === null || y === undefined || y === '' || (Array.isArray(y) && y.every(v => !v))) return '未作答';
  if (it.type === 'mc') return typeof y === 'number' ? `(${LETTERS.charAt(y)})` : `(${esc(y)})`;
  const arr = Array.isArray(y) ? y : [y];
  return arr.map((v, i) => (arr.length > 1 ? '①②③④⑤⑥'.charAt(i) + ' ' : '') + (v ? fmtTyped(v) : '—')).join('　');
}
function rightText(it) {
  if (it.type === 'mc') { const k = LETTERS.indexOf(it.correct); return `(${it.correct}) ${it.opts && it.opts[k] !== undefined ? fmt(it.opts[k]) : ''}`; }
  const arr = it.correct || [];
  return arr.map((v, i) => (arr.length > 1 ? '①②③④⑤⑥'.charAt(i) + ' ' : '') + fmt(v)).join('　');
}

function alineText(aline) {
  return fmt(String(aline || '').replace(/\{U\}/g, '＿＿'));
}

/** 題目回顧一題（報告頁、PDF 共用） */
function reviewItem(it, no, showSrc) {
  if (it.missing) return `<div class="rv"><b>第 ${no} 題</b> <span class="muted">（題目已從題庫移除）</span></div>`;
  const src = showSrc && it.src ? `<span class="src">【${esc(it.src)}】</span>` : '';
  const opts = it.type === 'mc' ? `<div class="small muted">${it.opts.map((o, j) => `(${LETTERS.charAt(j)}) ${fmt(o)}`).join('　')}</div>` : '';
  const aline = it.type === 'fill' && it.aline && it.aline !== '{U}' ? `<div class="small muted">${alineText(it.aline)}</div>` : '';
  const pts = it.pts ? `<span class="small muted">${it.pts} 分</span>` : '';
  return `<div class="rv">
    <div class="qhead" style="margin:0"><b>第 ${no} 題</b>${tierChip(it.tier, showSrc)}${src}${pts}<span class="${it.right ? 'o' : 'x'} small">${it.right ? '○ 答對' : '✕ 答錯'}</span></div>
    <div class="stem" style="font-size:15px">${fmt(it.stem)}</div>
    ${it.fig ? `<img class="fig small" src="assets/fig/${esc(it.fig)}" alt="題目附圖" crossorigin="anonymous">` : ''}
    ${opts}${aline}
    <div class="ans">你的答案 <span class="${it.right ? 'o' : 'x'}">${yourText(it)}</span>　正解 <span class="o">${rightText(it)}</span></div>
    <div class="expl"><b>解析</b>　${it.ex ? fmt(it.ex) : '<span class="ex-pending">解析整理中。</span>'}</div>
  </div>`;
}

function goalRow(g) {
  return `<div class="goal"><span class="ic st-${g.status}">${ST_ICON[g.status]}</span><span class="nm">${esc(g.name)}</span><span class="badge st-${g.status}">${g.status}<span>答對 ${g.c}／${g.n} 題</span></span>${g.status !== '掌握' && g.tip ? `<span class="tip">${esc(g.tip)}</span>` : ''}</div>`;
}

const hbar = (label, p, cls, val) => `<div class="hb"><span class="lb" title="${esc(label)}">${esc(label)}</span><span class="tr"><i class="${cls}" style="width:${Math.max(0, Math.min(100, p))}%"></i></span><span class="v">${val === undefined ? p + '%' : val}</span></div>`;
const colorFor = p => p >= 80 ? 'c-ok' : p >= 65 ? 'c-st' : p >= 50 ? 'c-warn' : 'c-bad';
const pct = (c, n) => n ? Math.round(c / n * 100) : 0;

/** 一次測驗的 PDF 內容 */
function reportPdfHtml(r, brand) {
  const head = `<div class="ph"><div><div style="font-size:12px;color:#E8692A;font-weight:700;letter-spacing:.08em">${esc(brand.term || '')} ${r.type === '模擬' ? '段考模擬' : '小節練習'}</div><h1>${esc(brand.site || '國七。二段練習區')}</h1></div>
    <div class="r">${brand.logo ? `<img src="${BRAND_LOGO}" alt="">` : ''}${brand.brand ? `<b style="color:#1D63B8;letter-spacing:.08em">${esc(brand.brandName)}</b><br>` : ''}${esc(r.uid && r.uid.indexOf('G-') !== 0 ? r.uid + ' ' + r.name : '訪客')}<br>${dt(r.start, true)}</div></div>`;
  const score = `<div class="box" style="display:flex;gap:20px;align-items:center">
    <div class="big">${r.score}<small style="font-size:15px;color:#5E6E80">／100</small></div>
    <div><div><b style="font-size:17px">${esc(r.title)}</b>　<span class="level lv-${r.level}" style="font-size:14px">${r.level}</span></div>
    <div class="small">用時 ${mmss(r.used)}・答對 ${r.nRight}／${r.n}・平均每題 ${r.avgSec} 秒${r.type === '練習' ? '・快速作答 ' + r.fast + ' 題' : ''}</div>
    <div style="font-weight:700;margin-top:4px">${esc(r.line)}</div></div></div>`;
  const secs = r.secs ? `<div class="box"><h2>各小節答對率</h2><div class="secbars">${r.secs.map(s => hbar(`${s.no} ${s.name}`, pct(s.c, s.n), colorFor(pct(s.c, s.n)), `${s.c}／${s.n}`)).join('')}</div></div>` : '';
  const goals = r.goals && r.goals.length ? `<div class="box"><h2>學習目標</h2>${r.goals.map(goalRow).join('')}<p class="small" style="color:#5E6E80;margin-top:6px">右邊數字＝這次這個目標答對幾題／考了幾題；燈號會再加上最近 3 次一起判斷。</p></div>` : '';
  const items = r.items.map((it, i) => reviewItem(it, i + 1, r.src)).join('');
  return `<div class="pg">${head}${score}${secs}${goals}<div class="box"><h2>題目回顧與解析</h2>${items}</div></div>`;
}

function reportFileName(r) {
  const d = new Date(r.start);
  const who = r.uid && r.uid.indexOf('G-') !== 0 ? r.uid + r.name : '訪客';
  return `國七二段_${r.type === '模擬' ? '模擬' + r.scope + '卷' : r.scope}_${who}_${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.pdf`;
}
