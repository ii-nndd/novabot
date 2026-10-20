// ============================================================================
//  hub.js — 🎛️ لوحة التحكم (Control Panel) لسيرفر نوفا
// ----------------------------------------------------------------------------
//  الفكرة: رسالة وحدة بالروم فيها:
//    ١) بانر مصمم بهوية نوفا (art.panelCard): عنوان ضخم + الخيارات مرقّمة
//    ٢) قائمة اختيار (StringSelectMenu) → العضو يختار الخيار فينفّذ فوراً
//
//  وكل خيار مربوط بنظام موجود فعلاً بالبوت (ما فيه شي وهمي):
//    🎫 التذاكر · 🏆 بطاقة المستوى · 🥇 المتصدرين · 🪙 الراتب اليومي ·
//    🎉 القرعات · 🎨 رتب الألوان · 📢 الرتب الذاتية · 📜 القوانين · ✉️ التواصل
//
//  • الشكل مثل بانلات السيرفرات المعروفة (صورة + خيارات تحت بعضها).
//  • أغلب الردود خاصة بالعضو (Ephemeral) عشان ما نزعج الروم.
//  • الإعدادات في hub.cfg.json (عبر store) وتُدار من صفحة «لوحة التحكم» بالداشبورد.
//  • لو تعطّل الرسم/الخط نرجع لنص عادي — الرسالة ما تنكسر أبداً.
// ============================================================================
const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
    AttachmentBuilder, MessageFlags
} = require('discord.js');
const store = require('./store');
const art = require('./art');
const access = require('./access');
const points = require('./points');
const cards = require('./cards');
const economy = require('./economy');
const giveaway = require('./giveaway');
const colors = require('./colors');
const tickets = require('./tickets');
const fs = require('fs');
const path = require('path');

// 🖼️ بانر مخصص لسيرفرنا فقط: حُط صورة باسم nova-panel.png بجانب هذا الملف
//     → تُستخدم هي بدل الرسم تلقائياً (لرسالة لوحة التحكم + معاينة الداشبورد).
//     باقي السيرفرات تكمل على البانر المرسوم (art.panelCard).
const CUSTOM_BANNER = 'nova-panel.png';
let bannerCache = { mtime: -1, size: -1, buf: null };

function customBanner(guild) {
    try {
        if (!guild || !access.isNova(guild.id)) return null;
        const p = path.join(__dirname, CUSTOM_BANNER);
        const st = fs.statSync(p);
        if (bannerCache.buf && bannerCache.mtime === st.mtimeMs && bannerCache.size === st.size) return bannerCache.buf;
        const buf = fs.readFileSync(p);
        if (!buf || buf.length < 200) return null;
        bannerCache = { mtime: st.mtimeMs, size: st.size, buf };
        return buf;
    } catch {
        return null;
    }
}

const EPH = MessageFlags.Ephemeral;
const FILE = 'hub.cfg.json';
const MENU_ID = 'hub_menu';
const MODAL_ID = 'hub_contact';

// ===== كتالوج الخيارات (الأفعال الحقيقية المتاحة) =====
const CATALOG = [
    { id: 'ticket', emoji: '🎫', label: 'اضغط هنا للتذكرة', desc: 'افتح تذكرة خاصة مع الإدارة' },
    { id: 'rank', emoji: '🏆', label: 'اضغط هنا لمستواي', desc: 'بطاقتك ونقاطك وترتيبك' },
    { id: 'top', emoji: '🥇', label: 'اضغط هنا للمتصدرين', desc: 'أعلى ١٠ أعضاء بالسيرفر' },
    { id: 'daily', emoji: '🪙', label: 'اضغط هنا للراتب اليومي', desc: 'استلم راتبك اليومي' },
    { id: 'giveaway', emoji: '🎉', label: 'اضغط هنا للقرعات', desc: 'القرعات الشغالة الآن' },
    { id: 'colors', emoji: '🎨', label: 'اضغط هنا لرتب الألوان', desc: 'اختر لونك المفضل' },
    { id: 'roles', emoji: '📢', label: 'اضغط هنا للرتب الذاتية', desc: 'خُذ أو شِل رتبتك' },
    { id: 'rules', emoji: '📜', label: 'اضغط هنا للقوانين', desc: 'قوانين سيرفر نوفا' },
    { id: 'contact', emoji: '✉️', label: 'اضغط هنا للتواصل', desc: 'أرسل رسالة خاصة للإدارة' }
];
const CAT = (id) => CATALOG.find(o => o.id === id);

