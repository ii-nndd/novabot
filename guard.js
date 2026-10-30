// 🛡️ درع نوفا — حماية السيرفر من النك والاختراق (Anti-Nuke / Anti-Raid)
//
// يغطي بإذن الله كل أنواع التخريب المعروفة:
//   • حذف الرومات بالجملة        → عقوبة + إعادة إنشاء الروم المحذوف بنفس شكله
//   • إنشاء رومات بالجملة        → عقوبة + حذف المسوي
//   • حذف/إنشاء الرتب بالجملة    → عقوبة + إعادة الرتبة المحذوفة (اسم/لون/صلاحيات/ترتيب)
//   • حظر أو طرد الأعضاء بالجملة → عقوبة + فك حظر المظلومين
//   • إعطاء رتبة خطيرة لأي أحد   → تُسحب فوراً (حتى لو أعطاها أدمن)
//   • تعديل صلاحيات @everyone أو أي رتبة → تُرجَّع من لقطة محفوظة
//   • ويب هوكس / إيموجي / دعوات بالجملة  → تُحذف + عقوبة
//   • تغيير اسم السيرفر أو أيقونته        → يُرجَّع
//   • رايد (دخول أعضاء بالجملة)          → قفل فوري + طرد الحسابات الجديدة
//   • سبام / رسائل مكررة / منشن جماعي / روابط → حذف + كتم
//   • زر «قفل السيرفر فوراً» (Panic) من اللوحة أو من ديسكورد
//
// القاعدة الذهبية: كل شي يشتغل تلقائياً، ولو ما قدرنا نعاقب (رتبة البوت أقل) ننبّه فوراً ونرجّع اللي انخرب.
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, AuditLogEvent, AttachmentBuilder } = require('discord.js');
const store = require('./store');
const art = require('./art');
const access = require('./access');

const EPH = MessageFlags.Ephemeral;
const P = PermissionFlagsBits;

let CONFIG = {};            // آيديات السيرفر (تجي من index.js) — ارثر/إيدا/الرتبة الملكية
const clientRef = { c: null };

// صلاحيات «خطيرة» ما نسمح أبداً أنها تنعطى بالغلط أو بالاختراق
const SEVERE = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'BanMembers', 'KickMembers', 'ManageWebhooks', 'ModerateMembers'];
const SEVERE_BITS = SEVERE.reduce((a, k) => a | BigInt(P[k] || 0), 0n);
const hasSevere = (bit) => (BigInt(bit || 0) & SEVERE_BITS) !== 0n;

// أنواع الأحداث اللي نعاقب عليها بطريقة الحماية المختارة (ban/kick/derole)
const HARD = ['channelDelete', 'channelCreate', 'roleDelete', 'roleCreate', 'ban', 'kick', 'webhook', 'invite', 'overwrite', 'emoji'];

const DEF = {
    enabled: true,
    mode: 'ban',            // العقوبة: ban (حظر) | kick (طرد) | derole (سحب كل رتبه)
    protectOwners: false,   // لو فعّلت: حتى ارثر وإيدا والرتبة الملكية ينعاقبون (أقصى حماية)
    strictAll: false,       // عاقب على كل محاولة (حتى تغيير الصلاحيات وإعطاء الرتب)، مو بس التخريب الجماعي
    punishBots: false,      // عاقب البوتات الثانية مثل الأعضاء (افتراضياً: تنبيه فقط)
    revert: true,           // إرجاع اللي خربه المخرب (رومات/رتب/حظر/صلاحيات)
    windowSec: 10,          // نافذة العدّ: كم ثانية نحسب فيها التكرار
    alertChannelId: '',     // روم التنبيهات (فاضي = رسالة خاصة للملكي)
    alertDM: true,          // يرسل كذلك رسالة خاصة للملكي
    alertUsers: [],         // آيديات إضافية ينرسل لها التنبيه بالخاص (غير ارثر/إيدا/صاحب السيرفر)
    limits: {
        channelDelete: 3, channelCreate: 6, roleDelete: 3, roleCreate: 6,
        roleUpdate: 6, ban: 3, kick: 3, webhook: 3, emoji: 5, invite: 6, overwrite: 8
    },
    whitelist: { users: [], roles: [], bots: [] },
    raid: { enabled: true, joins: 8, sec: 20, minDays: 7, kickNew: true, autoUnlockMin: 15 },
    spam: { enabled: true, msgs: 7, sec: 5, dupMsgs: 4, mentions: 6, timeoutMin: 10 }
};

const all = () => store.read('guardcfg.json', {});
const ids = (v) => [...new Set(String(v || '').split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d{5,25}$/.test(s)))];
const clampNum = (v, a, b, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };

// ===== الإعدادات =====
function get(gid) {
    const c = all()[gid] || {};
    const w = c.whitelist || {};
    return {
        ...DEF, ...c,
        limits: { ...DEF.limits, ...(c.limits || {}) },
        whitelist: { users: ids((w.users || []).join(' ')), roles: ids((w.roles || []).join(' ')), bots: ids((w.bots || []).join(' ')) },
        alertUsers: ids((c.alertUsers || []).join(' ')),
        raid: { ...DEF.raid, ...(c.raid || {}) },
        spam: { ...DEF.spam, ...(c.spam || {}) }
    };
}

function set(gid, b) {
    const mode = ['ban', 'kick', 'derole'].includes(String(b.mode)) ? String(b.mode) : 'ban';
    const lim = b.limits || {};
    const a = all();
    const cur = get(gid);
    a[gid] = {
        enabled: 'enabled' in b ? !!b.enabled : cur.enabled,
        mode,
        protectOwners: 'protectOwners' in b ? !!b.protectOwners : cur.protectOwners,
        strictAll: 'strictAll' in b ? !!b.strictAll : cur.strictAll,
        punishBots: 'punishBots' in b ? !!b.punishBots : cur.punishBots,
        revert: 'revert' in b ? !!b.revert : cur.revert,
        windowSec: clampNum(b.windowSec, 3, 120, cur.windowSec),
        alertChannelId: b.alertChannelId !== undefined
            ? (/^\d{5,25}$/.test(String(b.alertChannelId)) ? String(b.alertChannelId) : '')
            : cur.alertChannelId,
        alertDM: 'alertDM' in b ? !!b.alertDM : cur.alertDM,
        alertUsers: ids(b.alertUsersText !== undefined ? b.alertUsersText : (cur.alertUsers || []).join(' ')),
        limits: {
            channelDelete: clampNum(lim.channelDelete ?? b.channelDelete, 1, 50, cur.limits.channelDelete),
            channelCreate: clampNum(lim.channelCreate ?? b.channelCreate, 1, 50, cur.limits.channelCreate),
            roleDelete: clampNum(lim.roleDelete ?? b.roleDelete, 1, 50, cur.limits.roleDelete),
            roleCreate: clampNum(lim.roleCreate ?? b.roleCreate, 1, 50, cur.limits.roleCreate),
            roleUpdate: clampNum(lim.roleUpdate ?? b.roleUpdate, 1, 50, cur.limits.roleUpdate),
            ban: clampNum(lim.ban ?? b.ban, 1, 50, cur.limits.ban),
            kick: clampNum(lim.kick ?? b.kick, 1, 50, cur.limits.kick),
            webhook: clampNum(lim.webhook ?? b.webhook, 1, 50, cur.limits.webhook),
            emoji: clampNum(lim.emoji ?? b.emoji, 1, 50, cur.limits.emoji),
            invite: clampNum(lim.invite ?? b.invite, 1, 50, cur.limits.invite),
            overwrite: clampNum(lim.overwrite ?? b.overwrite, 1, 50, cur.limits.overwrite)
        },
        whitelist: {
            users: ids(b.usersText !== undefined ? b.usersText : (cur.whitelist.users || []).join(' ')),
            bots: ids(b.botsText !== undefined ? b.botsText : (cur.whitelist.bots || []).join(' ')),
            roles: Array.isArray(b.roleIds) ? ids(b.roleIds.join(' ')) : cur.whitelist.roles
        },
        raid: {
            enabled: 'raidEnabled' in b ? !!b.raidEnabled : cur.raid.enabled,
            joins: clampNum(b.joins, 2, 100, cur.raid.joins),
            sec: clampNum(b.raidSec, 3, 600, cur.raid.sec),
            minDays: clampNum(b.minDays, 0, 365, cur.raid.minDays),
            kickNew: 'kickNew' in b ? !!b.kickNew : cur.raid.kickNew,
            autoUnlockMin: clampNum(b.autoUnlockMin, 0, 1440, cur.raid.autoUnlockMin)
        },
        spam: {
            enabled: 'spamEnabled' in b ? !!b.spamEnabled : cur.spam.enabled,
            msgs: clampNum(b.spamMsgs, 3, 60, cur.spam.msgs),
            sec: clampNum(b.spamSec, 2, 60, cur.spam.sec),
            dupMsgs: clampNum(b.dupMsgs, 2, 20, cur.spam.dupMsgs),
            mentions: clampNum(b.mentions, 3, 50, cur.spam.mentions),
            timeoutMin: clampNum(b.timeoutMin, 1, 1440, cur.spam.timeoutMin)
        }
    };
    store.write('guardcfg.json', a);
    return a[gid];
}

