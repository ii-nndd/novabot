// 💬 محرّر الردود الجديد (المرحلة ٢) — أقسام يكتبها صاحب السيرفر بنفسه.
// ----------------------------------------------------------------------------
//  الفكرة: كل «قسم» = اسم + إيموجي + مستهدف (شخص / رتبة / الكل) + مفاتيح تشغيل.
//    وكل «رد» = كلام العضو (الكلمة) + رد البوت — مع خيار «داخل الكلام» أو «مطابقة تامة».
//
//  ⚠️ هذا **طبقة جديدة مستقلة** فوق النظام القديم (`replies.js`) — ما نلمس
//     `replies.json` ولا `replies.seed.json` ولا سلوك نوفا الحالي إطلاقاً.
//     المحرّك يُسأل **قبل** أي رد قديم، ولو ما طابق شي يرجع الأمر للنظام القديم زي ما هو.
//
//  الأولوية (زي ما اتفقنا): 👤 شخص ← 🎭 رتبة ← 🌐 الكل
//    وبعدها: أطول كلمة مفتاحية تفوز (عشان «صباح الخير» تغلب «صباح»).
//
//  تعدد الردود لنفس الكلمة: أضف نفس الكلمة مرتين → البوت يختار **عشوائي** بينهم.
//
//  التخزين: replies2.json   { "<gid>": { sections: [ ... ] } }
//  يعرض: get · set · addSection · editSection · delSection · moveSection ·
//         addEntry · editEntry · delEntry · match · norm · fill · reset · DEF
// ============================================================================
const store = require('./store');
const access = require('./access');

const FILE = 'replies2.json';
const MAX_SECTIONS = 30;      // حد الأقسام لكل سيرفر
const MAX_ENTRIES = 80;       // حد الردود داخل القسم
const MAX_TRIGGER = 160;      // طول «كلام العضو»
const MAX_REPLY = 1500;       // طول «رد البوت»
const MIN_CONTAINS = 3;       // أقل طول للكلمة في وضع «داخل الكلام» (منع السبام)

const DEF = () => ({ name: 'قسم جديد', emoji: '💬', enabled: true, target: { type: 'all', id: '' }, anywhere: false, dm: false, entries: [] });

// ===== أدوات =====
const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const str = (v, n) => String(v == null ? '' : v).replace(/\r\n/g, '\n').slice(0, n).trim();
const digits = (v) => String(v == null ? '' : v).replace(/[^0-9]/g, '');

// تطبيع عربي: نشيل التشكيل والتطويل، نوحّد الألف/الهمزة والة/اله والى/الي، ونوّحد المسافات
function norm(t) {
    return String(t == null ? '' : t)
        .replace(/[\u064B-\u0652\u0640\u0670\u06D6-\u06ED]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىی]/g, 'ي')
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// متغيرات تتحول وقت الإرسال: {user} {name} {server}
function fill(t, o) {
    o = o || {};
    return String(t == null ? '' : t)
        .replace(/\{(user|منشن)\}/g, o.userId ? `<@${o.userId}>` : '')
        .replace(/\{(name|اسم)\}/g, o.displayName || '')
        .replace(/\{(server|سيرفر)\}/g, o.guildName || '');
}

// ===== تنظيف =====
function cleanEntry(e) {
    const t = str(e && e.t, MAX_TRIGGER);
    const r = [].concat((e && e.r) || []).map(x => str(x, MAX_REPLY)).filter(Boolean);
    return {
        id: String((e && e.id) || '') || nid('e'),
        t,
        mode: (e && e.mode === 'exact') ? 'exact' : 'contains',
        r: r.slice(0, 20),
        on: !(e && e.on === false)
    };
}

function cleanTarget(t) {
    t = t || {};
    const type = ['user', 'role'].includes(t.type) ? t.type : 'all';
    const id = type === 'all' ? '' : digits(t.id);
    if (type !== 'all' && id.length < 5) return { type: 'all', id: '' };
    return { type, id };
}