// ===== الافتراضي =====
const DEF = {
    enabled: false,
    image: true,
    channelId: '',
    messageId: '',
    title: 'لوحة التحكم',
    subtitle: 'CONTROL PANEL',
    placeholder: '🎛️ اختر اللي تبية من هنا…',
    heading: 'كل خدمات سيرفر نوفا في مكان واحد',
    desc: 'اضغط على الخيار اللي تبية من القائمة تحت 👇',
    color: 'b3121e',
    rules: '**قوانين سيرفر نوفا** 👑\n1) احترم الجميع ولا تسب أحد.\n2) ممنوع السبام والإعلانات بدون إذن.\n3) ممنوع نشر محتوى مخالف.\n4) احترم تعليمات الإدارة.\n5) أي مشكلة؟ افتح تذكرة من الخيار فوق 🎫',
    contactId: '',
    selfRolesText: '',
    // القائمة الافتراضية (كل الخيارات مفعّلة) — تستخدمها اللوحة بزر «رجوع للخيارات الافتراضية»
    options: CATALOG.map(o => Object.assign({ on: true }, o))
};

// ===== أدوات =====
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const isId = (v) => /^\d{5,25}$/.test(String(v || '').trim());
const isHex = (v) => /^[0-9a-f]{6}$/i.test(String(v || '').replace('#', ''));
const EMOJI_OK = /^(<a?:[A-Za-z0-9_]+:\d{5,25}>|[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}]+)$/u;
const all = () => store.read(FILE, {}) || {};
const writeAll = (a) => store.write(FILE, a);

// «آيدي : اسم الزر» كل واحد بسطر → [{id,label}]
function parseSelfRoles(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const m = l.split(/\s*[:：|]\s*/);
        const id = String(m[0] || '').trim();
        if (!isId(id)) return null;
        return { id, label: clip(String(m[1] || '').trim() || 'رتبة', 40) };
    }).filter(Boolean);
}

// ===== القراءة/الحفظ =====
function get(gid) {
    const raw = all()[gid] || {};
    const opts = (Array.isArray(raw.options) ? raw.options : []).map(o => {
        const cat = CAT(o && o.id);
        if (!cat) return null;
        return {
            id: cat.id,
            on: o.on !== false,
            emoji: clip(o.emoji || cat.emoji, 8),
            label: clip(o.label || cat.label, 80),
            desc: clip(o.desc == null ? cat.desc : o.desc, 80)
        };
    }).filter(Boolean);
    const hex = String(raw.color || '').replace('#', '');
    return {
        enabled: raw.enabled === true,
        image: raw.image !== false,
        channelId: isId(raw.channelId) ? String(raw.channelId) : '',
        messageId: isId(raw.messageId) ? String(raw.messageId) : '',
        title: clip(raw.title || DEF.title, 80),
        subtitle: clip(raw.subtitle == null ? DEF.subtitle : raw.subtitle, 40),
        placeholder: clip(raw.placeholder || DEF.placeholder, 100),
        heading: clip(raw.heading == null ? DEF.heading : raw.heading, 200),
        desc: clip(raw.desc == null ? DEF.desc : raw.desc, 500),
        color: isHex(hex) ? hex.toLowerCase() : DEF.color,
        rules: clip(raw.rules == null ? DEF.rules : raw.rules, 3500),
        contactId: isId(raw.contactId) ? String(raw.contactId) : '',
        selfRolesText: clip(raw.selfRolesText || '', 1500),
        selfRoles: parseSelfRoles(raw.selfRolesText),
        options: opts.length ? opts : CATALOG.map(o => Object.assign({ on: true }, o))
    };
}