// ===== سجل الحوادث =====
const logsAll = () => store.read('guardlog.json', {});
function incidents(gid, limit = 40) {
    const arr = logsAll()[gid] || [];
    return arr.slice(0, limit);
}
function addIncident(gid, rec) {
    const a = logsAll();
    const arr = a[gid] || [];
    arr.unshift(rec);
    a[gid] = arr.slice(0, 120);
    store.write('guardlog.json', a);
}
function clearIncidents(gid) {
    const a = logsAll();
    a[gid] = [];
    store.write('guardlog.json', a);
}

// ===== عدّادات التكرار =====
const buckets = new Map();   // "gid:key:type" -> [timestamps]
const dups = new Map();      // "gid:uid" -> [{ at, hash }] (لرصد تكرار نفس الرسالة)
function hit(gid, key, type, windowMs, bucketKey) {
    const k = `${gid}:${bucketKey || key}:${type}`;
    const now = Date.now();
    let arr = buckets.get(k);
    if (!arr) { arr = []; buckets.set(k, arr); }
    while (arr.length && arr[0] < now - windowMs) arr.shift();
    arr.push(now);
    return arr.length;
}
setInterval(() => {
    const cut = Date.now() - 10 * 60_000;
    for (const [k, arr] of buckets) {
        while (arr.length && arr[0] < cut) arr.shift();
        if (!arr.length) buckets.delete(k);
    }
}, 5 * 60_000).unref?.();

// طباعة الأخطاء مرة كل ٥ دقايق لكل نوع (عشان ما تغرق الكونسول وما تنبلع بصمت)
const lastErr = new Map();
function logErr(what, err) {
    const now = Date.now();
    if (now - (lastErr.get(what) || 0) < 300_000) return;
    lastErr.set(what, now);
    console.error(`❌ درع نوفا (${what}):`, err && err.message ? err.message : err);
}

// ===== الحصانة: منو ما نعاقبه =====
function immune(guild, uid, member) {
    if (!uid || !guild) return true;
    const cfg = get(guild.id);
    if (uid === guild.client.user.id) return true;          // البوت نفسه (كل إجراءاتنا من هنا)
    if (uid === guild.ownerId) return true;                 // صاحب السيرفر
    if (!cfg.protectOwners) {
        // 🌐 سيرفرنا: ارثر/إيدا/الرتبة الملكية · أي سيرفر ثاني: صاحب السيرفر + اللي أعطاه صلاحية الدخول
        const raw = String(uid);
        const ids = [CONFIG && CONFIG.ARTHUR_ID, CONFIG && CONFIG.SPECIAL_USER_ID]
            .map(x => String(x || '')).filter(Boolean);
        if (ids.includes(raw) || access.isSuper(uid, CONFIG)) return true;   // ارثر/إيدا دايماً محصّنين
        const m = member || guild.members.cache.get(uid);
        if (m && access.isRoyal(guild, m, CONFIG)) return true;
    }
    if (cfg.whitelist.users.includes(uid)) return true;
    if (cfg.whitelist.bots.includes(uid)) return true;
    const m = member || guild.members.cache.get(uid);
    if (m && cfg.whitelist.roles.some(r => m.roles.cache.has(r))) return true;
    if (m && m.user.bot && !cfg.punishBots) return true;    // بوت ثاني: تنبيه فقط (إلا لو فعّلت عقاب البوتات)
    return false;
}

// ===== سجل التدقيق: منو سوى الفعل؟ =====
const auditCache = new Map();   // "gid:type" -> { at, entries }
async function auditEntries(guild, type) {
    const k = `${guild.id}:${type}`;
    const c = auditCache.get(k);
    if (c && Date.now() - c.at < 4000) return c.entries;
    const entries = [];
    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 8 });
        for (const e of logs.entries.values()) entries.push({
            id: e.id, action: e.action, executorId: e.executorId,
            targetId: e.target && e.target.id, created: e.createdTimestamp,
            changes: e.changes || [], extra: e.extra || null
        });
    } catch (err) { logErr('سجل التدقيق', err); }
    auditCache.set(k, { at: Date.now(), entries });
    return entries;
}

// يرجع آيدي الفاعل (وحسابه) من سجل التدقيق لو الفعل صار قبل ثوانٍ
async function actorOf(guild, type, targetId, withinMs) {
    const entries = await auditEntries(guild, type);
    const now = Date.now();
    const lim = withinMs || Math.max(12000, get(guild.id).windowSec * 1000 + 4000);
    for (const e of entries) {
        if (now - e.created > lim) continue;
        if (targetId && e.targetId && e.targetId !== targetId) continue;
        if (e.executorId && e.executorId === guild.client.user.id) continue;
        return e.executorId;
    }
    return null;
}

// ===== التنبيه المصمم =====
// روم التنبيهات: المحدد من اللوحة → وإلا ندوّر روم اسمه تنبيهات/حماية/سجل → وإلا روم السجل العام
function alertChannelOf(guild, cfg) {
    const ok = (c) => !!c && typeof c.isTextBased === 'function' && c.isTextBased() && !(typeof c.isThread === 'function' && c.isThread());
    const pick = (id) => {
        const c = id && guild.channels.cache.get(String(id));
        return ok(c) ? c : null;
    };
    const fixed = pick(cfg && cfg.alertChannelId);
    if (fixed) return { ch: fixed, auto: false };
    const log = pick(CONFIG && CONFIG.LOG_CHANNEL_ID);
    if (log) return { ch: log, auto: true };
    const pat = /تنبيه|حماي|alert|guard|سجل|log|أمن|امن/i;
    const list = [...guild.channels.cache.values()].filter(ok);
    const byName = list.find(c => pat.test(String(c.name || '')));
    if (byName) return { ch: byName, auto: true };
    const sys = guild.systemChannel;
    if (ok(sys)) return { ch: sys, auto: true };
    return { ch: null, auto: true };
}

// 🔔 حركة من حساب مستثنى (ملكي/صاحب السيرفر/بالقائمة) — ننبّه ولا نعاقب
//    (قبل كذا كانت تنبلع بصمت فيظن إن الحماية ما تشتغل)
const noticeCache = new Map();
async function exemptNote(guild, uid, type, detail) {
    if (!guild || !uid) return;
    const cfg = get(guild.id);
    if (!cfg.enabled) return;
    const k = `${guild.id}:${uid}:${type}`;
    const now = Date.now();
    if (now - (noticeCache.get(k) || 0) < 60_000) return;   // مرة كل دقيقة لنفس الشخص/النوع
    noticeCache.set(k, now);
    const member = guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null);
    const name = member ? member.displayName : uid;
    await notify(guild, {
        title: 'حركة من حساب مستثنى 🔔',
        lines: [
            `**النوع:** ${reasonOf(type, detail)}`,
            `**الحساب:** <@${uid}> (\`${uid}\`) — ${name}`,
            '**العقوبة:** ما عاقبناه — مستثنى (ملكي · صاحب السيرفر · بالقائمة)',
            '**ملاحظة:** لو هذا تخريب حقيقي، فعّل «حماية المسؤولين» من صفحة الحماية 🛡️'
        ],
        culprit: uid, culpritName: name,
        avatarURL: member ? member.displayAvatarURL({ extension: 'png', size: 256 }) : null,
        stats: [{ label: 'الحالة', value: 'مستثنى' }, { label: 'النوع', value: type }],
        tone: HARD.includes(type) ? 'bad' : 'good'
    });
}

