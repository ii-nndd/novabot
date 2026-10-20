// نظام الترحيب: رسالة عند دخول عضو، رسالة وداع، ورتبة تلقائية.
// الإعدادات لكل سيرفر وتتعدل من /dashboard (صفحة الترحيب).
// ← كل رسالة ترحيب تجي معاها صورة «ولكم» مصممة (art.js): صورة العضو + الاسم + رقم العضوية.
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const store = require('./store');
const art = require('./art');
const access = require('./access');

const IMG = 'nova-welcome.png', IMG_LEAVE = 'nova-leave.png';

const DEFAULT = {
    enabled: false,
    channelId: '',
    title: 'حياك الله في {server} 🌹',
    message: 'يا هلا ومرحبا {user}! نورت السيرفر، أنت العضو رقم **{count}**',
    leaveEnabled: false,
    leaveMessage: '👋 {name} غادر السيرفر',
    autoRoleId: ''
};

const all = () => store.read('welcome.json', {});
const get = (gid) => ({ ...DEFAULT, ...(all()[gid] || {}) });

function set(gid, b) {
    const id = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : '');
    const a = all();
    a[gid] = {
        enabled: !!b.enabled,
        channelId: id(b.channelId),
        title: String(b.title || DEFAULT.title).slice(0, 100),
        message: String(b.message || DEFAULT.message).slice(0, 1000),
        leaveEnabled: !!b.leaveEnabled,
        leaveMessage: String(b.leaveMessage || DEFAULT.leaveMessage).slice(0, 300),
        autoRoleId: id(b.autoRoleId)
    };
    store.write('welcome.json', a);
}

const fill = (t, v) => String(t)
    .replace(/\{user\}/g, v.mention).replace(/\{name\}/g, v.name)
    .replace(/\{server\}/g, v.server).replace(/\{count\}/g, String(v.count));

// يبني رسالة الترحيب (تُستخدم عند الدخول الحقيقي وعند زر الاختبار)
function build(cfg, v) {
    const e = new EmbedBuilder().setColor(0xb3121e)
        .setTitle(fill(cfg.title, v).slice(0, 256))
        .setDescription(fill(cfg.message, v).slice(0, 4000))
        .setFooter({ text: `العضو رقم ${v.count}` }).setTimestamp();
    if (v.avatar) e.setThumbnail(v.avatar);
    return { content: v.mention, embeds: [e], allowedMentions: { users: v.id ? [v.id] : [] } };
}

// ===== الصور (art.js) =====
// صورة الترحيب: «ولكم» + صورة العضو + الاسم + عدد الأعضاء.
// العنوان اللي كتبه صاحب السيرفر باللوحة يصير السطر الذهبي تحت الاسم (بلا إيموجي لأنه يطلع مربع).
async function imageFor(cfg, v) {
    if (!art.available()) return null;
    const sub = art.san(fill(cfg.title, v)).slice(0, 64) || ('نوّرت ' + (v.server || 'السيرفر'));
    // art.guard: مهلة قصوى عشان صورة العضو لو تأخرت ما تعلّق رسالة الترحيب
    return await art.guard(art.welcomeCard({
        avatarURL: v.avatar, name: v.name, tag: v.handle,
        server: v.server, count: v.count, members: v.members, subtitle: sub
    }), 7000, 'صورة الترحيب');
}

// نفس رسالة الترحيب بس معاها الصورة (الصورة تصير هي صورة الـEmbed الكبيرة)
async function buildFull(cfg, v) {
    const msg = build(cfg, v);
    const buf = await imageFor(cfg, v);
    if (!buf) return msg;
    msg.embeds[0].setImage('attachment://' + IMG);
    msg.files = [new AttachmentBuilder(buf, { name: IMG })];
    return msg;
}

// صورة الوداع
async function leaveImage(v) {
    if (!art.available()) return null;
    return await art.guard(art.leaveCard({ avatarURL: v.avatar, name: v.name, server: v.server, count: v.count }), 7000, 'صورة الوداع');
}

function init(client) {
    client.on('guildMemberAdd', async (m) => {
        try {
            if (!access.isApproved(m.guild.id)) return;   // 🔒 سيرفر مقفول
            const cfg = get(m.guild.id);
            if (cfg.autoRoleId) await m.roles.add(cfg.autoRoleId, 'رتبة تلقائية').catch(() => {});
            if (!cfg.enabled || !cfg.channelId) return;
            const ch = await m.guild.channels.fetch(cfg.channelId).catch(() => null);
            if (!ch || !ch.isTextBased()) return;
            await ch.send(await buildFull(cfg, {
                id: m.id, mention: `<@${m.id}>`, name: m.displayName, handle: m.user.username,
                server: m.guild.name, count: m.guild.memberCount, members: m.guild.memberCount,
                avatar: m.user.displayAvatarURL({ size: 256 })
            }));
        } catch (err) { console.error('❌ ترحيب:', err.message); }
    });

    client.on('guildMemberRemove', async (m) => {
        try {
            if (!access.isApproved(m.guild.id)) return;   // 🔒 سيرفر مقفول
            const cfg = get(m.guild.id);
            if (!cfg.leaveEnabled || !cfg.channelId) return;
            const ch = await m.guild.channels.fetch(cfg.channelId).catch(() => null);
            if (!ch || !ch.isTextBased()) return;
            const name = (m.user && m.user.username) || 'عضو';
            const buf = m.user ? await leaveImage({
                avatar: m.user.displayAvatarURL({ size: 256 }), name,
                server: m.guild.name, count: m.guild.memberCount
            }) : null;
            const payload = {
                content: fill(cfg.leaveMessage, { mention: name, name, server: m.guild.name, count: m.guild.memberCount }).slice(0, 1900),
                allowedMentions: { parse: [] }
            };
            if (buf) payload.files = [new AttachmentBuilder(buf, { name: IMG_LEAVE })];
            await ch.send(payload);
        } catch (err) { console.error('❌ وداع:', err.message); }
    });
}

module.exports = { init, get, set, build, buildFull, imageFor, leaveImage, IMG, IMG_LEAVE };