function set(gid, b) {
    const cur = get(gid);
    const src = Array.isArray(b.options) ? b.options : cur.options;
    const opts = src.map(o => {
        const cat = CAT(o && o.id);
        if (!cat) return null;
        return {
            id: cat.id,
            on: o.on !== false,
            emoji: clip(o.emoji || cat.emoji, 8),
            label: clip(o.label || cat.label, 80),
            desc: clip(o.desc == null ? cat.desc : o.desc, 80)
        };
    }).filter(Boolean);
    const hex = String(b.color !== undefined ? b.color : cur.color).replace('#', '');
    const next = {
        enabled: b.enabled !== undefined ? !!b.enabled : cur.enabled,
        image: b.image !== undefined ? !!b.image : cur.image,
        channelId: b.channelId !== undefined ? (isId(b.channelId) ? String(b.channelId).trim() : '') : cur.channelId,
        // لو تغيّر الروم نمسح آيدي الرسالة القديمة (رسالة الروم الثاني ما نلمسها)
        messageId: (b.channelId !== undefined && String(b.channelId).trim() !== cur.channelId) ? '' : cur.messageId,
        contactId: b.contactId !== undefined ? (isId(b.contactId) ? String(b.contactId).trim() : '') : cur.contactId,
        title: b.title !== undefined ? clip(b.title, 80) || DEF.title : cur.title,
        subtitle: b.subtitle !== undefined ? clip(b.subtitle, 40) : cur.subtitle,
        placeholder: b.placeholder !== undefined ? clip(b.placeholder, 100) || DEF.placeholder : cur.placeholder,
        heading: b.heading !== undefined ? clip(b.heading, 200) : cur.heading,
        desc: b.desc !== undefined ? clip(b.desc, 500) : cur.desc,
        color: isHex(hex) ? hex.toLowerCase() : DEF.color,
        rules: b.rules !== undefined ? clip(b.rules, 3500) : cur.rules,
        selfRolesText: b.selfRolesText !== undefined ? clip(b.selfRolesText, 1500) : cur.selfRolesText,
        options: opts.length ? opts : CATALOG.map(o => Object.assign({ on: true }, o))
    };
    const a = all();
    a[gid] = next;
    writeAll(a);
    return get(gid);
}

function reset(gid) {
    const a = all();
    delete a[gid];
    writeAll(a);
    return get(gid);
}

function state(gid) {
    const cfg = get(gid);
    return {
        enabled: cfg.enabled,
        channelId: cfg.channelId,
        messageId: cfg.messageId,
        active: cfg.options.filter(o => o.on).length,
        link: cfg.channelId && cfg.messageId ? `https://discord.com/channels/${gid}/${cfg.channelId}/${cfg.messageId}` : ''
    };
}

// ===== بناء رسالة اللوحة =====
function optionOf(o) {
    const x = { label: clip(o.label, 100), value: o.id };
    if (o.desc) x.description = clip(o.desc, 100);
    if (o.emoji && EMOJI_OK.test(String(o.emoji).trim())) x.emoji = String(o.emoji).trim();
    return x;
}

// معاملات البانر (نفسها بالرسالة وبالمعاينة بالداشبورد)
function bannerArgs(guild, cfg) {
    const live = cfg.options.filter(o => o.on);
    return {
        title: cfg.title, subtitle: cfg.subtitle, server: guild ? guild.name : '',
        items: live.map(o => o.label),
        footerText: live.length ? 'اضغط على الخيار اللي تبية من القائمة تحت' : 'ما فيه خيارات مفعّلة حالياً'
    };
}

