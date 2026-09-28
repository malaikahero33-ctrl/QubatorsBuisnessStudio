/* =========================================================
   Qubators Business Studio — views (studio)
   designs · design editor · consultations · account · login
   ========================================================= */
(function () {
  const { icon, esc, $, $$, money, dtf, dts, tm, md, ago, until, initials,
          toast, modal, confirm, closeModal, field, input, select, textarea,
          formData, setBad, clearBad, copy, download, statusTone } = QB.ui;
  const S = QB.store;
  const V = (QB.views = QB.views || {});

  /* =======================================================
     DESIGNS — gallery
     ======================================================= */
  V.designs = function (main) {
    const list = S.designs.all();

    main.innerHTML =
      '<div class="page-head"><div class="t"><h1>Design studio</h1>' +
        '<p>Concepts, mockups and the work we have shipped.</p></div>' +
        '<div class="actions">' +
          '<button class="btn" id="sortBtn">' + icon('refresh') + 'Recently updated</button>' +
          '<button class="btn btn-primary" data-new-design>' + icon('plus') + 'New design</button>' +
        '</div></div>' +

      '<div class="grid g-4 mb">' +
        '<div class="card kpi"><div class="k-lab">Total designs</div><div class="k-val">' + list.length + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">In progress</div><div class="k-val">' + list.filter((d) => d.status === 'Drafting' || d.status === 'In review').length + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">Approved</div><div class="k-val">' + list.filter((d) => d.status === 'Approved' || d.status === 'Delivered').length + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">Awaiting client</div><div class="k-val">' + list.filter((d) => d.status === 'In review').length + '</div></div>' +
      '</div>' +

      '<div class="flex flex-wrap mb">' +
        ['', 'Packaging', 'Brand Identity', 'Digital Product', 'Campaign', 'Print'].map((t, i) =>
          '<button class="chip ' + (i === 0 ? 'on' : '') + '" data-type="' + t + '">' + (t || 'All work') + '</button>').join('') +
      '</div>' +

      '<div class="design-grid" id="dgrid">' + list.map(card).join('') + '</div>';

    let type = '';
    function apply() {
      const filtered = S.designs.all().filter((d) => !type || d.type === type);
      $('#dgrid', main).innerHTML = filtered.length ? filtered.map(card).join('') :
        '<div class="empty" style="grid-column:1/-1"><div class="e-ic">' + icon('palette') + '</div>' +
        '<h4>Nothing here yet</h4><p>Start a design brief and the canvas editor opens right here.</p>' +
        '<button class="btn btn-primary btn-sm" data-new-design>' + icon('plus') + 'New design</button></div>';
      wire();
    }
    function wire() {
      $$('[data-design]', main).forEach((el) => el.addEventListener('click', () => { location.hash = '#/designs/' + el.dataset.design; }));
      $$('[data-new-design]', main).forEach((el) => el.addEventListener('click', newDesign));
    }
    function card(d) {
      return '<article class="card design-card" data-design="' + esc(d.id) + '">' +
        '<div class="thumb" style="background:' + esc(d.thumb || 'linear-gradient(135deg,#6d4aff,#22d3ee)') + '">' +
          (d.canvas ? '<img src="' + d.canvas + '" alt="' + esc(d.name) + '">' : '') +
          '<div class="ov">' + icon('pen') + 'Open canvas</div></div>' +
        '<div class="meta"><h4>' + esc(d.name) + '</h4><p>' + esc(d.client) + ' · ' + ago(d.updated) + '</p>' +
          '<div class="tags"><span class="tag">' + esc(d.type) + '</span>' +
          '<span class="tag">' + esc(d.status) + '</span></div></div></article>';
    }

    $$('[data-type]', main).forEach((c) => c.addEventListener('click', () => {
      type = c.dataset.type;
      $$('[data-type]', main).forEach((x) => x.classList.toggle('on', x === c));
      apply();
    }));
    $('#sortBtn', main).addEventListener('click', () => { apply(); toast('Sorted by last update', 'ok'); });
    wire();
  };

  function newDesign() {
    modal({
      title: 'New design',
      body:
        field('Project name', input('name', 'placeholder="e.g. Aurora Coffee — Rebrand" required')) +
        field('Client', input('client', 'placeholder="e.g. Aurora Coffee" required')) +
        '<div class="grid-2">' +
          field('Category', select('type', ['Brand Identity', 'Packaging', 'Digital Product', 'Campaign', 'Print'].map((t) => ({ v: t, t: t })))) +
          field('Status', select('status', ['Drafting', 'In review', 'Approved', 'Delivered'].map((t) => ({ v: t, t: t })))) +
        '</div>' +
        field('Brief / notes', textarea('notes', 'placeholder="What are we solving? Tone, audience, references…"')),
      footer: '<button class="btn" data-cancel>Cancel</button><button class="btn btn-primary" data-save>Create & open canvas</button>',
      onMount(box, close) {
        $('[data-cancel]', box).addEventListener('click', close);
        $('[data-save]', box).addEventListener('click', () => {
          clearBad(box);
          const d = formData(box);
          if (!d.name) return setBad(box, 'name', 'Give the project a name');
          if (!d.client) return setBad(box, 'client', 'Who is it for?');
          const created = S.designs.add(d);
          close();
          toast('Design created', 'ok');
          location.hash = '#/designs/' + created.id;
        });
      }
    });
  }

  /* =======================================================
     DESIGN EDITOR — canvas sketchpad
     ======================================================= */
  V.designEditor = function (main, params) {
    const d = S.designs.byId(params.id);
    if (!d) { location.hash = '#/designs'; return; }

    main.innerHTML =
      '<div class="page-head"><div class="t">' +
        '<p class="muted" style="margin:0"><a href="#/designs">Design studio</a> / ' + esc(d.id) + '</p>' +
        '<h1 style="margin-top:4px">' + esc(d.name) + '</h1>' +
        '<p>' + esc(d.client) + ' · ' + esc(d.type) + ' · <span class="pill ' + statusTone(d.status) + '">' + esc(d.status) + '</span></p></div>' +
        '<div class="actions">' +
          '<button class="btn" id="editMeta">' + icon('pen') + 'Details</button>' +
          '<button class="btn" id="delDesign">' + icon('trash') + 'Delete</button>' +
          '<button class="btn btn-primary" id="saveDesign">' + icon('save') + 'Save design</button>' +
        '</div></div>' +

      '<div class="studio-layout">' +
        '<div class="card"><div class="card-body">' +
          '<div class="tools">' +
            '<div class="group"><div class="gl">Tool</div><div class="tool-grid" id="tools">' +
              [['pen', 'pen', 'Draw'], ['line', 'line', 'Line'], ['rect', 'square', 'Box'], ['circle', 'circle', 'Circle'], ['text', 'text', 'Text'], ['dot', 'dot', 'Fill']].map((t) =>
                '<button class="tool ' + (t[0] === 'pen' ? 'on' : '') + '" data-tool="' + t[0] + '">' + icon(t[1]) + t[2] + '</button>').join('') +
            '</div></div>' +
            '<div class="group"><div class="gl">Colour</div><div class="swatches" id="swatches">' +
              ['#15172b', '#6d4aff', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#ffffff'].map((c, i) =>
                '<span class="sw ' + (i === 1 ? 'on' : '') + '" data-color="' + c + '" style="background:' + c + (c === '#ffffff' ? ';border-color:var(--border)' : '') + '"></span>').join('') +
              '<input type="color" id="customColor" value="#6d4aff" style="width:25px;height:25px;border:0;background:none;cursor:pointer">' +
            '</div></div>' +
            '<div class="group"><div class="gl">Brush size</div>' +
              '<div class="size"><input type="range" id="size" min="1" max="48" value="6"><b id="sizeVal" style="min-width:44px">6 px</b></div></div>' +
            '<div class="group"><div class="gl">Canvas</div>' +
              '<button class="btn btn-sm" id="clear" style="width:100%">' + icon('eraser') + 'Clear canvas</button>' +
            '</div>' +
          '</div>' +
        '</div></div>' +

        '<div>' +
          '<div class="canvas-wrap"><div class="canvas-bar">' +
            '<span class="muted" style="font-size:12.5px">Sketch area — draw concepts straight into the brief</span>' +
            '<div class="right">' +
              '<button class="btn btn-sm" id="undo">' + icon('undo') + 'Undo</button>' +
              '<button class="btn btn-sm" id="exportPng">' + icon('download') + 'PNG</button>' +
            '</div>' +
          '</div><canvas id="cv"></canvas></div>' +
          '<div class="card mt"><div class="card-head"><h3>Brief</h3></div><div class="card-body">' +
            '<p class="muted" style="white-space:pre-wrap">' + esc(d.notes || 'No notes yet — add them from “Details”.') + '</p>' +
            '<div class="hint mt">Last updated ' + dts(d.updated) + '</div>' +
          '</div></div>' +
        '</div>' +
      '</div>';

    /* ---- canvas engine ---- */
    const cv = $('#cv', main);
    const ctx = cv.getContext('2d');
    const state = { tool: 'pen', color: '#6d4aff', size: 6, drawing: false, start: null, text: null, undo: [] };

    function fit() {
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(rect.width * dpr));
      cv.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    }
    function snapshot() {
      state.undo.push(cv.toDataURL());
      if (state.undo.length > 18) state.undo.shift();
    }
    function restore(dataUrl, done) {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height); done && done(); };
      img.src = dataUrl;
    }
    function undo() {
      const prev = state.undo.pop();
      if (!prev) return toast('Nothing to undo', 'err');
      restore(prev);
    }
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    };

    let down = false;
    function start(e) {
      e.preventDefault();
      snapshot();
      const p = pos(e);
      down = true;
      ctx.strokeStyle = state.color; ctx.fillStyle = state.color;
      ctx.lineWidth = state.size;

      if (state.tool === 'text') {
        const t = prompt('Text on canvas:');
        if (t) { ctx.font = '700 ' + (state.size * 3.2) + 'px "Segoe UI", system-ui, sans-serif'; ctx.fillText(t, p.x, p.y); }
        down = false; state.undo.pop(); return;
      }
      if (state.tool === 'pen') { ctx.beginPath(); ctx.moveTo(p.x, p.y); return; }
      state.start = p;
    }
    function move(e) {
      if (!down) return;
      e.preventDefault();
      const p = pos(e);
      if (state.tool === 'pen') { ctx.lineTo(p.x, p.y); ctx.stroke(); return; }
      const s = state.start;
      ctx.save();
      ctx.lineWidth = state.size;
      if (state.tool === 'line') {
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      } else if (state.tool === 'rect') {
        ctx.strokeRect(s.x, s.y, p.x - s.x, p.y - s.y);
      } else if (state.tool === 'circle') {
        const r = Math.hypot(p.x - s.x, p.y - s.y);
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
      } else if (state.tool === 'dot') {
        ctx.beginPath(); ctx.arc(p.x, p.y, state.size / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    function end() {
      if (!down) return;
      down = false;
      ctx.beginPath();
      state.start = null;
    }

    cv.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false });
    cv.addEventListener('touchmove', move, { passive: false });
    cv.addEventListener('touchend', end);

    setTimeout(() => {
      fit();
      if (d.canvas) restore(d.canvas);
    }, 30);
    window.addEventListener('resize', () => { if (document.body.contains(cv)) { const c = cv.toDataURL(); fit(); restore(c); } });

    /* ---- tool wiring ---- */
    $('#tools', main).addEventListener('click', (e) => {
      const b = e.target.closest('[data-tool]');
      if (!b) return;
      state.tool = b.dataset.tool;
      $$('#tools .tool', main).forEach((t) => t.classList.toggle('on', t === b));
    });
    $('#swatches', main).addEventListener('click', (e) => {
      const s = e.target.closest('[data-color]');
      if (!s) return;
      state.color = s.dataset.color;
      $$('#swatches .sw', main).forEach((x) => x.classList.toggle('on', x === s));
    });
    $('#customColor', main).addEventListener('input', (e) => { state.color = e.target.value; });
    $('#size', main).addEventListener('input', (e) => {
      state.size = Number(e.target.value);
      $('#sizeVal', main).textContent = state.size + ' px';
    });
    $('#undo', main).addEventListener('click', undo);
    $('#clear', main).addEventListener('click', () => confirm({
      title: 'Clear the canvas?', message: 'The sketch will be erased. Save first if you want to keep it.',
      ok: 'Clear', danger: true,
      onYes() { snapshot(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
    }));
    $('#exportPng', main).addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = d.id + '-concept.png';
      a.click();
      toast('Concept exported as PNG', 'ok');
    });
    $('#saveDesign', main).addEventListener('click', () => {
      S.designs.update(d.id, { canvas: cv.toDataURL('image/jpeg', 0.7) });
      toast('Design saved to the library', 'ok');
    });
    $('#editMeta', main).addEventListener('click', () => {
      modal({
        title: 'Design details',
        body:
          field('Project name', input('name', 'value="' + esc(d.name) + '"')) +
          field('Client', input('client', 'value="' + esc(d.client) + '"')) +
          '<div class="grid-2">' +
            field('Category', select('type', ['Brand Identity', 'Packaging', 'Digital Product', 'Campaign', 'Print'].map((t) => ({ v: t, t: t })), '')) +
            field('Status', select('status', ['Drafting', 'In review', 'Approved', 'Delivered'].map((t) => ({ v: t, t: t })), '')) +
          '</div>' + field('Brief', textarea('notes', '', 4)),
        footer: '<button class="btn" data-cancel>Cancel</button><button class="btn btn-primary" data-save>Save</button>',
        onMount(box, close) {
          $('select[name=type]', box).value = d.type;
          $('select[name=status]', box).value = d.status;
          $('textarea[name=notes]', box).value = d.notes || '';
          $('[data-cancel]', box).addEventListener('click', close);
          $('[data-save]', box).addEventListener('click', () => {
            S.designs.update(d.id, formData(box));
            close(); toast('Details updated', 'ok');
            V.designEditor(main, params);
          });
        }
      });
    });
    $('#delDesign', main).addEventListener('click', () => confirm({
      title: 'Delete ' + d.name + '?', message: 'The concept and brief will be removed from the library.',
      ok: 'Delete design', danger: true,
      onYes() { S.designs.remove(d.id); toast('Design deleted', 'ok'); location.hash = '#/designs'; }
    }));
  };

  /* =======================================================
     CONSULTATIONS
     ======================================================= */
  V.consultations = function (main) {
    const up = S.consults.upcoming();
    const past = S.consults.past().reverse();

    const card = (c) =>
      '<div class="card mb"><div class="card-body between" style="flex-wrap:wrap;gap:12px">' +
        '<div style="display:flex;gap:13px;align-items:flex-start;min-width:220px">' +
          '<div class="k-ic" style="width:40px;height:40px;border-radius:11px;display:grid;place-content:center;background:var(--brand-soft);color:var(--brand-ink)">' + icon('cal') + '</div>' +
          '<div><strong>' + esc(c.topic) + '</strong>' +
            '<div class="hint">' + esc(c.client) + ' · with ' + esc(c.advisor) + '</div>' +
            '<div class="hint">' + dts(c.when) + ' · ' + c.duration + ' min · ' + esc(c.mode) + '</div></div>' +
        '</div>' +
        '<div class="flex flex-wrap">' +
          '<span class="pill ' + statusTone(c.status) + '">' + esc(c.status) + '</span>' +
          (c.status !== 'Completed'
            ? '<button class="btn btn-sm" data-done="' + c.id + '">' + icon('check') + 'Mark done</button>' +
              '<button class="btn btn-sm" data-join="' + c.id + '">' + icon('send') + 'Join call</button>'
            : '') +
          '<button class="btn btn-sm btn-danger" data-del="' + c.id + '">' + icon('trash') + '</button>' +
        '</div>' +
      '</div></div>';

    main.innerHTML =
      '<div class="page-head"><div class="t"><h1>Consultations</h1>' +
        '<p>Discovery calls, reviews and free 20-minute slots.</p></div>' +
        '<div class="actions"><button class="btn btn-primary" id="book">' + icon('plus') + 'Book a slot</button></div></div>' +

      '<div class="grid g-3 mb">' +
        '<div class="card kpi"><div class="k-lab">Upcoming</div><div class="k-val">' + up.length + '</div><div class="k-foot">next: ' + (up[0] ? until(up[0].when) : '—') + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">Completed this month</div><div class="k-val">' + past.filter((c) => new Date(c.when).getMonth() === new Date().getMonth()).length + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">Hours booked</div><div class="k-val">' + Math.round(up.reduce((s, c) => s + c.duration, 0) / 60 * 10) / 10 + 'h</div></div>' +
      '</div>' +

      '<div class="grid g-2">' +
        '<div><h3 style="font-size:14px;margin-bottom:12px">Upcoming</h3>' +
          (up.length ? up.map(card).join('') :
            '<div class="card"><div class="empty"><div class="e-ic">' + icon('cal') + '</div><h4>Calendar is clear</h4><p>Book a discovery call and unblock pending jobs.</p><button class="btn btn-sm btn-primary" id="book2">Book a slot</button></div></div>') +
        '</div>' +
        '<div><h3 style="font-size:14px;margin-bottom:12px">Past &amp; completed</h3>' +
          (past.length ? past.slice(0, 8).map(card).join('') : '<div class="card"><div class="empty"><p>No past consultations yet.</p></div></div>') +
        '</div>' +
      '</div>';

    const book = () => {
      const slots = [];
      for (let i = 0; i < 10; i++) {
        const d = new Date(Date.now() + (i + 1) * 864e5);
        d.setHours(11, 0, 0, 0);
        slots.push({ v: d.toISOString(), t: dtf(d) + ' · ' + tm(d) });
      }
      modal({
        title: 'Book a consultation',
        body:
          field('Client', input('client', 'placeholder="Client or company" required')) +
          field('Topic', input('topic', 'placeholder="e.g. Brand positioning workshop" required')) +
          '<div class="grid-2">' +
            field('Slot', select('when', slots)) +
            field('Duration', select('duration', [{ v: 20, t: '20 min' }, { v: 30, t: '30 min' }, { v: 45, t: '45 min' }, { v: 60, t: '60 min' }])) +
          '</div>' +
          '<div class="grid-2">' +
            field('Mode', select('mode', [{ v: 'Video', t: 'Video call' }, { v: 'Studio', t: 'In studio' }, { v: 'Phone', t: 'Phone' }])) +
            field('Advisor', select('advisor', S.misc.users().map((u) => ({ v: u.name.split(' ')[0], t: u.name })))) +
          '</div>',
        footer: '<button class="btn" data-cancel>Cancel</button><button class="btn btn-primary" data-save>Book slot</button>',
        onMount(box, close) {
          $('[data-cancel]', box).addEventListener('click', close);
          $('[data-save]', box).addEventListener('click', () => {
            clearBad(box);
            const d = formData(box);
            if (!d.client) return setBad(box, 'client', 'Who is the call for?');
            if (!d.topic) return setBad(box, 'topic', 'Add a short topic');
            S.consults.add({
              client: d.client, topic: d.topic, when: new Date(d.when).getTime(),
              duration: Number(d.duration), mode: d.mode, advisor: d.advisor, status: 'Confirmed'
            });
            close(); toast('Consultation booked', 'ok');
            V.consultations(main);
          });
        }
      });
    };

    $('#book', main).addEventListener('click', book);
    const b2 = $('#book2', main); if (b2) b2.addEventListener('click', book);

    main.addEventListener('click', (e) => {
      const done = e.target.closest('[data-done]');
      const del = e.target.closest('[data-del]');
      const join = e.target.closest('[data-join]');
      if (done) { S.consults.setStatus(done.dataset.done, 'Completed'); toast('Marked complete', 'ok'); V.consultations(main); }
      if (del) { S.consults.remove(del.dataset.del); toast('Removed', 'ok'); V.consultations(main); }
      if (join) toast('Call link copied to clipboard', 'ok');
    });
  };

  /* =======================================================
     ACCOUNT — profile, security, team
     ======================================================= */
  V.account = function (main) {
    const u = S.account.get();
    const tab = sessionStorage.getItem('qb_tab') || 'profile';

    main.innerHTML =
      '<div class="page-head"><div class="t"><h1>Business account</h1>' +
        '<p>Your studio profile, security and team access.</p></div></div>' +
      '<div class="tabs" id="tabs">' +
        ['profile', 'business', 'security', 'team'].map((t) =>
          '<button class="tab ' + (t === tab ? 'on' : '') + '" data-tab="' + t + '">' +
          ({ profile: 'Profile', business: 'Business', security: 'Login & security', team: 'Team' })[t] + '</button>').join('') +
      '</div><div id="pane"></div>';

    function pane() {
      const t = sessionStorage.getItem('qb_tab') || 'profile';
      const P = $('#pane', main);
      if (t === 'profile') P.innerHTML = profilePane(u);
      if (t === 'business') P.innerHTML = businessPane(u);
      if (t === 'security') P.innerHTML = securityPane(u);
      if (t === 'team') P.innerHTML = teamPane();
      wirePane(P, main);
    }

    $('#tabs', main).addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      sessionStorage.setItem('qb_tab', b.dataset.tab);
      $$('#tabs .tab', main).forEach((t) => t.classList.toggle('on', t === b));
      pane();
    });
    pane();
  };

  function avatarHtml(u) {
    return u.avatar
      ? '<img class="avatar-lg" src="' + u.avatar + '" alt="Profile photo" style="object-fit:cover">'
      : '<div class="avatar-lg">' + initials(u.name) + '</div>';
  }

  function profilePane(u) {
    return '<div class="grid g-12">' +
      '<div class="card"><div class="card-body">' +
        '<div class="flex" style="gap:15px;align-items:center">' + avatarHtml(u) +
          '<div><strong style="font-size:15px">' + esc(u.name) + '</strong>' +
          '<div class="hint">' + esc(u.role) + '</div>' +
          '<div class="hint">Member since ' + dtf(u.joined) + '</div></div></div>' +
        '<hr style="border:0;border-top:1px solid var(--border);margin:18px 0">' +
        '<div class="rowlist">' +
          '<div class="r"><div class="b"><b>' + esc(u.email) + '</b><span>Studio email</span></div></div>' +
          '<div class="r"><div class="b"><b>' + esc(u.phone) + '</b><span>Phone</span></div></div>' +
          '<div class="r"><div class="b"><b>' + esc(u.timezone) + '</b><span>Timezone</span></div></div>' +
        '</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Edit profile</h3></div><div class="card-body" id="profForm">' +
        '<div class="grid-2">' +
          field('Full name', input('name', 'value="' + esc(u.name) + '"')) +
          field('Role / title', input('role', 'value="' + esc(u.role) + '"')) +
        '</div>' +
        '<div class="grid-2">' +
          field('Email', input('email', 'type="email" value="' + esc(u.email) + '"')) +
          field('Phone', input('phone', 'value="' + esc(u.phone) + '"')) +
        '</div>' +
        '<div class="grid-2">' +
          field('Timezone', input('timezone', 'value="' + esc(u.timezone) + '"')) +
          field('Profile photo URL', input('avatar', 'value="' + esc(u.avatar || '') + '" placeholder="https://…"')) +
        '</div>' +
        field('Short bio', textarea('bio', '', 3, u.bio)) +
        '<button class="btn btn-primary" data-save-prof>Save changes</button>' +
      '</div></div></div>';
  }

  function businessPane(u) {
    return '<div class="grid g-2">' +
      '<div class="card"><div class="card-head"><h3>Business details</h3><span class="sub">Shown on invoices &amp; tracking pages</span></div>' +
      '<div class="card-body" id="bizForm">' +
        field('Studio / company name', input('studio', 'value="' + esc(u.studio) + '"')) +
        field('Location', input('location', 'value="' + esc(u.location) + '"')) +
        field('Plan', input('plan', 'value="' + esc(u.plan) + '" disabled')) +
        field('Brand colour', input('brandColor', 'type="color" value="' + esc(u.brandColor) + '" style="height:42px;padding:4px"')) +
        '<button class="btn btn-primary" data-save-biz>Save business</button>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Public tracking page</h3></div><div class="card-body">' +
        '<p class="muted">This is what customers see. Share the link on your invoice or confirmation email.</p>' +
        '<div class="rowlist mt">' +
          '<div class="r"><div class="b"><b>' + esc(location.origin + location.pathname) + '#/track</b><span>Customer portal</span></div>' +
            '<div class="right"><button class="btn btn-sm" data-copy-url>' + icon('save') + 'Copy</button></div></div>' +
          '<div class="r"><div class="b"><b>Example order</b><span>QB-1041</span></div>' +
            '<div class="right"><a class="btn btn-sm" href="#/track/QB-1041">' + icon('globe') + 'Preview</a></div></div>' +
        '</div>' +
        '<h4 style="margin:22px 0 10px;font-size:13px">Notifications</h4>' +
        '<div class="rowlist">' +
          sw('notif.order', 'New order alerts', 'Email me when an order arrives') +
          sw('notif.consult', 'Consultation reminders', 'One hour before each call') +
          sw('notif.digest', 'Weekly digest', 'Monday summary of the studio') +
        '</div>' +
      '</div></div></div>';
  }
  function sw(name, title, sub) {
    const u = S.account.get();
    const parts = name.split('.');
    const on = u[parts[0]] && u[parts[0]][parts[1]];
    return '<div class="r"><div class="b"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div>' +
      '<div class="right"><label class="switch"><input type="checkbox" data-notif="' + name + '" ' + (on ? 'checked' : '') + '><span class="track"></span></label></div></div>';
  }

  function securityPane(u) {
    return '<div class="grid g-2">' +
      '<div>' +
        '<div class="card mb"><div class="card-head"><h3>Change password</h3><span class="sub">Last changed ' + dtf(u.lastPasswordChange) + '</span></div>' +
        '<div class="card-body" id="pwForm">' +
          field('Current password', input('current', 'type="password" placeholder="••••••••"')) +
          '<div class="grid-2">' +
            field('New password', input('next', 'type="password" placeholder="min 8 characters"')) +
            field('Confirm password', input('confirm', 'type="password" placeholder="repeat"')) +
          '</div>' +
          '<div class="meter mb"><i id="pwStrength" style="width:0%"></i></div>' +
          '<p class="hint mb" id="pwHint">Use 8+ characters with a number and a symbol.</p>' +
          '<button class="btn btn-primary" data-save-pw>Update password</button>' +
        '</div></div>' +

        '<div class="card"><div class="card-head"><h3>Two-factor authentication</h3></div><div class="card-body">' +
          '<div class="between mb"><div><b style="font-size:13.5px">Protect the studio account</b>' +
          '<div class="hint">Require a code from your phone at every login.</div></div>' +
          '<label class="switch"><input type="checkbox" id="twofa" ' + (u.twoFA ? 'checked' : '') + '><span class="track"></span></label></div>' +
          '<div id="twofaBox" class="' + (u.twoFA ? '' : 'hide') + '">' +
            '<div class="flex" style="gap:16px;align-items:flex-start">' +
              '<canvas class="qr" id="qr" width="132" height="132"></canvas>' +
              '<div><b style="font-size:13px">Scan with your authenticator</b>' +
              '<p class="hint">Use Google Authenticator, Authy or 1Password. Enter the code to finish setup.</p>' +
                field('6-digit code', input('code', 'inputmode="numeric" maxlength="6" placeholder="000000"')) +
              '</div></div>' +
          '</div>' +
        '</div></div>' +
      '</div>' +

      '<div>' +
        '<div class="card mb"><div class="card-head"><h3>Where you are signed in</h3><span class="sub">3 active sessions</span></div>' +
        '<div class="card-body">' +
          [['monitor', 'Chrome — Windows', 'Dhaka, Bangladesh · 192.168.1.24', 'Active now', true],
           ['phone', 'Safari — iPhone 15', 'Dhaka, Bangladesh · 102.16.4.8', '2 hours ago', false],
           ['globe', 'Firefox — Ubuntu', 'Chattogram, Bangladesh · 45.22.9.7', '3 days ago', false]]
          .map((s) => '<div class="session-row"><span class="ic-box">' + icon(s[0]) + '</span>' +
            '<div><b>' + esc(s[1]) + '</b><span>' + esc(s[2]) + '</span></div>' +
            '<div class="right"><span class="hint">' + s[3] + '</span>' +
            (s[4] ? '<span class="pill pill-success">This device</span>' : '<button class="btn btn-sm" data-revoke>Sign out</button>') +
            '</div></div>').join('') +
          '<button class="btn btn-sm mt" data-revoke-all style="width:100%">' + icon('logout') + 'Sign out of all other devices</button>' +
        '</div></div>' +

        '<div class="card danger-zone"><div class="card-head"><h3>Danger zone</h3></div><div class="card-body">' +
          '<p class="muted" style="margin-bottom:14px">These actions are permanent. Export your data before you continue.</p>' +
          '<div class="flex flex-wrap">' +
            '<button class="btn" id="exportData">' + icon('download') + 'Export my data</button>' +
            '<button class="btn btn-danger" id="resetAll">' + icon('trash') + 'Reset demo data</button>' +
          '</div></div></div>' +
      '</div></div>';
  }

  function teamPane() {
    return '<div class="card"><div class="card-head"><h3>Studio team</h3>' +
      '<span class="sub">People who can see orders and designs</span>' +
      '<div class="right"><button class="btn btn-sm btn-primary" id="invite">' + icon('plus') + 'Invite</button></div></div>' +
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Member</th><th>Role</th><th>Email</th><th>Status</th></tr></thead><tbody>' +
        S.misc.users().map((u) => '<tr><td><b>' + esc(u.name) + '</b></td><td class="muted">' + esc(u.role) + '</td>' +
          '<td class="mono">' + esc(u.email) + '</td>' +
          '<td><span class="pill ' + (u.status === 'Active' ? 'pill-success' : 'pill-warn') + '"><i class="d"></i>' + esc(u.status) + '</span></td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  function wirePane(P, main) {
    const u = S.account.get();

    const sp = $('[data-save-prof]', P);
    if (sp) sp.addEventListener('click', () => {
      const d = formData($('#profForm', P));
      if (!d.name) return toast('Name is required', 'err');
      S.account.update(d);
      toast('Profile updated', 'ok');
      V.account(main);
    });

    const sb = $('[data-save-biz]', P);
    if (sb) sb.addEventListener('click', () => {
      const d = formData($('#bizForm', P));
      S.account.update({ studio: d.studio, location: d.location, brandColor: d.brandColor });
      toast('Business details saved', 'ok');
    });

    const cu = $('[data-copy-url]', P);
    if (cu) cu.addEventListener('click', () => copy(location.origin + location.pathname + '#/track'));

    $$('[data-notif]', P).forEach((el) => el.addEventListener('change', () => {
      const parts = el.dataset.notif.split('.');
      const cur = S.account.get();
      cur[parts[0]][parts[1]] = el.checked;
      S.save();
      toast('Preference saved', 'ok');
    }));

    const next = $('input[name=next]', P);
    if (next) {
      const bar = $('#pwStrength', P), hint = $('#pwHint', P);
      next.addEventListener('input', () => {
        const v = next.value;
        let score = 0;
        if (v.length >= 8) score++;
        if (/[0-9]/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        bar.style.width = (score / 4 * 100) + '%';
        hint.textContent = score === 0 ? 'Start typing a new password.'
          : ['Too short — add more characters', 'Weak — mix in numbers and symbols', 'Okay — a little longer would help', 'Good password', 'Strong password'][score];
      });
      const btn = $('[data-save-pw]', P);
      if (btn) btn.addEventListener('click', () => {
        clearBad($('#pwForm', P));
        const d = formData($('#pwForm', P));
        if (!d.current) return setBad($('#pwForm', P), 'current', 'Enter your current password');
        if (d.next.length < 8) return setBad($('#pwForm', P), 'next', 'At least 8 characters');
        if (d.next !== d.confirm) return setBad($('#pwForm', P), 'confirm', 'Passwords do not match');
        if (!/[0-9]/.test(d.next)) return setBad($('#pwForm', P), 'next', 'Add at least one number');
        S.account.password(d.next);
        toast('Password updated', 'ok');
        V.account(main);
      });
    }

    const twofa = $('#twofa', P);
    if (twofa) {
      drawQR($('#qr', P));
      twofa.addEventListener('change', () => {
        $('#twofaBox', P).classList.toggle('hide', !twofa.checked);
        if (twofa.checked) toast('Enter the 6-digit code to finish setup', 'info');
      });
    }

    $$('[data-revoke]', P).forEach((b) => b.addEventListener('click', () => {
      b.textContent = 'Signed out';
      b.disabled = true;
      toast('Session ended', 'ok');
    }));
    const all = $('[data-revoke-all]', P);
    if (all) all.addEventListener('click', () => confirm({
      title: 'Sign out everywhere?', message: 'You will stay signed in on this device only.',
      ok: 'Sign out others', danger: true,
      onYes() { toast('All other devices signed out', 'ok'); }
    }));

    const ex = $('#exportData', P);
    if (ex) ex.addEventListener('click', () => {
      const u2 = S.account.get();
      download('qubators-account.json', JSON.stringify({
        user: u2, orders: S.orders.all(), designs: S.designs.all(), consults: S.consults.all()
      }, null, 2));
    });
    const rs = $('#resetAll', P);
    if (rs) rs.addEventListener('click', () => confirm({
      title: 'Reset all demo data?', message: 'Orders, designs and consultations return to their original state.',
      ok: 'Reset everything', danger: true, onYes() { S.misc.reset(); }
    }));

    const inv = $('#invite', P);
    if (inv) inv.addEventListener('click', () => {
      modal({
        title: 'Invite a teammate',
        body: field('Email', input('email', 'type="email" placeholder="name@qubators.studio"')) +
             field('Role', select('role', S.misc.users().map((x) => ({ v: x.role, t: x.role })))),
        footer: '<button class="btn" data-cancel>Cancel</button><button class="btn btn-primary" data-send>Send invite</button>',
        onMount(box, close) {
          $('[data-cancel]', box).addEventListener('click', close);
          $('[data-send]', box).addEventListener('click', () => {
            const d = formData(box);
            if (!d.email) return setBad(box, 'email', 'Email is required');
            close(); toast('Invite sent to ' + d.email, 'ok');
          });
        }
      });
    });
  }

  function drawQR(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const n = 21, cell = canvas.width / n;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const finder = (r, c) => {
      const inBox = (rr, cc) => rr < 7 && rr >= 0 && cc < 7 && cc >= 0;
      const local = (rr, cc) => (rr < 0 ? rr + 7 : rr) === 0 || (rr < 0 ? rr + 7 : rr) === 6 || (cc < 0 ? cc + 7 : cc) === 0 || (cc < 0 ? cc + 7 : cc) === 6
        || ((rr < 0 ? rr + 7 : rr) >= 2 && (rr < 0 ? rr + 7 : rr) <= 4 && (cc < 0 ? cc + 7 : cc) >= 2 && (cc < 0 ? cc + 7 : cc) <= 4);
      return inBox(r, c) && local(r, c);
    };
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const inFinder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const on = inFinder ? finder(r < 7 ? r : r - (n - 7), c < 7 ? c : c - (n - 7)) : rnd() > 0.52;
      if (on) { ctx.fillStyle = '#15172b'; ctx.fillRect(c * cell, r * cell, cell, cell); }
    }
  }

  /* =======================================================
     LOGIN (public)
     ======================================================= */
  V.login = function (main) {
    main.className = 'bare';
    main.innerHTML =
      '<div class="bare-art">' +
        '<div class="flex"><div class="brand-mark" style="width:40px;height:40px;font-size:19px">Q</div>' +
        '<div><strong style="font-size:15px">Qubators</strong><div class="hint" style="margin:0;color:#7f85a8">Business Studio</div></div></div>' +
        '<div>' +
          '<h2>Everything your studio runs on.</h2>' +
          '<p>Designs, consultations and orders in one place — with a customer portal that shows exactly where every job sits.</p>' +
          '<div class="feat">' +
            [['cart', 'Track every order from received to delivered'],
             ['pen', 'Brief, sketch and approve concepts in-browser'],
             ['cal', 'Book consultations and keep the calendar honest'],
             ['shield', 'Account, password and two-factor security']]
              .map((f) => '<div>' + icon(f[0]) + '<span>' + f[1] + '</span></div>').join('') +
          '</div>' +
        '</div>' +
        '<p style="color:#6f7599;font-size:12px">© ' + new Date().getFullYear() + ' Qubators Business Studio</p>' +
      '</div>' +

      '<div class="bare-form"><div class="box">' +
        '<h1 style="font-size:24px;margin-bottom:6px">Welcome back</h1>' +
        '<p class="muted mb">Sign in to your studio workspace.</p>' +
        '<form id="loginForm">' +
          '<label class="field"><span class="lb">Studio email</span>' +
            '<input class="input" name="email" type="email" value="owner@qubators.studio" required></label>' +
          '<label class="field"><span class="lb">Password</span>' +
            '<input class="input" name="password" type="password" value="studio123" required></label>' +
          '<div class="between mb"><label class="switch"><input type="checkbox" checked><span class="track"></span>' +
            '<span class="tx"><b style="font-size:12.5px">Keep me signed in</b></span></label>' +
            '<a href="#" class="hint">Forgot password?</a></div>' +
          '<button class="btn btn-primary" type="submit" style="width:100%;padding:11px">Sign in</button>' +
        '</form>' +
        '<div class="demo-note">Demo workspace — any email with a 4+ character password works. Data saves in this browser.</div>' +
        '<p class="hint mt" style="text-align:center">Just checking on an order? ' +
          '<a href="#/track">Open customer tracking</a></p>' +
      '</div></div>';

    $('#loginForm', main).addEventListener('submit', (e) => {
      e.preventDefault();
      const d = formData($('#loginForm', main));
      const res = S.auth.login(d.email, d.password);
      if (!res.ok) return toast(res.error, 'err');
      toast('Signed in. Opening your studio…', 'ok');
      location.hash = '#/dashboard';
    });
  };
})();
