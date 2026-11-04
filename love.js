// 💘 الحب — نسبة التوافق بين شخصين (عشوائية تتغيّر، مو رقم ثابت محسوب)
//
//   الهدف: ما فيه «نسبة محفوظة» لأحد. كل ما سألت → رقم جديد عشوائي،
//   إلا لو فعّلت خيار «نفس النسبة طول اليوم» أو أضفت زوجاً بالاستثناءات.
//
//   الإعدادات في love.cfg.json عبر store — وتُدار من صفحة «الحب 💘» باللوحة.
//   يعرض: get, set, reset, percent, roll, DEF, MAX_FIXED
const store = require('./store');

const FILE = 'love.cfg.json';
const DEF = {
    enabled: true,      // الأمر شغال
    random: true,       // عشوائي كل مرة (لو طفّيته = الحساب القديم من الآيديات)
    min: 0,             // أدنى نسبة
    max: 100,           // أعلى نسبة
    daily: false,       // نفس النسبة طول اليوم (تتغيّر كل يوم)
    everyone: true,     // كل الأعضاء يقدرون يستخدمونه
    fixed: []           // أزواج بنسبة ثابتة (اختياري — افتراضياً فاضي = ما أحد مميّز)
};
const MAX_FIXED = 50;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const idOk = (s) => /^\d{5,25}$/.test(String(s || ''));

function get() {
    const c = store.read(FILE, null);
    if (!c || typeof c !== 'object') return { ...DEF, fixed: [] };
    const min = clamp(c.min === undefined ? DEF.min : c.min, 0, 100);
    const max = clamp(c.max === undefined ? DEF.max : c.max, 0, 100);
    return {
        enabled: c.enabled !== false,
        random: c.random !== false,
        min: Math.min(min, max),
        max: Math.max(min, max),
        daily: !!c.daily,
        everyone: c.everyone !== false,
        fixed: (Array.isArray(c.fixed) ? c.fixed : [])
            .filter(o => o && idOk(o.a) && idOk(o.b))
            .map(o => ({ a: String(o.a), b: String(o.b), pct: clamp(o.pct, 0, 100) }))
            .slice(0, MAX_FIXED)
    };
}

function set(p) {
    const cur = get();
    const min = clamp(p && p.min !== undefined ? p.min : cur.min, 0, 100);
    const max = clamp(p && p.max !== undefined ? p.max : cur.max, 0, 100);
    if (min > max) throw new Error('أدنى نسبة أكبر من أعلى نسبة');
    const fixed = (p && Array.isArray(p.fixed) ? p.fixed : cur.fixed)
        .filter(o => o && idOk(o.a) && idOk(o.b))
        .map(o => ({ a: String(o.a), b: String(o.b), pct: clamp(o.pct, 0, 100) }))
        .slice(0, MAX_FIXED);
    const cfg = {
        enabled: p && p.enabled !== undefined ? !!p.enabled : cur.enabled,
        random: p && p.random !== undefined ? !!p.random : cur.random,
        min, max,
        daily: p && p.daily !== undefined ? !!p.daily : cur.daily,
        everyone: p && p.everyone !== undefined ? !!p.everyone : cur.everyone,
        fixed,
        at: Date.now()
    };
    store.write(FILE, cfg);
    return cfg;
}

function reset() { store.write(FILE, { ...DEF, fixed: [], at: Date.now() }); return get(); }

// عشوائي حقيقي داخل المدى
function rand(min, max) {
    const lo = Math.min(min, max), hi = Math.max(min, max);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// «نفس النسبة طول اليوم»: ثابتة للحظتها بس تتغيّر كل يوم (مو محفوظة أبد)
function daySeed(a, b, min, max) {
    const p = [String(a), String(b)].sort().join(':');
    const d = new Date();
    const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + ':' + p;
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    const span = max - min + 1;
    return min + (Math.abs(h) % span);
}

// نسبة الحب: زوج بالاستثناءات → ثابت · وإلا عشوائي (أو حساب الآيديات لو random مطفي)
function percent(a, b) {
    const cfg = get();
    const x = String(a), y = String(b);
    const p = [x, y].sort();
    const hit = cfg.fixed.find(o => (o.a === p[0] && o.b === p[1]) || (o.a === p[1] && o.b === p[0]));
    if (hit) return { percent: hit.pct, fixed: true, why: 'fixed' };
    if (cfg.daily) return { percent: daySeed(x, y, cfg.min, cfg.max), fixed: false, why: 'daily' };
    if (cfg.random) return { percent: rand(cfg.min, cfg.max), fixed: false, why: 'random' };
    // الحساب القديم (ثابت من الآيديات) — لو طفّى العشوائي
    try { return { percent: Number((BigInt(x) + BigInt(y)) % 101n), fixed: false, why: 'ids' }; }
    catch { return { percent: 50, fixed: false, why: 'ids' }; }
}

const roll = () => percent('111111111111111111', '222222222222222222');

module.exports = { get, set, reset, percent, roll, rand, DEF, MAX_FIXED, FILE };