// ينادي رسم البانر بأمان: ما يرمي ولا يعلّق حتى لو نسخة art قديمة ما فيها panelCard
// (هذا اللي كان يطلع «art.panelCard is not a function» ويوقف الرسالة كلها)
function drawBanner(guild, cfg) {
    if (!art || typeof art.panelCard !== 'function') return Promise.resolve(null);
    const p = Promise.resolve().then(() => art.panelCard(bannerArgs(guild, cfg)));
    if (typeof art.guard === 'function') return art.guard(p, 8000, 'بانر لوحة التحكم');
    return p.catch(() => null);
}

// يرجّع البانر PNG (للمعاينة بالداشبورد وللرسالة) — أو null لو الرسم مو متاح
async function renderImage(guild) {
    const own = customBanner(guild);          // صورتنا المخصصة (سيرفرنا فقط)
    if (own) return own;
    const cfg = get(guild ? guild.id : '');
    return drawBanner(guild, cfg);
}

async function payload(guild, cfg, gid) {
    const live = cfg.options.filter(o => o.on).slice(0, 25);
    const hex = parseInt(cfg.color, 16);
    const e = new EmbedBuilder().setColor(Number.isFinite(hex) ? hex : 0xb3121e);
    if (cfg.heading) e.setTitle(cfg.heading);
    if (cfg.desc) e.setDescription(cfg.desc);
    e.setFooter({ text: 'سيرفر نوفا · اضغط على الخيار اللي تبية 👇' });
    const out = { embeds: [e], components: [] };

    // البانر (صورتنا المخصصة لسيرفرنا، أو المرسوم) — لو فشل أو تأخّر نكمل بدونه
    if (cfg.image) {
        const png = await renderImage(guild);
        if (png) {
            e.setImage('attachment://hub.png');
            out.files = [new AttachmentBuilder(png, { name: 'hub.png' })];
        }
    }

    if (live.length) {
        let menu;
        try {
            menu = new StringSelectMenuBuilder().setCustomId(MENU_ID).setPlaceholder(cfg.placeholder)
                .setMinValues(1).setMaxValues(1).addOptions(live.map(optionOf));
        } catch {
            // إيموجي غلط أو نص طويل → نبنيها بأقل حقول ممكنة
            menu = new StringSelectMenuBuilder().setCustomId(MENU_ID).setPlaceholder(cfg.placeholder)
                .setMinValues(1).setMaxValues(1)
                .addOptions(live.map(o => ({ label: clip(o.label, 100), value: o.id })));
        }
        out.components.push(new ActionRowBuilder().addComponents(menu));
    }
    if (!out.files) delete out.files;
    return out;
}

async function channelOf(guild, id) {
    if (!isId(id)) return null;
    const ch = guild.channels.cache.get(String(id)) || await guild.channels.fetch(String(id)).catch(() => null);
    return ch && ch.isTextBased && ch.isTextBased() ? ch : null;
}

// إرسال/تحديث الرسالة: resend=true يحذف القديمة ويرسل جديدة
async function send(guild, gid, { resend = false } = {}) {
    const cfg = get(gid);
    if (!cfg.channelId) throw new Error('حدّد روم لوحة التحكم أول (من الصفحة أو من أمر /لوحة_تحكم بالروم اللي تبيه)');
    const ch = await channelOf(guild, cfg.channelId);
    if (!ch) throw new Error('روم لوحة التحكم مو موجود أو مو روم نصي');
    const p = await payload(guild, cfg, gid);

    if (cfg.messageId && !resend) {
        const old = await ch.messages.fetch(cfg.messageId).catch(() => null);
        if (old) {
            await old.edit(p);
            return { ok: true, messageId: old.id, channelId: ch.id, channelName: ch.name, edited: true };
        }
    }
    if (resend && cfg.messageId) {
        const old = await ch.messages.fetch(cfg.messageId).catch(() => null);
        if (old) await old.delete().catch(() => {});
    }
    const msg = await ch.send(p);
    const a = all();
    a[gid] = Object.assign(get(gid), { messageId: msg.id });
    delete a[gid].selfRoles;
    writeAll(a);
    return { ok: true, messageId: msg.id, channelId: ch.id, channelName: ch.name, edited: false };
}