function cleanSection(s) {
    const entries = [].concat((s && s.entries) || [])
        .map(cleanEntry)
        .filter(e => e.t && e.r.length)
        .slice(0, MAX_ENTRIES);
    return {
        id: String((s && s.id) || '') || nid('s'),
        name: str(s && s.name, 40) || 'قسم جديد',
        emoji: str(s && s.emoji, 8) || '💬',
        enabled: !(s && s.enabled === false),
        target: cleanTarget(s && s.target),
        anywhere: !!(s && s.anywhere),
        dm: !!(s && s.dm),
        entries
    };
}

const raw = () => {
    const a = store.read(FILE, {});
    return a && typeof a === 'object' && !Array.isArray(a) ? a : {};
};

function get(gid) {
    const g = raw()[String(gid || '')];
    if (!g || !Array.isArray(g.sections)) return [];
    return g.sections.map(cleanSection).slice(0, MAX_SECTIONS);
}

function set(gid, sections) {
    const g = String(gid || '').replace(/[^0-9]/g, '');
    if (!g) return null;
    const a = raw();
    a[g] = { sections: [].concat(sections || []).map(cleanSection).slice(0, MAX_SECTIONS), at: Date.now() };
    store.write(FILE, a);
    return get(g);
}

// ===== الأقسام =====
function addSection(gid, body) {
    const b = body || {};
    const list = get(gid);
    if (list.length >= MAX_SECTIONS) throw new Error('وصلت حد الأقسام (' + MAX_SECTIONS + ')');
    const sec = cleanSection({
        name: str(b.name, 40) || 'قسم جديد',
        emoji: str(b.emoji, 8) || '💬',
        target: b.target,
        anywhere: !!b.anywhere,
        dm: !!b.dm,
        entries: []
    });
    list.push(sec);
    set(gid, list);
    return sec.id;
}

function editSection(gid, id, patch) {
    const list = get(gid);
    const i = list.findIndex(s => s.id === id);
    if (i < 0) throw new Error('القسم مو موجود');
    const p = patch || {};
    const s = list[i];
    if (p.name !== undefined) s.name = str(p.name, 40) || s.name;
    if (p.emoji !== undefined) s.emoji = str(p.emoji, 8) || s.emoji;
    if (p.enabled !== undefined) s.enabled = !!p.enabled;
    if (p.anywhere !== undefined) s.anywhere = !!p.anywhere;
    if (p.dm !== undefined) s.dm = !!p.dm;
    if (p.target !== undefined) s.target = cleanTarget(p.target);
    list[i] = cleanSection(s);
    set(gid, list);
    return list[i];
}

function delSection(gid, id) {
    const list = get(gid);
    const out = list.filter(s => s.id !== id);
    set(gid, out);
    return out;
}

function moveSection(gid, id, dir) {
    const list = get(gid);
    const i = list.findIndex(s => s.id === id);
    if (i < 0) return list;
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return list;
    const t = list[i]; list[i] = list[j]; list[j] = t;
    set(gid, list);
    return list;
}

// ===== الردود =====
function addEntry(gid, sid, body) {
    const list = get(gid);
    const i = list.findIndex(s => s.id === sid);
    if (i < 0) throw new Error('القسم مو موجود');
    if (list[i].entries.length >= MAX_ENTRIES) throw new Error('وصلت حد الردود بالقسم (' + MAX_ENTRIES + ')');
    const b = body || {};
    const e = cleanEntry({ t: b.t, mode: b.mode, r: b.r !== undefined ? b.r : [b.rText || b.r], on: true });
    if (!e.t) throw new Error('اكتب «كلام العضو» أول');
    if (!e.r.length) throw new Error('اكتب «رد البوت» أول');
    if (e.mode === 'contains' && norm(e.t).length < MIN_CONTAINS) throw new Error('كلمة «داخل الكلام» لازم ٣ أحرف على الأقل');
    list[i].entries.push(e);
    set(gid, list);
    return e;
}

