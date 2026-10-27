// 🔐 صلاحية الأوامر — «من يقدر يستخدم أي أمر»
// ====================================================================
// لكل سيرفر خريطة: { "اسم الأمر": { mode, ids: [], roles: [] } }
//
// الأوضاع:
//   all    = الكل يقدر (الافتراضي)
//   royal  = الإدارة والملكيين بس (+ الأسماء المحددة ids)
//   custom = الملكي + الأسماء المحددة (ids) + الرتب المحددة (roles)
//   off    = مقفول للكل — ما عدا ارثر/إيدا (عشان ما يقفلون على نفسهم)
//
// التخزين: cmdaccess.json عبر store (محلي + نسخة MongoDB)
// ملاحظة مهمة: هذا **يقيد** فقط — ما يعطي أحد صلاحية أكبر من صلاحيته الأصلية.
// ====================================================================
const store = require('./store');

const FILE = 'cmdaccess.json';
const MODES = ['all', 'royal', 'custom', 'off'];
const MODE_LABEL = {
    all: 'الكل 🌐',
    royal: 'الإدارة والملكي 👑',
    custom: 'مخصص 🎯',
    off: 'مقفول 🔒'
};
const MAX_IDS = 60;

// ⚙️ افتراضيات أوامر معينة (لو ما عدّلها من اللوحة)
const DEF = {
    // 💘 أمر الحب: الإدارة والملكي + الأسماء المحددة (إيفا ملكية بالسر أصلاً)
    'حب': { mode: 'royal', ids: [], roles: [] }
};

const isId = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : '');
const idsOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,\s]+/))
    .map(isId).filter(Boolean).slice(0, MAX_IDS);

function all() {
    const a = store.read(FILE, {});
    if (!a || typeof a !== 'object' || Array.isArray(a)) return {};
    return a;
}

function normEntry(e) {
    e = (e && typeof e === 'object') ? e : {};
    return {
        mode: MODES.indexOf(e.mode) >= 0 ? e.mode : 'all',
        ids: idsOf(e.ids),
        roles: idsOf(e.roles)
    };
}

// خريطة سيرفر (نسخة جديدة كل مرة عشان ما نعدل الكاش)
function get(gid) {
    const g = all()[isId(gid)] || {};
    const out = {};
    for (const k of Object.keys(g)) out[k] = normEntry(g[k]);
    return out;
}

// الوضع الفعلي لأمر (المحفوظ لو موجود، وإلا الافتراضي، وإلا all)
function entry(gid, name) {
    const g = get(gid);
    if (g[name]) return g[name];
    return DEF[name] ? normEntry(DEF[name]) : { mode: 'all', ids: [], roles: [] };
}

// حفظ أمر واحد
function setOne(gid, name, cfg) {
    const id = isId(gid);
    if (!id) throw new Error('آيدي السيرفر غير صالح');
    const n = String(name || '').trim().slice(0, 40);
    if (!n) throw new Error('اسم الأمر مطلوب');
    const a = all();
    const g = (a[id] && typeof a[id] === 'object') ? a[id] : {};
    g[n] = normEntry(cfg);
    if (g[n].mode === 'all' && !g[n].ids.length && !g[n].roles.length) delete g[n];
    a[id] = g;
    store.write(FILE, a);
    return g[n] || { mode: 'all', ids: [], roles: [] };
}

// حفظ دفعة أوامر بنفس الوضع (مثال: كل الأوامر → الإدارة فقط)
function setMany(gid, names, mode, ids, roles) {
    const list = (Array.isArray(names) ? names : []).filter(Boolean);
    for (const n of list) setOne(gid, n, { mode, ids, roles });
    return list.length;
}

// تصفير سيرفر كامل (يرجع للأوضاع الافتراضية)
function reset(gid) {
    const id = isId(gid);
    const a = all();
    delete a[id];
    store.write(FILE, a);
    return true;
}

// هل السيرفر فيه أي تقييد محفوظ؟
function count(gid) {
    return Object.keys(get(gid)).length;
}

// ===== الفحص الفعلي =====
// ctx = { userId, member, tier, extraIds }
// يرجع { ok:true } أو { ok:false, mode, text }
function check(gid, name, ctx) {
    const c = ctx || {};
    const cfg = entry(gid, name);
    if (cfg.mode === 'all') return { ok: true, mode: 'all' };

    const tier = c.tier || 'peasant';
    const top = tier === 'arthur' || tier === 'ida';
    const royal = top || tier === 'royal';
    const uid = isId(c.userId);
    const extra = (c.extraIds || []).map(isId).filter(Boolean);

    // 👑 ارثر/إيدا ما ينقفل عليهم أي أمر أبداً
    if (top) return { ok: true, mode: cfg.mode };
    // الأسماء المسموحة من .env (زي LOVE_ALLOW_IDS) تشتغل مع أي وضع غير «مقفول»
    if (cfg.mode !== 'off' && uid && extra.indexOf(uid) >= 0) return { ok: true, mode: cfg.mode };

    if (cfg.mode === 'royal') {
        if (royal || (uid && cfg.ids.indexOf(uid) >= 0)) return { ok: true, mode: cfg.mode };
        return { ok: false, mode: cfg.mode, text: `🔒 أمر **/${name}** خاص بالإدارة والملكيين فقط.` };
    }

    if (cfg.mode === 'custom') {
        if (royal) return { ok: true, mode: cfg.mode };
        if (uid && cfg.ids.indexOf(uid) >= 0) return { ok: true, mode: cfg.mode };
        const has = c.member && c.member.roles && c.member.roles.cache;
        if (has && cfg.roles.some(r => c.member.roles.cache.has(r))) return { ok: true, mode: cfg.mode };
        return { ok: false, mode: cfg.mode, text: `🔒 أمر **/${name}** مو مسموح لك — مخصص لأشخاص/رتب محددة.` };
    }

    // off
    return { ok: false, mode: 'off', text: `🔒 أمر **/${name}** مقفول حالياً.` };
}

module.exports = {
    FILE, MODES, MODE_LABEL, DEF, MAX_IDS,
    all, get, entry, setOne, setMany, reset, count, check, normEntry, idsOf
};
