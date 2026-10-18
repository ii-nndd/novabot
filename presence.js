// 🎮 حالة البوت (Presence) — «وش يسوي العبد الحين»
//
// ثلاث طبقات:
//   ١) حالة دوّارة: تتنقل بين حالات جاهزة كل X ثانية (يلعب / يشاهد / يستمع / ينافس / يبث).
//   ٢) حالة ديناميكية: أرقام حقيقية تتحدّث لحالها (عدد الأعضاء · مدة الصمود 24/7).
//   ٣) مرآة نشاط الملكيين: لو ارثر أو إيدا أو أي ملكي يلعب/يسمع شي، البوت يحط حالته
//      «فلان يلعب …» (اختياري — يحتاج تفعيل Presence Intent من بوابة المطورين).
//
// ⚠️ ملاحظة مهمة: البوت ما يقدر يغيّر حالة **حسابك** أنت — يقدر (١) يعرض حالته هو،
// و(٢) يعكس نشاطك عليها، و(٣) ينشر رسالة بروم تقول «فلان بدأ يلعب …».
//
// الإعدادات في presence.cfg.json (عبر store) — كل تعديل من اللوحة يُطبّق فوراً.
const store = require('./store');
const { GatewayIntentBits } = require('discord.js');

// أنواع الحالة (أرقام ديسكورد) + كيف نقرأها بالعربي
const TYPE = { play: 0, stream: 1, listen: 2, watch: 3, compete: 5 };
const TYPE_AR = { play: 'يلعب', stream: 'يبث', listen: 'يستمع إلى', watch: 'يشاهد', compete: 'ينافس في' };
const TYPE_EMOJI = { play: '🎮', stream: '🔴', listen: '🎧', watch: '👀', compete: '🏆' };

const DEF = {
    enabled: true,
    intervalSec: 60,        // كل كم ثانية نبدّل الحالة (الحد الأدنى ٣٠)
    status: 'online',       // online | idle | dnd | invisible
    dynamic: true,          // يضيف حالات محسوبة (عدد الأعضاء · مدة الصمود)
    mirror: false,          // مرآة نشاط الملكيين (يحتاج Presence Intent)
    mirrorUsersText: '',    // آيديات (فاضية = ارثر · إيدا · الرتبة الملكية)
    mirrorMinutes: 15,      // كم دقيقة نمسك حالة الشخص قبل ما نرجع للدوّارة
    announceId: '',         // روم إعلانات النشاط (فاضي = ما ننشر)
    items: [
        { name: 'مع أعضاء نوفا', type: 'play', url: '' },
        { name: 'حماية السيرفر 24/7', type: 'watch', url: '' },
        { name: 'النقاط والمستويات', type: 'play', url: '' },
        { name: 'الألعاب: سرعة · أعلام · مبعثرة', type: 'watch', url: '' }
    ]
};

let CONFIG = {};
const ref = { client: null, timer: null, index: 0 };
const NOW = { text: '', type: 'play', at: 0, source: 'دوّارة', by: '' };
const hold = { until: 0, text: '', type: 'play', by: '', uid: '' };
const lastAnnounce = new Map();   // uid -> وقت آخر إعلان