async function notify(guild, { title, lines, culprit, culpritName, avatarURL, stats, tone = 'bad' }) {
    const cfg = get(guild.id);
    const rep = { art: false, channel: '', dm: '', channelId: cfg.alertChannelId || '', dmOn: !!cfg.alertDM };
    const text = [`🛡️ **درع نوفا** — ${title}`, ...lines].join('\n');
    let payload = { content: text.slice(0, 1900) };
    if (art.available()) {
        const png = await art.guard(art.noticeCard({
            title, iconName: 'shield', lines, tone,
            avatarURL, name: culpritName, sub: culprit ? `آيدي: ${culprit}` : '',
            stats: stats || [], server: guild.name
        }), 7000, 'بطاقة التنبيه الأمني');
        if (png) {
            rep.art = true;
            const e = new EmbedBuilder().setColor(tone === 'bad' ? 0xb3121e : 0x2f7d4f).setImage('attachment://alert.png')
                .setDescription(lines.join('\n').slice(0, 400));
            payload = { embeds: [e], files: [new AttachmentBuilder(png, { name: 'alert.png' })] };
            // المنشنات (للملكي) تنرسل نصاً عشان التنبيه يوصل بأسرع وقت
            const pingIds = access.royalIds(guild, CONFIG);
            const ping = pingIds.map(id => `<@${id}>`).join(' ');
            payload.content = `${ping} 🚨 ${title}`.slice(0, 1800);
            payload.allowedMentions = { users: pingIds };
        }
    }
    if (!payload.embeds) {
        const pingIds = access.royalIds(guild, CONFIG);
        payload = {
            content: ([pingIds.map(id => `<@${id}>`).join(' '), `**🛡️ درع نوفا — ${title}**`, ...lines].join('\n')).slice(0, 1900),
            allowedMentions: { users: pingIds }
        };
        const why = art.available() ? 'فشل رسم الصورة (رجّعنا نص)' : 'محرك الصور مو متاح (نص فقط)';
        rep.art = false; rep.artNote = why;
    }
    let target = null;
    if (cfg.alertChannelId) {
        try {
            target = guild.channels.cache.get(cfg.alertChannelId) || await guild.channels.fetch(cfg.alertChannelId).catch(() => null);
        } catch { target = null; }
        if (target && !(typeof target.isTextBased === 'function' && target.isTextBased())) target = null;
    }
    const usedAuto = !target;
    if (!target) { const f = alertChannelOf(guild, cfg); target = f.ch; }
    if (target) {
        try { await target.send(payload); rep.channel = '✅ أُرسل إلى #' + target.name + (usedAuto ? ' (تلقائي)' : ''); }
        catch (err) { rep.channel = '⛔ فشل: ' + (err && err.message || err); logErr('إرسال التنبيه بالروم', err); }
    } else rep.channel = '⚠️ ما فيه روم تنبيهات — سوّ روم اسمه «تنبيهات» أو حدّده من الصفحة';
    if (cfg.alertDM) {
        // ديسكورد يرفض الخاص لو البوت ما يشارك الحساب أي سيرفر → نرسل لكل مسؤول «موجود فعلاً بالسيرفر»
        const nameOf = (id) => id === CONFIG.ARTHUR_ID ? 'ارثر' : id === CONFIG.SPECIAL_USER_ID ? 'إيدا'
            : id === guild.ownerId ? 'صاحب السيرفر' : 'مسؤول';
        const targets = access.royalIds(guild, CONFIG).map(id => [nameOf(id), id])
            .concat((cfg.alertUsers || []).map(id => ['إضافي', id]))
            .filter(t => t[1]).filter((t, i, a) => a.findIndex(x => x[1] === t[1]) === i);
        const out = [];
        for (const [label, id] of targets) {
            let mem = guild.members.cache.get(id) || null;
            if (!mem) { try { mem = await guild.members.fetch(id); } catch { mem = null; } }
            if (!mem) { out.push('⚠️ ' + label + ' (' + id + ') مو بالسيرفر'); continue; }
            try {
                const u = mem.user || await guild.client.users.fetch(id);
                await u.send(payload);
                out.push('✅ ' + (mem.displayName || u.username || label));
            } catch (err) { out.push('⛔ ' + label + ': ' + (err && err.message || err)); logErr('إرسال التنبيه بالخاص', err); }
        }
        rep.dm = out.length ? out.join(' · ') : '⚠️ ما فيه حساب محدد للتنبيه';
    } else rep.dm = '⚠️ مفتاح «التنبيه بالخاص» مطفي';
    return rep;
}

// ===== العقوبة =====
function reasonOf(type, detail) {
    const names = {
        channelDelete: 'حذف رومات بالجملة', channelCreate: 'إنشاء رومات بالجملة', roleDelete: 'حذف رتب بالجملة',
        roleCreate: 'إنشاء رتب بالجملة', ban: 'حظر أعضاء بالجملة', kick: 'طرد أعضاء بالجملة', webhook: 'إنشاء ويب هوكس بالجملة',
        emoji: 'حذف إيموجيات بالجملة', invite: 'إنشاء دعوات بالجملة', overwrite: 'تخريب صلاحيات الرومات',
        roleGrant: 'إعطاء رتبة خطيرة', rolePerm: 'تعديل صلاحيات رتبة', everyonePerm: 'تعديل صلاحيات @everyone', guildUpdate: 'تخريب إعدادات السيرفر'
    };
    return `🛡️ درع نوفا: ${names[type] || 'محاولة تخريب'}${detail ? ' — ' + detail : ''}`;
}

async function punish(guild, uid, type, detail) {
    const cfg = get(guild.id);
    const me = guild.members.me;
    const member = guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null);
    const reason = reasonOf(type, detail);
    let action = 'تنبيه فقط (رتبة البوت أقل من المخرب أو الصلاحيات ناقصة)';
    try {
        const canAct = me && member && member.id !== guild.ownerId && me.roles.highest.position > member.roles.highest.position;
        if (canAct) {
            if (cfg.mode === 'kick') {
                if (me.permissions.has(P.KickMembers)) { await member.kick(reason); action = 'طرد فوري'; }
            } else if (cfg.mode === 'derole') {
                if (me.permissions.has(P.ManageRoles)) {
                    const roles = member.roles.cache.filter(r => r.id !== guild.id && !r.managed && me.roles.highest.position > r.position);
                    if (roles.size) { await member.roles.remove(roles, reason); action = `سحب كل رتبه (${roles.size})`; }
                }
            } else {
                if (me.permissions.has(P.BanMembers)) { await member.ban({ reason }); action = 'حظر فوري'; }
            }
        }
    } catch (err) { logErr('تنفيذ العقوبة', err); action = 'فشلت العقوبة: ' + err.message; }
    return action;
}

// ===== إرجاع اللي انخرب =====
async function restoreChannel(guild, ch) {
    try {
        if (!ch || !ch.name) return null;
        if (typeof ch.isThread === 'function' && ch.isThread()) return null;
        const same = guild.channels.cache.find(c => c.name === ch.name && c.type === ch.type);
        if (same) return null;
        const opts = {
            name: ch.name, type: ch.type, position: ch.rawPosition ?? ch.position,
            permissionOverwrites: [...(ch.permissionOverwrites?.cache?.values?.() || [])].map(o => ({ id: o.id, allow: o.allow.bitfield, deny: o.deny.bitfield })),
            reason: '🛡️ درع نوفا: إرجاع روم حذفه مخرب'
        };
        if (ch.parentId) opts.parent = ch.parentId;
        if ('topic' in ch && ch.topic) opts.topic = ch.topic;
        if ('nsfw' in ch) opts.nsfw = !!ch.nsfw;
        if ('rateLimitPerUser' in ch) opts.rateLimitPerUser = ch.rateLimitPerUser || 0;
        if ('userLimit' in ch) opts.userLimit = ch.userLimit || 0;
        if ('bitrate' in ch && ch.bitrate) opts.bitrate = ch.bitrate;
        return await guild.channels.create(opts);
    } catch (err) { logErr('إرجاع روم', err); return null; }
}

