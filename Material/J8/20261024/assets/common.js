/* 國八。二段練習 — 學生端、老師端共用的工具（API、數學排版、PDF、提示） */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const LETTERS = 'ABCD';
const BRAND_LOGO = 'assets/ay-logo-blue.png?v=2';

/* ---------- 本機儲存（無痕模式等情況可能不能用，一律包 try） ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('g8.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('g8.' + k, JSON.stringify(v)); } catch (e) { /* 不能存就算了 */ } },
  del(k) { try { localStorage.removeItem('g8.' + k); } catch (e) { /* 同上 */ } }
};

/* ---------- 後端 ---------- */
const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const API_URL = LOCAL ? '/api' : ((window.G8_CONFIG && window.G8_CONFIG.api) || '');

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
   題目記號：^{..} 上標、√{..} 根號、a／b 分數、{..}／{..} 複雜分數、3又1／4 帶分數、{U} 填答格、‹..› 底線、‾{AB} 線段上橫線、«..» 原樣文字 */
// 分子、分母：一串數字字母、一組括號，或已排好的根號（佔位字元，前面可帶係數）；後面可帶次方
const ATOM = '(?:\\([^()]*\\)|[0-9]*\\d+|[0-9A-Za-zα-ω甲乙丙丁戊□△○☆？?.]+)(?:\\^\\{[^{}]*\\})?';
const FRAC_RE = new RegExp('(' + ATOM + ')／(' + ATOM + ')', 'g');
const sup = s => s.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>');
/** 根號、分數、上下標（h 已跳脫）。排好的根號、分數先換成佔位字元，最後再換回，避免被後面的規則拆壞 */
function mathCore(h) {
  const box = [];
  const hold = x => '' + (box.push(x) - 1) + '';
  let i;
  while ((i = h.indexOf('√{')) >= 0) {
    let d = 0, j = i + 1;
    for (; j < h.length; j++) { if (h[j] === '{') d++; else if (h[j] === '}' && --d === 0) break; }
    if (j >= h.length) break;
    const inner = mathCore(h.slice(i + 2, j));
    const tall = inner.indexOf('class="frac"') >= 0;
    h = h.slice(0, i) + hold(`<span class="rt${tall ? ' tall' : ''}"><span class="rs">√</span><span class="rd">${inner}</span></span>`) + h.slice(j + 1);
  }
  h = h.replace(/\{((?:[^{}]|\{[^{}]*\})+)\}／\{((?:[^{}]|\{[^{}]*\})+)\}/g, (m, a, b) => hold(`<span class="frac"><span>${sup(a)}</span><span>${sup(b)}</span></span>`))
    .replace(FRAC_RE, (m, a, b) => hold(`<span class="frac"><span>${sup(a)}</span><span>${sup(b)}</span></span>`));
  h = sup(sup(h));
  while (/\d+/.test(h)) h = h.replace(/(\d+)/g, (m, n) => box[n]);
  return h;
}
function fmt(s, opt) {
  opt = opt || {};
  let k = 0;
  const nb = (String(s).match(/\{U\}/g) || []).length;
  let h = mathCore(esc(s).replace(/«([^»]*)»/g, '$1'))
    .replace(/(\d)又(?=<span class="frac">)/g, '$1')
    .replace(/‹([^›]*)›/g, '<u>$1</u>')
    .replace(/‾\{([^{}]*)\}/g, '<span style="text-decoration:overline">$1</span>')
    .replace(/\{U\}/g, () => { k++; return `<span class="blank">${nb > 1 || opt.num ? '①②③④⑤⑥'.charAt(k - 1) : ''}</span>`; })
    .replace(/\n/g, '<br>');
  return h;
}
/** 學生打的答案（2^3×3^2、-3/4）轉成排版預覽 */
function fmtTyped(s) {
  let t = String(s || '').replace(/\^\(([^)]*)\)/g, '^{$1}').replace(/\^([0-9a-z]+)/gi, '^{$1}');
  // 根號：√15、√x、√(…) → √{…}
  t = t.replace(/√([0-9.]+|[a-z])/gi, '√{$1}');
  let i;
  while ((i = t.indexOf('√(')) >= 0) {
    let d = 0, j = i + 1;
    for (; j < t.length; j++) { if (t[j] === '(') d++; else if (t[j] === ')' && --d === 0) break; }
    if (j >= t.length) break;
    t = t.slice(0, i) + '√{' + t.slice(i + 2, j) + '}' + t.slice(j + 1);
  }
  t = t.replace(/\//g, '／').replace(/-/g, '－');
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
  h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
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

/* PDF：先把內容排成一頁一頁（A4 內容區，760px 寬），每頁各自轉成圖片再放進 PDF。
   每次下載結果都一樣，不受畫面捲動位置影響，也不會超過手機瀏覽器的畫布大小上限。 */
const PDF_W = 760, PDF_H = Math.round(PDF_W * 275 / 190);   // A4 扣掉邊界（左右 10、上 10、下 12 mm）
const PDF_FOOT = 24;                                          // 頁碼列

/** 攤平成一塊一塊：外層包裝（無 class、.pg、.pb）往內拆，.pb 包裝的第一塊要換頁 */
function pdfBlocks(root) {
  const out = [];
  const walk = (el, brk) => Array.from(el.children).forEach(c => {
    const wrap = c.tagName === 'DIV' && (!c.className || /^(pg|pb)( |$)/.test(c.className));
    if (wrap && c.children.length) { walk(c, brk || c.classList.contains('pb')); brk = false; return; }
    out.push({ el: c, brk }); brk = false;
  });
  walk(root, false);
  return out;
}

/** 把塊排進頁面；放不下的框（.box 內有多項、或表格）拆成一項一項接到下一頁 */
function pdfPaginate(st, blocks) {
  const pages = [], LIMIT = PDF_H - PDF_FOOT;
  let pg;
  const newPage = () => { pg = document.createElement('div'); pg.className = 'pdfpage'; st.appendChild(pg); pages.push(pg); };
  const over = () => pg.offsetHeight > LIMIT;
  const split = b => {
    const tbl = Array.from(b.children).find(c => c.tagName === 'TABLE');
    let items, mk;
    if (tbl && tbl.tBodies[0] && tbl.tBodies[0].rows.length > 1) {
      items = Array.from(tbl.tBodies[0].rows);
      mk = () => {
        const sh = b.cloneNode(false);
        Array.from(b.children).forEach(c => {
          if (c !== tbl) { if (c.tagName === 'H2') sh.appendChild(c.cloneNode(true)); return; }
          const t = tbl.cloneNode(false);
          if (tbl.tHead) t.appendChild(tbl.tHead.cloneNode(true));
          t.appendChild(document.createElement('tbody'));
          sh.appendChild(t);
        });
        return [sh, sh.querySelector('tbody')];
      };
    } else {
      const heads = Array.from(b.children).filter(c => c.tagName === 'H2');
      items = Array.from(b.children).filter(c => c.tagName !== 'H2');
      if (items.length < 2) return false;
      mk = () => { const sh = b.cloneNode(false); heads.forEach(h => sh.appendChild(h.cloneNode(true))); return [sh, sh]; };
    }
    let i = 0, first = true;
    while (i < items.length) {
      const [sh, slot] = mk();
      const h = sh.querySelector('h2');
      if (h && !first) h.textContent += '（續）';
      pg.appendChild(sh);
      let n = 0;
      while (i < items.length) {
        slot.appendChild(items[i]);
        if (over()) { slot.removeChild(items[i]); break; }
        i++; n++;
      }
      if (!n) {
        if (pg.childElementCount > 1) { pg.removeChild(sh); newPage(); continue; }
        slot.appendChild(items[i++]);                     // 單一項目就比一頁高，只好硬放
      }
      first = false;
      if (i < items.length) newPage();
    }
    return true;
  };
  blocks.forEach(({ el, brk }) => {
    if (!pg || (brk && pg.childElementCount)) newPage();
    pg.appendChild(el);
    if (!over()) return;
    pg.removeChild(el);
    if (pg.childElementCount && !split(el)) { newPage(); pg.appendChild(el); return; }
    if (!pg.childElementCount && !split(el)) pg.appendChild(el);
  });
  return pages;
}

/** 浮水印：PDF 每頁畫在轉好的圖上（canvas 畫得出中文）；網頁上用背景圖 */
function wmDraw(cv, text) {
  const ctx = cv.getContext('2d'), fs = Math.round(cv.width / 30);
  ctx.save();
  ctx.globalAlpha = 0.08; ctx.fillStyle = '#1D3B66'; ctx.textAlign = 'center';
  ctx.font = `700 ${fs}px "Noto Sans TC", sans-serif`;
  ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate(-Math.PI / 8);
  const dx = fs * (text.length + 6), dy = fs * 5;
  for (let y = -cv.height, row = 0; y <= cv.height; y += dy, row++) {
    for (let x = -cv.width - (row % 2) * dx / 2; x <= cv.width; x += dx) ctx.fillText(text, x, y);
  }
  ctx.restore();
}
const wmBg = text => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><text x="150" y="88" text-anchor="middle" transform="rotate(-18 150 80)" font-family="Noto Sans TC, sans-serif" font-size="14" font-weight="700" fill="#1D3B66" fill-opacity="0.08">${esc(text)}</text></svg>`)}")`;

/** 把一段 HTML 排成 A4 PDF 下載；opt.wm＝每頁浮水印文字，opt.note＝頁尾左邊的警語 */
async function savePdf(html, filename, opt) {
  opt = opt || {};
  await Promise.all([lib('h2c'), lib('jspdf')]);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  let st = $('#pdfStage');
  if (!st) { st = document.createElement('div'); st.id = 'pdfStage'; document.body.appendChild(st); }
  st.innerHTML = html;
  await Promise.all(Array.from(st.querySelectorAll('img')).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  try {
    const src = st.firstElementChild || st;
    const pages = pdfPaginate(st, pdfBlocks(src));
    src.remove();
    pages.forEach((p, i) => {
      p.classList.add('fixed');
      p.insertAdjacentHTML('beforeend', `<div class="pf">${opt.note ? `<span class="pn">${esc(opt.note)}</span>` : ''}${i + 1}／${pages.length}</div>`);
      p.hidden = true;
    });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    for (let i = 0; i < pages.length; i++) {
      pages.forEach((p, j) => { p.hidden = j !== i; });  // 一次只顯示一頁，固定在畫面左上角轉圖
      const cv = await window.html2canvas(pages[i], {
        scale: 2, useCORS: true, backgroundColor: '#FFFFFF', logging: false, scrollX: 0, scrollY: 0,
        onclone: doc => { doc.getElementById('pdfStage').style.opacity = '1'; }
      });
      if (opt.wm) wmDraw(cv, opt.wm);
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 10, 10, 190, 275);
    }
    pdf.save(filename);
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

/** 多格填充的小題代號：照作答格式（⑴⑵…或①②…），對不上格數才用 ①②… */
function blankLabels(it, n) {
  const m = String(it.aline || '').match(/[①-⑳⑴-⒇]/g);
  return m && m.length === n ? m : Array.from('①②③④⑤⑥⑦⑧⑨⑩').slice(0, n);
}

function yourText(it) {
  const y = it.yours;
  if (y === null || y === undefined || y === '' || (Array.isArray(y) && y.every(v => !v))) return '未作答';
  if (it.type === 'mc') return typeof y === 'number' ? `(${LETTERS.charAt(y)})` : `(${esc(y)})`;
  const arr = Array.isArray(y) ? y : [y];
  const lb = blankLabels(it, arr.length);
  return arr.map((v, i) => (arr.length > 1 ? lb[i] + ' ' : '') + (v ? fmtTyped(v) : '—')).join('　');
}
function rightText(it) {
  if (it.type === 'mc') { const k = LETTERS.indexOf(it.correct); return `(${it.correct}) ${it.opts && it.opts[k] !== undefined ? fmt(it.opts[k]) : ''}`; }
  const arr = it.correct || [];
  const lb = blankLabels(it, arr.length);
  return arr.map((v, i) => (arr.length > 1 ? lb[i] + ' ' : '') + fmt(v)).join('　');
}

function alineText(aline) {
  return fmt(String(aline || '').replace(/\{U\}/g, '＿＿'));
}

/** 題目回顧一題（報告頁、PDF 共用） */
function reviewItem(it, no, showSrc) {
  if (it.missing) return `<div class="rv"><b>第 ${no} 題</b> <span class="muted">（題目已從題庫移除）</span></div>`;
  const src = showSrc && it.src ? `<span class="src">【${esc(it.src)}】</span>` : '';
  const opts = it.type === 'mc' ? `<div class="small muted">${it.opts.map((o, j) => `<span class="op">(${LETTERS.charAt(j)}) ${fmt(o)}</span>`).join('　')}</div>` : '';
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

/** 錯題清單的答案：選擇題只寫代號，不印選項內容 */
const ansBrief = (it, which) => it.type !== 'mc' ? (which === 'yours' ? yourText(it) : rightText(it))
  : which === 'right' ? `(${esc(it.correct)})`
  : it.yours === null || it.yours === undefined || it.yours === '' ? '未作答' : `(${typeof it.yours === 'number' ? LETTERS.charAt(it.yours) : esc(it.yours)})`;

/** 近幾次分數（同一個範圍）；少於 2 次就不畫 */
function trendHtml(list, cur) {
  if (!list || list.length < 2) return '';
  return `<div class="trend2">${list.map(t => `<div${t.start === cur ? ' class="cur"' : ''}><b>${t.score}</b><i class="${colorFor(t.score)}" style="height:${Math.max(t.score, 4) * 0.56}px"></i><span>${dshort(t.start)}</span></div>`).join('')}</div>`;
}

/** 一次測驗的 PDF 內容。qmode＝要不要印題目：不附（只列錯題清單）／只附錯題／全部（老師端）；沒給就照網站設定 */
function reportPdfHtml(r, brand, qmode) {
  qmode = qmode || brand.pdfQ || '不附';
  const head = `<div class="ph"><div><div style="font-size:12px;color:#E8692A;font-weight:700;letter-spacing:.08em">${esc(brand.term || '')} ${r.type === '模擬' ? '段考模擬' : '小節練習'}</div><h1>${esc(brand.site || '國八。二段練習')}</h1></div>
    <div class="r">${brand.logo ? `<img src="${BRAND_LOGO}" alt="">` : ''}${brand.brand ? `<b style="color:#1D63B8;letter-spacing:.08em">${esc(brand.brandName)}</b><br>` : ''}${esc(r.uid && r.uid.indexOf('G-') !== 0 ? r.uid + ' ' + r.name : '訪客')}<br>${dt(r.start, true)}</div></div>`;
  const score = `<div class="box" style="display:flex;gap:20px;align-items:center">
    <div class="big">${r.score}<small style="font-size:15px;color:#5E6E80">／100</small></div>
    <div><div><b style="font-size:17px">${esc(r.title)}</b>　<span class="level lv-${r.level}" style="font-size:14px">${r.level}</span></div>
    <div class="small">用時 ${mmss(r.used)}・答對 ${r.nRight}／${r.n}・平均每題 ${r.avgSec} 秒${r.type === '練習' ? '・快速作答 ' + r.fast + ' 題' : ''}</div>
    <div style="font-weight:700;margin-top:4px">${esc(r.line)}</div></div></div>`;
  const secs = r.secs ? `<div class="box"><h2>各小節答對率</h2><div class="secbars">${r.secs.map(s => hbar(`${s.no} ${s.name}`, pct(s.c, s.n), colorFor(pct(s.c, s.n)), `${s.c}／${s.n}`)).join('')}</div></div>` : '';
  const goals = r.goals && r.goals.length ? `<div class="box"><h2>學習目標</h2>${r.goals.map(goalRow).join('')}<p class="small" style="color:#5E6E80;margin-top:6px">右邊數字＝這次這個目標答對幾題／考了幾題；燈號只看這一次：全對＝掌握，全錯＝需加強，其餘＝不穩。</p></div>` : '';
  const next = r.next && r.next.length ? `<div class="box"><h2>下一步</h2><ul class="next">${r.next.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '';
  const tr = trendHtml(r.trend, r.start);
  const trend = tr ? `<div class="box"><h2>近幾次分數（${esc(r.type === '模擬' ? '模擬' + r.scope + '卷' : r.scope)}）</h2>${tr}</div>` : '';
  const all = r.items || [];                                           // 主任版沒有題目
  const wrong = all.map((it, i) => ({ it, no: i + 1 })).filter(x => !x.it.right && !x.it.missing);
  let qs = '';
  if (qmode === '全部' && all.length) qs = `<div class="box"><h2>題目回顧與解析</h2>${all.map((it, i) => reviewItem(it, i + 1, r.src)).join('')}</div>`;
  else if (qmode === '只附錯題' && wrong.length) qs = `<div class="box"><h2>錯題與解析</h2>${wrong.map(x => reviewItem(x.it, x.no, r.src)).join('')}</div>`;
  else if (wrong.length) qs = `<div class="box"><h2>錯題清單（完整題目和解析請上網站查看）</h2><table><thead><tr><th>題號</th><th>學習目標</th><th>難度</th><th>你的答案</th><th>正解</th></tr></thead><tbody>${wrong.map(x => `<tr><td>第 ${x.no} 題</td><td>${esc(x.it.goal || '—')}</td><td>${x.it.tier === '會考' && !r.src ? '—' : esc(x.it.tier)}</td><td>${ansBrief(x.it, 'yours')}</td><td>${ansBrief(x.it, 'right')}</td></tr>`).join('')}</tbody></table></div>`;
  else if (all.length) qs = '<div class="box"><h2>錯題</h2><p>這次全對，沒有錯題。</p></div>';
  return `<div class="pg">${head}${score}${secs}${goals}${next}${trend}${qs}</div>`;
}

function reportFileName(r) {
  const d = new Date(r.start);
  const who = r.uid && r.uid.indexOf('G-') !== 0 ? r.uid + r.name : '訪客';
  return `國八二段_${r.type === '模擬' ? '模擬' + r.scope + '卷' : r.scope}_${who}_${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.pdf`;
}
