// ============================================================================
//  access.js — 🔑 صلاحية الدخول · 🔒 قفل البوت · 👑 «الملكي» لكل سيرفر
// ----------------------------------------------------------------------------
//  الفكرة (٢٠ أكتوبر ٢٠٢٦):
//    ١) 🔒 **البوت مقفول افتراضياً**: أي سيرفر يضيف البوت يظل **مقفول** — ما يرد على
//       أي رسالة، ولا تنزل عنده أوامر سلاش، ولا يشتغل عنده أي نظام (ترحيب/مستويات/
//       حماية/قرعات…) — إلا إذا **ارثر أو إيدا فعّلوا السيرفر** من اللوحة.
//    ٢) 🔑 **اللوحة مقفولة**: ما يدخلها إلا اللي عنده صلاحية بقائمة سيرفره.
//       وصاحب السيرفر ما يدخل إلا بعد ما يتفعّل سيرفره (وبعدها هو يضيف مسؤولينه).
//    ٣) 👑 سيرفرنا (نوفا): ارثر/إيدا/الرتبة الملكية — نفس السلوك القديم بالضبط.
//
//  التخزين: access.json
//    {
//      "approved": { "<gid>": { at, by, name } },              ← السيرفرات المفعّلة
//      "guilds":   { "<gid>": [ { id, name, at, by } ] }       ← المسموح لهم باللوحة
//    }
//
//  يعرض:
//    boot · isApproved · approve · approvedList · canRun          (القفل)
//    list · add · remove · clear · has · canUse · canManage       (الصلاحية)
//    isSuper · superIds · superSet · isNova · isRoyal · royalIds  (الرتب)
//    guildsOf · label · royalWord · clean · isTop · denyText*
// ============================================================================
const store = require('./store');

const FILE = 'access.json';
const MAX_PER_GUILD = 200;   // حد منطقي عشان ما يكبر الملف

const asId = (v) => String(v == null ? '' : v).trim();
const isId = (v) => (/^\d{5,25}$/.test(asId(v)) ? asId(v) : '');
const clip = (s, n) => (String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n));

// إعدادات البوت (نسجّلها مرة وحدة عند الإقلاع عشان أي ملف يقدر يسأل بدون تمرير CONFIG)
let CFG = {};
function boot(CONFIG) { if (CONFIG && CONFIG.GUILD_ID != null) CFG = CONFIG; return CFG; }
const cfg = (CONFIG) => (CONFIG && CONFIG.GUILD_ID != null ? CONFIG : CFG);

// القراءة الآمنة (لو الملف خرب أو قديم)
function all() {
    const a = store.read(FILE, {});
    if (!a || typeof a !== 'object' || Array.isArray(a)) return { approved: {}, guilds: {} };
    if (!a.guilds || typeof a.guilds !== 'object' || Array.isArray(a.guilds)) a.guilds = {};
    if (!a.approved || typeof a.approved !== 'object' || Array.isArray(a.approved)) a.approved = {};
    return a;
}
function save(a) { store.write(FILE, a); return a; }

// ===== 🔒 تفعيل/قفل السيرفرات =====

// ===== 🌐 وضع البوت: سيرفر واحد (الافتراضي) أو لكل السيرفرات =====
// PUBLIC_BOT=0 (الافتراضي) → البوت **لسيرفر نوفا فقط**: يطلع من أي سيرفر ثاني فوراً
//   (هذا شرط معظم استضافات البوتات المجانية: ممنوع «بوت عام» يخدم سيرفرات كثيرة)
// PUBLIC_BOT=1 → البوت لكل السيرفرات (نظام التفعيل من صفحة «السيرفرات 🌐»)
const publicBot = () => String(process.env.PUBLIC_BOT || '0').trim() === '1';

// هل السيرفر مفعّل؟ (سيرفرنا مفعّل دايماً)
function isApproved(gid, CONFIG) {
    const c = cfg(CONFIG);
    const g = asId(gid);
    if (!g) return false;
    if (isNova(g, c)) return true;
    if (!publicBot()) return false;         // 🔒 وضع السيرفر الواحد
    return !!all().approved[g];
}

// تفعيل (on=true) أو قفل (on=false) سيرفر
function approve(gid, on, by, name) {
    const g = isId(gid);
    if (!g) throw new Error('آيدي السيرفر غير صالح');
    const a = all();
    if (on) a.approved[g] = { at: Date.now(), by: isId(by) || '', name: clip(name, 80) || g };
    else delete a.approved[g];
    save(a);
    return !!on;
}