async function restoreRole(guild, role) {
    try {
        if (!role || !role.name || role.managed) return null;
        const same = guild.roles.cache.find(r => r.name === role.name && r.permissions.bitfield === role.permissions.bitfield);
        if (same) return null;
        return await guild.roles.create({
            name: role.name, color: role.color, hoist: !!role.hoist, mentionable: !!role.mentionable,
            permissions: role.permissions.bitfield, position: role.position,
            reason: '🛡️ درع نوفا: إرجاع رتبة حذفها مخرب'
        });
    } catch (err) { logErr('إرجاع رتبة', err); return null; }
}

async function restoreEmoji(guild, emoji) {
    try {
        if (!emoji || !emoji.name) return null;
        if (guild.emojis.cache.find(e => e.name === emoji.name)) return null;
        return await guild.emojis.create({ attachment: emoji.imageURL({ size: 128 }), name: emoji.name, reason: '🛡️ درع نوفا: إرجاع إيموجي حذفه مخرب' });
    } catch (err) { logErr('إرجاع إيموجي', err); return null; }
}

// فك حظر كل من حظره المخرب بنفس النافذة
async function unbanBy(guild, uid, type, limitMs) {
    const entries = await auditEntries(guild, type);
    const now = Date.now();
    let n = 0;
    for (const e of entries) {
        if (e.executorId !== uid) continue;
        if (now - e.created > limitMs) continue;
        if (!e.targetId) continue;
        try { await guild.members.unban(e.targetId, '🛡️ درع نوفا: فك حظر مظلوم'); n++; } catch {}
    }
    return n;
}

// ===== اللقطات (نقطة رجوع لصلاحيات الرتب والرومات) =====
const snaps = new Map();   // gid -> { at, roles, channels, name, icon }
function snapshot(guild) {
    const roles = {};
    for (const r of guild.roles.cache.values()) roles[r.id] = { name: r.name, permissions: r.permissions.bitfield.toString(), color: r.color, hoist: r.hoist, mentionable: r.mentionable, position: r.position };
    const channels = {};
    for (const c of guild.channels.cache.values()) {
        if (!c.permissionOverwrites) continue;
        const ow = {};
        for (const o of c.permissionOverwrites.cache.values()) ow[o.id] = { allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() };
        channels[c.id] = ow;
    }
    snaps.set(guild.id, { at: Date.now(), roles, channels, name: guild.name, icon: guild.icon });
    return snaps.get(guild.id);
}
const snapOf = (guild) => snaps.get(guild.id) || snapshot(guild);

// يرجّع صلاحيات الرومات لحالتها باللقطة (إرجاع دقيق: نستبدل قائمة الصلاحيات بنسخة اللقطة)
async function restoreOverwrites(guild, snap) {
    let n = 0;
    await guild.channels.fetch().catch(() => {});
    for (const ch of guild.channels.cache.values()) {
        const want = snap.channels[ch.id];
        if (!want || !ch.permissionOverwrites) continue;
        const list = Object.entries(want).map(([id, ow]) => ({ id, allow: BigInt(ow.allow), deny: BigInt(ow.deny) }));
        // هل فيه فرق فعلاً؟ (عشان ما نعدل بلا داعي)
        const cur = [...ch.permissionOverwrites.cache.values()];
        const same = cur.length === list.length && list.every(o => {
            const c = ch.permissionOverwrites.cache.get(o.id);
            return c && c.allow.bitfield === o.allow && c.deny.bitfield === o.deny;
        });
        if (same) continue;
        try { await ch.permissionOverwrites.set(list, '🛡️ درع نوفا: إرجاع صلاحيات الروم'); n++; } catch {}
    }
    return n;
}

async function restoreRolePerms(guild, snap) {
    let n = 0;
    for (const r of guild.roles.cache.values()) {
        const want = snap.roles[r.id];
        if (!want) continue;
        if (r.permissions.bitfield.toString() === want.permissions) continue;
        try { await r.setPermissions(BigInt(want.permissions), '🛡️ درع نوفا: إرجاع صلاحيات الرتبة'); n++; } catch {}
    }
    return n;
}

// ===== القفل الفوري (Panic / Lockdown) =====
const LOCK_KEYS = ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions', 'CreateInstantInvite', 'Connect', 'Speak'];
const lockTimers = new Map();   // gid -> Timeout (فتح تلقائي)
const lockAll = () => store.read('guardlock.json', {});
const isLocked = (gid) => !!lockAll()[gid];

async function lockdown(guild, on, opt = {}) {
    const rec = lockAll();
    if (on) {
        if (rec[guild.id]) return { already: true, locked: true, at: rec[guild.id].at };
        const saved = {};
        await guild.channels.fetch().catch(() => {});
        let n = 0;
        for (const ch of guild.channels.cache.values()) {
            if (!ch.permissionOverwrites) continue;
            if (typeof ch.isThread === 'function' && ch.isThread()) continue;
            const ow = ch.permissionOverwrites.cache.get(guild.id);
            saved[ch.id] = ow ? { allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString() } : null;
            const edit = {};
            for (const k of LOCK_KEYS) edit[k] = false;
            try { await ch.permissionOverwrites.edit(guild.id, edit, { reason: '🛡️ درع نوفا: قفل طوارئ' }); n++; } catch {}
        }
        const entry = { at: Date.now(), by: opt.by || 'درع نوفا', reason: opt.reason || '', saved };
        rec[guild.id] = entry;
        store.write('guardlock.json', rec);
        // فتح تلقائي بعد مدة (لقفل الرايد) عشان ما ينسى أحد يفتحه
        if (lockTimers.has(guild.id)) clearTimeout(lockTimers.get(guild.id));
        if (opt.autoUnlockMin > 0) {
            lockTimers.set(guild.id, setTimeout(() => {
                lockdown(guild, false, { by: 'فتح تلقائي' }).catch(() => {});
            }, opt.autoUnlockMin * 60_000));
        }
        return { locked: true, channels: n, saved };
    }
    const entry = rec[guild.id];
    if (!entry) return { already: true, locked: false };
    if (lockTimers.has(guild.id)) { clearTimeout(lockTimers.get(guild.id)); lockTimers.delete(guild.id); }
    let n = 0;
    for (const [cid, ow] of Object.entries(entry.saved || {})) {
        const ch = guild.channels.cache.get(cid);
        if (!ch || !ch.permissionOverwrites) continue;
        const edit = {};
        for (const k of LOCK_KEYS) {
            if (!ow) { edit[k] = null; continue; }
            const bit = BigInt(P[k] || 0);
            const allow = BigInt(ow.allow), deny = BigInt(ow.deny);
            edit[k] = (allow & bit) ? true : (deny & bit) ? false : null;
        }
        try { await ch.permissionOverwrites.edit(guild.id, edit, { reason: '🛡️ درع نوفا: فتح السيرفر' }); n++; } catch {}
    }
    delete rec[guild.id];
    store.write('guardlock.json', rec);
    return { locked: false, channels: n };
}

