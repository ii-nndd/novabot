// نظام التذاكر: لوحة بزر، روم خاص لكل تذكرة، إغلاق مع نسخة من المحادثة.
// الإعدادات من /dashboard (صفحة التذاكر).
const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits: P, ChannelType, AttachmentBuilder, MessageFlags
} = require('discord.js');
const store = require('./store');

const EPH = MessageFlags.Ephemeral;
const DEF = {
    enabled: false, categoryId: '', staffRoleId: '', logChannelId: '',
    panelTitle: '🎫 الدعم الفني', panelText: 'اضغط الزر تحت لفتح تذكرة، وأحد الإداريين يرد عليك بأقرب وقت.',
    buttonLabel: 'فتح تذكرة', welcomeText: 'أهلاً {user}! اشرح مشكلتك أو طلبك وانتظر أحد الإداريين.', maxOpen: 1
};
const ids = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : '');

const cfgAll = () => store.read('ticketcfg.json', {});
const get = (gid) => ({ ...DEF, ...(cfgAll()[gid] || {}) });
function set(gid, b) {
    const a = cfgAll();
    a[gid] = {
        enabled: !!b.enabled, categoryId: ids(b.categoryId), staffRoleId: ids(b.staffRoleId), logChannelId: ids(b.logChannelId),
        panelTitle: String(b.panelTitle || DEF.panelTitle).slice(0, 100), panelText: String(b.panelText || DEF.panelText).slice(0, 1000),
        buttonLabel: String(b.buttonLabel || DEF.buttonLabel).slice(0, 40), welcomeText: String(b.welcomeText || DEF.welcomeText).slice(0, 1000),
        maxOpen: Math.min(5, Math.max(1, Math.floor(Number(b.maxOpen)) || 1))
    };
    store.write('ticketcfg.json', a);
}

const dbAll = () => store.read('tickets.json', {});
const getDb = (gid) => dbAll()[gid] || { counter: 0, open: {} };
const saveDb = (gid, d) => { const a = dbAll(); a[gid] = d; store.write('tickets.json', a); };
const openCount = (gid) => Object.keys(getDb(gid).open).length;

