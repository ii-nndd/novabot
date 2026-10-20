// ============================================================================
//  access.js — 🔑 صلاحية الدخول للوحة + «الملكي» لكل سيرفر
// ----------------------------------------------------------------------------
//  الفكرة: البوت صار يشتغل على كل السيرفرات، والداشبورد لكل سيرفر لحاله:
//    ١) ما يدخل اللوحة إلا **اللي أعطيه صلاحية** (قائمة مسموحين لكل سيرفر)
//       → مو أي واحد معه الرابط يقدر يدخل، ولا يقدر يسوي أي شي.
//    ٢) صاحب سيرفرنا (ارثر/إيدا/الرتبة الملكية) مثل ما هو بالضبط — ما تغير شي.
//    ٣) بأي سيرفر ثاني: «الملكي» = **صاحب السيرفر** + اللي أنا عطيتهم صلاحية الدخول.
//
//  التخزين: access.json
//    { "guilds": { "<gid>": [ { id, name, at, by } ] } }
//
//  يعرض: list · add · remove · clear · has · isSuper · superIds · superSet ·
//        isRoyal · royalIds · canEnter · guildsOf · canManage · label · denyText
// ============================================================================
const store = require('./store');

const FILE = 'access.json';
const MAX_PER_GUILD = 200;   // حد منطقي عشان ما يكبر الملف

const isId = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : '');
const clip = (s, n) => (String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n));

// القراءة الآمنة (لو الملف خرب أو قديم)
function all() {
    const a = store.read(FILE, { guilds: {} });
    if (!a || typeof a !== 'object' || Array.isArray(a)) return { guilds: {} };
    if (!a.guilds || typeof a.guilds !== 'object') a.guilds = {};
    return a;
}
function save(a) { store.write(FILE, a); return a; }

// قائمة المسموحين لسيرفر
const list = (gid) => (all().guilds[isId(gid)] || []).slice();

// إضافة (أو تحديث) عضو مسموح
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

// إزالة عضو
function remove(gid, id) {
    const g = isId(gid), uid = isId(id);
    const a = all();
    const arr = (a.guilds[g] || []).filter(e => e.id !== uid);
    a.guilds[g] = arr;
    save(a);
    return arr;
}

// تصفير قائمة سيرفر
function clear(gid) {
    const a = all();
    delete a.guilds[isId(gid)];
    save(a);
    return [];
}

// هل هذا الحساب «فوق» بهذا السيرفر؟ (بسيرفرنا = ارثر/إيدا · بأي سيرفر ثاني = صاحب السيرفر/المسؤولين)
function isTop(guild, member, tier, CONFIG = {}) {
    if (isNova(guild && guild.id, CONFIG)) return tier === 'arthur' || tier === 'ida';
    return isRoyal(guild, member, CONFIG);
}

// ===== اللي فوق الكل (صاحب المشروع): ارثر وإيدا =====
const asId = (v) => String(v == null ? '' : v).trim();
const superIds = (CONFIG = {}) => [asId(CONFIG.ARTHUR_ID), asId(CONFIG.SPECIAL_USER_ID)].filter(Boolean);
const superSet = (CONFIG = {}) => new Set(superIds(CONFIG));
const isSuper = (id, CONFIG = {}) => superSet(CONFIG).has(asId(id));
const isNova = (gid, CONFIG = {}) => { const a = asId(gid), b = asId(CONFIG.GUILD_ID); return !!a && a === b; };

// هل عنده صلاحية دخول لوحة هذا السيرفر؟ (فوق الكل يدخلون أي سيرفر)
function has(gid, id, CONFIG = {}) {
    if (isSuper(id, CONFIG)) return true;
    const uid = isId(id);
    return !!uid && list(gid).some(e => e.id === uid);
}

// ===== «الملكي» بهذا السيرفر =====
// سيرفرنا: ارثر · إيدا · الرتبة الملكية (نفس السلوك القديم بالضبط)
// غيرنا  : صاحب السيرفر · واللي أنا عطيتهم صلاحية الدخول
function isRoyal(guild, member, CONFIG = {}) {
    if (!guild || !member) return false;
    const uid = asId(member.id);
    if (!uid) return false;
    if (isSuper(uid, CONFIG)) return true;
    if (isNova(guild.id, CONFIG)) {
        return !!(CONFIG.ROYAL_ROLE_ID && member.roles && member.roles.cache
            && member.roles.cache.has(CONFIG.ROYAL_ROLE_ID));
    }
    if (asId(guild.ownerId) === uid) return true;
    return has(guild.id, uid, CONFIG);
}