// ===== قلب النظام: حدث مشتبه فيه =====
async function threat(guild, { type, uid, detail, count, hard, revert }) {
    if (!guild) return null;
    const cfg = get(guild.id);
    const known = !!uid;
    const member = known ? (guild.members.cache.get(uid) || await guild.members.fetch(uid).catch(() => null)) : null;
    const name = member ? member.displayName : (known ? uid : 'غير معروف');

    const undone = [];
    if (cfg.revert && revert) {
        try { undone.push(...(await revert())); } catch (err) { logErr('إرجاع التخريب', err); }
    }
    // العقوبة: أنواع التخريب الجماعي دايماً، وغيرها لو «عاقب على كل محاولة» أو حقل hard
    let action = 'تنبيه فقط';
    const wantPunish = known && (hard || cfg.strictAll);
    if (wantPunish) action = await punish(guild, uid, type, detail);
    else if (!known) action = 'تنبيه فقط — ما عرفنا الفاعل (ناقص صلاحية «سجل التدقيق»؟)';

    const rec = {
        at: Date.now(), type, uid, name,
        detail: detail || '', count: count || 0, action,
        undone: undone.filter(Boolean).length
    };
    addIncident(guild.id, rec);

    const lines = [
        `**النوع:** ${reasonOf(type, detail)}`,
        known ? `**المخرب:** <@${uid}> (\`${uid}\`) — ${name}` : '**المخرب:** ❓ غير معروف — تأكد إن البوت عنده صلاحية **«سجل التدقيق / View Audit Log»**',
        count ? `**خلال النافذة:** ${count} حركة` : '',
        undone.filter(Boolean).length ? `**رجعنا:** ${undone.filter(Boolean).join(' · ')}` : '',
        `**العقوبة:** ${action}`
    ].filter(Boolean);
    await notify(guild, {
        title: 'تصدّينا لمحاولة تخريب 🛡️', lines, culprit: uid, culpritName: name,
        avatarURL: member ? member.displayAvatarURL({ extension: 'png', size: 256 }) : null,
        stats: [{ label: 'حركات', value: count || 1 }, { label: 'رجعنا', value: undone.filter(Boolean).length }]
    });
    // نسجل بالسجل العام للوحة (صفحة السجل)
    try {
        const g = store.read('log.json', []);
        g.unshift({ msg: `🛡️ درع نوفا: ${reasonOf(type, detail)} — ${name} — ${action}`, by: 'درع نوفا', at: Date.now(), gid: guild.id });
        store.write('log.json', g.slice(0, 300));
    } catch {}
    return action;
}

// ❓ حركة مشبوهة وما قدرنا نعرف الفاعل (ناقص صلاحية سجل التدقيق) — ننبّه ولا نرجّع شي
const unknownCache = new Map();
async function unknownNote(guild, type, detail) {
    if (!guild) return;
    const cfg = get(guild.id);
    if (!cfg.enabled) return;
    const k = `${guild.id}:${type}`;
    const now = Date.now();
    if (now - (unknownCache.get(k) || 0) < 5000) return;   // ما نزعج: مرة كل ٥ ثواني لكل نوع
    unknownCache.set(k, now);
    await notify(guild, {
        title: 'حركة مشبوهة — ما عرفنا الفاعل ❓',
        lines: [
            `**النوع:** ${reasonOf(type, detail)}`,
            '**الفاعل:** غير معروف — البوت ما قدر يقرأ سجل التدقيق',
            '**العقوبة:** تنبيه فقط (ما رجّعنا شي عشان ما نخرب شي حلال)',
            '**الحل:** أعطِ رتبة البوت صلاحية **«عرض سجل التدقيق / View Audit Log»**'
        ],
        culprit: null, culpritName: 'غير معروف',
        stats: [{ label: 'النوع', value: type }]
    });
}

// ينفّذ الفحص الكامل لحدث واحد
async function handleAction(guild, { type, uid, targetId, detail, revert }) {
    if (!guild) return null;
    const cfg = get(guild.id);
    if (!cfg.enabled) return null;
    // ❓ مجهول الفاعل: ننبّه بس (الإرجاع الأعمى ممكن يخرب شغل حلال)
    if (!uid) { await unknownNote(guild, type, detail); return null; }
    if (immune(guild, uid)) { await exemptNote(guild, uid, type, detail); return null; }
    const limit = cfg.limits[type] || 3;
    const win = cfg.windowSec * 1000;
    const count = hit(guild.id, uid, type, win);
    if (count < limit) return null;
    if (count === limit || count % limit === 0) {
        return threat(guild, { type, uid, detail, count, hard: HARD.includes(type), revert });
    }
    return null;
}

// تصفير العدّادات والكاش (يستخدمه الفحص واللوحة عند الحاجة)
function resetCache() {
    buckets.clear();
    dups.clear();
    auditCache.clear();
    lastErr.clear();
    return true;
}

// رجوع للإعدادات الافتراضية (نحافظ على قائمة المستثنين عشان ما تنمسح بالغلط)
function reset(gid) {
    const cur = get(gid);
    const a = all();
    delete a[gid];
    store.write('guardcfg.json', a);
    return set(gid, {
        usersText: (cur.whitelist.users || []).join(' '),
        botsText: (cur.whitelist.bots || []).join(' '),
        roleIds: cur.whitelist.roles || []
    });
}

