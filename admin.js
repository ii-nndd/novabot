// أوامر إدارة السيرفر
// owner = ارثر وإيدا فقط | royal = ارثر وإيدا + أصحاب الرتبة الملكية
const { SlashCommandBuilder, EmbedBuilder, ChannelType, MessageFlags, AttachmentBuilder } = require('discord.js');
const store = require('./store');
const jail = require('./jail');
const art = require('./art');

const EPH = MessageFlags.Ephemeral;
const cmd = (n, d) => new SlashCommandBuilder().setName(n).setDescription(d).setDMPermission(false);
const member = (o) => o.setName('عضو').setDescription('العضو').setRequired(true);
const reasonOpt = (o) => o.setName('السبب').setDescription('السبب').setMaxLength(200);
const VOICE = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];

const defs = [
    [cmd('طرد', 'طرد عضو من السيرفر').addUserOption(member).addStringOption(reasonOpt), 'owner'],
    [cmd('حظر', 'حظر عضو').addUserOption(member).addStringOption(reasonOpt)
        .addIntegerOption(o => o.setName('ايام').setDescription('حذف رسائله من آخر كم يوم (0-7)').setMinValue(0).setMaxValue(7)), 'owner'],
    [cmd('فك_حظر', 'فك الحظر عن عضو').addStringOption(o => o.setName('الايدي').setDescription('آي دي العضو').setRequired(true)), 'owner'],
    [cmd('ميوت', 'كتم عضو كتابياً (تايم اوت)').addUserOption(member)
        .addIntegerOption(o => o.setName('الدقائق').setDescription('المدة بالدقائق').setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption(reasonOpt), 'royal'],
    [cmd('فك_ميوت', 'فك التايم اوت عن عضو').addUserOption(member), 'royal'],
    [cmd('مسح', 'مسح رسائل من الروم')
        .addIntegerOption(o => o.setName('العدد').setDescription('عدد الرسائل (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('عضو').setDescription('مسح رسائل هذا العضو فقط')), 'royal'],
    [cmd('قفل', 'قفل الروم الحالي عن الكتابة'), 'owner'],
    [cmd('فتح', 'فتح الروم الحالي للكتابة'), 'owner'],
    [cmd('بطيء', 'تفعيل الوضع البطيء للروم')
        .addIntegerOption(o => o.setName('الثواني').setDescription('0 لإلغاءه').setRequired(true).setMinValue(0).setMaxValue(21600)), 'royal'],
    [cmd('رتبة_اضافة', 'إعطاء رتبة لعضو').addUserOption(member)
        .addRoleOption(o => o.setName('الرتبة').setDescription('الرتبة').setRequired(true)), 'owner'],
    [cmd('رتبة_ازالة', 'سحب رتبة من عضو').addUserOption(member)
        .addRoleOption(o => o.setName('الرتبة').setDescription('الرتبة').setRequired(true)), 'owner'],
    [cmd('لقب', 'تغيير لقب عضو').addUserOption(member)
        .addStringOption(o => o.setName('اللقب').setDescription('اتركه فاضي لحذف اللقب').setMaxLength(32)), 'owner'],
    [cmd('صوت', 'التحكم بعضو في الفويس').addUserOption(member)
        .addStringOption(o => o.setName('الاجراء').setDescription('الإجراء').setRequired(true).addChoices(
            { name: 'كتم 🔇', value: 'mute' }, { name: 'فك الكتم 🔊', value: 'unmute' },
            { name: 'تصميم 🙉', value: 'deafen' }, { name: 'فك التصميم 👂', value: 'undeafen' },
            { name: 'فصل من الفويس 🚪', value: 'kick' })), 'royal'],
    [cmd('نقل', 'نقل عضو لروم فويس ثاني').addUserOption(member)
        .addChannelOption(o => o.setName('الروم').setDescription('روم الفويس').setRequired(true).addChannelTypes(...VOICE)), 'royal'],
    [cmd('اعلان', 'إرسال إعلان ملكي')
        .addStringOption(o => o.setName('النص').setDescription('نص الإعلان').setRequired(true).setMaxLength(1500))
        .addStringOption(o => o.setName('العنوان').setDescription('عنوان الإعلان').setMaxLength(100))
        .addStringOption(o => o.setName('الشكل').setDescription('كيف ينرسل الإعلان؟ (الافتراضي صورة مصممة)').addChoices(
            { name: '🖼️ صورة مصممة', value: 'img' },
            { name: '📝 نص عادي', value: 'txt' }))
        .addChannelOption(o => o.setName('الروم').setDescription('الروم (الافتراضي الحالي)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)), 'owner'],
    [cmd('تحذير', 'إعطاء تحذير لعضو').addUserOption(member)
        .addStringOption(o => o.setName('السبب').setDescription('السبب').setRequired(true).setMaxLength(200)), 'royal'],
    [cmd('تحذيرات', 'عرض تحذيرات عضو').addUserOption(member), 'royal'],
    [cmd('معلومات_عضو', 'معلومات عن عضو').addUserOption(o => o.setName('عضو').setDescription('العضو')), 'royal'],
    [cmd('معلومات_سيرفر', 'معلومات عن السيرفر'), 'royal'],
    [cmd('سجن', 'سجن عضو (يشوف روم السجن بس، لازم تضبط النظام من /dashboard أول)').addUserOption(member).addStringOption(reasonOpt), 'royal'],
    [cmd('فك_سجن', 'فك سجن عضو').addUserOption(member), 'royal']
];

const commands = defs.map(([b]) => b.toJSON());
const LEVEL = Object.fromEntries(defs.map(([b, l]) => [b.name, l]));

const tierName = { arthur: '👑 ارثر', ida: '🌸 الملكة إيدا', royal: '🛡️ رتبة ملكية', peasant: '👤 عادي' };
const ts = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

async function done(i, ctx, text) {
    await (i.deferred ? i.editReply(text) : i.reply(text));
    const id = ctx.CONFIG.LOG_CHANNEL_ID;
    if (!id) return;
    try {
        const ch = await i.client.channels.fetch(id);
        await ch.send({ embeds: [new EmbedBuilder().setColor(0x8b0000).setDescription(text).setFooter({ text: `بواسطة ${i.user.tag}` }).setTimestamp()] });
    } catch {}
}
const fail = (i, text) => (i.deferred || i.replied)
    ? i.editReply('⚠️ ' + text)
    : i.reply({ content: '⚠️ ' + text, flags: EPH });

// ===== الإعلان الملكي =====
// خياران: «صورة مصممة» (بطاقة نوفا: العنوان + النص + صاحب الإعلان) أو «نص عادي» (Embed).
// يستخدمه أمر /اعلان وصفحة «الإعلانات» باللوحة — نفس الشكل بالضبط.
const MENTION_RE = /@everyone|@here|<@&\d+>|<@!?\d+>/g;
async function announcePayload({ title, text, by, image = true, server, avatarURL, name, sub, footerBy }) {
    const head = title || '📢 إعلان ملكي';
    const body = String(text == null ? '' : text).trim();
    const embed = new EmbedBuilder().setColor(0xb3121e).setTitle(head)
        .setFooter({ text: footerBy ? `بأمر ${footerBy}` : 'من لوحة نوفا' }).setTimestamp();
    const payload = { embeds: [embed] };

    if (image && art.available()) {
        // النص كامل داخل الصورة، ونخلي المنشنات بالكونتنت عشان التنبيه يشتغل مثل ما هو
        const png = await art.guard(art.noticeCard({
            title: head, iconName: 'horn', tone: 'gold', server,
            avatarURL, name, sub: sub || 'إعلان من إدارة السيرفر',
            lines: body.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40)
        }), 7000, 'صورة الإعلان');
        if (png) {
            const mentions = [...new Set(body.match(MENTION_RE) || [])].join(' ');
            if (mentions) payload.content = mentions;
            embed.setImage('attachment://announce.png');
            payload.files = [new AttachmentBuilder(png, { name: 'announce.png' })];
            return payload;
        }
        console.warn('⚠️ تعذّر رسم صورة الإعلان — نرسله نص عادي.');
    }
    embed.setDescription(body.slice(0, 3900));
    return payload;
}

// فحص العضو المستهدف
function badTarget(i, t, tier, ctx) {
    if (!t) return 'ما لقيت العضو بالسيرفر.';
    if (t.id === i.client.user.id) return 'ما أقدر أسوي هذا بنفسي 😅';
    if (t.id === i.user.id) return 'ما تقدر تسويها على نفسك!';
    const tt = ctx.getTier(t.id, t);
    if (tt === 'arthur' || tt === 'ida') return 'ما أمس الملوك 👑';
    if (tier === 'royal' && tt === 'royal') return 'ما تقدر على زميلك بالرتبة.';
    return null;
}

async function run(i, tier, ctx) {
    const g = i.guild, o = i.options, n = i.commandName;
    const why = o.getString('السبب') || 'بدون سبب';
    const by = `${i.user.tag} | ${why}`;
    const tgt = () => o.getMember('عضو');
    const needTarget = async () => {
        const t = tgt();
        const err = badTarget(i, t, tier, ctx);
        if (err) { await fail(i, err); return null; }
        return t;
    };

    switch (n) {
        case 'طرد': {
            const t = await needTarget(); if (!t) return;
            await t.kick(by);
            return done(i, ctx, `👢 تم طرد **${t.user.tag}**\nالسبب: ${why}`);
        }
        case 'حظر': {
            const user = o.getUser('عضو');
            const m = o.getMember('عضو');
            if (m) { const err = badTarget(i, m, tier, ctx); if (err) return fail(i, err); }
            else if (user.id === i.user.id) return fail(i, 'ما تقدر تحظر نفسك!');
            await g.members.ban(user.id, { reason: by, deleteMessageSeconds: (o.getInteger('ايام') || 0) * 86400 });
            return done(i, ctx, `🔨 تم حظر **${user.tag}**\nالسبب: ${why}`);
        }
        case 'فك_حظر': {
            const id = o.getString('الايدي').trim();
            await g.members.unban(id, by);
            return done(i, ctx, `✅ تم فك الحظر عن \`${id}\``);
        }
        case 'ميوت': {
            const t = await needTarget(); if (!t) return;
            const mins = o.getInteger('الدقائق');
            await t.timeout(mins * 60_000, by);
            return done(i, ctx, `🔇 تم كتم ${t} لمدة **${mins}** دقيقة\nالسبب: ${why}`);
        }
        case 'فك_ميوت': {
            const t = await needTarget(); if (!t) return;
            await t.timeout(null, by);
            return done(i, ctx, `🔊 تم فك الكتم عن ${t}`);
        }
        case 'سجن': {
            const t = await needTarget(); if (!t) return;
            const cfg = jail.get(g.id);
            if (!cfg.enabled || !cfg.roleId) return fail(i, 'نظام السجن مو مفعل، اضبطه من /dashboard (صفحة السجن) أول.');
            await jail.jailMember(t, cfg, by);
            return done(i, ctx, `⛓️ تم سجن ${t}\nالسبب: ${why}`);
        }
        case 'فك_سجن': {
            const t = await needTarget(); if (!t) return;
            const cfg = jail.get(g.id);
            if (!cfg.roleId) return fail(i, 'نظام السجن مو مضبوط، اضبطه من /dashboard أول.');
            await jail.unjailMember(t, cfg, by);
            return done(i, ctx, `🔓 تم فك سجن ${t}`);
        }
        case 'مسح': {
            await i.deferReply({ flags: EPH });
            let msgs = await i.channel.messages.fetch({ limit: 100 });
            const u = o.getUser('عضو');
            if (u) msgs = msgs.filter(m => m.author.id === u.id);
            const del = await i.channel.bulkDelete([...msgs.values()].slice(0, o.getInteger('العدد')), true);
            return done(i, ctx, `🧹 تم مسح **${del.size}** رسالة في ${i.channel}`);
        }
        case 'قفل':
            await i.channel.permissionOverwrites.edit(g.roles.everyone, { SendMessages: false }, { reason: by });
            return done(i, ctx, `🔒 تم قفل ${i.channel}`);
        case 'فتح':
            await i.channel.permissionOverwrites.edit(g.roles.everyone, { SendMessages: null }, { reason: by });
            return done(i, ctx, `🔓 تم فتح ${i.channel}`);
        case 'بطيء': {
            const s = o.getInteger('الثواني');
            await i.channel.setRateLimitPerUser(s, by);
            return done(i, ctx, s ? `🐢 الوضع البطيء: **${s}** ثانية` : '⚡ تم إلغاء الوضع البطيء');
        }
        case 'رتبة_اضافة':
        case 'رتبة_ازالة': {
            const t = tgt();
            if (!t) return fail(i, 'ما لقيت العضو بالسيرفر.');
            const role = o.getRole('الرتبة');
            if (role.managed || role.id === g.id || role.position >= g.members.me.roles.highest.position)
                return fail(i, 'ما أقدر أتحكم بهذي الرتبة (رتبتي لازم تكون أعلى منها).');
            if (n === 'رتبة_اضافة') await t.roles.add(role, by); else await t.roles.remove(role, by);
            return done(i, ctx, `${n === 'رتبة_اضافة' ? '➕ تمت إضافة' : '➖ تمت إزالة'} الرتبة **${role.name}** ${n === 'رتبة_اضافة' ? 'إلى' : 'من'} ${t}`);
        }
        case 'لقب': {
            const t = tgt();
            if (!t) return fail(i, 'ما لقيت العضو بالسيرفر.');
            const nick = o.getString('اللقب');
            await t.setNickname(nick || null, by);
            return done(i, ctx, nick ? `✏️ لقب ${t} صار **${nick}**` : `✏️ تم حذف لقب ${t}`);
        }
        case 'صوت': {
            const t = await needTarget(); if (!t) return;
            if (!t.voice.channel) return fail(i, 'العضو مو بالفويس.');
            const a = o.getString('الاجراء');
            if (a === 'mute') await t.voice.setMute(true, by);
            else if (a === 'unmute') await t.voice.setMute(false, by);
            else if (a === 'deafen') await t.voice.setDeaf(true, by);
            else if (a === 'undeafen') await t.voice.setDeaf(false, by);
            else await t.voice.disconnect(by);
            return done(i, ctx, `🎙️ تم تنفيذ (${a}) على ${t}`);
        }
        case 'نقل': {
            const t = await needTarget(); if (!t) return;
            if (!t.voice.channel) return fail(i, 'العضو مو بالفويس.');
            const ch = o.getChannel('الروم');
            await t.voice.setChannel(ch, by);
            return done(i, ctx, `🚚 تم نقل ${t} إلى ${ch}`);
        }
        case 'اعلان': {
            const ch = o.getChannel('الروم') || i.channel;
            const text = o.getString('النص');
            const title = o.getString('العنوان') || '📢 إعلان ملكي';
            const image = (o.getString('الشكل') || 'img') === 'img';
            // نأجّل الرد: رسم الصورة + تنزيل صورة المرسل ياخذ وقت، ومهلة ديسكورد ٣ ثواني
            await i.deferReply().catch(() => {});
            const payload = await announcePayload({
                title, text, image, server: i.guild && i.guild.name,
                avatarURL: i.user.displayAvatarURL({ extension: 'png', size: 256 }),
                name: i.member ? i.member.displayName : i.user.username,
                by: i.user.username, footerBy: i.user.username
            });
            await ch.send(payload);
            return done(i, ctx, `📨 تم إرسال الإعلان في ${ch}${image ? ' (كصورة مصممة 🖼️)' : ''}${image && !payload.files ? ' — تعذّر الرسم فرُسل نص عادي' : ''}`);
        }
        case 'تحذير': {
            const t = await needTarget(); if (!t) return;
            const db = store.read('warnings.json', {});
            const key = `${g.id}:${t.id}`;
            (db[key] = db[key] || []).push({ by: i.user.id, why, at: Date.now() });
            store.write('warnings.json', db);
            const c = db[key].length;
            return done(i, ctx, `⚠️ تحذير رقم **${c}** لـ ${t}\nالسبب: ${why}${c >= 3 ? '\n🚨 وصل 3 تحذيرات أو أكثر!' : ''}`);
        }
        case 'تحذيرات': {
            const t = o.getUser('عضو');
            const list = store.read('warnings.json', {})[`${g.id}:${t.id}`] || [];
            if (!list.length) return i.reply({ content: `✅ ${t} ما عنده تحذيرات.`, flags: EPH });
            const txt = list.slice(-10).map((w, k) => `**${k + 1}.** ${w.why} (${ts(w.at)})`).join('\n');
            return i.reply({ content: `⚠️ تحذيرات ${t} (${list.length}):\n${txt}`, flags: EPH });
        }
        case 'معلومات_عضو': {
            const m = o.getMember('عضو') || i.member;
            const e = new EmbedBuilder().setColor(0x8b0000).setTitle(m.user.tag)
                .setThumbnail(m.displayAvatarURL())
                .addFields(
                    { name: 'الآي دي', value: m.id, inline: true },
                    { name: 'المستوى', value: tierName[ctx.getTier(m.id, m)], inline: true },
                    { name: 'أنشأ الحساب', value: ts(m.user.createdTimestamp), inline: true },
                    { name: 'دخل السيرفر', value: m.joinedTimestamp ? ts(m.joinedTimestamp) : 'غير معروف', inline: true },
                    { name: 'الرتب', value: m.roles.cache.filter(r => r.id !== g.id).map(r => `${r}`).join(' ') || 'لا يوجد' }
                );
            return i.reply({ embeds: [e] });
        }
        case 'معلومات_سيرفر': {
            const e = new EmbedBuilder().setColor(0xb3121e).setTitle(g.name)
                .setThumbnail(g.iconURL())
                .addFields(
                    { name: 'الأعضاء', value: String(g.memberCount), inline: true },
                    { name: 'الرومات', value: String(g.channels.cache.size), inline: true },
                    { name: 'الرتب', value: String(g.roles.cache.size), inline: true },
                    { name: 'البوستات', value: String(g.premiumSubscriptionCount || 0), inline: true },
                    { name: 'تاريخ الإنشاء', value: ts(g.createdTimestamp), inline: true }
                );
            return i.reply({ embeds: [e] });
        }
    }
}

async function handle(i, ctx) {
    const level = LEVEL[i.commandName];
    if (!level) return false;
    const tier = ctx.getTier(i.user.id, i.member);
    const owner = (ctx.access && ctx.access.isTop)
        ? ctx.access.isTop(i.guild, i.member, tier, ctx.CONFIG)
        : (tier === 'arthur' || tier === 'ida');
    if (!(owner || (level === 'royal' && tier === 'royal'))) {
        await i.reply({
            content: level === 'owner'
                ? (ctx.access ? ctx.access.denyTextOwner(i.guild, ctx.CONFIG) : '⛔ هذا الأمر للإدارة فقط! 👑')
                : (ctx.access ? ctx.access.denyTextRanks(i.guild, ctx.CONFIG) : '⛔ هذا الأمر للإدارة فقط! 💅'),
            flags: EPH
        });
        return true;
    }
    try {
        await run(i, tier, ctx);
    } catch (err) {
        console.error('❌ خطأ إداري:', i.commandName, err.message);
        await fail(i, 'ما قدرت أنفذ. تأكد إن رتبة البوت أعلى من العضو/الرتبة وإن عنده الصلاحية المطلوبة.').catch(() => {});
    }
    return true;
}

module.exports = { commands, handle, run, LEVEL, announcePayload };