// آيديات «الملكيين» بهذا السيرفر (للتنبيهات والخاص)
function royalIds(guild, CONFIG = {}) {
    const out = new Set();
    if (!guild) return [];
    if (isNova(guild.id, CONFIG)) {
        superIds(CONFIG).forEach(x => out.add(x));
    } else {
        list(guild.id).forEach(e => out.add(e.id));
    }
    if (isId(guild.ownerId)) out.add(isId(guild.ownerId));
    return [...out];
}

// هل عنده صلاحية دخول لوحة هذا السيرفر؟ (فوق الكل · أو بالقائمة · أو صاحب السيرفر نفسه)
function canUse(guild, id, CONFIG = {}) {
    if (!guild) return false;
    const uid = asId(id);
    if (!uid) return false;
    if (isSuper(uid, CONFIG)) return true;
    if (asId(guild.ownerId) === uid) return true;
    return list(guild.id).some(e => e.id === uid);
}

// السيرفرات اللي هذا الحساب يقدر يدخل لوحتها (فوق الكل → كل السيرفرات)
function guildsOf(client, id, CONFIG = {}) {
    const uid = asId(id);
    const out = [];
    if (!client || !uid) return out;
    for (const g of client.guilds.cache.values()) {
        if (canUse(g, uid, CONFIG)) out.push(g);
    }
    return out;
}

// هل يقدر يدير قائمة المسموحين بهذا السيرفر؟ (فوق الكل · أو صاحب السيرفر)
function canManage(guild, id, CONFIG = {}) {
    if (!guild) return false;
    const uid = isId(id);
    if (!uid) return false;
    if (isSuper(uid, CONFIG)) return true;
    if (isNova(guild.id, CONFIG)) return false;   // قائمة سيرفرنا ما يلمسها غيرنا
    return isId(guild.ownerId) === uid;
}

// اسم الشخصة الملكية بهذا السيرفر (للنصوص) — بسيرفرنا نذكر الأسماء، بغيره «إدارة السيرفر»
const label = (gid, CONFIG = {}) => (isNova(gid, CONFIG) ? 'مولاي ارثر والملكة إيدا' : 'إدارة السيرفر');
const royalWord = (gid, CONFIG = {}) => (isNova(gid, CONFIG) ? 'الرتبة الملكية' : 'إدارة السيرفر');

// تنقية النصوص: بسيرفرنا ما نغيّر شي · بأي سيرفر ثاني نشيل أسماء ارثر/إيدا ونوفا ونحوّلها لكلام عام
function clean(text, guild, CONFIG = {}) {
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

// نص رفض الأمر حسب السيرفر (عشان ما نذكر ارثر/إيدا بغير سيرفرنا)
function denyText(guild, CONFIG = {}) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بمولاي ارثر والملكة إيدا وأصحاب الرتب بس! 💅';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر (صاحب السيرفر أو اللي عطاه صلاحية) فقط.';
}
function denyTextRanks(guild, CONFIG = {}) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بأهل الرتبة الملكية! 💅';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر فقط.';
}
// نص رفض خاص بأمر «لوحة التحكم» (بسيرفرنا يذكر الأسماء مثل قبل بالضبط)
function denyTextRoyal(guild, CONFIG = {}) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بمولاي ارثر والملكة إيدا والرتبة الملكية.';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر فقط.';
}
function denyTextOwner(guild, CONFIG = {}) {
    const gid = guild ? guild.id : '';
    if (isNova(gid, CONFIG)) return '⛔ هذا الأمر خاص بمولاي ارثر والملكة إيدا فقط! 👑';
    return '⛔ هذا الأمر خاص بإدارة هذا السيرفر فقط.';
}

module.exports = {
    FILE, list, add, remove, clear, has, isSuper, superIds, superSet, isNova,
    isRoyal, royalIds, guildsOf, canUse, canManage, label, royalWord, clean, isTop,
    denyText, denyTextRanks, denyTextOwner, denyTextRoyal
};