// ===== المراقبة =====
function init(client, CONFIG_) {
    CONFIG = CONFIG_ || {};
    const safe = (fn, what) => (...args) => {
        try {
            // 🔒 سيرفر مقفول (ما فعّلناه من اللوحة) = درع نوفا ما يشتغل فيه أبداً
            const gid = args.map(a => (a && a.guild && a.guild.id)
                || (a && a.guildId)
                || (a && a.id && a.members && a.roles ? a.id : '')).find(Boolean) || '';
            if (gid && !access.isApproved(gid, CONFIG)) return;
            return Promise.resolve(fn(...args)).catch(e => logErr(what, e));
        } catch (e) { logErr(what, e); }
    };

    // ١) حذف روم → نعرف منو حذفه ونرجّعه ونعاقبه
    client.on('channelDelete', safe(async (ch) => {
        if (!ch.guild) return;
        const uid = await actorOf(ch.guild, AuditLogEvent.ChannelDelete, ch.id);
        if (uid && immune(ch.guild, uid)) { exemptNote(ch.guild, uid, 'channelDelete', '#' + ch.name).catch(() => { }); return; }
        await handleAction(ch.guild, {
            type: 'channelDelete', uid, targetId: ch.id, detail: `#${ch.name}`,
            revert: async () => { const r = await restoreChannel(ch.guild, ch); return r ? [`رجعنا الروم #${ch.name}`] : []; }
        });
    }, 'حذف روم'));

    // ٢) إنشاء رومات بالجملة
    client.on('channelCreate', safe(async (ch) => {
        if (!ch.guild) return;
        const uid = await actorOf(ch.guild, AuditLogEvent.ChannelCreate, ch.id);
        if (uid && immune(ch.guild, uid)) { exemptNote(ch.guild, uid, 'channelCreate', '#' + ch.name).catch(() => { }); return; }
        await handleAction(ch.guild, {
            type: 'channelCreate', uid, targetId: ch.id, detail: `#${ch.name}`,
            revert: async () => { try { await ch.delete('🛡️ درع نوفا: روم مسوي بالجملة'); return ['حذفنا الروم المسوي']; } catch { return []; } }
        });
    }, 'إنشاء روم'));

    // ٣) حذف رتبة → نرجّعها بنفس اسمها ولونها وصلاحياتها
    client.on('roleDelete', safe(async (role) => {
        const guild = role.guild;
        if (!guild) return;
        const uid = await actorOf(guild, AuditLogEvent.RoleDelete, role.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'roleDelete', role.name).catch(() => { }); return; }
        await handleAction(guild, {
            type: 'roleDelete', uid, targetId: role.id, detail: role.name,
            revert: async () => { const r = await restoreRole(guild, role); return r ? [`رجعنا الرتبة ${role.name}`] : []; }
        });
    }, 'حذف رتبة'));

    // ٤) إنشاء رتبة (خطيرة → حذف فوري + عقوبة)
    client.on('roleCreate', safe(async (role) => {
        const guild = role.guild;
        if (!guild) return;
        const uid = await actorOf(guild, AuditLogEvent.RoleCreate, role.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'roleCreate', role.name).catch(() => { }); return; }
        if (hasSevere(role.permissions.bitfield)) {
            await threat(guild, {
                type: 'roleCreate', uid, count: 1, hard: true, detail: `رتبة خطيرة: ${role.name}`,
                revert: async () => { try { await role.delete('🛡️ درع نوفا: رتبة خطيرة'); return [`حذفنا الرتبة الخطيرة ${role.name}`]; } catch { return []; } }
            });
            return;
        }
        await handleAction(guild, {
            type: 'roleCreate', uid, targetId: role.id, detail: role.name,
            revert: async () => { try { await role.delete('🛡️ درع نوفا: رتب مسوية بالجملة'); return ['حذفنا الرتبة المسوية']; } catch { return []; } }
        });
    }, 'إنشاء رتبة'));

    // ٥) تعديل رتبة: صلاحيات @everyone أو رتبة → نرجّعها من اللقطة
    client.on('roleUpdate', safe(async (oldRole, newRole) => {
        const guild = newRole.guild;
        if (!guild) return;
        const before = oldRole.permissions.bitfield.toString();
        const after = newRole.permissions.bitfield.toString();
        if (before === after) return;
        const gained = BigInt(after) & ~BigInt(before);
        const uid = await actorOf(guild, AuditLogEvent.RoleUpdate, newRole.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'roleUpdate', newRole.name).catch(() => { }); return; }
        const snap = snapOf(guild);

        // أي إعطاء لصلاحية خطيرة = تخريب مؤكد (يُرجَّع فوراً ولو حركة وحدة)
        if (hasSevere(gained)) {
            const isEveryone = newRole.id === guild.id;
            await threat(guild, {
                type: isEveryone ? 'everyonePerm' : 'rolePerm', uid, count: 1, hard: false,
                detail: `${isEveryone ? '@everyone' : newRole.name} → صلاحية خطيرة`,
                revert: async () => {
                    try {
                        await newRole.setPermissions(BigInt(snap.roles[newRole.id]?.permissions || before), '🛡️ درع نوفا: إرجاع صلاحيات الرتبة');
                        return [`رجعنا صلاحيات ${isEveryone ? '@everyone' : newRole.name}`];
                    } catch { return []; }
                }
            });
            return;
        }
        await handleAction(guild, {
            type: 'roleUpdate', uid, targetId: newRole.id, detail: newRole.name,
            revert: async () => { const n = await restoreRolePerms(guild, snap); return n ? [`رجعنا صلاحيات ${n} رتبة`] : []; }
        });
    }, 'تعديل رتبة'));

    // ٦) حظر أعضاء بالجملة → عقوبة + فك حظر المظلومين
    client.on('guildBanAdd', safe(async (ban) => {
        const guild = ban.guild;
        if (!guild) return;
        const uid = await actorOf(guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'ban', 'عضو ' + ban.user.username).catch(() => { }); return; }
        await handleAction(guild, {
            type: 'ban', uid, targetId: ban.user.id, detail: `حظر ${ban.user.username}`,
            revert: async () => { const n = await unbanBy(guild, uid, AuditLogEvent.MemberBanAdd, get(guild.id).windowSec * 1000 + 5000); return n ? [`فكينا الحظر عن ${n} عضو`] : []; }
        });
    }, 'حظر عضو'));

    // ٧) طرد أعضاء بالجملة (ما يصير guildMemberRemove مع سجل تدقيق الطرد)
    client.on('guildMemberRemove', safe(async (member) => {
        const guild = member.guild;
        if (!guild) return;
        const uid = await actorOf(guild, AuditLogEvent.MemberKick, member.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'kick', 'عضو ' + member.user.username).catch(() => { }); return; }
        await handleAction(guild, { type: 'kick', uid, targetId: member.id, detail: `طرد ${member.user.username}`, revert: null });
    }, 'طرد عضو'));

    // ٨) رتبة خطيرة تنعطى لعضو → تُسحب فوراً + تنبيه (بلا حظر)
    client.on('guildMemberUpdate', safe(async (oldMember, newMember) => {
        const guild = newMember.guild;
        if (!guild) return;
        const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        if (!added.size) return;
        const bad = added.filter(r => hasSevere(r.permissions.bitfield));
        if (!bad.size) return;
        const uid = await actorOf(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'roleGrant', newMember.user.username).catch(() => { }); return; }
        await threat(guild, {
            type: 'roleGrant', uid, count: 1, hard: false,
            detail: `أعطى ${bad.map(r => r.name).join('، ')} لـ ${newMember.user.username}`,
            revert: async () => {
                const done = [];
                for (const r of bad.values()) {
                    try { await newMember.roles.remove(r, '🛡️ درع نوفا: رتبة خطيرة'); done.push(`سحبنا ${r.name}`); } catch {}
                }
                return done;
            }
        });
    }, 'إعطاء رتبة'));

    // ٩) ويب هوكس / إيموجي / دعوات بالجملة
    client.on('webhooksUpdate', safe(async (ch) => {
        const guild = ch.guild;
        if (!guild) return;
        const entries = await auditEntries(guild, AuditLogEvent.WebhookCreate);
        const recent = entries.filter(e => Date.now() - e.created < 15000);
        for (const e of recent) {
            if (!e.executorId || immune(guild, e.executorId)) continue;
            await handleAction(guild, {
                type: 'webhook', uid: e.executorId, targetId: e.targetId, detail: 'ويب هوك',
                revert: async () => {
                    let n = 0;
                    try {
                        const hooks = await ch.fetchWebhooks();
                        for (const h of hooks.values()) { if (h.owner && h.owner.id === e.executorId) { await h.delete('🛡️ درع نوفا: ويب هوك مخرب').catch(() => {}); n++; } }
                    } catch {}
                    return n ? [`حذفنا ${n} ويب هوك`] : [];
                }
            });
        }
    }, 'ويب هوك'));

    client.on('emojiDelete', safe(async (emoji) => {
        const guild = emoji.guild;
        if (!guild) return;
        const uid = await actorOf(guild, AuditLogEvent.EmojiDelete, emoji.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'emoji', emoji.name).catch(() => { }); return; }
        await handleAction(guild, {
            type: 'emoji', uid, targetId: emoji.id, detail: emoji.name,
            revert: async () => { const r = await restoreEmoji(guild, emoji); return r ? [`رجعنا الإيموجي ${emoji.name}`] : []; }
        });
    }, 'حذف إيموجي'));

    client.on('inviteCreate', safe(async (invite) => {
        const guild = invite.guild;
        if (!guild || !invite.inviterId) return;
        if (immune(guild, invite.inviterId)) return;
        await handleAction(guild, {
            type: 'invite', uid: invite.inviterId, detail: 'دعوة',
            revert: async () => { try { await invite.delete('🛡️ درع نوفا: دعوات بالجملة'); return ['حذفنا الدعوة']; } catch { return []; } }
        });
    }, 'إنشاء دعوة'));

    // ١٠) تخريب صلاحيات الرومات (@everyone) بالجملة
    client.on('channelUpdate', safe(async (oldCh, newCh) => {
        const guild = newCh.guild;
        if (!guild || !newCh.permissionOverwrites) return;
        const before = oldCh.permissionOverwrites ? oldCh.permissionOverwrites.cache.get(guild.id) : null;
        const after = newCh.permissionOverwrites.cache.get(guild.id);
        const bA = before ? before.allow.bitfield : 0n, bD = before ? before.deny.bitfield : 0n;
        const aA = after ? after.allow.bitfield : 0n, aD = after ? after.deny.bitfield : 0n;
        if (bA === aA && bD === aD) return;
        const uid = await actorOf(guild, AuditLogEvent.ChannelOverwriteUpdate, newCh.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'overwrite', '#' + newCh.name).catch(() => { }); return; }
        const snap = snapOf(guild);
        await handleAction(guild, {
            type: 'overwrite', uid, targetId: newCh.id, detail: `#${newCh.name}`,
            revert: async () => { const n = await restoreOverwrites(guild, snap); return n ? [`رجعنا صلاحيات ${n} روم`] : []; }
        });
    }, 'تخريب صلاحيات'));

    // ١١) تغيير اسم السيرفر أو أيقونته
    client.on('guildUpdate', safe(async (oldGuild, newGuild) => {
        const guild = newGuild;
        const uid = await actorOf(guild, AuditLogEvent.GuildUpdate, guild.id);
        if (uid && immune(guild, uid)) { exemptNote(guild, uid, 'guildUpdate', 'اسم/أيقونة السيرفر').catch(() => { }); return; }
        const changed = oldGuild.name !== newGuild.name || oldGuild.icon !== newGuild.icon;
        if (!changed) return;
        await threat(guild, {
            type: 'guildUpdate', uid, count: 1, hard: true, detail: 'اسم/أيقونة السيرفر',
            revert: async () => {
                const done = [];
                try {
                    if (oldGuild.name !== newGuild.name) { await guild.setName(oldGuild.name, '🛡️ درع نوفا: إرجاع اسم السيرفر'); done.push('رجعنا اسم السيرفر'); }
                    if (oldGuild.icon !== newGuild.icon && oldGuild.iconURL) { await guild.setIcon(oldGuild.iconURL({ extension: 'png', size: 256 }), '🛡️ درع نوفا: إرجاع أيقونة السيرفر'); done.push('رجعنا أيقونة السيرفر'); }
                } catch {}
                return done;
            }
        });
    }, 'إعدادات السيرفر'));

    // ١٢) الرايد: دخول أعضاء بالجملة → قفل فوري + طرد الحسابات الجديدة
    client.on('guildMemberAdd', safe(async (member) => {
        const guild = member.guild;
        const cfg = get(guild.id);
        if (!cfg.enabled || !cfg.raid.enabled) return;
        if (member.user.bot && !cfg.punishBots) {
            // بوت جديد: تنبيه فقط (خطر لو مجهول)
            if (!cfg.whitelist.bots.includes(member.id)) {
                await notify(guild, {
                    title: 'بوت جديد دخل السيرفر 🤖',
                    lines: [`**البوت:** <@${member.id}> (\`${member.id}\`)`, `**الاسم:** ${member.user.username}`, 'راجعه: لو مو بوت تعرفه اطرده فوراً وبدّل صلاحيات أي رتبة عطيته.'],
                    culprit: member.id, culpritName: member.user.username,
                    avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
                    stats: [{ label: 'بوتات', value: guild.members.cache.filter(m => m.user.bot).size }]
                });
                addIncident(guild.id, { at: Date.now(), type: 'botAdd', uid: member.id, name: member.user.username, detail: 'بوت جديد', count: 1, action: 'تنبيه فقط', undone: 0 });
            }
            return;
        }
        const count = hit(guild.id, 'raid', 'join', cfg.raid.sec * 1000, 'raid');
        if (count < cfg.raid.joins) {
            // حماية استباقية: حساب عمره أقل من الحد → طرد فوري
            const days = (Date.now() - member.user.createdTimestamp) / 86400000;
            if (cfg.raid.kickNew && cfg.raid.minDays > 0 && days < cfg.raid.minDays) {
                try {
                    await member.send('🛡️ سيرفر نوفا محمي: حسابك جديد، حاول بعد ما تكمل السيرفر شروط الانضمام.').catch(() => {});
                    await member.kick('🛡️ درع نوفا: حساب جديد (حماية رايد)');
                    addIncident(guild.id, { at: Date.now(), type: 'newAccount', uid: member.id, name: member.user.username, detail: `عمر الحساب ${Math.floor(days)} يوم`, count: 1, action: 'طرد', undone: 0 });
                } catch {}
            }
            return;
        }
        // رايد مؤكد: قفل + طرد الجدد
        const kicked = [];
        for (const m of guild.members.cache.values()) {
            if (m.user.bot) continue;
            const d = (Date.now() - m.user.createdTimestamp) / 86400000;
            if (d < Math.max(1, cfg.raid.minDays)) {
                try { await m.kick('🛡️ درع نوفا: رايد'); kicked.push(m.user.username); } catch {}
            }
        }
        const res = await lockdown(guild, true, { by: 'درع نوفا (رايد)', reason: 'رايد', autoUnlockMin: cfg.raid.autoUnlockMin });
        addIncident(guild.id, { at: Date.now(), type: 'raid', uid: 'raid', name: 'رايد', detail: `${count} عضو خلال ${cfg.raid.sec} ثانية`, count, action: `قفل السيرفر${kicked.length ? ' + طرد ' + kicked.length : ''}`, undone: 0 });
        await notify(guild, {
            title: 'رايد! تم قفل السيرفر 🔒',
            lines: [`**دخلوا:** ${count} عضو خلال ${cfg.raid.sec} ثانية`, `**طردنا الجدد:** ${kicked.length}`, `**القفل:** ${res.channels || 0} روم`, cfg.raid.autoUnlockMin > 0 ? `يفتح تلقائياً بعد ${cfg.raid.autoUnlockMin} دقيقة` : 'ينفتح يدوياً من أمر /حماية'],
            stats: [{ label: 'دخلوا', value: count }, { label: 'طردنا', value: kicked.length }]
        });
    }, 'دخول عضو'));

    // ١٣) السبام: رسائل/تكرار/منشن جماعي/روابط
    client.on('messageCreate', safe(async (message) => {
        const guild = message.guild;
        if (!guild || !message.author || message.author.bot) return;
        const cfg = get(guild.id);
        if (!cfg.enabled || !cfg.spam.enabled) return;
        if (immune(guild, message.author.id, message.member)) return;
        const sp = cfg.spam;

        // منشن @everyone من غير الملكيين → حذف فوري
        if (message.mentions.everyone) {
            try {
                await message.delete();
                await message.channel.send(`⚠️ <@${message.author.id}> منشن @everyone مو مسموح.`).then(m => setTimeout(() => m.delete().catch(() => {}), 6000));
                addIncident(guild.id, { at: Date.now(), type: 'everyoneMention', uid: message.author.id, name: message.author.username, detail: 'منشن @everyone', count: 1, action: 'حذف الرسالة', undone: 0 });
            } catch {}
            return;
        }
        // منشن جماعي برسالة وحدة
        const mentions = message.mentions.users.size + message.mentions.roles.size;
        if (mentions >= sp.mentions) {
            try { await message.delete(); } catch {}
            await muteMember(guild, message.member, `🛡️ درع نوفا: منشن جماعي (${mentions})`, sp.timeoutMin);
            addIncident(guild.id, { at: Date.now(), type: 'massMention', uid: message.author.id, name: message.author.username, detail: `${mentions} منشن برسالة`, count: mentions, action: `كتم ${sp.timeoutMin} دقيقة`, undone: 0 });
            return;
        }
        // تكرار نفس الرسالة
        const dupKey = `${guild.id}:${message.author.id}`;
        const h = simpleHash(message.content);
        const now = Date.now();
        let cur = (dups.get(dupKey) || []).filter(x => x.at > now - 20000);
        cur.push({ at: now, hash: h });
        if (cur.length > 40) cur = cur.slice(-40);
        dups.set(dupKey, cur);
        const same = cur.filter(x => x.hash === h).length;
        if (same >= sp.dupMsgs && message.content.trim().length > 1) {
            try { await message.delete(); } catch {}
            await muteMember(guild, message.member, `🛡️ درع نوفا: تكرار نفس الرسالة ${same} مرات`, sp.timeoutMin);
            addIncident(guild.id, { at: Date.now(), type: 'spamDup', uid: message.author.id, name: message.author.username, detail: `كرر رسالة ${same} مرات`, count: same, action: `كتم ${sp.timeoutMin} دقيقة`, undone: 0 });
            return;
        }
        // فلود
        const n = hit(guild.id, message.author.id, 'spam', sp.sec * 1000);
        if (n === sp.msgs) {
            await nukeMessagesFrom(guild, message.author.id);
            await muteMember(guild, message.member, `🛡️ درع نوفا: سبام ${n} رسالة خلال ${sp.sec} ثانية`, sp.timeoutMin);
            addIncident(guild.id, { at: Date.now(), type: 'spam', uid: message.author.id, name: message.author.username, detail: `${n} رسالة خلال ${sp.sec} ثانية`, count: n, action: `كتم ${sp.timeoutMin} دقيقة`, undone: 0 });
            await notify(guild, {
                title: 'سبام بالشات — تم كتمه 🧹',
                lines: [`**العضو:** <@${message.author.id}> (\`${message.author.id}\`)`, `**الحركة:** ${n} رسالة خلال ${sp.sec} ثانية`, `**العقوبة:** كتم ${sp.timeoutMin} دقيقة وحذف رسائله`],
                culprit: message.author.id, culpritName: message.author.username,
                avatarURL: message.author.displayAvatarURL({ extension: 'png', size: 256 }),
                stats: [{ label: 'رسائل', value: n }, { label: 'كتم', value: sp.timeoutMin }]
            });
        }
    }, 'فلترة الرسائل'));

    // لقطة أولى + تحديث دوري (نقطة رجوع لصلاحيات الرتب والرومات) — لكل السيرفرات
    client.on('clientReady', safe(async () => {
        for (const g of client.guilds.cache.values()) if (access.isApproved(g.id, CONFIG)) snapshot(g);
        // فحص ذاتي: وين يروح التنبيه بالضبط (يطلع بالكونسول عشان تعرف المشكلة فوراً)
        for (const g of client.guilds.cache.values()) {
            if (!access.isApproved(g.id, CONFIG)) continue;
            try {
                const d = diag(g);
                const ch = d.channel ? '#' + d.channel.name + (d.channel.auto ? ' (تلقائي)' : '') : '⛔ ما فيه روم تنبيهات';
                const dm = d.dm ? `${d.targets.filter(t => t.inGuild).length}/${d.targets.length} مسؤول` : 'مطفي';
                console.log(`🛡️ ${g.name}: التنبيه ← ${ch} · الخاص ${dm} · سجل التدقيق ${d.perms.audit ? '✅' : '❌'}`);
            } catch { /* تجاهل */ }
        }
    }, 'اللقطة'));
    setInterval(() => {
        for (const g of client.guilds.cache.values()) if (g.available && access.isApproved(g.id, CONFIG)) snapshot(g);
    }, 10 * 60_000).unref?.();

    console.log('🛡️ درع نوفا شغال (حماية النك والاختراق)');
}

