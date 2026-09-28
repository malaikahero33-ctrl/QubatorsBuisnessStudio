/* =========================================================
   Qubators Business Studio — shared UI helpers
   ========================================================= */
window.QB = window.QB || {};

QB.ui = (function () {
  /* ---- icons (inline svg, currentColor) --------------------- */
  const P = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    cal: 'M7 3v4M17 3v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2l-4.35-4.35',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    plus: 'M12 5v14M5 12h14',
    spark: 'M12 3l2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
    chev: 'M9 18l6-6-6-6',
    bolt: 'M13 2L3 14h8l-1 8 10-12h-8z',
    box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    key: 'M14 7a4 4 0 1 1-3.9 5H8v3H5v3H2v-4l8.1-8.1A4 4 0 0 1 14 7z',
    monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
    phone: 'M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z',
    pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    star: 'M12 2l3 6.6 7 .9-5 4.8 1.2 7L12 18l-6.2 3.3L7 14.3l-5-4.8 7-.9z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
    undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
    eraser: 'M20 20H8l-4-4a2 2 0 0 1 0-2.8l9-9a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L14 20',
    text: 'M4 7V5h16v2M12 5v14M9 19h6',
    square: 'M4 4h16v16H4z',
    circle: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    line: 'M4 20L20 4',
    dot: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z',
    palette: 'M12 21a9 9 0 0 1 0-18c5 0 9 3.6 9 8 0 2.2-1.8 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 21z',
    send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
    play: 'M6 4l14 8-14 8z'
  };

  function icon(name, cls) {
    const d = P[name] || P.dot;
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  /* ---- escaping --------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- formatting ------------------------------------------- */
  const nf = new Intl.NumberFormat('en-US');
  const money = (n) => '৳' + nf.format(Math.round(n || 0));
  const dtf = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const dts = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const tm = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const md = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  function ago(d) {
    const s = Math.max(0, (Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    const dd = Math.floor(h / 24); if (dd < 7) return dd + 'd ago';
    return md(d);
  }
  function until(d) {
    const diff = new Date(d) - Date.now();
    const days = Math.round(diff / 864e5);
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    return days > 0 ? 'in ' + days + ' days' : Math.abs(days) + ' days late';
  }
  const initials = (name) => String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

  /* ---- dom -------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /* ---- toast ------------------------------------------------ */
  function toast(msg, type) {
    const host = $('#toasts');
    if (!host) return;
    const ic = type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'bell';
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = icon(ic) + '<span>' + esc(msg) + '</span>';
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, 2800);
  }

  /* ---- modal / drawer --------------------------------------- */
  function closeModal() {
    const b = $('.backdrop', $('#modal-root'));
    if (b) b.remove();
  }

  /**
   * modal({ title, body, footer, size:'wide'|'drawer', onMount })
   * body/footer may be an HTML string.
   */
  function modal(opts) {
    const o = opts || {};
    const root = $('#modal-root');
    const back = document.createElement('div');
    back.className = 'backdrop';
    back.innerHTML =
      '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + esc(o.title || '') + '</h3>' +
          '<button class="icon-btn x" data-x aria-label="Close">' + icon('x') + '</button></div>' +
        '<div class="modal-body">' + (o.body || '') + '</div>' +
        (o.footer ? '<div class="modal-foot">' + o.footer + '</div>' : '') +
      '</div>';
    root.innerHTML = '';
    root.appendChild(back);

    const box = $('.modal', back);
    back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
    $('[data-x]', back).addEventListener('click', closeModal);
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); }
    });

    const first = $('input,select,textarea,button', box);
    if (first) setTimeout(() => first.focus(), 40);
    if (o.onMount) o.onMount(box, closeModal);
    return box;
  }

  function confirm(opts) {
    const o = opts || {};
    modal({
      title: o.title || 'Are you sure?',
      body: '<p class="muted">' + esc(o.message || 'This action cannot be undone.') + '</p>',
      footer: '<button class="btn" data-no>Cancel</button>' +
              '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + esc(o.ok || 'Confirm') + '</button>',
      onMount(box, close) {
        $('[data-no]', box).addEventListener('click', close);
        $('[data-yes]', box).addEventListener('click', () => { close(); o.onYes && o.onYes(); });
      }
    });
  }

  /* ---- field helpers ---------------------------------------- */
  function field(label, inner, hint) {
    return '<label class="field"><span class="lb">' + esc(label) + '</span>' + inner +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') +
      '<span class="err"></span></label>';
  }
  function input(name, attrs) {
    return '<input class="input" name="' + name + '" ' + (attrs || '') + '>';
  }
  function select(name, options, attrs) {
    return '<select class="select" name="' + name + '" ' + (attrs || '') + '>' +
      options.map((o) => '<option value="' + esc(o.v) + '">' + esc(o.t) + '</option>').join('') +
      '</select>';
  }
  function textarea(name, attrs, rows, value) {
    return '<textarea class="textarea" name="' + name + '" ' + (attrs || '') +
      ' rows="' + (rows || 3) + '">' + esc(value || '') + '</textarea>';
  }
  function formData(box) {
    const out = {};
    $$('input,select,textarea', box).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else out[el.name] = el.value.trim();
    });
    return out;
  }
  function setBad(box, name, msg) {
    const el = $('[name="' + name + '"]', box);
    if (!el) return;
    const f = el.closest('.field');
    if (!f) return;
    f.classList.add('bad');
    const e = $('.err', f);
    if (e) e.textContent = msg || 'Please check this field';
    el.focus();
  }
  function clearBad(box) { $$('.field.bad', box).forEach((f) => f.classList.remove('bad')); }

  /* ---- misc ------------------------------------------------- */
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('Copied: ' + text, 'ok'),
        () => toast('Copy failed', 'err')
      );
    } else toast('Copy not supported here', 'err');
  }
  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Downloaded ' + filename, 'ok');
  }
  function debounce(fn, ms) {
    let t; return function () {
      const a = arguments, c = this;
      clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 200);
    };
  }
  function stageTone(stage) {
    return ['pill-info', 'pill-brand', 'pill-warn', 'pill-info', 'pill-brand', 'pill-success'][stage] || 'pill-info';
  }
  function statusTone(s) {
    const m = {
      'Approved': 'pill-success', 'Delivered': 'pill-success', 'Completed': 'pill-success',
      'Confirmed': 'pill-info', 'In review': 'pill-warn', 'Drafting': 'pill-info',
      'Pending': 'pill-warn', 'Received': 'pill-info'
    };
    return m[s] || '';
  }

  return {
    icon, esc, $, $$, money, dtf, dts, tm, md, ago, until, initials,
    toast, modal, confirm, closeModal,
    field, input, select, textarea, formData, setBad, clearBad,
    copy, download, debounce, stageTone, statusTone, paths: P
  };
})();
