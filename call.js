// 👋 اسم النداء — البوت ما يرد إلا لما تناديه بالاسم اللي تحدده من اللوحة
//
//   الافتراضي «عبد» (نفس سلوك البوت القديم حرفياً).
//   لو غيّرته لـ«ايدا» → يرد على «يا ايدا …» وما يرد على «يا عبد».
//
//   الإعدادات في call.cfg.json عبر store — وتُدار من صفحة «النداء 👋» باللوحة.
//   يعرض: get, set, reset, name, names, has, strip, phrase, DEF, MAX
const store = require('./store');

const FILE = 'call.cfg.json';
const DEF = { name: 'عبد', aliases: [], bare: true };
const MAX = 24;

// تنقية الاسم: حروف عربية/لاتينية وأرقام بس + توحيد الهمزات (أإآ→ا · ة→ه · ى→ي)
const clean = (s) => norm(String(s || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX));

// تطبيع عربي (نفس منطق الأوامر): تشكيل/تطويل + أإآ→ا + ة→ه + ى→ي
const norm = (t) => String(t || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function get() {
    const c = store.read(FILE, null);
    const env = clean(process.env.CALL_NAME || '');
    if (!c || typeof c !== 'object') return { name: env || DEF.name, aliases: [], bare: true };
    return {
        name: clean(c.name) || env || DEF.name,
        aliases: (Array.isArray(c.aliases) ? c.aliases : []).map(clean).filter(Boolean).slice(0, 5),
        bare: c.bare !== false
    };
}

function set(p) {
    const cur = get();
    const name = p && p.name !== undefined ? clean(p.name) : cur.name;
    if (!name) throw new Error('اسم النداء ما يكون فاضي');
    if (name.length < 2) throw new Error('اسم النداء قصير — حرفين على الأقل');
    const aliases = (p && Array.isArray(p.aliases) ? p.aliases : cur.aliases)
        .map(clean).filter(a => a && a !== name).slice(0, 5);
    const cfg = { name, aliases, bare: p && p.bare !== undefined ? !!p.bare : cur.bare, at: Date.now() };
    store.write(FILE, cfg);
    return cfg;
}

function reset() { store.write(FILE, { ...DEF, at: Date.now() }); return get(); }

const name = () => get().name;

function names() {
    const c = get();
    return [c.name, ...c.aliases].filter(Boolean);
}

const phrase = () => 'يا ' + name();

// هل الرسالة فيها نداء؟  «يا ايدا …» · «ياايدا» · وبالاسم لحاله لو «bare» مفعّل
function has(text, tokens) {
    const t = norm(text);
    const c = get();
    const list = names().map(norm);
    for (const n of list) {
        if (!n) continue;
        if (t.includes('يا ' + n) || t.includes('يا' + n)) return true;
        if (!c.bare) continue;
        const tk = (tokens || t.split(/[\s،,.!?؟]+/)).map(norm);
        if (tk.includes(n) || tk.includes('ال' + n)) return true;
    }
    return false;
}

// يشيل «يا <الاسم>» من أول النص عشان تتفك الأوامر
function strip(text) {
    let t = String(text || '');
    for (const n of names()) {
        const nn = norm(n);
        t = t.replace(new RegExp('^\\s*(?:يا\\s*)?' + esc(nn) + '\\s+', 'i'), '');
        t = t.replace(new RegExp('^\\s*يا\\s*' + esc(nn) + '\\s*', 'i'), '');
        t = t.replace(new RegExp('^\\s*' + esc(nn) + '\\s*$', 'i'), '');
    }
    return t.trim();
}

module.exports = { get, set, reset, name, names, has, strip, phrase, norm, clean, DEF, MAX, FILE };
