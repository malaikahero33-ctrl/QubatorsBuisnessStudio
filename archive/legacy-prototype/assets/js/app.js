/* =========================================================
   Qubators Business Studio — app shell + router
   ========================================================= */
(function () {
  const { icon, esc, $, $$, toast } = QB.ui;
  const S = QB.store;

  const app = $('#app');
  const THEME_KEY = 'qb_theme';
  let shellBuilt = false;

  /* ---------- routes ---------- */
  const ROUTES = [
    { re: /^\/login$/,        view: 'login',         bare: true },
    { re: /^\/track$/,        view: 'track',         bare: true },
    { re: /^\/track\/([\w-]+)$/, view: 'track',      bare: true, params: ['id'] },
    { re: /^\/dashboard$/,    view: 'dashboard' },
    { re: /^\/orders$/,       view: 'orders' },
    { re: /^\/orders\/([\w-]+)$/, view: 'orderDetail', params: ['id'] },
    { re: /^\/customers$/,    view: 'customers' },
    { re: /^\/designs$/,      view: 'designs' },
    { re: /^\/designs\/new$/, view: 'designs' },
    { re: /^\/designs\/([\w-]+)$/, view: 'designEditor', params: ['id'] },
    { re: /^\/consultations$/, view: 'consultations' },
    { re: /^\/account$/,      view: 'account' }
  ];

  const NAV = [
    { group: 'Studio' },
    { href: '#/dashboard',     ic: 'grid',   label: 'Dashboard' },
    { href: '#/orders',        ic: 'cart',   label: 'Orders',     count: () => S.misc.stats().active },
    { href: '#/customers',     ic: 'user',   label: 'Customers' },
    { group: 'Work' },
    { href: '#/designs',       ic: 'pen',    label: 'Designs',    count: () => S.designs.all().length },
    { href: '#/consultations', ic: 'cal',    label: 'Consultations', count: () => S.consults.upcoming().length },
    { group: 'Customer journey' },
    { href: '#/track',         ic: 'truck',  label: 'Track order' },
    { group: 'Account' },
    { href: '#/account',       ic: 'shield', label: 'Business account' }
  ];

  /* ---------- theme ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    const b = $('#themeBtn');
    if (b) b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  }
  function currentTheme() {
    let t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /* ---------- shell ---------- */
  function buildShell() {
    const u = S.account.get();
    const st = S.misc.stats();

    const navHtml = NAV.map((n) => {
      if (n.group) return '<div class="nav-label">' + n.group + '</div>';
      return '<a href="' + n.href + '" data-href="' + n.href + '">' + icon(n.ic) +
        '<span>' + n.label + '</span>' +
        (n.count ? '<span class="count">' + n.count() + '</span>' : '') + '</a>';
    }).join('');

    app.className = '';
    app.innerHTML =
      '<div class="shell">' +
        '<aside class="sidebar" id="side">' +
          '<div class="brand"><span class="brand-mark">Q</span>' +
            '<div class="brand-text"><strong>' + esc(u.studio) + '</strong><span>' + esc(u.plan) + '</span></div></div>' +
          '<nav class="nav">' + navHtml + '</nav>' +
          '<div class="sidebar-foot"><div class="studio-plan">' +
            '<strong>' + st.active + ' active jobs</strong>' +
            '<div class="meter"><i style="width:' + Math.min(100, st.active * 12) + '%"></i></div>' +
            '<div style="margin-top:8px">Need a hand? <a href="#/consultations" style="color:#a99cff">Book a slot</a></div>' +
          '</div></div>' +
        '</aside>' +

        '<div class="body">' +
          '<header class="topbar">' +
            '<button class="icon-btn hide-desktop" id="menuBtn" aria-label="Menu">' + icon('grid') + '</button>' +
            '<div class="crumb">Qubators <span>/</span> <b id="crumbNow">Dashboard</b></div>' +
            '<div class="search">' + icon('search') +
              '<input id="globalSearch" placeholder="Search orders, customers…"></div>' +
            '<button class="icon-btn" id="themeBtn" aria-label="Toggle theme"></button>' +
            '<button class="icon-btn" id="bellBtn" aria-label="Notifications" style="position:relative">' + icon('bell') +
              (st.pending ? '<i style="position:absolute;top:7px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--danger)"></i>' : '') + '</button>' +
            '<div class="user-chip" id="userChip">' +
              (u.avatar ? '<img class="avatar" src="' + u.avatar + '" alt="">' : '<span class="avatar">' + QB.ui.initials(u.name) + '</span>') +
              '<span class="who"><b>' + esc(u.name) + '</b><span>' + esc(u.role) + '</span></span>' +
              icon('chev') +
            '</div>' +
          '</header>' +
          '<main class="main" id="main"></main>' +
        '</div>' +
      '</div>';

    applyTheme(currentTheme());
    $('#themeBtn').addEventListener('click', () =>
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

    $('#menuBtn').addEventListener('click', () => {
      const s = $('#side');
      s.classList.add('open');
      const scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.addEventListener('click', () => { s.classList.remove('open'); scrim.remove(); });
      document.body.appendChild(scrim);
    });

    $('#bellBtn').addEventListener('click', (e) => { e.stopPropagation(); openNotifications(e.currentTarget); });
    $('#userChip').addEventListener('click', (e) => { e.stopPropagation(); openUserMenu(e.currentTarget); });
    document.addEventListener('click', closePopovers);

    $('#globalSearch').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const term = e.target.value.trim();
      if (!term) return;
      location.hash = '#/orders';
      setTimeout(() => { const q = $('#q'); if (q) { q.value = term; q.dispatchEvent(new Event('input')); } }, 80);
    });
  }

  /* ---------- popovers ---------- */
  function closePopovers() { $$('.menu').forEach((m) => m.remove()); }

  function popover(anchor, html) {
    closePopovers();
    const m = document.createElement('div');
    m.className = 'menu';
    m.innerHTML = html;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = (r.bottom + 8) + 'px';
    m.style.left = Math.max(10, Math.min(r.right - m.offsetWidth, window.innerWidth - m.offsetWidth - 10)) + 'px';
    m.addEventListener('click', (e) => e.stopPropagation());
    return m;
  }

  function openUserMenu(anchor) {
    const u = S.account.get();
    const m = popover(anchor,
      '<div class="hd">' + esc(u.email) + '</div>' +
      '<button data-go="#/account">' + icon('user') + 'Business account</button>' +
      '<button data-go="#/designs">' + icon('palette') + 'Design studio</button>' +
      '<button data-track>' + icon('truck') + 'Customer tracking page</button>' +
      '<hr><button data-logout>' + icon('logout') + 'Sign out</button>');

    m.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      const tr = e.target.closest('[data-track]');
      const lo = e.target.closest('[data-logout]');
      if (go) { location.hash = go.dataset.go; closePopovers(); }
      if (tr) { location.hash = '#/track'; closePopovers(); }
      if (lo) { S.auth.logout(); toast('Signed out', 'ok'); location.hash = '#/login'; }
    });
  }

  function openNotifications(anchor) {
    const items = S.misc.activity().slice(0, 6);
    const m = popover(anchor,
      '<div class="hd">Notifications</div>' +
      items.map((a) => '<button data-go="#/orders">' + icon(a.icon) +
        '<span style="text-align:left"><span style="display:block">' + esc(a.text) + '</span>' +
        '<span class="hint">' + QB.ui.ago(a.when) + '</span></span></button>').join('') +
      '<hr><button data-go="#/dashboard">' + icon('grid') + 'See everything</button>');
    m.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { location.hash = go.dataset.go; closePopovers(); }
    });
  }

  /* ---------- router ---------- */
  function currentPath() {
    const h = location.hash.replace(/^#/, '');
    return h || '/dashboard';
  }

  function setActiveNav(path) {
    $$('#side .nav a').forEach((a) => {
      const base = a.dataset.href;
      if (!base) return;
      const on = base === '#/orders' ? /^\/orders/.test(path)
        : base === '#/designs' ? /^\/designs/.test(path)
        : path === base.replace('#', '');
      a.classList.toggle('active', !!on);
    });
  }

  function render() {
    const path = currentPath();
    const match = ROUTES.map((r) => ({ r, m: r.re.exec(path) })).find((x) => x.m);
    const route = match ? match.r : { view: 'dashboard' };
    const params = {};
    (route.params || []).forEach((p, i) => { params[p] = match.m[i + 1]; });

    // Guard: everything except public pages needs a session
    if (!route.bare && !S.auth.session()) {
      location.replace('#/login');
      return;
    }
    if (route.view === 'login' && S.auth.session()) {
      location.replace('#/dashboard');
      return;
    }

    // A bare page (login / customer tracking) has no shell, so the shell must be
    // rebuilt whenever we cross between the two kinds of page — a lingering
    // #main element from a bare page must not be mistaken for a built shell.
    if (route.bare) {
      app.className = '';
      const main = document.createElement('div');
      main.id = 'main';
      app.innerHTML = '';
      app.appendChild(main);
      shellBuilt = false;
    } else if (!shellBuilt) {
      buildShell();
      shellBuilt = true;
    }

    const main = $('#main');
    QB.ui.closeModal();
    if (route.view === 'designEditor' || route.view === 'orderDetail' || route.view === 'track') {
      window.scrollTo({ top: 0 });
    }
    main.scrollTop = 0;

    const fn = QB.views[route.view];
    if (!fn) { main.innerHTML = '<div class="empty"><h4>Page not found</h4><p>Try the dashboard.</p></div>'; return; }
    fn(main, params);

    if (!route.bare) {
      setActiveNav(path);
      const names = {
        dashboard: 'Dashboard', orders: 'Orders', orderDetail: 'Order detail',
        customers: 'Customers', designs: 'Designs', designEditor: 'Design editor',
        consultations: 'Consultations', account: 'Business account'
      };
      const c = $('#crumbNow');
      if (c) c.textContent = names[route.view] || 'Dashboard';
      document.title = (names[route.view] ? names[route.view] + ' · ' : '') + 'Qubators Business Studio';
    } else {
      document.title = (route.view === 'login' ? 'Sign in · ' : 'Track your order · ') + 'Qubators Business Studio';
    }
  }

  /* ---------- global actions ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    const to = b.dataset.nav;
    if (to === 'new-order') { QB.views.newOrder(); return; }
    location.hash = '#/' + to;
  });

  // Re-render the current view when data changes in another tab
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', (e) => { if (e.key === 'qb_studio_data_v1') location.reload(); });

  /* ---------- boot ---------- */
  applyTheme(currentTheme());
  if (!location.hash) location.hash = S.auth.session() ? '#/dashboard' : '#/login';
  render();
  app.classList.add('ready');
})();