// عند كل إقلاع: نتأكد الرسالة موجودة ومحدّثة (ولو انحذفت نرسلها من جديد) — لكل سيرفر مفعّل فيه
async function ensure(client, CONFIG) {
    for (const g of client.guilds.cache.values()) {
        if (!access.isApproved(g.id, CONFIG)) continue;   // 🔒 سيرفر مقفول = ما نرسل له لوحة
        const cfg = get(g.id);
        if (!cfg.enabled || !cfg.channelId) continue;
        try {
            await send(g, g.id, { resend: false });
            console.log(`🎛️ لوحة التحكم: محدّثة بسيرفر ${g.name}`);
        } catch (e) {
            console.error('❌ لوحة التحكم (ensure):', e.message);
        }
    }
}

// ===== ردود مساعدة =====
async function replyEph(i, content) {
    if (i.deferred || i.replied) return i.followUp({ content, flags: EPH }).catch(() => {});
    return i.reply({ content, flags: EPH }).catch(() => {});
}

// ===== تنفيذ الخيارات (كلها أنظمة حقيقية) =====
async function run(i, id, cfg, ctx) {
    const gid = i.guild.id;

    switch (id) {
        // 🎫 تذكرة — نفس نظام التذاكر (رد مخفي + روم خاص)
        case 'ticket':
            return tickets.openTicket(i, ctx.CONFIG);

        // 🏆 بطاقة المستوى — نفس بطاقة /رتبة
        case 'rank': {
            await i.deferReply({ flags: EPH }).catch(() => {});
            return points.sendRank(i, i.user, gid);
        }

        // 🥇 المتصدرين — بطاقة Canvas لنفس قائمة /المتصدرين
        case 'top': {
            await i.deferReply({ flags: EPH }).catch(() => {});
            const rows = await points.top(gid, 10);
            if (!rows.length) return i.editReply({ content: '📊 ما فيه نقاط مسجّلة بعد — تكلموا بالرومات عشان تجمعون XP!' }).catch(() => {});
            const entries = [];
            for (const d of rows) {
                const u = i.client.users.cache.get(d.userId) || await i.client.users.fetch(d.userId).catch(() => null);
                entries.push({
                    name: art.san(u ? (u.globalName || u.username) : d.userId),
                    points: d.points || 0,
                    totalLevel: points.levelOf(d.points || 0),
                    avatarURL: u ? u.displayAvatarURL({ extension: 'png', size: 128 }) : ''
                });
            }
            if (cards.available()) {
                const png = await art.guard(cards.leaderboardCard(entries), 8000, 'بطاقة المتصدرين');
                if (png) return i.editReply({ files: [new AttachmentBuilder(png, { name: 'top.png' })] }).catch(() => {});
            }
            const lines = entries.map((e, k) => `**${k + 1}.** ${e.name} — ${e.points} XP (م${e.totalLevel})`);
            return i.editReply({ embeds: [new EmbedBuilder().setColor(0xb3121e).setTitle('🏆 المتصدرين بنوفا').setDescription(lines.join('\n'))] }).catch(() => {});
        }

        // 🪙 الراتب اليومي — نفس منطق /يومي
        case 'daily':
            return economy.claimDaily(i, true);

        // 🎉 القرعات الشغالة — روابط تنقّل لرسائل القرعات (زر الدخول الأصلي يشتغل هناك)
        case 'giveaway': {
            const live = Object.entries(giveaway.list() || {})
                .filter(([, g]) => g && g.guildId === gid && !g.ended)
                .sort((a, b) => (a[1].endsAt || 0) - (b[1].endsAt || 0));
            if (!live.length) return replyEph(i, '🎉 ما فيه قرعة شغالة حالياً — استنى الإعلان!');
            const lines = live.slice(0, 10).map(([mid, g]) => {
                const t = Math.floor((g.endsAt || Date.now()) / 1000);
                return `• **${clip(g.prize, 60)}** — ${(g.entrants || []).length} متسابق · ينتهي <t:${t}:R>\n↳ [روح للقرعة](https://discord.com/channels/${gid}/${g.channelId}/${mid})`;
            });
            const e = new EmbedBuilder().setColor(0xb3121e).setTitle(`🎉 القرعات الشغالة (${live.length})`)
                .setDescription(lines.join('\n') + '\n\nاضغط الرابط وبتلقى زر «دخول القرعة» 🎫');
            return i.reply({ embeds: [e], flags: EPH });
        }

        // 🎨 رتب الألوان — نفس بانل الألوان (صورة + قائمة أرقام)
        case 'colors': {
            const ccfg = colors.get(gid);
            if (!ccfg.roles || !ccfg.roles.length) return replyEph(i, '🎨 ما فيه ألوان مضافة للسيرفر حالياً.');
            const p = colors.buildPanel(ccfg, {});
            return i.reply(Object.assign({}, p, { flags: EPH })).catch(() => replyEph(i, '⚠️ ما قدرت أعرض الألوان، جرّب مرة ثانية.'));
        }

        // 📢 الرتب الذاتية — أزرار role_pick_* (نفس نظام /رتب_لوحة)
        case 'roles': {
            const list = cfg.selfRoles || [];
            if (!list.length) return replyEph(i, '📢 الرتب الذاتية ما انضبطت بعد — الإدارة تضيفها من لوحة التحكم.');
            const rows = [];
            list.slice(0, 25).forEach((r, k) => {
                const idx = Math.floor(k / 5);
                if (!rows[idx]) rows[idx] = new ActionRowBuilder();
                rows[idx].addComponents(new ButtonBuilder()
                    .setCustomId('role_pick_' + r.id).setLabel(clip(r.label || 'رتبة', 80)).setStyle(ButtonStyle.Secondary));
            });
            return i.reply({ content: '📢 اضغط على الرتبة اللي تبيها — لو عندك تنشال، ولو ما عندك تنضاف لك:', components: rows, flags: EPH });
        }

        // 📜 القوانين — النص المكتوب باللوحة
        case 'rules': {
            const e = new EmbedBuilder().setColor(0xb3121e).setTitle('📜 قوانين سيرفر نوفا')
                .setDescription(cfg.rules || 'ما انكتبت القوانين بعد — الإدارة تضيفها من لوحة التحكم.');
            return i.reply({ embeds: [e], flags: EPH });
        }

        // ✉️ التواصل مع الإدارة — نافذة كتابة (Modal) → روم التواصل أو خاص الملكيين
        case 'contact':
            return i.showModal(new ModalBuilder().setCustomId(MODAL_ID).setTitle('✉️ رسالة للإدارة').addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder()
                    .setCustomId('msg').setLabel('اكتب رسالتك هنا').setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('اكتب مشكلتك أو اقتراحك بالتفصيل…').setMaxLength(1000).setRequired(true))
            ));

        default:
            return replyEph(i, '⚠️ هذا الخيار ما هو مربوط بشي حالياً.');
    }
}

