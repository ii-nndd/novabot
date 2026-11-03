// 🤝 الاتحاد — ربط بوتات مستقلة بلوحة وحدة
//
//  الفكرة: كل بوت يبقى مستقل (توكنه · لوحته · قاعدته)، لكنه يفتح «باب» صغير
//  محمي بمفتاح سري (FED_KEY) عشان البوت الرئيسي يقدر:
//    • يعرف سيرفراته (كل بوت يجيب سيرفراته)
//    • يفعّل/يقفل سيرفر عنده
//    • يعرف مين يقدر يدير أي سيرفر (للصلاحيات)
//    • يفتح لوحته بضغطة وحدة (توكن دخول موقّع — SSO بلا تسجيل دخول ثاني)
//
//  ⚠️ الأمان: كل مسارات /fed/* مرفوضة إلا بمفتاح FED_KEY الصحيح،
//     والتوكن الموقّع صالح دقيقتين فقط ولا يُستخدم إلا مرة.
const crypto = require('crypto');
const store = require('./store');

const KEY = () => String(process.env.FED_KEY || '').trim();
const MASTER = () => norm(process.env.FED_MASTER || '');
const TTL = 120000;                       // صلاحية توكن الدخول الموحّد

function norm(u) { return String(u || '').trim().replace(/\/+$/, ''); }
const okUrl = (u) => /^https?:\/\/[^\s/]+/i.test(norm(u));

// ===== البوتات المربوطة (عند البوت الرئيسي) =====
const all = () => store.read('bots.json', {});
const list = () => Object.values(all()).sort((a, b) => (a.at || 0) - (b.at || 0));
const get = (id) => all()[String(id || '')] || null;

function save(b) {
    const url = norm(b.url);
    if (!okUrl(url)) throw new Error('الرابط لازم يبدأ بـ https:// (رابط لوحة البوت)');
    const key = String(b.key || '').trim();
    if (key.length < 12) throw new Error('المفتاح السري قصير — لازم ١٢ حرف على الأقل');
    const a = all();
    const id = String(b.id || '').trim() || crypto.randomBytes(5).toString('hex');
    a[id] = { id, name: String(b.name || '').trim().slice(0, 40) || url, url, key, at: (a[id] && a[id].at) || Date.now() };
    store.write('bots.json', a);
    return a[id];
}

function del(id) {
    const a = all();
    if (!a[String(id)]) throw new Error('البوت مو موجود');
    delete a[String(id)];
    store.write('bots.json', a);
    return true;
}

