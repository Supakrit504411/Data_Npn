// ============================================================
// PresentKit — shared presentation controls for dashboard.html and finance.html
// - floating control bar (prev/next, insert slide, PDF, fullscreen, exit)
// - inserted slides (image / paste / link / YouTube) stored per LINE user in IndexedDB
// - JSON backup/restore covering every deck of the user, PDF via browser print
// ============================================================
(function () {
  'use strict';

  const DECKS = ['dashboard', 'finance'];
  const USER = sessionStorage.getItem('line_user_id') || 'guest';
  // dashboard keeps the original key so slides saved before PresentKit still load
  const keyFor = deck => deck === 'dashboard' ? 'u:' + USER : 'u:' + USER + ':' + deck;

  const XDB = {
    open() { return new Promise((res, rej) => { const r = indexedDB.open('dataNpnPres', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { try { const db = await this.open(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; } },
    async set(k, v) { const db = await this.open(); await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  };

  const escH = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ytId = u => { const m = String(u).match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : null; };
  const newId = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const IC = {
    prev: svg('<polyline points="15 18 9 12 15 6"/>'),
    next: svg('<polyline points="9 18 15 12 9 6"/>'),
    plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    pdf: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    full: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
    unfull: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'),
    exit: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')
  };

  const CSS = `
  .pk-bar { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 600; display: none;
    align-items: center; gap: 4px; padding: 7px 8px 11px; border-radius: 18px; color: #fff;
    background: rgba(26,17,46,0.80); -webkit-backdrop-filter: blur(14px) saturate(150%); backdrop-filter: blur(14px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 14px 44px rgba(10,5,25,0.40);
    font-family: inherit; transition: opacity .45s, transform .45s; max-width: calc(100vw - 24px); }
  .pk-bar.on { display: flex; }
  .pk-bar.idle { opacity: 0.22; }
  .pk-bar:hover { opacity: 1; }
  .pk-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 40px; min-width: 40px;
    padding: 0 10px; border: 0; border-radius: 12px; background: transparent; color: rgba(255,255,255,0.88);
    font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s, color .15s; white-space: nowrap; }
  .pk-btn svg { width: 20px; height: 20px; flex-shrink: 0; }
  .pk-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); color: #fff; }
  .pk-btn:disabled { opacity: 0.28; cursor: default; }
  .pk-btn.pk-nav { width: 44px; background: rgba(255,255,255,0.06); }
  .pk-btn.pk-exit:hover { background: rgba(232,80,80,0.22); color: #ffb4b4; }
  .pk-badge { display: none; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #e2b64a; color: #2a1f3d;
    font-size: 12px; font-weight: 800; line-height: 20px; text-align: center; }
  .pk-badge.on { display: inline-block; }
  .pk-info { min-width: 150px; max-width: 280px; padding: 0 10px; text-align: center; line-height: 1.25; }
  .pk-title { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pk-count { font-size: 11.5px; opacity: 0.6; margin-top: 1px; font-variant-numeric: tabular-nums; }
  .pk-sep { width: 1px; height: 24px; margin: 0 4px; background: rgba(255,255,255,0.14); }
  .pk-prog { position: absolute; left: 16px; right: 16px; bottom: 5px; height: 3px; border-radius: 3px; background: rgba(255,255,255,0.12); overflow: hidden; }
  .pk-prog i { display: block; height: 100%; width: 0; border-radius: 3px; background: linear-gradient(90deg, #a583e0, #e2b64a); transition: width .3s; }
  @media (max-width: 760px) {
    .pk-bar { bottom: 10px; gap: 2px; padding: 6px 6px 10px; }
    .pk-btn .pk-lbl { display: none; }
    .pk-info { min-width: 90px; max-width: 150px; padding: 0 4px; }
    .pk-sep { display: none; }
  }

  .pk-ins { display: none; }
  .pk-ins.active { display: block; }
  .pk-ins h2 { font-size: 26px; color: #4b2e83; margin: 4px 0 16px; text-align: center; }
  .pk-ins .ins-body { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .pk-ins img { max-width: 100%; max-height: calc(100vh - 220px); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.14); background: #fff; }
  .pk-ins iframe { width: 100%; height: calc(100vh - 250px); border: 0; border-radius: 12px; background: #fff; }
  .pk-ins .open { color: #4b2e83; font-weight: 600; }

  .pk-modal { position: fixed; inset: 0; z-index: 700; background: rgba(30,20,50,0.55); display: none; align-items: center; justify-content: center; padding: 16px; }
  .pk-modal.show { display: flex; }
  .im-box { background: #fff; color: #2a1f3d; width: 100%; max-width: 620px; max-height: 92vh; overflow: auto; border-radius: 18px; box-shadow: 0 24px 70px rgba(0,0,0,0.35); font-family: inherit; }
  .im-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 20px 8px; }
  .im-head h3 { font-size: 20px; color: #4b2e83; margin: 0; }
  .im-head p { font-size: 13px; color: #8d84a2; margin: 2px 0 0; }
  .im-body { padding: 4px 20px 12px; display: grid; gap: 10px; }
  .im-box input[type=text] { width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1.5px solid #e9e5f0; border-radius: 9px; font: inherit; font-size: 14px; }
  .im-box button { font: inherit; cursor: pointer; }
  .im-x { border: 1px solid #e9e5f0; background: #faf9fc; width: 34px; height: 34px; border-radius: 9px; }
  .im-pos, .im-tabs { display: flex; gap: 12px; align-items: center; font-size: 14px; flex-wrap: wrap; }
  .im-tabs button { border: 1.5px solid #e9e5f0; background: #faf9fc; padding: 7px 14px; border-radius: 999px; font-size: 14px; }
  .im-tabs button.on { background: #4b2e83; color: #fff; border-color: #4b2e83; }
  .im-drop { display: block; text-align: center; padding: 18px; border: 2px dashed #cfc5e0; border-radius: 12px; color: #4b2e83; font-weight: 600; cursor: pointer; }
  .im-tip { font-size: 12.5px; color: #8d84a2; }
  .im-row { display: flex; gap: 8px; }
  .im-row button, .im-foot button { border: none; background: #4b2e83; color: #fff; padding: 8px 16px; border-radius: 9px; white-space: nowrap; }
  .im-err { display: none; color: #bf3030; background: #fdeeee; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
  .im-lh { font-size: 13px; font-weight: 700; color: #5a4e6e; margin-top: 4px; }
  .im-item { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid #e9e5f0; border-radius: 10px; margin-bottom: 6px; }
  .im-item .n { width: 22px; text-align: center; font-weight: 700; color: #8d84a2; }
  .im-item .t { width: 64px; height: 40px; border-radius: 6px; background: #f2ecfb center/cover no-repeat; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #4b2e83; }
  .im-item .m { flex: 1; min-width: 0; font-size: 13px; }
  .im-item .m b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .im-item .m small { color: #8d84a2; }
  .im-item button { border: 1px solid #e9e5f0; background: #faf9fc; padding: 4px 8px; border-radius: 7px; font-size: 12.5px; color: #2a1f3d; }
  .im-item button.del { color: #bf3030; }
  .im-item button:disabled { opacity: .35; }
  .im-empty { font-size: 13px; color: #8d84a2; padding: 8px; }
  .im-foot { display: flex; justify-content: space-between; gap: 8px; padding: 12px 20px 18px; border-top: 1px solid #e9e5f0; flex-wrap: wrap; }
  .im-foot .ghost { background: #faf9fc; color: #5a4e6e; border: 1px solid #e9e5f0; }

  .pk-print { display: none; }
  @media print {
    @page { size: A4 landscape; margin: 10mm; }
    body.pk-printing .pk-bar, body.pk-printing .pk-modal, body.pk-printing .pk-ins { display: none !important; }
    body.pk-printing .pk-print { display: block !important; break-after: page; page-break-after: always; }
    body.pk-printing .pk-print h2 { font-size: 22px; color: #4b2e83; margin: 0 0 12px; }
    body.pk-printing .pk-print img { max-width: 100%; max-height: 170mm; }
  }`;

  const MODAL = `
  <div class="im-box">
    <div class="im-head"><div><h3>แทรกหน้า</h3><p data-r="sub"></p></div><button type="button" class="im-x" data-r="x">✕</button></div>
    <div class="im-body">
      <div class="im-pos"><span>ตำแหน่ง:</span><label><input type="radio" name="pkpos" value="after" checked> ต่อจากหน้านี้</label><label><input type="radio" name="pkpos" value="before"> ก่อนหน้านี้</label></div>
      <div class="im-tabs"><button type="button" data-tab="image" class="on">รูปภาพ / สไลด์</button><button type="button" data-tab="embed">ลิงก์เว็บ / YouTube</button></div>
      <input type="text" data-r="title" placeholder="หัวข้อ (ไม่บังคับ)">
      <div data-r="image">
        <label class="im-drop">เลือกไฟล์รูปภาพ (เลือกได้หลายไฟล์)<input type="file" data-r="file" accept="image/*" multiple hidden></label>
        <div class="im-tip">หรือกด <kbd>Ctrl</kbd>+<kbd>V</kbd> เพื่อวางรูปที่ copy มา (เช่น จาก PowerPoint / Canva / หน้าจอ)</div>
        <div class="im-row" style="margin-top:8px"><input type="text" data-r="imgUrl" placeholder="หรือวางลิงก์รูปภาพ (URL)"><button type="button" data-add="image">เพิ่ม</button></div>
      </div>
      <div data-r="embed" style="display:none">
        <div class="im-row"><input type="text" data-r="webUrl" placeholder="วางลิงก์เว็บไซต์ หรือ YouTube"><button type="button" data-add="embed">เพิ่ม</button></div>
        <div class="im-tip" style="margin-top:6px">บางเว็บไม่อนุญาตให้ฝัง ถ้าหน้าว่างให้ใช้ลิงก์ "เปิดในแท็บใหม่" บนสไลด์</div>
      </div>
      <div class="im-err" data-r="err"></div>
      <div class="im-lh">หน้าที่แทรกในช่วงนี้ (<span data-r="count">0</span>)</div>
      <div data-r="list"></div>
    </div>
    <div class="im-foot">
      <span>
        <button type="button" class="ghost" data-r="export" title="สำรองหน้าที่แทรกทั้งหมด (ทุกหน้านำเสนอ) เป็นไฟล์ .json">⤓ สำรอง (.json)</button>
        <button type="button" class="ghost" data-r="import" title="นำเข้าหน้าที่แทรกจากไฟล์ .json">⤒ นำเข้า</button>
        <input type="file" data-r="importFile" accept=".json,application/json" hidden>
      </span>
      <button type="button" data-r="done">เสร็จสิ้น</button>
    </div>
  </div>`;

  /**
   * opts: {
   *   deck: 'dashboard' | 'finance',
   *   count(): number of main slides,
   *   title(i): title of main slide i,
   *   showMain(i), hideMain(),          // display / hide the page's own slides
   *   container: element that shows an inserted slide (gets class pk-ins),
   *   mainEl(i): element of main slide i (PDF ordering),
   *   onEnter(), onExit(), beforePrint(), afterPrint(),
   *   fullscreenEl: element for fullscreen (default document.documentElement)
   * }
   */
  function create(opts) {
    if (!document.getElementById('pk-css')) {
      const st = document.createElement('style'); st.id = 'pk-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const bar = document.createElement('div');
    bar.className = 'pk-bar';
    bar.innerHTML =
      '<button class="pk-btn pk-nav" data-a="prev" title="ก่อนหน้า (←)">' + IC.prev + '</button>'
      + '<div class="pk-info"><div class="pk-title"></div><div class="pk-count"></div></div>'
      + '<button class="pk-btn pk-nav" data-a="next" title="ถัดไป (→)">' + IC.next + '</button>'
      + '<span class="pk-sep"></span>'
      + '<button class="pk-btn" data-a="ins" title="แทรกหน้าก่อน/หลังหน้านี้ (I)">' + IC.plus + '<span class="pk-lbl">แทรกหน้า</span><b class="pk-badge"></b></button>'
      + '<button class="pk-btn" data-a="pdf" title="บันทึกทุกหน้า (รวมหน้าที่แทรก) เป็น PDF">' + IC.pdf + '<span class="pk-lbl">PDF</span></button>'
      + '<button class="pk-btn" data-a="full" title="เต็มจอ (F)">' + IC.full + '</button>'
      + '<span class="pk-sep"></span>'
      + '<button class="pk-btn pk-exit" data-a="exit" title="ออก (Esc)">' + IC.exit + '</button>'
      + '<div class="pk-prog"><i></i></div>';
    document.body.appendChild(bar);
    const modal = document.createElement('div');
    modal.className = 'pk-modal'; modal.innerHTML = MODAL; document.body.appendChild(modal);
    const R = n => modal.querySelector('[data-r="' + n + '"]');
    const B = a => bar.querySelector('[data-a="' + a + '"]');
    const box = opts.container; box.classList.add('pk-ins');

    let EXTRA = [], pos = 0, active = false;
    const save = () => { XDB.set(keyFor(opts.deck), EXTRA).catch(() => showErr('บันทึกไม่สำเร็จ (พื้นที่เบราว์เซอร์อาจเต็ม) — หน้าที่แทรกยังใช้ได้จนกว่าจะปิดหน้า'));
      updBadge(); if (modal.classList.contains('show')) renderIns(); };

    // order: inserts before the first slide (at -1), then each main slide followed by its inserts
    function SEQ() {
      const L = EXTRA.filter(x => x.at === -1).map(x => ({ kind: 'ins', id: x.id }));
      for (let i = 0; i < opts.count(); i++) { L.push({ kind: 'main', i }); EXTRA.filter(x => x.at === i).forEach(x => L.push({ kind: 'ins', id: x.id })); }
      return L;
    }
    const cur = () => SEQ()[pos];
    const titleOf = sl => sl.kind === 'main' ? opts.title(sl.i) : ((EXTRA.find(x => x.id === sl.id) || {}).title || 'หน้าแทรก');
    const mainPos = i => Math.max(0, SEQ().findIndex(x => x.kind === 'main' && x.i === i));

    function renderInsert(it) {
      let body;
      if (it.type === 'image') body = '<img src="' + escH(it.src) + '" alt="">';
      else { const y = ytId(it.src);
        body = (y ? '<iframe src="https://www.youtube.com/embed/' + y + '" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>'
                  : '<iframe src="' + escH(it.src) + '" referrerpolicy="no-referrer"></iframe>')
          + '<a class="open" href="' + escH(it.src) + '" target="_blank" rel="noopener">เปิดในแท็บใหม่ ↗</a>'; }
      box.innerHTML = (it.title ? '<h2>' + escH(it.title) + '</h2>' : '') + '<div class="ins-body">' + body + '</div>';
    }
    function hideInsert() { box.classList.remove('active'); box.innerHTML = ''; }

    function show(p) {
      const L = SEQ(); pos = Math.max(0, Math.min(L.length - 1, p));
      const sl = L[pos];
      if (sl.kind === 'main') { hideInsert(); opts.showMain(sl.i); }
      else { const it = EXTRA.find(x => x.id === sl.id); opts.hideMain(it.at); renderInsert(it); box.classList.add('active'); }
      bar.querySelector('.pk-title').textContent = titleOf(sl);
      bar.querySelector('.pk-count').textContent = 'หน้า ' + (pos + 1) + ' / ' + L.length;
      bar.querySelector('.pk-prog i').style.width = ((pos + 1) / L.length * 100) + '%';
      B('prev').disabled = pos === 0; B('next').disabled = pos === L.length - 1;
      updBadge(); wake();
    }
    const go = d => show(pos + d);

    function enter(startMain) {
      if (active) return;
      active = true; bar.classList.add('on');
      if (opts.onEnter) opts.onEnter();
      show(mainPos(startMain || 0));
      ready.then(() => { if (active) show(mainPos(startMain || 0)); }); // re-render once saved inserts are loaded
    }
    function exit() {
      if (!active) return;
      active = false; bar.classList.remove('on'); closeIns();
      const sl = cur(); let back = 0;
      if (sl) back = sl.kind === 'main' ? sl.i : Math.max(0, (EXTRA.find(x => x.id === sl.id) || { at: 0 }).at);
      hideInsert();
      if (opts.onExit) opts.onExit(back);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    // leaving fullscreen with the bar button only shrinks the window; it must not end the presentation
    let manualFsExit = false;
    function toggleFull() {
      const el = opts.fullscreenEl || document.documentElement;
      if (document.fullscreenElement) { manualFsExit = true; document.exitFullscreen().catch(() => { manualFsExit = false; }); }
      else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    }
    function updFullBtn() {
      const on = !!document.fullscreenElement, b = B('full');
      b.innerHTML = on ? IC.unfull : IC.full; b.title = on ? 'ออกจากเต็มจอ (F)' : 'เต็มจอ (F)';
    }

    // fade the bar while the presenter is not moving the mouse
    let idleT;
    function wake() { bar.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!modal.classList.contains('show')) bar.classList.add('idle'); }, 2600); }
    document.addEventListener('mousemove', () => { if (active) wake(); });

    B('prev').onclick = () => go(-1);
    B('next').onclick = () => go(1);
    B('ins').onclick = openIns;
    B('pdf').onclick = pdf;
    B('full').onclick = toggleFull;
    B('exit').onclick = exit;

    document.addEventListener('keydown', e => {
      if (!active) return;
      if (modal.classList.contains('show')) { if (e.key === 'Escape') closeIns(); return; }
      if (opts.blockKeys && opts.blockKeys()) return;
      if (e.target.closest && e.target.closest('input,textarea,select')) return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') show(0);
      else if (e.key === 'End') show(SEQ().length - 1);
      else if (e.key === 'i' || e.key === 'I') openIns();
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'Escape') { if (!document.fullscreenElement) exit(); }
    });
    // leaving fullscreen with Esc exits presentation too
    document.addEventListener('fullscreenchange', () => {
      updFullBtn();
      if (!document.fullscreenElement) {
        if (manualFsExit) { manualFsExit = false; return; }
        if (active && opts.exitWithFullscreen) exit();
      }
    });

    // ---------- insert panel ----------
    const groupOf = () => { const sl = cur(); if (!sl) return 0; return sl.kind === 'main' ? sl.i : EXTRA.find(x => x.id === sl.id).at; };
    const groupTitle = g => g === -1 ? 'ก่อนหน้าแรก' : 'ต่อจาก ' + opts.title(g);
    function updBadge() { const n = EXTRA.filter(x => x.at === groupOf()).length, b = bar.querySelector('.pk-badge');
      b.textContent = n || ''; b.classList.toggle('on', n > 0); }
    function showErr(m) { const e = R('err'); e.textContent = m || ''; e.style.display = m ? 'block' : 'none'; }
    function openIns() { if (!active) return; modal.classList.add('show'); bar.classList.remove('idle'); showErr(''); renderIns(); }
    function closeIns() { modal.classList.remove('show'); }
    function renderIns() {
      const g = groupOf(), list = EXTRA.filter(x => x.at === g);
      R('sub').textContent = 'หน้าปัจจุบัน: ' + titleOf(cur()) + ' · ช่วง: ' + groupTitle(g)
        + ' · บันทึกในเครื่องนี้ของ ' + (sessionStorage.getItem('line_display_name') || 'ผู้ใช้');
      R('count').textContent = list.length;
      R('list').innerHTML = list.length ? list.map((it, k) => '<div class="im-item" data-id="' + it.id + '"><span class="n">' + (k + 1) + '</span>'
        + (it.type === 'image' ? '<div class="t" style="background-image:url(\'' + escH(it.src) + '\')"></div>' : '<div class="t">' + (ytId(it.src) ? 'YouTube' : 'เว็บ') + '</div>')
        + '<div class="m"><b>' + escH(it.title || (it.type === 'image' ? 'รูปภาพ' : it.src)) + '</b><small>' + (it.type === 'image' ? 'รูปภาพ' : ytId(it.src) ? 'YouTube' : 'ฝังเว็บ') + '</small></div>'
        + '<button data-a="go">ดู</button><button data-a="up"' + (k ? '' : ' disabled') + '>↑</button><button data-a="dn"' + (k < list.length - 1 ? '' : ' disabled') + '>↓</button>'
        + '<button data-a="ed">✎</button><button data-a="del" class="del">ลบ</button></div>').join('')
        : '<div class="im-empty">ยังไม่มีหน้าแทรกในช่วงนี้</div>';
    }
    // "before main slide i" is stored as "after main slide i-1" (-1 = before the first slide)
    function addInsert(type, src) {
      const before = modal.querySelector('input[name=pkpos]:checked').value === 'before';
      const sl = cur(); let g, at;
      if (sl.kind === 'ins') { const idx = EXTRA.findIndex(x => x.id === sl.id); g = EXTRA[idx].at; at = before ? idx : idx + 1; }
      else { g = before ? sl.i - 1 : sl.i;
        at = EXTRA.length; for (let k = EXTRA.length - 1; k >= 0; k--) if (EXTRA[k].at === g) { at = k + 1; break; } }
      const it = { id: newId(), at: g, type, src, title: R('title').value.trim() };
      EXTRA.splice(at, 0, it); R('title').value = ''; showErr(''); save();
      show(SEQ().findIndex(x => x.kind === 'ins' && x.id === it.id));
      modal.querySelector('input[name=pkpos][value=after]').checked = true;
      renderIns();
    }
    function shrink(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
      const k = Math.min(1, 1920 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', .86)); }; im.src = fr.result; }; fr.readAsDataURL(file); }); }
    function normUrl(v) { v = v.trim(); if (!v) return null; if (!/^https?:\/\//i.test(v)) v = 'https://' + v; try { new URL(v); return v; } catch (e) { return null; } }

    modal.querySelectorAll('.im-tabs button').forEach(b => b.onclick = () => {
      modal.querySelectorAll('.im-tabs button').forEach(x => x.classList.toggle('on', x === b));
      R('image').style.display = b.dataset.tab === 'image' ? 'block' : 'none'; R('embed').style.display = b.dataset.tab === 'embed' ? 'block' : 'none'; showErr(''); });
    R('file').onchange = async e => {
      const files = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      for (const f of files) { if (!f.type.startsWith('image/')) { showErr('ไฟล์ ' + f.name + ' ไม่ใช่รูปภาพ'); continue; }
        try { if (!R('title').value && files.length > 1) R('title').value = f.name.replace(/\.[^.]+$/, ''); addInsert('image', await shrink(f)); } catch (err) { showErr('อ่านไฟล์ไม่สำเร็จ: ' + f.name); } }
      e.target.value = '';
    };
    modal.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const inp = b.dataset.add === 'image' ? R('imgUrl') : R('webUrl'), u = normUrl(inp.value);
      if (!u) return showErr('ลิงก์ไม่ถูกต้อง'); addInsert(b.dataset.add, u); inp.value = ''; });
    ['imgUrl', 'webUrl'].forEach(n => R(n).addEventListener('keydown', e => { if (e.key === 'Enter') R(n).nextElementSibling.click(); }));
    modal.addEventListener('paste', async e => {
      const item = [...(e.clipboardData && e.clipboardData.items || [])].find(x => x.type.startsWith('image/'));
      if (!item) return; e.preventDefault(); try { addInsert('image', await shrink(item.getAsFile())); } catch (err) { showErr('วางรูปไม่สำเร็จ'); } });
    R('list').onclick = e => {
      const b = e.target.closest('button'), row = e.target.closest('.im-item'); if (!b || !row) return;
      const id = row.dataset.id, k = EXTRA.findIndex(x => x.id === id), g = EXTRA[k].at, a = b.dataset.a;
      const sib = d => { for (let j = k + d; j >= 0 && j < EXTRA.length; j += d) if (EXTRA[j].at === g) return j; return -1; };
      if (a === 'go') { closeIns(); show(SEQ().findIndex(x => x.kind === 'ins' && x.id === id)); return; }
      if (a === 'del') { if (!confirm('ลบหน้านี้?')) return; const viewing = cur().id === id; EXTRA.splice(k, 1); save(); show(viewing ? pos - 1 : pos); return; }
      const keep = cur();
      if (a === 'up' || a === 'dn') { const j = sib(a === 'up' ? -1 : 1); if (j < 0) return; [EXTRA[k], EXTRA[j]] = [EXTRA[j], EXTRA[k]]; }
      else if (a === 'ed') { const t = prompt('แก้หัวข้อ', EXTRA[k].title); if (t === null) return; EXTRA[k].title = t.trim(); }
      save();
      show(SEQ().findIndex(x => x.kind === keep.kind && (keep.kind === 'main' ? x.i === keep.i : x.id === keep.id)));
    };
    R('x').onclick = closeIns;
    R('done').onclick = () => { closeIns(); show(pos); };
    modal.addEventListener('click', e => { if (e.target === modal) R('done').onclick(); });

    // ---------- backup / restore: one file holds every deck of this user ----------
    R('export').onclick = async () => {
      const decks = {};
      for (const d of DECKS) decks[d] = d === opts.deck ? EXTRA : ((await XDB.get(keyFor(d))) || []);
      const blob = new Blob([JSON.stringify({ app: 'data-npn-slides', version: 2, exported: new Date().toISOString(), decks })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'สไลด์แทรก-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    };
    R('import').onclick = () => R('importFile').click();
    R('importFile').onchange = e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const d = JSON.parse(fr.result);
          // v2: { decks: { dashboard: [...], finance: [...] } } · v1: { items: [...] } (dashboard only)
          const decks = d.decks || { dashboard: Array.isArray(d) ? d : d.items };
          const clean = items => (Array.isArray(items) ? items : []).filter(x => x && (x.type === 'image' || x.type === 'embed') && typeof x.src === 'string'
              && /^(data:image\/|https?:\/\/)/.test(x.src) && Number.isInteger(x.at) && x.at >= -1)
            .map(x => ({ id: newId(), at: x.at, type: x.type, src: x.src, title: String(x.title || '') }));
          const got = {}; let total = 0;
          for (const dk of DECKS) { got[dk] = clean(decks[dk]); total += got[dk].length; }
          if (!total) throw new Error('ไม่พบหน้าที่นำเข้าได้');
          let existing = 0;
          for (const dk of DECKS) existing += dk === opts.deck ? EXTRA.length : ((await XDB.get(keyFor(dk))) || []).length;
          const replace = existing > 0 && confirm('มีหน้าแทรกอยู่แล้ว ' + existing + ' หน้า\nOK = แทนที่ทั้งหมด · Cancel = เพิ่มต่อท้าย');
          for (const dk of DECKS) {
            if (!got[dk].length && !replace) continue;
            const old = dk === opts.deck ? EXTRA : ((await XDB.get(keyFor(dk))) || []);
            const next = replace ? got[dk] : old.concat(got[dk]);
            if (dk === opts.deck) EXTRA = next; else await XDB.set(keyFor(dk), next);
          }
          EXTRA = EXTRA.filter(x => x.at < opts.count());
          save(); show(pos); showErr('');
          alert('นำเข้าแล้ว ' + total + ' หน้า');
        } catch (err) { showErr('นำเข้าไม่สำเร็จ: ' + err.message); }
      };
      fr.readAsText(f);
    };

    // ---------- PDF via browser print: main slides + inserts in presentation order ----------
    function pdf() {
      closeIns();
      const made = [];
      const mk = it => { const d = document.createElement('div'); d.className = 'pk-print';
        d.innerHTML = (it.title ? '<h2>' + escH(it.title) + '</h2>' : '') + (it.type === 'image' ? '<img src="' + escH(it.src) + '">'
          : '<p>' + (ytId(it.src) ? 'วิดีโอ YouTube' : 'ลิงก์เว็บไซต์') + ': ' + escH(it.src) + '</p>'); made.push(d); return d; };
      EXTRA.filter(x => x.at === -1).forEach(it => opts.mainEl(0).before(mk(it)));
      for (let i = 0; i < opts.count(); i++) { let ref = opts.mainEl(i); EXTRA.filter(x => x.at === i).forEach(it => { const d = mk(it); ref.after(d); ref = d; }); }
      if (opts.beforePrint) opts.beforePrint();
      document.body.classList.add('pk-printing');
      const done = () => { document.body.classList.remove('pk-printing'); made.forEach(d => d.remove());
        if (opts.afterPrint) opts.afterPrint(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(() => window.print(), 300);
    }

    const ready = XDB.get(keyFor(opts.deck)).then(v => { EXTRA = Array.isArray(v) ? v : []; updBadge(); });

    return {
      enter, exit, ready,
      isActive: () => active,
      goMain: i => { if (active) show(mainPos(i)); },
      refresh: () => { if (active) show(pos); }
    };
  }

  window.PresentKit = { create };
})();