function editEntry(gid, sid, eid, patch) {
    const list = get(gid);
    const i = list.findIndex(s => s.id === sid);
    if (i < 0) throw new Error('القسم مو موجود');
    const j = list[i].entries.findIndex(e => e.id === eid);
    if (j < 0) throw new Error('الرد مو موجود');
    const p = patch || {};
    const cur = list[i].entries[j];
    const next = cleanEntry({
        id: cur.id,
        t: p.t !== undefined ? p.t : cur.t,
        mode: p.mode !== undefined ? p.mode : cur.mode,
        r: p.r !== undefined ? p.r : (p.rText !== undefined ? [p.rText] : cur.r),
        on: p.on !== undefined ? p.on : cur.on
    });
    if (!next.t) throw new Error('اكتب «كلام العضو» أول');
    if (!next.r.length) throw new Error('اكتب «رد البوت» أول');
    if (next.mode === 'contains' && norm(next.t).length < MIN_CONTAINS) throw new Error('كلمة «داخل الكلام» لازم ٣ أحرف على الأقل');
    list[i].entries[j] = next;
    set(gid, list);
    return next;
}

function delEntry(gid, sid, eid) {
    const list = get(gid);
    const i = list.findIndex(s => s.id === sid);
    if (i < 0) throw new Error('القسم مو موجود');
    list[i].entries = list[i].entries.filter(e => e.id !== eid);
    set(gid, list);
    return list[i].entries;
}

function reset(gid) {
    const a = raw();
    delete a[String(gid || '')];
    store.write(FILE, a);
    return [];
}

// ===== المطابقة =====
const prio = (t) => (t && t.type === 'user' ? 3 : t && t.type === 'role' ? 2 : 1);

function targetOk(sec, member, userId, isDM) {
    const t = sec.target || { type: 'all', id: '' };
    if (t.type === 'user') return String(t.id) === String(userId || '');
    if (t.type === 'role') {
        if (isDM) return false;
        return !!(member && member.roles && member.roles.cache && member.roles.cache.has(String(t.id)));
    }
    return true;
}

/**
 * match({ gid, member, userId, content, called, isDM, guildName, displayName })
 * ترجع { text, section, entryId } أو null
 */
function match(o) {
    o = o || {};
    const gid = o.gid;
    if (!gid) return null;
    if (!access.isApproved(gid)) return null;          // 🔒 سيرفر مقفول
    const secs = get(gid);
    if (!secs.length) return null;
    const content = norm(o.content);
    if (!content) return null;
    const isDM = !!o.isDM;

    const usable = (sec) => {
        if (!sec.enabled) return false;
        if (isDM && !sec.dm) return false;              // أقسام الخاص: لازم تفعيل «تشغل بالخاص»
        if (!targetOk(sec, o.member, o.userId, isDM)) return false;
        if (!isDM && !o.called && !sec.anywhere) return false;   // بدون مناداة؟ لازم القسم يسمح
        return true;
    };

    let best = null;
    for (const sec of secs) {
        if (!usable(sec)) continue;
        const p = prio(sec.target);
        for (const e of sec.entries) {
            if (!e.on) continue;
            const key = norm(e.t);
            if (!key) continue;
            let hit = false;
            if (e.mode === 'exact') hit = content === key;
            else { if (key.length < MIN_CONTAINS) continue; hit = content.includes(key); }
            if (!hit) continue;
            const c = { sec, e, p, len: key.length, key };
            if (!best || c.p > best.p || (c.p === best.p && c.len > best.len)) best = c;
        }
    }
    if (!best) return null;

    // نجمع كل الردود بنفس الأولوية ونفس الكلمة → اختيار عشوائي (تنويع)
    const pool = [];
    for (const sec of secs) {
        if (!usable(sec)) continue;
        if (prio(sec.target) !== best.p) continue;
        for (const e of sec.entries) {
            if (!e.on || norm(e.t) !== best.key) continue;
            for (const r of e.r) pool.push(r);
        }
    }
    const list = pool.length ? pool : best.e.r;
    const text = fill(list[Math.floor(Math.random() * list.length)], o);
    return { text, section: best.sec.name, entryId: best.e.id, sectionId: best.sec.id };
}

module.exports = {
    get, set, addSection, editSection, delSection, moveSection,
    addEntry, editEntry, delEntry, reset, match, norm, fill, cleanSection,
    MAX_SECTIONS, MAX_ENTRIES, MAX_TRIGGER, MAX_REPLY, MIN_CONTAINS, DEF
};