// ===== نداء بوت آخر =====
async function call(bot, path, body, ms = 9000) {
    if (!bot || !okUrl(bot.url)) throw new Error('رابط البوت غير صالح');
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
        const r = await fetch(norm(bot.url) + '/fed/' + path, {
            method: body ? 'POST' : 'GET',
            headers: { 'content-type': 'application/json', 'x-fed-key': String(bot.key || '') },
            body: body ? JSON.stringify(body) : undefined,
            signal: ac.signal
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
    } catch (e) {
        throw new Error(e.name === 'AbortError' ? 'البوت ما رد (مهلة)' : String(e.message || e));
    } finally { clearTimeout(t); }
}

// ===== توكن الدخول الموحّد (SSO) =====
const sign = (key, p) => {
    const b = Buffer.from(JSON.stringify(p)).toString('base64url');
    return b + '.' + crypto.createHmac('sha256', String(key || '')).update(b).digest('base64url');
};

function check(key, t) {
    const [b, s] = String(t || '').split('.');
    if (!b || !s || !key) return null;
    const want = crypto.createHmac('sha256', String(key)).update(b).digest('base64url');
    const a = Buffer.from(want), c = Buffer.from(s);
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
    try {
        const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
        if (!p || !p.uid) return null;
        if (p.exp && Date.now() > Number(p.exp)) return null;
        return p;
    } catch { return null; }
}

const tokenFor = (bot, uid, name, gid) => sign(bot.key, { uid: String(uid), name: String(name || ''), gid: String(gid || ''), exp: Date.now() + TTL });

// هل يقدر يدخل لوحة هالبوت؟ (نسأل البوت نفسه)
async function accessOf(bot, uid) {
    try { return await call(bot, 'access?uid=' + encodeURIComponent(String(uid)), null, 6000); }
    catch { return null; }
}

// كل بوتات الاتحاد اللي للحساب صلاحية فيها (للمستخدمين اللي مو عندنا)
async function botsForUser(uid) {
    const out = [];
    for (const b of list()) {
        const a = await accessOf(b, uid);
        if (a && ((a.guilds && a.guilds.length) || a.super)) out.push({ id: b.id, name: b.name, url: b.url, guilds: (a.guilds || []).length, super: !!a.super });
    }
    return out;
}

// ===== مسارات البوت نفسه (/fed/*) =====
function mount(app, ctx) {
    const { client, CONFIG, access, express, build } = ctx;
    const guard = (req, res) => {
        if (!KEY()) { res.status(503).json({ error: 'الاتحاد مو مفعّل عند هذا البوت (FED_KEY فاضي)' }); return false; }
        if (String(req.get('x-fed-key') || '') !== KEY()) { res.status(403).json({ error: 'مفتاح الاتحاد غلط' }); return false; }
        return true;
    };
    const js = express.json({ limit: '64kb' });

    app.get('/fed/ping', (req, res) => {
        if (!guard(req, res)) return;
        res.json({
            ok: true, build: build || '', ready: !!client.isReady(),
            name: (client.user && client.user.username) || '', avatar: (client.user && client.user.displayAvatarURL({ size: 64 })) || '',
            guilds: client.guilds.cache.size, uptime: Math.round(process.uptime())
        });
    });

    app.get('/fed/guilds', (req, res) => {
        if (!guard(req, res)) return;
        res.json({
            guilds: [...client.guilds.cache.values()].map(g => ({
                id: g.id, name: g.name, icon: (g.iconURL && g.iconURL({ size: 64 })) || '',
                members: g.memberCount || 0, home: String(g.id) === String(CONFIG.GUILD_ID),
                approved: access.isApproved(g.id, CONFIG)
            })).sort((a, b) => (b.members || 0) - (a.members || 0))
        });
    });

    app.get('/fed/access', (req, res) => {
        if (!guard(req, res)) return;
        const uid = String(req.query.uid || '');
        if (!/^\d{5,25}$/.test(uid)) return res.status(400).json({ error: 'آيدي غير صالح' });
        res.json({
            super: access.isSuper(uid, CONFIG),
            guilds: [...client.guilds.cache.values()]
                .filter(g => access.canUse(g, uid, CONFIG))
                .map(g => ({ id: g.id, name: g.name }))
        });
    });

    app.post('/fed/act', js, async (req, res) => {
        if (!guard(req, res)) return;
        try {
            const gid = String((req.body && req.body.id) || '').trim();
            const on = !!(req.body && req.body.on);
            const g = client.guilds.cache.get(gid);
            if (!g) throw new Error('السيرفر مو موجود (البوت مو فيه)');
            if (String(gid) === String(CONFIG.GUILD_ID) && !on) throw new Error('سيرفر البيت ما ينقفل أبداً');
            access.approve(gid, on, 'اللوحة الموحّدة', g.name);
            try { if (typeof client.syncGuildCommands === 'function') await client.syncGuildCommands(g); } catch { }
            res.json({ ok: true, id: gid, approved: on });
        } catch (e) { res.status(400).json({ error: String(e.message || 'خطأ').slice(0, 150) }); }
    });
}

module.exports = {
    KEY, MASTER, TTL, norm, okUrl,
    all, list, get, save, del, call,
    sign, check, tokenFor, accessOf, botsForUser, mount
};
