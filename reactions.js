// 😍 نظام الرياكشن — البوت يحط إيموجي (حتى ٣) على أي **صورة** تنزل برومات محددة.
// ----------------------------------------------------------------------------
//  الفكرة: تختار رومات (روم واحد أو أكثر) + إيموجيات (حد ٣) من صفحة «الرياكشن 😍»
//    باللوحة → أي أحد ينزّل صورة بهالرومات، البوت يحط الإيموجيات عليها فوراً.
//
//  القواعد (عشان ما نتجاوز حدود ديسكورد ولا نزعج):
//    • 📷 **الصور فقط** (مرفق صورة / إيمبد صورة أو GIF) — الرسائل النصية ما نلمسها.
//    • ⏱️ تأخير بسيط بين كل رياكشن والثاني + حد أقصى بالدقيقة لكل روم (MAX_PER_MIN).
//    • 🤖 نتجاهل رسائل البوتات (ما نتفاعل مع أنفسنا).
//    • 🔒 السيرفر المقفول ما يشتغل فيه شي.
//
//  التخزين: reactcfg.json   { "<gid>": { enabled, channels:[], emojis:[], at } }
//  يعرض: init · get · set · reset · stat · hasImage · MAX_EMOJI · MAX_CHANNELS · DEF
// ============================================================================
const store = require('./store');
const access = require('./access');

const FILE = 'reactcfg.json';
const MAX_EMOJI = 3;        // حد الإيموجيات لكل سيرفر
const MAX_CHANNELS = 30;    // حد الرومات المختارة

// الحدود (قابلة للتعديل بالاختبارات فقط — لا تُعدّل من اللوحة)
const LIMITS = {
    gapMs: 700,        // أقل فاصل بين رياكشن ورياكشن بنفس الروم
    stepMs: 220,       // فاصل بين إيموجي وإيموجي بنفس الرسالة
    perMin: 30,        // حد الرياكشنات بالدقيقة لكل روم
    maxPending: 10     // حد الرسائل المنتظرة بنفس الروم (لو زاد نتخطى — ما نتراكم)
};

const DEF = { enabled: false, channels: [], emojis: ['😍'] };

const all = () => {
    const a = store.read(FILE, {});
    return a && typeof a === 'object' && !Array.isArray(a) ? a : {};
};
const save = (a) => store.write(FILE, a);

const cleanEmoji = (s) => String(s == null ? '' : s).trim().slice(0, 80);

// نقبل: إيموجي عادي · إيموجي سيرفر مخصص <:name:id> أو <a:name:id> · آيدي إيموجي
const isEmoji = (s) => {
    const t = cleanEmoji(s);
    if (!t) return false;
    if (/^<a?:[A-Za-z0-9_]{2,32}:\d{5,25}>$/.test(t)) return true;
    if (/^\d{5,25}$/.test(t)) return true;
    if (t.length > 20) return false;
    return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}\u{200D}\u{2764}]/u.test(t);
};

const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);

// إعدادات سيرفر (مع تنظيف أي شي قديم/خرب)
function get(gid) {
    const c = all()[String(gid || '')] || {};
    const channels = (Array.isArray(c.channels) ? c.channels : [])
        .map(x => String(x || '').replace(/[^0-9]/g, '')).filter(x => x.length >= 5);
    let emojis = (Array.isArray(c.emojis) ? c.emojis : [])
        .map(cleanEmoji).filter(isEmoji);
    emojis = uniq(emojis).slice(0, MAX_EMOJI);
    return {
        enabled: !!c.enabled,
        channels: uniq(channels).slice(0, MAX_CHANNELS),
        emojis: emojis.length ? emojis : DEF.emojis.slice(),
        onlyImages: true,
        at: c.at || 0
    };
}

// حفظ إعدادات سيرفر
function set(gid, body) {
    const g = String(gid || '').replace(/[^0-9]/g, '');
    if (!g) return null;
    const b = body || {};
    const channels = uniq((Array.isArray(b.channels) ? b.channels : [])
        .map(x => String(x || '').replace(/[^0-9]/g, '')).filter(x => x.length >= 5)).slice(0, MAX_CHANNELS);
    let emojis = uniq((Array.isArray(b.emojis) ? b.emojis : []).map(cleanEmoji).filter(isEmoji)).slice(0, MAX_EMOJI);
    if (!emojis.length) emojis = DEF.emojis.slice();
    const a = all();
    a[g] = { enabled: !!b.enabled, channels, emojis, at: Date.now() };
    save(a);
    return a[g];
}