const all = () => store.read('presence.cfg.json', {});
const ids = (v) => [...new Set(String(v || '').split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d{5,25}$/.test(s)))];
const clip = (s, n = 120) => String(s || '').slice(0, n);
const num = (v, a, b, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const okType = (t) => (t in TYPE ? t : 'play');

function cleanItems(list) {
    return (Array.isArray(list) ? list : [])
        .map(it => ({ name: clip(String((it && it.name) || '').trim(), 120), type: okType(String((it && it.type) || 'play')), url: String((it && it.url) || '').trim() }))
        .filter(it => it.name);
}

// ===== الإعدادات =====
function get(gid) {
    const c = all()[gid] || {};
    const items = cleanItems(c.items);
    return {
        ...DEF, ...c,
        intervalSec: num(c.intervalSec, 30, 3600, DEF.intervalSec),
        mirrorMinutes: num(c.mirrorMinutes, 1, 240, DEF.mirrorMinutes),
        items: items.length ? items : cleanItems(DEF.items),
        mirrorUsers: ids((c.mirrorUsers || []).join(' '))
    };
}

function set(gid, b) {
    const a = all();
    const cur = get(gid);
    a[gid] = {
        enabled: 'enabled' in b ? !!b.enabled : cur.enabled,
        status: ['online', 'idle', 'dnd', 'invisible'].includes(String(b.status)) ? String(b.status) : cur.status,
        intervalSec: num(b.intervalSec, 30, 3600, cur.intervalSec),
        dynamic: 'dynamic' in b ? !!b.dynamic : cur.dynamic,
        mirror: 'mirror' in b ? !!b.mirror : cur.mirror,
        mirrorUsers: ids(b.mirrorUsersText !== undefined ? b.mirrorUsersText : (cur.mirrorUsers || []).join(' ')),
        mirrorMinutes: num(b.mirrorMinutes, 1, 240, cur.mirrorMinutes),
        announceId: b.announceId !== undefined
            ? (/^\d{5,25}$/.test(String(b.announceId)) ? String(b.announceId) : '')
            : cur.announceId,
        items: b.items !== undefined ? cleanItems(b.items) : cur.items
    };
    store.write('presence.cfg.json', a);
    return get(gid);
}

function reset(gid) {
    const a = all();
    delete a[gid];
    store.write('presence.cfg.json', a);
    return get(gid);
}

// ===== الحالات المحسوبة (أرقام حقيقية) =====
function dynItems() {
    const g = guildOf();
    const out = [];
    if (g) out.push({ name: `${g.memberCount} عضو في نوفا`, type: 'watch', url: '' });
    const mins = Math.max(1, Math.round(process.uptime() / 60));
    out.push({ name: `صامد ${mins} دقيقة بلا انقطاع`, type: 'watch', url: '' });
    out.push({ name: `واقف معاك: ${new Date().toLocaleTimeString('ar-OM', { hour: '2-digit', minute: '2-digit' })}`, type: 'watch', url: '' });
    return out;
}

function guildOf() {
    const c = ref.client;
    if (!c) return null;
    return c.guilds.cache.get(CONFIG.GUILD_ID) || c.guilds.cache.first() || null;
}

// ===== التطبيق =====
function push(entry, source, by) {
    const c = ref.client;
    if (!c || !c.user) return null;
    const cfg = get(CONFIG.GUILD_ID);
    let type = okType(entry.type);
    const act = { name: clip(entry.name) || 'نوفا', type: TYPE[type] };
    if (type === 'stream') {
        if (entry.url) act.url = String(entry.url);
        else { type = 'play'; act.type = 0; }   // بث بلا رابط ما ينفع → نرجعه «يلعب»
    }
    try {
        c.user.setPresence({ status: cfg.status, activities: [act] });
        NOW.text = act.name; NOW.type = type; NOW.at = Date.now(); NOW.source = source; NOW.by = by || '';
        return { ...NOW };
    } catch { return null; }
}

// الحالة الحالية اللي المفروض تظهر الآن (دوّارة أو مرآة)
function current() {
    const cfg = get(CONFIG.GUILD_ID);
    if (Date.now() < hold.until && hold.text) return { name: hold.text, type: hold.type, source: 'مرآة', by: hold.by };
    const list = cfg.items.concat(cfg.dynamic ? dynItems() : []);
    const it = list[ref.index % list.length] || list[0];
    return it ? { name: it.name, type: it.type, url: it.url, source: 'دوّارة' } : null;
}

function apply() {
    const cfg = get(CONFIG.GUILD_ID);
    if (!cfg.enabled) return status();
    const cur = current();
    if (cur) push(cur, cur.source || 'دوّارة', cur.by);
    return status();
}

function next() {
    ref.index++;
    return apply();
}

// ===== المرآة =====
function mirrorTargets(cfg) {
    if (cfg.mirrorUsers.length) return cfg.mirrorUsers;
    return [CONFIG.ARTHUR_ID, CONFIG.SPECIAL_USER_ID].filter(Boolean);
}

function mirrored(member, cfg) {
    if (!member || !member.user || member.user.bot) return false;
    if (cfg.mirrorUsers.length) return cfg.mirrorUsers.includes(member.id);
    if (member.id === CONFIG.ARTHUR_ID || member.id === CONFIG.SPECIAL_USER_ID) return true;
    return !!(CONFIG.ROYAL_ROLE_ID && member.roles && member.roles.cache && member.roles.cache.has(CONFIG.ROYAL_ROLE_ID));
}

// أول نشاط «مفيد» (لعبة/سماع/مشاهدة) — نتجاهل الحالة المخصصة والبث بدون رابط
function pickActivity(activities) {
    const list = Array.isArray(activities) ? activities : [];
    const good = list.filter(a => a && a.name && [0, 2, 3, 5, 1].includes(Number(a.type)));
    const a = good.find(x => Number(x.type) === 0) || good.find(x => Number(x.type) === 2) ||
        good.find(x => Number(x.type) === 3) || good.find(x => Number(x.type) === 5) || good[0];
    if (!a) return null;
    const t = Number(a.type);
    const key = t === 0 ? 'play' : t === 2 ? 'listen' : t === 3 ? 'watch' : t === 5 ? 'compete' : 'stream';
    const extra = t === 2 && a.details ? ` — ${a.details}` : '';   // في الاستماع: اسم الأغنية/الفنان
    return { type: key, name: clip(String(a.name) + extra) };
}

async function announce(member, act) {
    const cfg = get(CONFIG.GUILD_ID);
    if (!cfg.announceId) return;
    const last = lastAnnounce.get(member.id) || 0;
    if (Date.now() - last < 10 * 60 * 1000) return;   // ما نزعج أكثر من مرة كل ١٠ دقايق للشخص
    lastAnnounce.set(member.id, Date.now());
    const g = guildOf();
    if (!g) return;
    try {
        const ch = g.channels.cache.get(cfg.announceId) || await g.channels.fetch(cfg.announceId).catch(() => null);
        if (ch && ch.isTextBased && ch.isTextBased()) {
            await ch.send(`${TYPE_EMOJI[act.type] || '🎮'} **${member.displayName}** ${TYPE_AR[act.type] || 'يلعب'} **${act.name}**`);
        }
    } catch (err) { console.error('❌ حضور (إعلان النشاط):', err && err.message); }
}

// ===== الاشتغال =====
function restartTimer() {
    if (ref.timer) { clearInterval(ref.timer); ref.timer = null; }
    const cfg = get(CONFIG.GUILD_ID);
    if (!cfg.enabled) return;
    ref.timer = setInterval(() => {
        const c = get(CONFIG.GUILD_ID);
        if (!c.enabled) return;
        if (Date.now() < hold.until && hold.text) return;   // المرآة ماسكة الحالة
        next();
    }, cfg.intervalSec * 1000);
    if (ref.timer.unref) ref.timer.unref();
}

function onPresence(oldP, newP) {
    try {
        const cfg = get(CONFIG.GUILD_ID);
        if (!cfg.enabled || !cfg.mirror) return;
        const member = (newP && newP.member) || (oldP && oldP.member);
        if (!mirrored(member, cfg)) return;
        const before = pickActivity(oldP && oldP.activities);
        const after = pickActivity(newP && newP.activities);
        if (!after) return;
        if (before && before.type === after.type && before.name === after.name) return;   // ما تغيّر شي
        const text = `${member.displayName} ${TYPE_AR[after.type]} ${after.name}`;
        hold.text = clip(text); hold.type = after.type; hold.by = member.displayName; hold.uid = member.id;
        hold.until = Date.now() + cfg.mirrorMinutes * 60 * 1000;
        push({ name: hold.text, type: hold.type }, 'مرآة', member.displayName);
        announce(member, after);
    } catch (err) { console.error('❌ حضور (المرآة):', err && err.message); }
}

function status() {
    const cfg = get(CONFIG.GUILD_ID);
    const list = cfg.items.concat(cfg.dynamic ? dynItems() : []);
    return {
        enabled: cfg.enabled,
        status: cfg.status,
        intervalSec: cfg.intervalSec,
        mirrorNow: Date.now() < hold.until,
        mirrorHold: hold.text || '',
        mirrorCapable: canMirror(),
        index: list.length ? ref.index % list.length : 0,
        total: list.length,
        now: { ...NOW },
        next: cfg.enabled ? new Date(Date.now() + cfg.intervalSec * 1000).toISOString() : null
    };
}

// هل Presence Intent مفعّل؟ (المرآة تحتاجه — بدونه البوت يشتغل عادي)
function canMirror() {
    try {
        const c = ref.client;
        return !!(c && c.options && c.options.intents && c.options.intents.has(GatewayIntentBits.GuildPresences));
    } catch { return false; }
}

function init(client, cfgRoot) {
    CONFIG = cfgRoot || {};
    ref.client = client;
    client.on('presenceUpdate', (o, n) => onPresence(o, n));
    // الحالة تبدأ مع كل إقلاع حتى لو الإعدادات محفوظة من قبل
    try { if (client.user) client.user.setStatus(get(CONFIG.GUILD_ID).status); } catch {}
    apply();
    restartTimer();
    console.log(`🎮 حالة البوت شغالة (${get(CONFIG.GUILD_ID).items.length} حالة · تبديل كل ${get(CONFIG.GUILD_ID).intervalSec} ثانية${get(CONFIG.GUILD_ID).mirror ? ' · مرآة الملكيين' : ''})`);
}

module.exports = { init, get, set, reset, apply, next, status, restartTimer, canMirror, TYPE, TYPE_AR, TYPE_EMOJI, DEF };
