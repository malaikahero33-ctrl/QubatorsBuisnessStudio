/* =========================================================
   Qubators Business Studio — views (core)
   dashboard · orders · order detail · public tracking
   ========================================================= */
(function () {
  const { icon, esc, $, $$, money, dtf, dts, md, ago, until, initials,
          toast, modal, confirm, closeModal, field, input, select, textarea,
          formData, setBad, clearBad, copy, download, debounce, stageTone, statusTone } = QB.ui;
  const S = QB.store;
  const V = (QB.views = QB.views || {});

  /* =======================================================
     Shared: order progress rail
     ======================================================= */
  function journeyBar(stage) {
    let out = '<div class="journey-bar">';
    for (let i = 0; i < S.ORDER_STAGES.length; i++) out += '<i class="' + (i <= stage ? 'on' : '') + '"></i>';
    return out + '</div>';
  }
  V.journeyBar = journeyBar;

  function orderRow(o) {
    const pct = Math.round((o.stage / (S.ORDER_STAGES.length - 1)) * 100);
    return '<tr data-order="' + esc(o.id) + '">' +
      '<td><span class="id">' + esc(o.id) + '</span><div class="muted" style="font-size:11.5px">' + esc(o.item) + '</div></td>' +
      '<td>' + esc(o.customer) + '<div class="muted" style="font-size:11.5px">' + esc(o.channel) + '</div></td>' +
      '<td class="mono">' + money(o.total) + '</td>' +
      '<td style="min-width:170px">' +
        '<div class="flex" style="justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:5px">' +
          '<span>' + esc(S.ORDER_STAGES[o.stage]) + '</span><span>' + pct + '%</span></div>' +
        journeyBar(o.stage) +
      '</td>' +
      '<td class="nowrap muted">' + dtf(o.placed) + '</td>' +
      '<td class="nowrap">' + '<span class="pill ' + stageTone(o.stage) + '"><i class="d"></i>' + esc(S.ORDER_STAGES[o.stage]) + '</span>' + '</td>' +
      '</tr>';
  }

  /* =======================================================
     DASHBOARD
     ======================================================= */
  V.dashboard = function (main) {
    const st = S.misc.stats();
    const orders = S.orders.all();
    const active = orders.filter((o) => o.stage < 5);
    const up = S.consults.upcoming();
    const next = up[0];

    const kpi = (lab, val, foot, ic, upDown) =>
      '<div class="card kpi"><div class="k-top"><span class="k-ic">' + icon(ic) + '</span>' +
      '<span class="k-lab">' + lab + '</span></div><div class="k-val">' + val + '</div>' +
      '<div class="k-foot">' + (upDown || '') + foot + '</div></div>';

    const funnel = S.ORDER_STAGES.map((label, i) => {
      const c = active.filter((o) => o.stage === i).length;
      const max = Math.max.apply(null, active.map((o) => o.stage === i ? 1 : 0).concat([1]));
      const n = active.length ? Math.round((c / Math.max(active.length, 1)) * 100) : 0;
      return '<div class="fr"><span>' + esc(label) + '</span>' +
        '<div class="meter"><i style="width:' + Math.max(n, c ? 6 : 0) + '%"></i></div>' +
        '<b>' + c + '</b></div>';
    }).join('');

    main.innerHTML =
      '<div class="page-head"><div class="t"><h1>Good day, ' + esc((S.account.get().name || '').split(' ')[0]) + '</h1>' +
        '<p>' + dtf(Date.now()) + ' · ' + st.active + ' active orders in the studio</p></div>' +
        '<div class="actions">' +
          '<button class="btn" data-nav="orders">' + icon('cart') + 'All orders</button>' +
          '<button class="btn btn-primary" data-nav="new-order">' + icon('plus') + 'New order</button>' +
        '</div></div>' +

      '<div class="grid g-4 mb">' +
        kpi('Active orders', st.active, st.pending ? '<span class="down">' + st.pending + ' need attention</span>' : 'all on track', 'cart') +
        kpi('Open pipeline', money(st.pipeline), 'across ' + st.active + ' live orders', 'bolt') +
        kpi('Designs', st.designs, 'in the studio library', 'palette') +
        kpi('Consultations', st.consults, next ? 'next: ' + until(next.when) : 'none scheduled', 'cal') +
      '</div>' +

      '<div class="grid g-21">' +
        '<div class="card"><div class="card-head"><h3>Order pipeline</h3>' +
          '<span class="sub">Live jobs by stage</span>' +
          '<div class="right"><button class="btn btn-sm" data-nav="orders">View all</button></div></div>' +
          '<div class="card-body"><div class="funnel">' + funnel + '</div>' +
            '<div class="mt" style="border-top:1px solid var(--border);padding-top:16px">' +
              '<div class="between mb"><strong style="font-size:13px">Delivered revenue</strong>' +
              '<strong>' + money(st.revenue) + '</strong></div>' +
              '<div class="meter"><i style="width:' + Math.min(100, Math.round((st.revenue / Math.max(st.revenue + st.pipeline, 1)) * 100)) + '%"></i></div>' +
              '<p class="hint" style="margin-top:8px">' + st.delivered + ' of ' + orders.length + ' orders completed end to end.</p>' +
            '</div>' +
          '</div></div>' +

        '<div class="card"><div class="card-head"><h3>Coming up</h3><span class="sub">Consultations</span></div>' +
          '<div class="card-body">' +
            (up.length ? up.slice(0, 4).map((c) =>
              '<div class="rowlist"><div class="r"><div class="b"><b>' + esc(c.topic) + '</b>' +
              '<span>' + esc(c.client) + ' · ' + esc(c.mode) + ' · ' + c.duration + 'm</span></div>' +
              '<div class="right"><span class="pill ' + statusTone(c.status) + '">' + esc(c.status) + '</span>' +
              '<div class="hint">' + dts(c.when) + '</div></div></div></div>').join('')
              : '<div class="empty"><div class="e-ic">' + icon('cal') + '</div><h4>Nothing scheduled</h4><p>Book a consultation to unblock a stuck job.</p><button class="btn btn-sm" data-nav="consultations">Open calendar</button></div>') +
          '</div></div>' +
      '</div>' +

      '<div class="grid g-12 mt">' +
        '<div class="card"><div class="card-head"><h3>Recent orders</h3><div class="right"><button class="btn btn-sm" data-nav="orders">See all</button></div></div>' +
          '<div style="overflow-x:auto"><table class="table"><thead><tr>' +
            '<th>Order</th><th>Customer</th><th>Value</th><th>Progress</th><th>Placed</th><th>Status</th>' +
          '</tr></thead><tbody>' + orders.slice(0, 5).map(orderRow).join('') + '</tbody></table></div>' +
        '</div>' +

        '<div class="card"><div class="card-head"><h3>Studio activity</h3><span class="sub">Latest</span></div>' +
          '<div class="card-body"><div class="feed">' +
            S.misc.activity().slice(0, 7).map((a) =>
              '<div class="fi"><span class="bubble">' + icon(a.icon) + '</span><div><p>' + esc(a.text) + '</p><time>' + ago(a.when) + '</time></div></div>'
            ).join('') +
          '</div></div></div>' +
      '</div>';

    wireOrderRows(main);
  };

  /* =======================================================
     ORDERS LIST
     ======================================================= */
  V.orders = function (main) {
    main.innerHTML =
      '<div class="page-head"><div class="t"><h1>Orders</h1>' +
        '<p>Every job, its stage and the customer-facing link.</p></div>' +
        '<div class="actions">' +
          '<button class="btn" id="exportOrders">' + icon('download') + 'Export CSV</button>' +
          '<button class="btn btn-primary" data-nav="new-order">' + icon('plus') + 'New order</button>' +
        '</div></div>' +

      '<div class="card"><div class="card-head" style="flex-wrap:wrap;gap:10px">' +
        '<div class="search" style="margin-left:0;width:280px">' + icon('search') +
          '<input id="q" placeholder="Search order, customer, item…"></div>' +
        '<div class="right" id="filters">' +
          ['all', 'live', 'delivered', 'urgent'].map((f, i) =>
            '<button class="chip ' + (i === 0 ? 'on' : '') + '" data-filter="' + f + '">' +
            ({ all: 'All', live: 'In progress', delivered: 'Delivered', urgent: 'Needs attention' })[f] + '</button>').join('') +
        '</div></div>' +
        '<div style="overflow-x:auto"><table class="table"><thead><tr>' +
          '<th>Order</th><th>Customer</th><th>Value</th><th>Progress</th><th>Placed</th><th>Status</th>' +
        '</tr></thead><tbody id="rows"></tbody></table></div>' +
        '<div id="orderEmpty" class="empty hide"><div class="e-ic">' + icon('search') + '</div>' +
          '<h4>No matching orders</h4><p>Try another search or clear the filters.</p></div>' +
      '</div>';

    const rows = $('#rows', main);
    const empty = $('#orderEmpty', main);
    const q = $('#q', main);
    let filter = 'all';

    function render() {
      const term = q.value.toLowerCase().trim();
      let list = S.orders.all().filter((o) => {
        if (filter === 'live' && o.stage >= 5) return false;
        if (filter === 'delivered' && o.stage !== 5) return false;
        if (filter === 'urgent' && o.priority !== 'urgent' && o.priority !== 'high') return false;
        if (!term) return true;
        return (o.id + ' ' + o.customer + ' ' + o.item).toLowerCase().indexOf(term) > -1;
      });
      rows.innerHTML = list.map(orderRow).join('');
      empty.classList.toggle('hide', list.length > 0);
      wireOrderRows(main);
    }

    q.addEventListener('input', debounce(render, 120));
    $('#filters', main).addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      filter = b.dataset.filter;
      $$('#filters .chip', main).forEach((c) => c.classList.toggle('on', c === b));
      render();
    });
    $('#exportOrders', main).addEventListener('click', () => {
      const head = 'Order,Customer,Item,Qty,Total,Stage,Placed,Due,Channel,Assignee,Priority';
      const body = S.orders.all().map((o) =>
        [o.id, o.customer, o.item, o.qty, o.total, S.ORDER_STAGES[o.stage],
         dtf(o.placed), dtf(o.due), o.channel, o.assignee, o.priority].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')
      ).join('\n');
      download('qubators-orders.csv', head + '\n' + body);
    });

    render();
  };

  function wireOrderRows(root) {
    $$('[data-order]', root).forEach((tr) => {
      if (tr.dataset.wired) return;
      tr.dataset.wired = '1';
      tr.addEventListener('click', () => { location.hash = '#/orders/' + tr.dataset.order; });
    });
  }

  /* =======================================================
     ORDER DETAIL
     ======================================================= */
  V.orderDetail = function (main, params) {
    const o = S.orders.byId(params.id);
    if (!o) { location.hash = '#/orders'; return; }
    const isDone = o.stage === 5;
    const late = new Date(o.due) < Date.now() && !isDone;

    const steps = S.ORDER_STAGES.map((label, i) => {
      let cls = '';
      if (i < o.stage) cls = 'done';
      else if (i === o.stage) cls = 'now';
      const when = i <= o.stage ? estimateWhen(o, i) : null;
      return '<div class="tl ' + cls + '"><div class="rail"><span class="dot">' +
        (i < o.stage ? '✓' : i + 1) + '</span></div>' +
        '<div class="body"><h5>' + esc(label) + '</h5>' +
        '<p>' + esc(stageNote(label)) + '</p>' +
        (when ? '<time>' + dts(when) + '</time>' : '<time class="muted">Pending</time>') +
        '</div></div>';
    }).join('');

    main.innerHTML =
      '<div class="page-head"><div class="t">' +
        '<p class="muted" style="margin:0"><a href="#/orders">Orders</a> / ' + esc(o.id) + '</p>' +
        '<h1 style="margin-top:4px">' + esc(o.item) + '</h1>' +
        '<p>' + esc(o.customer) + ' · placed ' + dtf(o.placed) + ' via ' + esc(o.channel) + '</p></div>' +
        '<div class="actions">' +
          '<button class="btn" id="copyLink">' + icon('globe') + 'Copy tracking link</button>' +
          (isDone ? '' : '<button class="btn btn-primary" id="advance">' + icon('chev') + 'Move to ' + esc(S.ORDER_STAGES[o.stage + 1]) + '</button>') +
        '</div></div>' +

      '<div class="grid g-4 mb">' +
        kpiCard('Order value', money(o.total), o.qty + ' × unit') +
        kpiCard('Current stage', S.ORDER_STAGES[o.stage], isDone ? 'Completed' : (late ? 'Overdue' : 'On schedule'), late ? 'pill-danger' : isDone ? 'pill-success' : 'pill-info') +
        kpiCard('Due date', dtf(o.due), until(o.due)) +
        kpiCard('Priority', o.priority === 'normal' ? 'Standard' : (o.priority === 'high' ? 'High' : 'Urgent'), 'assignee: ' + o.assignee) +
      '</div>' +

      '<div class="grid g-21">' +
        '<div class="card"><div class="card-head"><h3>Customer journey</h3>' +
          '<span class="sub">What ' + esc(o.customer.split(' ')[0]) + ' sees when tracking</span></div>' +
          '<div class="card-body"><div class="timeline">' + steps + '</div></div></div>' +

        '<div>' +
          '<div class="card mb"><div class="card-head"><h3>Update stage</h3></div><div class="card-body">' +
            '<label class="field"><span class="lb">Move this order to</span>' +
              select('stage', S.ORDER_STAGES.map((s, i) => ({ v: i, t: s })), 'id="stageSel"') + '</label>' +
            '<label class="field"><span class="lb">Internal note (optional)</span>' +
              textarea('note', '', 2) + '</label>' +
            '<button class="btn btn-primary" id="saveStage" style="width:100%">Save stage</button>' +
          '</div></div>' +

          '<div class="card"><div class="card-head"><h3>Customer</h3></div><div class="card-body">' +
            '<div class="rowlist">' +
              '<div class="r"><div class="b"><b>' + esc(o.customer) + '</b><span>Primary contact</span></div></div>' +
              '<div class="r"><div class="b"><b>' + esc(o.assignee) + '</b><span>Studio owner</span></div></div>' +
              '<div class="r"><div class="b"><b>' + esc(o.channel) + '</b><span>Acquisition channel</span></div></div>' +
            '</div>' +
            '<button class="btn btn-danger mt" id="delOrder" style="width:100%">' + icon('trash') + 'Delete order</button>' +
          '</div></div>' +
        '</div>' +
      '</div>';

    $('#saveStage', main).addEventListener('click', () => {
      const v = Number($('#stageSel', main).value);
      const note = $('textarea[name=note]', main).value.trim();
      S.orders.setStage(o.id, v);
      if (note) S.log('Note on ' + o.id + ': ' + note, 'pen');
      toast('Order ' + o.id + ' → ' + S.ORDER_STAGES[v], 'ok');
      V.orderDetail(main, params);
    });

    const adv = $('#advance', main);
    if (adv) adv.addEventListener('click', () => {
      S.orders.setStage(o.id, o.stage + 1);
      toast('Order ' + o.id + ' → ' + S.ORDER_STAGES[o.stage + 1], 'ok');
      V.orderDetail(main, params);
    });

    $('#copyLink', main).addEventListener('click', () => {
      copy(location.origin + location.pathname + '#/track/' + o.id);
    });

    $('#delOrder', main).addEventListener('click', () => {
      confirm({
        title: 'Delete ' + o.id + '?', message: 'The customer tracking link will stop working immediately.',
        ok: 'Delete order', danger: true,
        onYes() { S.orders.remove(o.id); toast('Order deleted', 'ok'); location.hash = '#/orders'; }
      });
    });
  };

  function kpiCard(label, val, sub, pill) {
    return '<div class="card kpi"><div class="k-lab">' + label + '</div>' +
      '<div class="k-val" style="font-size:20px">' + val + '</div>' +
      '<div class="k-foot">' + (pill ? '<span class="pill ' + pill + '">' + sub + '</span>' : sub) + '</div></div>';
  }

  function stageNote(label) {
    return {
      'Received': 'Order confirmed, payment logged, job queued into the studio.',
      'Designing': 'Concept, layout and mockups in progress. Client previews shared here.',
      'Production': 'Artwork locked and sent to print / fabrication partners.',
      'Quality Check': 'Colour, finish and specification review before dispatch.',
      'Dispatched': 'Packed, invoiced and handed to the courier with tracking.',
      'Delivered': 'Received and signed for. Invoice closed, files archived.'
    }[label] || '';
  }
  function estimateWhen(o, i) {
    if (i === 0) return o.placed;
    const span = (new Date(o.due) - new Date(o.placed)) / (S.ORDER_STAGES.length - 1);
    return new Date(new Date(o.placed).getTime() + span * i);
  }
  V.stageNote = stageNote;

  /* =======================================================
     NEW ORDER (modal from anywhere)
     ======================================================= */
  V.newOrder = function () {
    modal({
      title: 'New order',
      body:
        field('Customer name', input('customer', 'placeholder="e.g. Nusrat Jahan" required')) +
        field('What are they ordering?', input('item', 'placeholder="e.g. Brand Identity — Pharma" required')) +
        '<div class="grid-2">' +
          field('Quantity', input('qty', 'type="number" min="1" value="1"')) +
          field('Total value', input('total', 'type="number" min="0" placeholder="0"')) +
        '</div>' +
        '<div class="grid-2">' +
          field('Due date', input('due', 'type="date"')) +
          field('Priority', select('priority', [{ v: 'normal', t: 'Standard' }, { v: 'high', t: 'High' }, { v: 'urgent', t: 'Urgent' }])) +
        '</div>' +
        '<div class="grid-2">' +
          field('Channel', select('channel', [{ v: 'Website', t: 'Website' }, { v: 'Referral', t: 'Referral' }, { v: 'WhatsApp', t: 'WhatsApp' }, { v: 'Walk-in', t: 'Walk-in' }])) +
          field('Assign to', select('assignee', S.misc.users().map((u) => ({ v: u.name.split(' ')[0], t: u.name })))) +
        '</div>' +
        field('Notes', textarea('notes', 'placeholder="Anything the team should know…"'), 'Only visible inside the studio.'),
      footer: '<button class="btn" data-cancel>Cancel</button><button class="btn btn-primary" data-save>Create order</button>',
      onMount(box, close) {
        $('[data-cancel]', box).addEventListener('click', close);
        $('[data-save]', box).addEventListener('click', () => {
          clearBad(box);
          const d = formData(box);
          if (!d.customer) return setBad(box, 'customer', 'Customer name is required');
          if (!d.item) return setBad(box, 'item', 'Describe the job');
          if (!d.due) return setBad(box, 'due', 'Pick a due date');
          S.orders.add({
            customer: d.customer, item: d.item, qty: Number(d.qty) || 1,
            total: Number(d.total) || 0, due: new Date(d.due).toISOString(),
            priority: d.priority, channel: d.channel, assignee: d.assignee
          });
          close();
          toast('Order created — tracking link ready', 'ok');
          location.hash = '#/orders';
        });
      }
    });
  };

  /* =======================================================
     PUBLIC CUSTOMER TRACKING  (#/track, #/track/:id)
     ======================================================= */
  V.track = function (main, params) {
    const id = (params && params.id) || '';
    const saved = sessionStorage.getItem('qb_track_id') || '';
    const lookup = id || saved;

    main.innerHTML =
      '<div class="track-hero"><div class="inner">' +
        '<div class="flex" style="margin-bottom:20px">' +
          '<div class="brand-mark" style="width:42px;height:42px;font-size:20px">Q</div>' +
          '<div><strong style="font-size:16px">' + esc(S.account.get().studio) + '</strong>' +
          '<div class="hint" style="margin:0">Order tracking portal</div></div>' +
        '</div>' +
        '<h1>Where is my order?</h1>' +
        '<p class="lead">Enter your order number to see exactly where your job sits — design, production, quality check and delivery.</p>' +
        '<form class="track-form" id="trackForm">' +
          '<input class="input mono" name="id" placeholder="QB-1042" value="' + esc(lookup) + '" required>' +
          '<button class="btn btn-primary" type="submit">' + icon('search') + 'Track order</button>' +
        '</form>' +
        '<p class="hint" style="margin-top:12px">Try <button class="chip" id="tryDemo" style="padding:2px 8px">QB-1041</button> with any demo order number.</p>' +
      '</div></div>' +

      '<div style="max-width:880px;margin:0 auto;padding:26px 22px 60px" id="trackResult"></div>';

    $('#tryDemo', main).addEventListener('click', () => { $('#trackForm input', main).value = 'QB-1041'; renderResult('QB-1041', main); });
    $('#trackForm', main).addEventListener('submit', (e) => {
      e.preventDefault();
      renderResult($('#trackForm input', main).value.trim(), main);
    });

    if (lookup) renderResult(lookup, main);
  };

  function renderResult(id, main) {
    const box = $('#trackResult', main);
    const o = S.orders.byId(id);
    if (!o) {
      box.innerHTML = '<div class="card"><div class="empty"><div class="e-ic">' + icon('search') + '</div>' +
        '<h4>We could not find that order</h4>' +
        '<p>Check the number on your confirmation email — it looks like <b>QB-1036</b>. ' +
        'Still stuck? <a href="#/login">Message the studio</a> and we will look it up.</p></div></div>';
      return;
    }
    sessionStorage.setItem('qb_track_id', o.id);
    const pct = Math.round((o.stage / (S.ORDER_STAGES.length - 1)) * 100);
    const steps = S.ORDER_STAGES.map((label, i) => {
      let cls = i < o.stage ? 'done' : i === o.stage ? 'now' : '';
      const when = i <= o.stage ? estimateWhen(o, i) : null;
      return '<div class="tl ' + cls + '"><div class="rail"><span class="dot">' + (i < o.stage ? '✓' : i + 1) + '</span></div>' +
        '<div class="body"><h5>' + esc(label) + '</h5><p>' + esc(stageNote(label)) + '</p>' +
        (when ? '<time>' + dts(when) + '</time>' : '<time class="muted">We will update you here</time>') + '</div></div>';
    }).join('');

    box.innerHTML =
      '<div class="card mb"><div class="card-head">' +
        '<h3>' + esc(o.id) + ' · ' + esc(o.item) + '</h3>' +
        '<div class="right"><span class="pill ' + stageTone(o.stage) + '"><i class="d"></i>' + esc(S.ORDER_STAGES[o.stage]) + '</span></div></div>' +
        '<div class="card-body">' +
          '<div class="between mb"><span class="muted" style="font-size:13px">' + pct + '% complete</span>' +
          '<span class="muted" style="font-size:13px">Expected ' + dtf(o.due) + '</span></div>' +
          journeyBar(o.stage) +
          '<div class="journey-steps mt">' +
            S.ORDER_STAGES.map((label, i) =>
              '<div class="js ' + (i < o.stage ? 'done' : i === o.stage ? 'now' : '') + '">' +
              '<div class="b">' + (i < o.stage ? '✓' : i + 1) + '</div><span>' + esc(label) + '</span></div>').join('') +
          '</div>' +
        '</div></div>' +

      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>Order details</h3></div><div class="card-body">' +
          '<div class="rowlist">' +
            '<div class="r"><div class="b"><b>Placed</b><span>via ' + esc(o.channel) + '</span></div><div class="right">' + dtf(o.placed) + '</div></div>' +
            '<div class="r"><div class="b"><b>Quantity</b><span>units</span></div><div class="right">' + o.qty + '</div></div>' +
            '<div class="r"><div class="b"><b>Total</b><span>incl. taxes</span></div><div class="right">' + money(o.total) + '</div></div>' +
            '<div class="r"><div class="b"><b>Your contact</b><span>studio owner</span></div><div class="right">' + esc(o.assignee) + '</div></div>' +
          '</div>' +
        '</div></div>' +
        '<div class="card"><div class="card-head"><h3>Journey</h3></div><div class="card-body">' +
          '<div class="timeline">' + steps + '</div></div></div>' +
      '</div>' +

      '<div class="card mt"><div class="card-body between" style="flex-wrap:wrap;gap:14px">' +
        '<div><strong>Something not right?</strong>' +
        '<div class="hint">Our studio replies within one working day.</div></div>' +
        '<div class="flex flex-wrap">' +
          '<button class="btn" data-copy>' + icon('globe') + 'Copy this link</button>' +
          '<a class="btn btn-primary" href="mailto:' + esc(S.account.get().email) + '?subject=' + encodeURIComponent('Order ' + o.id) + '">' + icon('mail') + 'Contact studio</a>' +
        '</div>' +
      '</div></div>';

    $('[data-copy]', box).addEventListener('click', () => copy(location.href));
  }

  /* =======================================================
     CUSTOMER PREVIEW  (#/customers)
     ======================================================= */
  V.customers = function (main) {
    const orders = S.orders.all();
    const rows = orders.map((o) => ({
      name: o.customer, orders: 1, value: o.total, last: o.placed,
      stage: o.stage, id: o.id
    })).sort((a, b) => new Date(b.last) - new Date(a.last));

    main.innerHTML =
      '<div class="page-head"><div class="t"><h1>Customers</h1>' +
        '<p>Everyone who has ordered from the studio.</p></div>' +
        '<div class="actions"><button class="btn" id="csv">' + icon('download') + 'Export</button></div></div>' +

      '<div class="grid g-4 mb">' +
        '<div class="card kpi"><div class="k-lab">Total customers</div><div class="k-val">' + rows.length + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">Lifetime value</div><div class="k-val">' + money(rows.reduce((s, r) => s + r.value, 0)) + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">Average order</div><div class="k-val">' + money(Math.round(rows.reduce((s, r) => s + r.value, 0) / (rows.length || 1))) + '</div></div>' +
        '<div class="card kpi"><div class="k-lab">In progress</div><div class="k-val">' + rows.filter((r) => r.stage < 5).length + '</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h3>Customer list</h3></div>' +
        '<div style="overflow-x:auto"><table class="table"><thead><tr>' +
          '<th>Customer</th><th>Orders</th><th>Lifetime value</th><th>Last order</th><th>Status</th></tr></thead>' +
        '<tbody>' + rows.map((r) =>
          '<tr data-order="' + esc(r.id) + '"><td><b>' + esc(r.name) + '</b><div class="muted mono" style="font-size:11.5px">' + esc(r.id) + '</div></td>' +
          '<td>' + r.orders + '</td><td class="mono">' + money(r.value) + '</td>' +
          '<td class="muted nowrap">' + dtf(r.last) + '</td>' +
          '<td><span class="pill ' + stageTone(r.stage) + '"><i class="d"></i>' + esc(S.ORDER_STAGES[r.stage]) + '</span></td></tr>').join('') +
        '</tbody></table></div></div>';

    wireOrderRows(main);
    $('#csv', main).addEventListener('click', () => {
      download('qubators-customers.csv',
        'Customer,Lifetime value,Last order,Status\n' +
        rows.map((r) => [r.name, r.value, dtf(r.last), S.ORDER_STAGES[r.stage]].map((v) => '"' + v + '"').join(',')).join('\n'));
    });
  };
})();