// قائمة السيرفرات المفعّلة (للعرض بالسجل)
function approvedList() {
    const a = all();
    return Object.keys(a.approved).map(id => ({ id, ...a.approved[id] }));
}

// 🔒 هل نشتغل بهذا السيرفر؟ (مفعّل · أو اللي يكتب ارثر/إيدا = يقدرون يجرّبون بأي مكان)
function canRun(gid, uid, CONFIG) {
    const c = cfg(CONFIG);
    if (isApproved(gid, c)) return true;
    return !!uid && isSuper(uid, c);
}

// ===== قائمة المسموحين باللوحة (لكل سيرفر) =====
const list = (gid) => (all().guilds[isId(gid)] || []).slice();

function add(gid, id, name, by) {
    const g = isId(gid), uid = isId(id);
    if (!g) throw new Error('آيدي السيرفر غير صالح');
    if (!uid) throw new Error('اكتب آيدي الحساب صح (أرقام فقط)');
    const a = all();
    const arr = (a.guilds[g] || []).slice();
    const i = arr.findIndex(e => e.id === uid);
    const entry = { id: uid, name: clip(name, 60) || uid, at: Date.now(), by: isId(by) || '' };
    if (i >= 0) arr[i] = { ...arr[i], ...entry };
    else arr.push(entry);
    a.guilds[g] = arr.slice(-MAX_PER_GUILD);
    save(a);
    return a.guilds[g];
}

function remove(gid, id) {
    const g = isId(gid), uid = isId(id);
    const a = all();
    const arr = (a.guilds[g] || []).filter(e => e.id !== uid);
    a.guilds[g] = arr;
    save(a);
    return arr;
}

function clear(gid) {
    const a = all();
    delete a.guilds[isId(gid)];
    save(a);
    return [];
}

// ===== 👑 اللي فوق الكل (صاحب المشروع): ارثر وإيدا =====
const superIds = (CONFIG) => [asId(cfg(CONFIG).ARTHUR_ID), asId(cfg(CONFIG).SPECIAL_USER_ID)].filter(Boolean);
const superSet = (CONFIG) => new Set(superIds(CONFIG));
const isSuper = (id, CONFIG) => superSet(CONFIG).has(asId(id));
const isNova = (gid, CONFIG) => { const a = asId(gid), b = asId(cfg(CONFIG).GUILD_ID); return !!a && a === b; };

// هل هذا الحساب «فوق» بهذا السيرفر؟ (بسيرفرنا = ارثر/إيدا · بأي سيرفر ثاني = المسؤولين)
function isTop(guild, member, tier, CONFIG) {
    if (isNova(guild && guild.id, CONFIG)) return tier === 'arthur' || tier === 'ida';
    return isRoyal(guild, member, CONFIG);
}

// هل عنده صلاحية دخول لوحة هذا السيرفر؟
function has(gid, id, CONFIG) {
    if (isSuper(id, CONFIG)) return true;
    const uid = isId(id);
    return !!uid && list(gid).some(e => e.id === uid);
}

// ===== 👑 «الملكي» بهذا السيرفر =====
// سيرفرنا: ارثر · إيدا · الرتبة الملكية (نفس السلوك القديم بالضبط)
// غيرنا  : صاحب السيرفر · واللي أنا عطيتهم صلاحية الدخول — وبس لو السيرفر مفعّل
function isRoyal(guild, member, CONFIG) {
    if (!guild || !member) return false;
    const uid = asId(member.id);
    if (!uid) return false;
    if (isSuper(uid, CONFIG)) return true;
    if (!isApproved(guild.id, CONFIG)) return false;   // 🔒 سيرفر مقفول = ما فيه ملكي
    if (isNova(guild.id, CONFIG)) {
        return !!(cfg(CONFIG).ROYAL_ROLE_ID && member.roles && member.roles.cache
            && member.roles.cache.has(cfg(CONFIG).ROYAL_ROLE_ID));
    }
    if (asId(guild.ownerId) === uid) return true;
    return has(guild.id, uid, CONFIG);
}

// آيديات «الملكيين» بهذا السيرفر (للتنبيهات والخاص)
function royalIds(guild, CONFIG) {
    const out = new Set();
    if (!guild || !isApproved(guild.id, CONFIG)) return [];
    if (isNova(guild.id, CONFIG)) {
        superIds(CONFIG).forEach(x => out.add(x));
    } else {
        list(guild.id).forEach(e => out.add(e.id));
    }
    if (isId(guild.ownerId)) out.add(isId(guild.ownerId));
    return [...out];
}