// ===== قائمة الاختيار =====
async function handleSelect(i, ctx) {
    if (!i.isStringSelectMenu() || i.customId !== MENU_ID) return false;
    if (!i.guild) return false;
    const cfg = get(i.guild.id);
    const chosen = String((i.values && i.values[0]) || '');
    const opt = cfg.options.find(o => o.id === chosen && o.on);
    if (!opt) { await replyEph(i, '⚠️ هذا الخيار مو مفعّل حالياً.'); return true; }
    try {
        await run(i, opt.id, cfg, ctx);
    } catch (err) {
        console.error('❌ لوحة التحكم (' + opt.id + '):', err && err.message);
        await replyEph(i, '⚠️ صار خطأ غير متوقع، جرّب مرة ثانية.');
    }
    return true;
}

// ===== إرسال رسالة التواصل (بعد ما يكتبها العضو بالنافذة) =====
async function handleModal(i, ctx) {
    if (!i.isModalSubmit() || i.customId !== MODAL_ID) return false;
    if (!i.guild) return false;
    const cfg = get(i.guild.id);
    const text = clip(String(i.fields.getTextInputValue('msg') || '').trim(), 1000);
    if (!text) { await replyEph(i, '✉️ الرسالة فاضية، اكتب شي أول.'); return true; }
    try {
        await i.deferReply({ flags: EPH }).catch(() => {});
        const e = new EmbedBuilder().setColor(0xb3121e).setTitle('✉️ رسالة من عضو (لوحة التحكم)')
            .setDescription(text)
            .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
            .setFooter({ text: `آيدي العضو: ${i.user.id}` });
        const ch = await channelOf(i.guild, cfg.contactId);
        let sent = false;
        if (ch) {
            const ping = [...access.royalIds(i.guild, ctx.CONFIG)][0];
            await ch.send({ content: ping ? `<@${ping}>` : '', embeds: [e], allowedMentions: { users: ping ? [ping] : [] } })
                .then(() => { sent = true; }).catch(() => {});
        }
        if (!sent) {
            // ما فيه روم تواصل → نجرب خاص المسؤولين (اللي موجودين بالسيرفر)
            const ids = access.royalIds(i.guild, ctx.CONFIG);
            for (const id of ids) {
                const u = await i.client.users.fetch(id).catch(() => null);
                if (u) await u.send({ embeds: [e] }).then(() => { sent = true; }).catch(() => {});
            }
        }
        return i.editReply({
            content: sent ? '✅ وصلت رسالتك للإدارة، بنرد عليك بأقرب وقت 👌' : '⚠️ ما قدرت أوصل رسالتك (الإدارة تضبط روم التواصل من لوحة التحكم).'
        }).catch(() => {}).then(() => true);
    } catch (err) {
        console.error('❌ لوحة التحكم (التواصل):', err && err.message);
        await replyEph(i, '⚠️ ما قدرت أرسل رسالتك، جرّب بعدين.');
        return true;
    }
}

