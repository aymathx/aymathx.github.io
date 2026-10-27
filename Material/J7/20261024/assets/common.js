/* 國七。二段練習 — 學生端、老師端共用的工具（API、數學排版、PDF、提示） */
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
  h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  qr: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
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

/** 浮水印：PDF 每頁正中央畫一個淡淡的 LOGO（畫在轉好的圖上）；網頁上的錯題用學號姓名背景圖 */
const loadImg = src => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = src; });
function wmLogo(cv, im) {
  const ctx = cv.getContext('2d'), w = cv.width * 0.58, h = w * im.naturalHeight / im.naturalWidth;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
  ctx.restore();
}
const wmBg = text => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><text x="150" y="88" text-anchor="middle" transform="rotate(-18 150 80)" font-family="Noto Sans TC, sans-serif" font-size="14" font-weight="700" fill="#1D3B66" fill-opacity="0.08">${esc(text)}</text></svg>`)}")`;

/** 把一段 HTML 排成 A4 PDF 下載；opt.logo＝每頁中央淡色 LOGO，opt.note＝頁尾左邊的文字（學號姓名、報告編號、警語） */
async function savePdf(html, filename, opt) {
  opt = opt || {};
  await Promise.all([lib('h2c'), lib('jspdf')]);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  let st = $('#pdfStage');
  if (!st) { st = document.createElement('div'); st.id = 'pdfStage'; document.body.appendChild(st); }
  st.innerHTML = html;
  st.classList.toggle('rp-compact', !!st.querySelector('.rp-sec'));
  const qrs = Array.from(st.querySelectorAll('[data-qr]'));      // QR code：連到網站上的這一份報告
  if (qrs.length) {
    try {
      await lib('qr');
      qrs.forEach(el => { const q = window.qrcode(0, 'M'); q.addData(el.dataset.qr); q.make(); el.innerHTML = `<img src="${q.createDataURL(4, 0)}" alt="QR code">`; });
    } catch (e) { qrs.forEach(el => (el.closest('.rp-qrbox') || el).remove()); }
  }
  const wmImg = opt.logo ? await loadImg(BRAND_LOGO).catch(() => null) : null;
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
      if (wmImg) wmLogo(cv, wmImg);
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

/* ---------- 學習診斷報告 v3：PDF 兩頁（成績與診斷／訂正與練習），報告頁共用其中幾塊（2026-10-27） ---------- */
/** **粗體** 標記轉成 <b> */
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
/** 出處隱藏時，會考題一律叫「綜合」 */
const tierName = (t, src) => t === '會考' && !src ? '綜合' : t;
const TAGC = { 太快: 'warn', 格式: 'bad', 正負號: 'bad', 沒化簡: 'bad', 沒作答: 'gray', 觀念: 'exam' };
const rpTag = (t, c) => `<span class="rp-tag t-${c}">${esc(t)}</span>`;
/** 這份報告在網站上的網址（QR code 用）：掃了登入後直接打開這一份 */
const reportLink = aid => location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'index.html#r=' + aid;

/** 錯題清單的答案：選擇題只寫代號，不印選項內容 */
const ansBrief = (it, which) => it.type !== 'mc' ? (which === 'yours' ? yourText(it) : rightText(it))
  : which === 'right' ? `(${esc(it.correct)})`
  : it.yours === null || it.yours === undefined || it.yours === '' ? '未作答' : `(${typeof it.yours === 'number' ? LETTERS.charAt(it.yours) : esc(it.yours)})`;

/** 等第量尺：四個等第的分數範圍，標出這次的位置 */
function rpScale(score) {
  return `<div class="rp-scale"><div class="mk"><b style="left:${Math.min(96, Math.max(4, score))}%">這次 ${score} 分</b></div><div class="band"><i></i><i></i><i></i><i></i></div>
    <div class="lab"><span>需補強　0～49</span><span>待加強　50～69</span><span>穩定　70～89</span><span>精熟　90～</span></div></div>`;
}

/** 各難度答對 */
const rpTiers = r => ['易', '中', '難', '會考'].filter(t => r.tiers && r.tiers[t] && r.tiers[t].n)
  .map(t => { const x = r.tiers[t], p = pct(x.c, x.n); return hbar(tierName(t, r.src), p, colorFor(p), `${x.c}／${x.n}`); }).join('').replace(/^/, '<div class="rp-tiers">') + '</div>';

/** 在全班的位置：各等第人數（不排名）；練過的人少於 3 人不顯示 */
function rpClass(r) {
  const c = r.cls;
  if (!c || c.n < 3) return '';
  const names = ['需補強', '待加強', '穩定', '精熟'], colors = ['#D9826F', '#D9A74F', '#8E80D0', '#5FAE82'];
  const cnt = [c.lv[3], c.lv[2], c.lv[1], c.lv[0]], me = names.indexOf(r.level), top = names[cnt.indexOf(Math.max.apply(null, cnt))];
  const E = r.tiers && r.tiers['易'];
  return `<div class="rp-dist">${cnt.map((v, i) => v ? `<i style="width:${v / c.n * 100}%;background:${colors[i]}">${v}</i>` : '').join('')}</div>
    <div class="rp-distlab">${cnt.map((v, i) => v ? `<span style="width:${v / c.n * 100}%">${names[i]}</span>` : '').join('')}</div>
    <p class="rp-p">你在<b style="color:${colors[me]}">「${r.level}」</b>這一群（${cnt[me]} 人）。${top === r.level ? '全班最多人也在這一群。' : `全班最多人在「${top}」。`}${me === 3 ? '保持下去！' : E && E.c < E.n ? '<b>先把易題練到全對</b>，就能往上一群。' : '把錯的觀念訂正，就能往上一群。'}</p>`;
}

/** 段考準備度：各小節＋模擬卷 */
function rpProg(r) {
  const P = r.prog;
  if (!P) return '';
  const st = u => !u.times ? ['未練', 'gray'] : u.best >= 90 ? ['精熟', 'ok'] : u.best >= 70 ? ['穩定', 'exam'] : ['加強', 'bad'];
  const card = (no, tag, line, bar, foot, idle) => `<div class="u${idle ? ' idle' : ''}"><div class="no">${esc(no)}${rpTag(tag[0], tag[1])}</div>${line}<div class="bar"><i style="width:${bar}%"></i></div>${foot}</div>`;
  const m = P.mock;
  return `<div class="rp-units">${P.units.map(u => card(u.no, st(u), u.times ? `練 ${u.times} 次・最高 ${u.best}` : '還沒練習', u.cover, `題庫做過 ${u.cover}%`, !u.times)).join('')}${card('模擬卷', m.done ? [`${m.done}／${m.total}`, 'exam'] : ['未寫', 'gray'], m.done ? `最高 ${m.best} 分` : '還沒寫', pct(m.done, m.total), `寫過 ${m.done}／${m.total} 份`, !m.done)}</div>`;
}

/** 分數走勢（同一個範圍）＋全班平均虛線；第一次就寫說明 */
function rpTrend(r) {
  const L = r.trend || [], avg = r.cls && r.cls.n >= 3 ? r.cls.avg : null;
  if (L.length < 2) return `<p class="rp-p muted">這是第一次${r.type === '模擬' ? '寫這份卷子' : '練這一節'}；之後每練一次，這裡會畫出分數變化${avg !== null ? '（虛線是全班平均）' : ''}。</p>`;
  const y = s => 80 - s * 0.72, x = i => 40 + i * 180 / (L.length - 1);
  return `<svg class="rp-trend" viewBox="0 0 250 94" font-family="IBM Plex Mono, Consolas, monospace" font-size="9">
    <line x1="22" y1="8" x2="246" y2="8" stroke="#EEF2F6"/><line x1="22" y1="44" x2="246" y2="44" stroke="#EEF2F6"/><line x1="22" y1="80" x2="246" y2="80" stroke="#C7D2DF"/>
    <text x="0" y="11" fill="#8A97A6">100</text><text x="6" y="47" fill="#8A97A6">50</text><text x="12" y="83" fill="#8A97A6">0</text>
    ${avg !== null ? `<line x1="22" y1="${y(avg)}" x2="246" y2="${y(avg)}" stroke="#8E80D0" stroke-dasharray="4 3"/>` : ''}
    <polyline points="${L.map((t, i) => x(i) + ',' + y(t.score)).join(' ')}" fill="none" stroke="#1D63B8" stroke-width="2"/>
    ${L.map((t, i) => `<circle cx="${x(i)}" cy="${y(t.score)}" r="${i === L.length - 1 ? 3.5 : 3}" fill="#1D63B8"/><text x="${x(i)}" y="${y(t.score) - 6}" text-anchor="middle" fill="#1B2838" font-weight="600">${t.score}</text><text x="${x(i)}" y="92" text-anchor="middle" fill="#8A97A6">${dshort(t.start)}</text>`).join('')}
  </svg>${avg !== null ? `<p class="rp-note">實線＝你的分數；虛線＝全班平均 ${avg} 分</p>` : ''}`;
}

/** 觀念診斷：依學習目標整理錯的題號和原因 */
function rpDiag(r) {
  const items = r.items || [];
  return `<table class="rp-diag"><thead><tr><th></th><th>學習目標</th><th style="width:48px">答對</th><th style="width:96px">錯的題號</th><th style="width:118px">錯的原因</th></tr></thead><tbody>${r.goals.map(g => {
    const wr = items.map((it, i) => ({ it, no: i + 1 })).filter(x => !x.it.right && !x.it.missing && x.it.tgt === g.code), tags = {};
    wr.forEach(x => (x.it.why || []).forEach(w => { tags[w] = (tags[w] || 0) + 1; }));
    return `<tr><td class="ic st-${g.status}">${ST_ICON[g.status]}</td><td><span class="nm">${esc(g.name)}</span>${g.status !== '掌握' && g.tip ? `<div class="tip">${esc(g.tip)}</div>` : ''}</td><td class="mono">${g.c}／${g.n}</td><td>${wr.length ? '第 ' + wr.map(x => x.no).join('、') + ' 題' : '—'}</td><td>${Object.keys(tags).map(k => rpTag(`${k} ${tags[k]}`, TAGC[k] || 'gray')).join('') || '—'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

/** 逐題作答（不印題目） */
function rpItems(r) {
  const items = r.items || [], hasT = items.some(it => it.t > 0);
  return `<table class="rp-items"><thead><tr><th>題號</th><th>難度</th><th>學習目標</th><th>你的答案</th><th>正解</th>${hasT ? '<th>用時</th>' : ''}<th style="text-align:center">結果</th></tr></thead><tbody>${items.map((it, i) => it.missing
    ? `<tr><td>第 ${i + 1} 題</td><td colspan="${hasT ? 6 : 5}" class="muted">（題目已從題庫移除）</td></tr>`
    : `<tr class="${it.right ? 'right' : ''}"><td>第 ${i + 1} 題</td><td>${esc(tierName(it.tier, r.src))}</td><td>${esc(it.goal || '—')}</td><td>${it.right ? '—' : ansBrief(it, 'yours')}</td><td>${it.right ? '—' : ansBrief(it, 'right')}</td>${hasT ? `<td class="mono">${it.t ? it.t + ' 秒' : '—'}${it.t > 0 && it.t < 10 && (it.why || []).indexOf('沒作答') < 0 ? ' ' + rpTag('快', 'warn') : ''}</td>` : ''}<td class="rs st-${it.right ? '掌握' : '需加強'}">${it.right ? '○' : '✕'}</td></tr>`).join('')}</tbody></table>${hasT ? `<p class="rp-note">「快」＝不到 10 秒就作答。這${r.type === '模擬' ? '份卷子' : '一節'}每題平均可以用 ${Math.round(r.limit * 60 / (r.n || 10))} 秒，建議每題至少想 30 秒。</p>` : ''}`;
}

/** 測驗說明 */
function rpAbout(r) {
  const prac = r.type !== '模擬';
  return `<ul class="rp-about"><li><b>範圍：</b>${esc(r.title)}。</li>
    <li><b>題目來源：</b>各校歷屆定期評量與國中教育會考試題，依難度分級，每題都有解析。</li>
    ${prac ? `<li><b>抽題：</b>每次 10 題＝易 5、中 3、難 1、${tierName('會考', r.src)} 1；和做過的題目最多重複 ${r.repeat || 3} 題。</li>` : '<li><b>試卷：</b>整份段考模擬卷，題型和配分照原卷。</li>'}
    <li><b>計分：</b>限時 ${r.limit} 分鐘，${prac ? '每題 10 分' : '照原卷配分換算成 100 分'}。等第：精熟 90 分以上、穩定 70～89、待加強 50～69、需補強 49 以下。</li>
    <li><b>學習目標燈號只看這一次：</b>全對＝掌握，全錯＝需加強，其餘＝不穩。</li></ul>`;
}

/** 一次測驗的 PDF：第 1 頁成績與診斷（給家長）、第 2 頁訂正與練習（給學生）。
 *  qmode＝要不要印題目：不附／只附錯題／全部（老師端）；沒給就照網站設定。主任版沒有題目，只有第 1 頁。 */
function reportPdfHtml(r, brand, qmode) {
  qmode = qmode || brand.pdfQ || '不附';
  const items = r.items || [];
  const who = r.uid && r.uid.indexOf('G-') !== 0 ? r.uid + '　' + r.name : '訪客';
  const head = `<div class="ph"><div><div style="font-size:12px;color:#E8692A;font-weight:700;letter-spacing:.08em">${esc(brand.term || '')}</div><h1>${esc(brand.site || '國七。二段練習')}<span class="rp-doc">學習診斷報告</span></h1></div>
    <div class="r">${brand.logo ? `<img src="${BRAND_LOGO}" alt="">` : ''}${brand.brand ? `<b style="color:#1D63B8;letter-spacing:.08em">${esc(brand.brandName)}</b><br>` : ''}<b class="rp-who">${esc(who)}</b><br>${dt(r.start, true)}</div></div>`;
  const sec = (t, s) => `<div class="rp-sec">${t}<small>${s}</small></div>`;
  const box = (h, body, cls) => `<div class="box${cls ? ' ' + cls : ''}">${h ? `<h2>${h}</h2>` : ''}${body}</div>`;
  const mk = r.type === '模擬', prev = r.trend && r.trend.length > 1 ? r.trend[r.trend.length - 2].score : null;
  const cmp = `<div class="rp-cmp"><div>和上次比　<b>${prev === null ? (mk ? '第一次寫這份' : '第一次練這一節') : r.score > prev ? `進步 ${r.score - prev} 分 ↑` : r.score < prev ? `退步 ${prev - r.score} 分 ↓` : '一樣'}</b></div>${r.cls && r.cls.n >= 3 ? `<div>全班${mk ? '這份' : '這一節'}平均　<b>${r.cls.avg} 分</b></div><div>${mk ? '寫過' : '練過'}的同學　<b>${r.cls.n} 人</b></div>` : ''}</div>`;
  const top = `<div class="box rp-top"><div class="big">${r.score}<small style="font-size:15px;color:#5E6E80">／100</small></div>
    <div><div style="font-size:16px;font-weight:700">${esc(r.title)}　<span class="level lv-${r.level}" style="font-size:13px">${r.level}</span></div><div class="small" style="color:#5E6E80">答對 ${r.nRight}／${r.n}・用時 ${mmss(r.used)}（限時 ${r.limit} 分鐘）</div></div>${cmp}${rpScale(r.score)}</div>`;
  const cls = rpClass(r);
  const p1 = [head, sec('成績與診斷', '這一次的表現，和整個二段範圍準備到哪裡'), top,
    r.summary ? box('老師看這次', `<p class="rp-sum">${rich(r.summary)}</p>`, 'rp-sumbox') : '',
    `<div class="rp-row${cls ? '' : ' one'}">${box('各難度答對', rpTiers(r) + '<p class="rp-note">易題要全對，基礎才算穩。</p>')}${cls ? box(`在全班的位置 <small>${mk ? '寫過這份' : '這一節練過'}的 ${r.cls.n} 位同學，各取最近一次</small>`, cls) : ''}</div>`,
    r.secs ? box('各小節答對率', `<div class="secbars">${r.secs.map(s => hbar(`${s.no} ${s.name}`, pct(s.c, s.n), colorFor(pct(s.c, s.n)), `${s.c}／${s.n}`)).join('')}</div>`) : '',
    r.goals && r.goals.length ? box(`觀念診斷 <small>依學習目標整理${items.length ? '；完整題目和解析請上網站「我的測驗報告」→「查看」' : ''}</small>`, rpDiag(r)) : '',
    `<div class="rp-row wide">${box('段考準備度 <small>整個二段範圍，到目前為止</small>', rpProg(r))}${box(`${esc(mk ? '模擬' + r.scope + '卷' : r.scope)} 分數走勢`, rpTrend(r))}</div>`].join('');
  if (!items.length) return `<div><div class="pg">${p1}</div></div>`;
  const wrong = items.map((it, i) => it.right || it.missing ? 0 : i + 1).filter(Boolean);
  const qs = qmode === '全部' ? items.map((it, i) => reviewItem(it, i + 1, r.src)).join('')
    : qmode === '只附錯題' ? wrong.map(no => reviewItem(items[no - 1], no, r.src)).join('') : '';
  const p2 = [head, sec('訂正與練習', '照著做，下一次會更好'),
    box(`逐題作答 <small>${esc(r.title)}・${r.n} 題${qs ? '' : '・不印題目'}</small>`, rpItems(r)),
    qs ? box(qmode === '全部' ? '題目回顧與解析' : '錯題與解析', qs) : '',
    box('下一步 <small>照順序做</small>', `<ol class="rp-next">${(r.next || []).map(s => `<li>${rich(s)}</li>`).join('')}</ol>${r.parent ? `<p class="rp-parent">給家長：${esc(r.parent)}</p>` : ''}`),
    box('訂正紀錄 <small>看完解析、自己重算一次就打勾</small>', wrong.length ? `<div class="rp-fix">${wrong.map(n => `<span>第 ${n} 題</span>`).join('')}</div>` : '<p class="rp-p">這次全對，不用訂正。</p>'),
    box('老師評語', '<div class="rp-lines"><div></div><div></div></div><div class="rp-sign"><span>訂正完成日期<i></i></span><span>家長簽名<i></i></span><span>老師簽名<i></i></span></div>'),
    `<div class="rp-row about">${box('測驗說明', rpAbout(r))}<div class="box rp-qrbox"><div data-qr="${esc(reportLink(r.aid))}"></div>掃描看這一次的<br>完整題目與解析<br><small>（要先登入）</small></div></div>`].join('');
  return `<div><div class="pg">${p1}</div><div class="pb">${p2}</div></div>`;
}

function reportFileName(r) {
  const d = new Date(r.start);
  const who = r.uid && r.uid.indexOf('G-') !== 0 ? r.uid + r.name : '訪客';
  return `國七二段_${r.type === '模擬' ? '模擬' + r.scope + '卷' : r.scope}_${who}_${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.pdf`;
}