const btn = (id, label, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function panelMessage(cfg) {
    return {
        embeds: [new EmbedBuilder().setColor(0xb3121e).setTitle(cfg.panelTitle).setDescription(cfg.panelText)],
        components: [new ActionRowBuilder().addComponents(btn('ticket_open', cfg.buttonLabel, ButtonStyle.Success))]
    };
}

const commands = [
    new SlashCommandBuilder().setName('تذكرة_اضافة').setDescription('إضافة عضو للتذكرة الحالية')
        .addUserOption(o => o.setName('عضو').setDescription('العضو').setRequired(true)).setDMPermission(false),
    new SlashCommandBuilder().setName('تذكرة_ازالة').setDescription('إزالة عضو من التذكرة الحالية')
        .addUserOption(o => o.setName('عضو').setDescription('العضو').setRequired(true)).setDMPermission(false),
    new SlashCommandBuilder().setName('تذكرة_اغلاق').setDescription('إغلاق التذكرة الحالية').setDMPermission(false)
].map(c => c.toJSON());

// الإداري = ارثر/إيدا، أو صاحب رتبة الدعم، أو الرتبة الملكية
function isStaff(member, cfg, CONFIG) {
    if (!member) return false;
    if (member.id === CONFIG.ARTHUR_ID || member.id === CONFIG.SPECIAL_USER_ID) return true;
    return member.roles.cache.has(CONFIG.ROYAL_ROLE_ID) || (cfg.staffRoleId && member.roles.cache.has(cfg.staffRoleId));
}

async function openTicket(i, CONFIG) {
    const g = i.guild, cfg = get(g.id);
    if (!cfg.enabled) return i.reply({ content: '⚠️ نظام التذاكر مو مفعل حالياً.', flags: EPH });

    const db = getDb(g.id);
    for (const cid of Object.keys(db.open)) if (!g.channels.cache.has(cid)) delete db.open[cid];   // تنظيف المحذوف يدوياً
    const mine = Object.entries(db.open).filter(([, t]) => t.userId === i.user.id);
    if (mine.length >= cfg.maxOpen) {
        saveDb(g.id, db);
        return i.reply({ content: `⚠️ عندك تذكرة مفتوحة: <#${mine[0][0]}>`, flags: EPH });
    }
    await i.deferReply({ flags: EPH });

    const num = ++db.counter;
    const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
    const overwrites = [
        { id: g.id, deny: [P.ViewChannel] },
        { id: i.user.id, allow },
        { id: i.client.user.id, allow: [...allow, P.ManageChannels] }
    ];
    for (const rid of new Set([cfg.staffRoleId, CONFIG.ROYAL_ROLE_ID])) {
        if (rid && g.roles.cache.has(rid)) overwrites.push({ id: rid, allow });
    }
    const parent = cfg.categoryId && g.channels.cache.get(cfg.categoryId);
    const ch = await g.channels.create({
        name: `ticket-${String(num).padStart(4, '0')}`, type: ChannelType.GuildText,
        parent: parent && parent.type === ChannelType.GuildCategory ? parent.id : undefined,
        topic: `ticket:${i.user.id}`, permissionOverwrites: overwrites
    });
    db.open[ch.id] = { userId: i.user.id, num, at: Date.now(), claimedBy: null };
    saveDb(g.id, db);

    const staffPing = cfg.staffRoleId && g.roles.cache.has(cfg.staffRoleId) ? ` <@&${cfg.staffRoleId}>` : '';
    await ch.send({
        content: `<@${i.user.id}>${staffPing}`,
        embeds: [new EmbedBuilder().setColor(0xb3121e).setTitle(`🎫 تذكرة #${String(num).padStart(4, '0')}`)
            .setDescription(cfg.welcomeText.replace(/\{user\}/g, `<@${i.user.id}>`))],
        components: [new ActionRowBuilder().addComponents(
            btn('ticket_claim', 'استلام التذكرة', ButtonStyle.Primary), btn('ticket_close', 'إغلاق التذكرة', ButtonStyle.Danger))],
        allowedMentions: { users: [i.user.id], roles: staffPing ? [cfg.staffRoleId] : [] }
    });
    await i.editReply(`✅ تم فتح تذكرتك: ${ch}`);
}

// يتأكد إن الروم تذكرة وإن الشخص له صلاحية (صاحبها أو إداري)
function guard(i, CONFIG, staffOnly) {
    const db = getDb(i.guild.id), t = db.open[i.channelId], cfg = get(i.guild.id);
    if (!t) return { error: 'هذا مو روم تذكرة.' };
    const staff = isStaff(i.member, cfg, CONFIG);
    if (!(staff || (!staffOnly && t.userId === i.user.id))) return { error: '⛔ ما عندك صلاحية.' };
    return { db, t, cfg, staff };
}

async function askClose(i, CONFIG) {
    const g = guard(i, CONFIG, false);
    if (g.error) return i.reply({ content: g.error, flags: EPH });
    await i.reply({
        content: 'متأكد تبي تقفل التذكرة؟ بيتحذف الروم وتنحفظ نسخة من المحادثة.',
        components: [new ActionRowBuilder().addComponents(btn('ticket_close_yes', 'نعم، أقفلها', ButtonStyle.Danger), btn('ticket_close_no', 'إلغاء', ButtonStyle.Secondary))],
        flags: EPH
    });
}

async function transcript(ch) {
    const all = [];
    let before;
    for (let n = 0; n < 5; n++) {
        const b = await ch.messages.fetch({ limit: 100, before });
        if (!b.size) break;
        all.push(...b.values());
        before = b.last().id;
    }
    return all.reverse().map(m =>
        `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.username}: ${m.content}` +
        (m.attachments.size ? ` [مرفقات: ${[...m.attachments.values()].map(a => a.url).join(' ')}]` : '')).join('\n');
}

async function closeTicket(i, CONFIG) {
    const g = guard(i, CONFIG, false);
    if (g.error) return i.reply({ content: g.error, flags: EPH });
    await i.update({ content: '🔒 جاري إغلاق التذكرة...', components: [] });
    const ch = i.channel, num = String(g.t.num).padStart(4, '0');
    if (g.cfg.logChannelId) {
        try {
            const log = await i.guild.channels.fetch(g.cfg.logChannelId).catch(() => null);
            if (log && log.isTextBased()) {
                const text = await transcript(ch);
                await log.send({
                    embeds: [new EmbedBuilder().setColor(0x8b0000).setTitle(`🔒 أغلقت التذكرة #${num}`)
                        .setDescription(`فاتحها: <@${g.t.userId}>\nأغلقها: <@${i.user.id}>${g.t.claimedBy ? `\nاستلمها: <@${g.t.claimedBy}>` : ''}`)],
                    files: [new AttachmentBuilder(Buffer.from(text || '(فاضية)', 'utf8'), { name: `ticket-${num}.txt` })],
                    allowedMentions: { parse: [] }
                });
            }
        } catch (err) { console.error('❌ نسخة التذكرة:', err.message); }
    }
    delete g.db.open[i.channelId];
    saveDb(i.guild.id, g.db);
    setTimeout(() => ch.delete('إغلاق تذكرة').catch(() => {}), 4000);
}

async function claim(i, CONFIG) {
    const g = guard(i, CONFIG, true);
    if (g.error) return i.reply({ content: g.error, flags: EPH });
    if (g.t.claimedBy) return i.reply({ content: `التذكرة مستلمة من <@${g.t.claimedBy}>`, flags: EPH, allowedMentions: { parse: [] } });
    g.t.claimedBy = i.user.id;
    saveDb(i.guild.id, g.db);
    await i.reply({ content: `🙋 ${i.user} استلم التذكرة`, allowedMentions: { users: [i.user.id] } });
}

async function handleButton(i, ctx) {
    if (!i.customId.startsWith('ticket_')) return false;
    try {
        const id = i.customId;
        if (id === 'ticket_open') await openTicket(i, ctx.CONFIG);
        else if (id === 'ticket_close') await askClose(i, ctx.CONFIG);
        else if (id === 'ticket_close_yes') await closeTicket(i, ctx.CONFIG);
        else if (id === 'ticket_close_no') await i.update({ content: 'تم الإلغاء.', components: [] });
        else if (id === 'ticket_claim') await claim(i, ctx.CONFIG);
    } catch (err) {
        console.error('❌ تذاكر:', err.message);
        const msg = err.code === 50013 ? '⚠️ البوت ما عنده صلاحية (Manage Channels) أو رتبته أقل.' : '⚠️ صار خطأ، حاول مرة ثانية.';
        if (i.deferred || i.replied) i.editReply(msg).catch(() => {});
        else i.reply({ content: msg, flags: EPH }).catch(() => {});
    }
    return true;
}

async function handle(i, ctx) {
    if (!['تذكرة_اضافة', 'تذكرة_ازالة', 'تذكرة_اغلاق'].includes(i.commandName)) return false;
    try {
        if (i.commandName === 'تذكرة_اغلاق') { await askClose(i, ctx.CONFIG); return true; }
        const g = guard(i, ctx.CONFIG, true);
        if (g.error) { await i.reply({ content: g.error, flags: EPH }); return true; }
        const u = i.options.getUser('عضو');
        if (i.commandName === 'تذكرة_اضافة') {
            await i.channel.permissionOverwrites.edit(u.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
            await i.reply(`✅ تمت إضافة ${u} للتذكرة`);
        } else {
            if (u.id === g.t.userId) { await i.reply({ content: 'ما تقدر تشيل صاحب التذكرة.', flags: EPH }); return true; }
            await i.channel.permissionOverwrites.delete(u.id);
            await i.reply(`✅ تمت إزالة ${u} من التذكرة`);
        }
    } catch (err) {
        console.error('❌ أمر تذكرة:', err.message);
        if (!i.replied && !i.deferred) i.reply({ content: '⚠️ صار خطأ، تأكد من صلاحيات البوت.', flags: EPH }).catch(() => {});
    }
    return true;
}

module.exports = { commands, handle, handleButton, get, set, panelMessage, openTicket, openCount };
