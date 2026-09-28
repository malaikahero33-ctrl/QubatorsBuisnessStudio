/* =========================================================
   Qubators Business Studio — data layer
   A tiny local-first store. Swap QB.store for a real API
   when you connect a backend.
   ========================================================= */
window.QB = window.QB || {};

QB.store = (function () {
  const KEY = 'qb_studio_data_v1';
  const SESSION_KEY = 'qb_studio_session_v1';

  const ORDER_STAGES = ['Received', 'Designing', 'Production', 'Quality Check', 'Dispatched', 'Delivered'];

  /* ---- seed -------------------------------------------------- */
  function seed() {
    const now = Date.now();
    const iso = (days) => new Date(now - days * 864e5).toISOString();
    const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);

    return {
      user: {
        name: 'Amina Rahman',
        email: 'owner@qubators.studio',
        studio: 'Qubators Business Studio',
        plan: 'Studio Pro',
        role: 'Founder & Creative Director',
        location: 'Dhaka, Bangladesh',
        bio: 'We design brands that sell. Packaging, print, signage and digital — all under one roof.',
        brandColor: '#6d4aff',
        avatar: null,
        phone: '+880 1700 000 000',
        timezone: 'GMT+6 Dhaka',
        joined: iso(410),
        lastPasswordChange: iso(38),
        twoFA: false,
        notif: { order: true, consult: true, digest: false }
      },
      orders: [
        { id: 'QB-1042', customer: 'Nusrat Jahan', item: 'Brand Identity — Pharma', qty: 1, total: 145000, stage: 5, placed: iso(11), due: iso(-3), channel: 'Website', assignee: 'Rifat', priority: 'high' },
        { id: 'QB-1041', customer: 'Tarek Ahmed', item: 'Packaging Box — Beverage', qty: 5000, total: 268000, stage: 3, placed: iso(6), due: iso(6), channel: 'Referral', assignee: 'Sadia', priority: 'normal' },
        { id: 'QB-1040', customer: 'Bluewave Ltd.', item: 'Trade Show Backdrop', qty: 2, total: 96000, stage: 4, placed: iso(14), due: iso(1), channel: 'Website', assignee: 'Rifat', priority: 'normal' },
        { id: 'QB-1039', customer: 'Ayesha Siddika', item: 'Wedding Invitation Suite', qty: 350, total: 74500, stage: 2, placed: iso(3), due: iso(4), channel: 'WhatsApp', assignee: 'Sadia', priority: 'normal' },
        { id: 'QB-1038', customer: 'Orbit Fintech', item: 'Pitch Deck + Brand Book', qty: 1, total: 189000, stage: 1, placed: iso(2), due: iso(9), channel: 'Referral', assignee: 'Rifat', priority: 'urgent' },
        { id: 'QB-1037', customer: 'Rahim Store', item: 'Shop Signage — Acrylic', qty: 1, total: 42000, stage: 5, placed: iso(22), due: iso(-9), channel: 'Walk-in', assignee: 'Sadia', priority: 'normal' },
        { id: 'QB-1036', customer: 'Mehedi Hasan', item: 'Menu Booklet (A5)', qty: 120, total: 33000, stage: 0, placed: iso(0), due: iso(8), channel: 'Website', assignee: 'Rifat', priority: 'normal' }
      ],
      designs: [
        { id: 'DS-201', name: 'Aurora Coffee — Rebrand', client: 'Aurora Coffee', type: 'Brand Identity', status: 'In review', updated: iso(1), notes: 'Two routes presented. Client leaning route B.', thumb: 'linear-gradient(135deg,#6d4aff,#22d3ee)' },
        { id: 'DS-200', name: 'Helix Pharma — Packaging', client: 'Helix Pharma', type: 'Packaging', status: 'Approved', updated: iso(4), thumb: 'linear-gradient(135deg,#10b981,#3b82f6)' },
        { id: 'DS-199', name: 'Nimbus App — UI Kit', client: 'Nimbus Labs', type: 'Digital Product', status: 'Drafting', updated: iso(0), thumb: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
        { id: 'DS-198', name: 'Vertex Fitness — Campaign', client: 'Vertex', type: 'Campaign', status: 'Approved', updated: iso(9), thumb: 'linear-gradient(135deg,#ef4444,#6d4aff)' },
        { id: 'DS-197', name: 'Bengal Spice — Label Set', client: 'Bengal Spice', type: 'Packaging', status: 'Delivered', updated: iso(16), thumb: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
        { id: 'DS-196', name: 'Solace Interiors — Lookbook', client: 'Solace', type: 'Print', status: 'Delivered', updated: iso(25), thumb: 'linear-gradient(135deg,#8b5cf6,#ec4899)' }
      ],
      consults: [
        { id: 'CT-31', client: 'Orbit Fintech', topic: 'Brand positioning', when: new Date(now + 2 * 864e5).setHours(11, 0), duration: 45, mode: 'Video', status: 'Confirmed', advisor: 'Amina' },
        { id: 'CT-30', client: 'Bluewave Ltd.', topic: 'Print vs digital budget', when: new Date(now - 3 * 864e5).setHours(15, 30), duration: 30, mode: 'Studio', status: 'Completed', advisor: 'Rifat' },
        { id: 'CT-29', client: 'Nusrat Jahan', topic: 'Pharma compliance review', when: new Date(now - 9 * 864e5).setHours(10, 0), duration: 60, mode: 'Video', status: 'Completed', advisor: 'Amina' },
        { id: 'CT-32', client: 'Walk-in', topic: 'Discovery call', when: new Date(now + 5 * 864e5).setHours(17, 0), duration: 30, mode: 'Studio', status: 'Pending', advisor: 'Sadia' }
      ],
      activity: [
        { id: uid('ac'), text: 'Order QB-1036 received from mehedi@example.com', when: new Date(now - 4e5).toISOString(), icon: 'cart' },
        { id: uid('ac'), text: 'Sadia moved QB-1041 to Production', when: new Date(now - 9e5).toISOString(), icon: 'refresh' },
        { id: uid('ac'), text: 'Consultation CT-32 booked for tomorrow 5:00 PM', when: new Date(now - 2.6e6).toISOString(), icon: 'cal' },
        { id: uid('ac'), text: 'Aurora Coffee approved concept notes', when: new Date(now - 6.4e6).toISOString(), icon: 'check' },
        { id: uid('ac'), text: 'You joined the studio', when: iso(410), icon: 'spark' }
      ],
      users: [
        { id: uid('u'), name: 'Rifat Islam', role: 'Art Director', email: 'rifat@qubators.studio', status: 'Active' },
        { id: uid('u'), name: 'Sadia Karim', role: 'Production Lead', email: 'sadia@qubators.studio', status: 'Active' },
        { id: uid('u'), name: 'Tanvir Hasan', role: 'Account Manager', email: 'tanvir@qubators.studio', status: 'Away' }
      ]
    };
  }

  /* ---- persistence ------------------------------------------- */
  let state = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted — fall through */ }
    const s = seed();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {
        console.warn('Could not persist studio data', e);
      }
    }, 150);
  }

  /* ---- helpers ----------------------------------------------- */
  const nextId = (prefix, list) => {
    const max = list.reduce((m, item) => {
      const n = parseInt(String(item.id).split('-')[1], 10);
      return isNaN(n) ? m : Math.max(m, n);
    }, 1000);
    return prefix + '-' + (max + 1);
  };

  function log(text, icon) {
    state.activity.unshift({ id: 'ac-' + Date.now(), text, when: new Date().toISOString(), icon: icon || 'spark' });
    state.activity = state.activity.slice(0, 40);
    save();
  }

  /* ---- orders ----------------------------------------------- */
  const orders = {
    all: () => state.orders.slice().sort((a, b) => new Date(b.placed) - new Date(a.placed)),
    byId: (id) => state.orders.find((o) => o.id.toUpperCase() === String(id).toUpperCase()),
    add(data) {
      const o = Object.assign({
        id: nextId('QB', state.orders), stage: 0, placed: new Date().toISOString(),
        channel: 'Website', assignee: 'Amina', priority: 'normal', qty: 1
      }, data);
      state.orders.unshift(o);
      log('New order ' + o.id + ' — ' + o.customer, 'cart');
      save();
      return o;
    },
    setStage(id, stage) {
      const o = orders.byId(id);
      if (!o) return null;
      const from = ORDER_STAGES[o.stage];
      o.stage = Math.max(0, Math.min(ORDER_STAGES.length - 1, Number(stage)));
      log('Order ' + o.id + ': ' + from + ' → ' + ORDER_STAGES[o.stage], 'refresh');
      save();
      return o;
    },
    remove(id) {
      state.orders = state.orders.filter((o) => o.id !== id);
      log('Order ' + id + ' deleted', 'refresh');
      save();
    }
  };

  /* ---- designs ---------------------------------------------- */
  const designs = {
    all: () => state.designs.slice().sort((a, b) => new Date(b.updated) - new Date(a.updated)),
    byId: (id) => state.designs.find((d) => d.id === id),
    add(data) {
      const d = Object.assign({ id: nextId('DS', state.designs), updated: new Date().toISOString(), status: 'Drafting' }, data);
      state.designs.unshift(d);
      save();
      return d;
    },
    update(id, patch) {
      const d = designs.byId(id);
      if (!d) return null;
      Object.assign(d, patch, { updated: new Date().toISOString() });
      save();
      return d;
    },
    remove(id) {
      state.designs = state.designs.filter((d) => d.id !== id);
      save();
    }
  };

  /* ---- consultations ----------------------------------------- */
  const consults = {
    all: () => state.consults.slice().sort((a, b) => a.when - b.when),
    upcoming: () => consults.all().filter((c) => c.when >= Date.now() && c.status !== 'Completed'),
    past: () => consults.all().filter((c) => c.when < Date.now() || c.status === 'Completed'),
    add(data) {
      const c = Object.assign({
        id: nextId('CT', state.consults), when: Date.now() + 864e5,
        duration: 30, mode: 'Video', status: 'Pending', advisor: 'Amina'
      }, data);
      state.consults.push(c);
      log('Consultation ' + c.id + ' booked — ' + c.topic, 'cal');
      save();
      return c;
    },
    setStatus(id, status) {
      const c = state.consults.find((x) => x.id === id);
      if (!c) return null;
      c.status = status;
      log('Consultation ' + id + ' marked ' + status.toLowerCase(), 'cal');
      save();
      return c;
    },
    remove(id) {
      state.consults = state.consults.filter((c) => c.id !== id);
      save();
    }
  };

  /* ---- account ---------------------------------------------- */
  const account = {
    get: () => state.user,
    update(patch) { Object.assign(state.user, patch); save(); return state.user; },
    password(next) { state.user.lastPasswordChange = new Date().toISOString(); state.user.hash = next; save(); }
  };

  /* ---- auth (demo only) ------------------------------------- */
  const auth = {
    login(email, password) {
      const ok = email && password && password.length >= 4;
      if (!ok) return { ok: false, error: 'Enter your studio email and password (min 4 characters).' };
      const s = { email, at: Date.now() };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
      return { ok: true, user: { email, name: state.user.name } };
    },
    logout() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} },
    session() {
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
    }
  };

  /* ---- misc ------------------------------------------------- */
  const misc = {
    users: () => state.users,
    activity: () => state.activity,
    stats() {
      const os = state.orders;
      const active = os.filter((o) => o.stage < 5).length;
      const revenue = os.filter((o) => o.stage === 5).reduce((s, o) => s + o.total, 0);
      const pipeline = os.filter((o) => o.stage < 5).reduce((s, o) => s + o.total, 0);
      const avg = active ? Math.round(os.filter((o) => o.stage < 5).reduce((s, o) => s + o.total, 0) / active) : 0;
      return {
        active, revenue, pipeline, avg,
        designs: state.designs.length,
        pending: os.filter((o) => o.priority === 'urgent' || o.priority === 'high').length,
        consults: consults.upcoming().length,
        delivered: os.filter((o) => o.stage === 5).length
      };
    },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }
  };

  return { ORDER_STAGES, orders, designs, consults, account, auth, misc, save, log, state, seed };
})();