const simpleHash = (s) => {
    let h = 0;
    const t = String(s || '').slice(0, 500);
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return h;
};

async function muteMember(guild, member, reason, minutes) {
    try {
        if (!member) return false;
        const me = guild.members.me;
        if (!me || !me.permissions.has(P.ModerateMembers)) return false;
        if (me.roles.highest.position <= member.roles.highest.position) return false;
        await member.timeout(Math.max(1, minutes) * 60_000, reason);
        return true;
    } catch (err) { logErr('كتم عضو', err); return false; }
}

async function nukeMessagesFrom(guild, uid) {
    try {
        await guild.channels.fetch().catch(() => {});
        for (const ch of guild.channels.cache.values()) {
            if (!ch.isTextBased() || ch.isThread?.()) continue;
            if (!ch.permissionsFor?.(guild.members.me)?.has(P.ManageMessages)) continue;
            const msgs = await ch.messages.fetch({ limit: 25 }).catch(() => null);
            if (!msgs) continue;
            const mine = msgs.filter(m => m.author.id === uid);
            if (!mine.size) continue;
            await ch.bulkDelete(mine, true).catch(() => {});
        }
    } catch (err) { logErr('حذف رسائل السبام', err); }
}

// ===== أوامر السلاش =====
const commands = [
    new SlashCommandBuilder().setName('حماية').setDescription('🛡️ درع نوفا: حالة الحماية / قفل السيرفر فوراً / فتحه / آخر الحوادث')
        .addStringOption(o => o.setName('عملية').setDescription('وش تبغى تسوي').setRequired(true)
            .addChoices(
                { name: '📊 حالة الحماية', value: 'status' },
                { name: '🔒 قفل السيرفر فوراً (Panic)', value: 'lock' },
                { name: '🔓 فتح السيرفر', value: 'unlock' },
                { name: '📜 آخر محاولات التخريب', value: 'log' }
            ))
        .setDMPermission(false)
].map(c => c.toJSON());