function reset(gid) {
    const a = all();
    delete a[String(gid || '')];
    save(a);
    return get(gid);
}

// ===== عدّاد بسيط بالذاكرة (من آخر تشغيل — ما نكتب على القرص كل رياكشن) =====
const stats = new Map();
function bump(gid, n) {
    const s = stats.get(gid) || { n: 0, last: 0 };
    s.n += n; s.last = Date.now(); stats.set(gid, s);
}
function stat(gid) { return stats.get(String(gid || '')) || { n: 0, last: 0 }; }

// ===== هل الرسالة فيها صورة؟ =====
const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|avif)(\?|#|$)/i;
function hasImage(m) {
    if (!m) return false;
    try {
        if (m.attachments && m.attachments.size) {
            for (const a of m.attachments.values()) {
                if (!a) continue;
                if (String(a.contentType || '').toLowerCase().startsWith('image/')) return true;
                if (IMG_RE.test(String(a.name || a.url || ''))) return true;
            }
        }
        if (Array.isArray(m.embeds) && m.embeds.length) {
            for (const e of m.embeds) {
                if (!e) continue;
                if (e.image || e.thumbnail) return true;
                if (e.type === 'image' || e.type === 'gifv') return true;
            }
        }
    } catch { }
    return false;
}

// ===== حدود المعدّل + طابور لكل روم =====
// ملاحظة مهمة: ما نرمي الرياكشن لو جاءت صورتين ورا بعض — ندخلها **طابور** ونفصل بينها،
// عشان ما نضيّع تفاعل أحد ولا نتجاوز حدود ديسكورد (اللي تسبب حظر مؤقت للبوت).
const lastAt = new Map();
const bucket = new Map();
const chain = new Map();
const pending = new Map();

function allowMinute(chid) {
    const now = Date.now();
    let b = bucket.get(chid);
    if (!b || now - b.t0 > 60_000) { b = { t0: now, n: 0 }; bucket.set(chid, b); }
    if (b.n >= LIMITS.perMin) return false;
    b.n++;
    return true;
}

function enqueue(chid, fn) {
    const prev = chain.get(chid) || Promise.resolve();
    const next = prev.then(async () => {
        const gap = LIMITS.gapMs - (Date.now() - (lastAt.get(chid) || 0));
        if (gap > 0) await new Promise(r => setTimeout(r, gap));
        lastAt.set(chid, Date.now());
        return fn();
    }).catch(() => 0);
    chain.set(chid, next);
    return next;
}

// ===== التفاعل مع رسالة =====
async function reactTo(m) {
    try {
        if (!m || !m.guild || !m.channel) return 0;
        if (m.author && m.author.bot) return 0;
        const gid = m.guild.id;
        if (!access.isApproved(gid)) return 0;
        const cfg = get(gid);
        if (!cfg.enabled || !cfg.channels.length || !cfg.emojis.length) return 0;
        const chid = String(m.channel.id);
        if (!cfg.channels.includes(chid)) return 0;
        if (!hasImage(m)) return 0;
        if ((pending.get(chid) || 0) >= LIMITS.maxPending) return 0;   // طابور ممتلئ → نتخطى
        if (!allowMinute(chid)) return 0;                              // تجاوز حد الدقيقة
        pending.set(chid, (pending.get(chid) || 0) + 1);
        try {
            return await enqueue(chid, async () => {
                let n = 0;
                for (const e of cfg.emojis) {
                    try { await m.react(e); n++; } catch { }
                    if (LIMITS.stepMs) await new Promise(r => setTimeout(r, LIMITS.stepMs));
                }
                if (n) bump(gid, n);
                return n;
            });
        } finally {
            pending.set(chid, Math.max(0, (pending.get(chid) || 1) - 1));
        }
    } catch { return 0; }
}

function init(client) {
    client.on('messageCreate', (m) => {
        try {
            if (!m || !m.guild || !m.author || m.author.bot) return;
            if (m.system) return;
            if (!access.isApproved(m.guild.id)) return;   // 🔒 سيرفر مقفول
            const cfg = get(m.guild.id);
            if (!cfg.enabled || !cfg.channels.length) return;
            if (!cfg.channels.includes(String(m.channel.id))) return;
            if (!hasImage(m)) return;
            reactTo(m).catch(() => {});
        } catch { }
    });
    console.log('😍 نظام الرياكشن شغال (تفاعل تلقائي مع الصور)');
}

module.exports = { init, get, set, reset, stat, reactTo, hasImage, isEmoji, MAX_EMOJI, MAX_CHANNELS, LIMITS, DEF };