// ===== أمر السلاش /لوحة_تحكم (إرسال أو تحديث اللوحة) =====
const commands = [
    new SlashCommandBuilder().setName('لوحة_تحكم')
        .setDescription('إرسال أو تحديث لوحة التحكم بهذا الروم (للإدارة فقط)')
        .addBooleanOption(o => o.setName('جديدة').setDescription('إرسال رسالة جديدة بدل تعديل الحالية'))
        .setDMPermission(false)
].map(c => c.toJSON());

async function handle(i, ctx) {
    if (!i.isChatInputCommand() || i.commandName !== 'لوحة_تحكم') return false;
    const tier = ctx.getTier(i.user.id, i.member);
    if (tier !== 'arthur' && tier !== 'ida' && tier !== 'royal') {
        await replyEph(i, access.denyTextRoyal(i.guild, ctx.CONFIG));
        return true;
    }
    try {
        await i.deferReply({ flags: EPH }).catch(() => {});
        const gid = i.guild.id;
        // لو ما فيه روم محدد → نستخدم الروم الحالي ونحفظه
        const cfg = get(gid);
        if (!cfg.channelId) set(gid, { channelId: i.channelId });
        const fresh = i.options && i.options.getBoolean ? !!i.options.getBoolean('جديدة') : false;
        const r = await send(i.guild, gid, { resend: fresh });
        await i.editReply({
            content: `✅ لوحة التحكم ${r.edited ? 'انحدّثت' : 'انرسلت'} في <#${r.channelId}>\n${r.edited ? 'https://discord.com/channels/' + gid + '/' + r.channelId + '/' + r.messageId : ''}`
        }).catch(() => {});
        return true;
    } catch (err) {
        console.error('❌ /لوحة_تحكم:', err && err.message);
        await replyEph(i, '⚠️ ' + (err && err.message ? err.message : 'صار خطأ'));
        return true;
    }
}

module.exports = {
    CATALOG, DEF, MENU_ID,
    get, set, reset, state, send, ensure, payload, renderImage, bannerArgs,
    handleSelect, handleModal, handle, commands
};