async function handle(i, ctx) {
    if (i.commandName !== 'حماية') return false;
    const tier = ctx.getTier(i.user.id, i.member);
    if (!['arthur', 'ida', 'royal'].includes(tier)) {
        await i.reply({ content: access.denyTextRanks(i.guild, CONFIG), flags: EPH });
        return true;
    }
    const op = i.options.getString('عملية');
    const guild = i.guild;
    const cfg = get(guild.id);
    try {
        if (op === 'lock') {
            const res = await lockdown(guild, true, { by: i.user.tag || i.user.username, reason: 'قفل يدوي من ديسكورد' });
            addIncident(guild.id, { at: Date.now(), type: 'panic', uid: i.user.id, name: i.user.username, detail: 'قفل يدوي', count: 1, action: 'قفل السيرفر', undone: 0 });
            return i.reply({ content: res.already ? '🔒 السيرفر مقفول أصلاً.' : `🔒 **قفلنا السيرفر فوراً** (${res.channels || 0} روم). ما يقدر أحد يكتب غير الملكيين. للفتح: \`/حماية عملية: فتح السيرفر\`` });
        }
        if (op === 'unlock') {
            const res = await lockdown(guild, false, { by: i.user.username });
            return i.reply({ content: res.already ? '🔓 السيرفر مفتوح أصلاً.' : `🔓 **فتحنا السيرفر** (${res.channels || 0} روم رجعت لحالتها).` });
        }
        if (op === 'log') {
            const list = incidents(guild.id, 10);
            if (!list.length) return i.reply({ content: '📜 ما فيه أي محاولة تخريب مسجّلة ✅ السيرفر نظيف.' });
            const e = new EmbedBuilder().setColor(0xb3121e).setTitle('📜 آخر محاولات التخريب')
                .setDescription(list.map(l => `• **${l.name}** — ${l.detail || l.type}\n  <t:${Math.floor(l.at / 1000)}:R> · ${l.action}`).join('\n').slice(0, 3900));
            return i.reply({ embeds: [e] });
        }
        // حالة
        const locked = isLocked(guild.id);
        const e = new EmbedBuilder().setColor(locked ? 0xb3121e : 0x2f7d4f).setTitle('🛡️ درع نوفا — حالة الحماية')
            .addFields(
                { name: 'الحماية', value: cfg.enabled ? 'شغالة ✅' : 'مطفية ❌', inline: true },
                { name: 'العقوبة', value: cfg.mode === 'ban' ? 'حظر فوري' : cfg.mode === 'kick' ? 'طرد فوري' : 'سحب كل الرتب', inline: true },
                { name: 'القفل', value: locked ? '🔒 السيرفر مقفول' : '🔓 مفتوح', inline: true },
                { name: 'حدود التخريب', value: `حذف رومات ${cfg.limits.channelDelete} · حذف رتب ${cfg.limits.roleDelete} · حظر ${cfg.limits.ban} — خلال ${cfg.windowSec} ثانية`, inline: false },
                { name: 'محميين', value: `${access.isNova(guild.id, CONFIG) ? 'ارثر وإيدا والرتبة الملكية' : 'صاحب السيرفر والمسؤولين'}${cfg.whitelist.users.length ? ' + ' + cfg.whitelist.users.length + ' مستثنى' : ''}`, inline: false },
                { name: 'حوادث مسجّلة', value: String(incidents(guild.id, 200).length), inline: true }
            );
        return i.reply({ embeds: [e] });
    } catch (err) {
        logErr('أمر حماية', err);
        if (!i.replied && !i.deferred) i.reply({ content: '⚠️ صار خطأ: ' + err.message, flags: EPH }).catch(() => {});
        return true;
    }
}

// تشخيص سريع: وين يروح التنبيه بالضبط؟ ومنو بيوصله بالخاص؟ ووش ناقص البوت؟
function diag(guild) {
    const cfg = get(guild.id);
    const f = alertChannelOf(guild, cfg);
    const me = guild.members.me;
    const has = (k) => !!(me && me.permissions.has(P[k]));
    let targets = [];
    try { targets = access.royalIds(guild, CONFIG) || []; } catch { targets = []; }
    for (const id of (cfg.alertUsers || [])) if (!targets.includes(id)) targets.push(id);
    return {
        enabled: !!cfg.enabled,
        mode: cfg.mode,
        channel: f.ch ? { id: f.ch.id, name: f.ch.name, auto: !!f.auto } : null,
        dm: !!cfg.alertDM,
        targets: targets.map(id => ({ id, inGuild: !!guild.members.cache.get(id) })),
        perms: {
            audit: has('ViewAuditLog'), ban: has('BanMembers'), kick: has('KickMembers'),
            roles: has('ManageRoles'), channels: has('ManageChannels'),
            webhooks: has('ManageWebhooks'), timeout: has('ModerateMembers')
        },
        highest: me ? me.roles.highest.position : 0,
        total: guild.roles.cache.size
    };
}

module.exports = {
    init, get, set, reset, commands, handle, diag,
    incidents, clearIncidents, lockdown, isLocked, snapshot, notify, immune, hit, hasSevere, resetCache, SEVERE
};