// هل عنده صلاحية دخول لوحة هذا السيرفر؟ (فوق الكل · أو مفعّل + صاحبه/مسموح)
function canUse(guild, id, CONFIG) {
    if (!guild) return false;
    const uid = asId(id);
    if (!uid) return false;
    if (isSuper(uid, CONFIG)) return true;
    if (!isApproved(guild.id, CONFIG)) return false;         // 🔒 لازم السيرفر يتفعّل أول
    if (asId(guild.ownerId) === uid) return true;
    return list(guild.id).some(e => e.id === uid);
}

// السيرفرات اللي هذا الحساب يقدر يدخل لوحتها (فوق الكل → كل السيرفرات)
function guildsOf(client, id, CONFIG) {
    const uid = asId(id);
    const out = [];
    if (!client || !uid) return out;
    for (const g of client.guilds.cache.values()) {
        if (canUse(g, uid, CONFIG)) out.push(g);
    }
    return out;
}

// هل يقدر يدير قائمة المسموحين بهذا السيرفر؟
// فوق الكل = أي سيرفر · صاحب السيرفر = سيرفره (بس بعد تفعيله) · قائمة سيرفرنا لك وإيدا بس
function canManage(guild, id, CONFIG) {
    if (!guild) return false;
    const uid = asId(id);
    if (!uid) return false;
    if (isSuper(uid, CONFIG)) return true;
    if (isNova(guild.id, CONFIG)) return false;
    if (!isApproved(guild.id, CONFIG)) return false;
    return asId(guild.ownerId) === uid;
}

// اسم الشخصة الملكية بهذا السيرفر (للنصوص)
const label = (gid, CONFIG) => (isNova(gid, CONFIG) ? 'مولاي ارثر والملكة إيدا' : 'إدارة السيرفر');
const royalWord = (gid, CONFIG) => (isNova(gid, CONFIG) ? 'الرتبة الملكية' : 'إدارة السيرفر');

// تنقية النصوص: بسيرفرنا ما نغيّر شي · بأي سيرفر ثاني نشيل أسماء ارثر/إيدا ونوفا
function clean(text, guild, CONFIG) {
    if (text == null) return text;
    let s = String(text);
    if (isNova(guild && guild.id, CONFIG)) return s;
    return s
        .replace(/مولاي\s*ارثر\s*(?:و|and)?\s*(?:الملكة\s*)?إيدا/g, 'إدارة السيرفر')
        .replace(/نبض\s*ارثر/g, 'الغالي')
        .replace(/مولاي\s*ارثر/g, 'صاحب السيرفر')
        .replace(/الملكة\s*إيدا/g, 'الإدارة')
        .replace(/سيرفر\s*نوفا/g, 'هذا السيرفر')
        .replace(/نوفا/g, 'السيرفر')
        .replace(/ارثر/g, 'صاحب السيرفر')
        .replace(/إيدا/g, 'الإدارة')
        .replace(/يا\s*مولاي/g, 'يا طويل العمر');
}

// نصوص الرفض حسب السيرفر (عشان ما نذكر ارثر/إيدا بغير سيرفرنا)
function denyText(guild, CONFIG) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بمولاي ارثر والملكة إيدا وأصحاب الرتب بس! 💅';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر (صاحب السيرفر أو اللي عطاه صلاحية) فقط.';
}
function denyTextRanks(guild, CONFIG) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بأهل الرتبة الملكية! 💅';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر فقط.';
}
function denyTextRoyal(guild, CONFIG) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بمولاي ارثر والملكة إيدا والرتبة الملكية.';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر فقط.';
}
function denyTextOwner(guild, CONFIG) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بمولاي ارثر والملكة إيدا فقط! 👑';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر فقط.';
}
// 🔒 نص القفل (السيرفر مو مفعّل)
const denyTextLocked = '🔒 هذا البوت مقفل في هذا السيرفر.\nلتفعيله تواصل مع إدارة نوفا — بعد التفعيل يشتغل كل شي تلقائياً.';

module.exports = {
    FILE,
    // 🔒 القفل
    boot, isApproved, approve, approvedList, canRun, denyTextLocked, publicBot,
    // 🔑 الصلاحية
    list, add, remove, clear, has, canUse, canManage, guildsOf,
    // 👑 الرتب
    isSuper, superIds, superSet, isNova, isRoyal, royalIds, isTop,
    label, royalWord, clean, denyText, denyTextRanks, denyTextOwner, denyTextRoyal
};
