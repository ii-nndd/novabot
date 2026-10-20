// نظام النقاط والمستويات (MongoDB). كل سيرفر له نقاطه المستقلة.
// بدون MONGODB_URI يبقى البوت شغال والنقاط معطلة فقط.
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { MongoClient } = require('mongodb');
const cards = require('./cards');
const art = require('./art');

let users = null;
const chatCd = new Map();
const levelOf = (p) => Math.floor(Math.sqrt(p / 50));
const needFor = (l) => 50 * l * l;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function init() {
    const uri = process.env.MONGODB_URI;
    if (!uri) return console.log('⚠️ MONGODB_URI غير مضبوط: النقاط معطلة');
    try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
        await client.connect();
        users = client.db(process.env.MONGODB_DB || 'divelbot').collection('users');
        await users.createIndex({ guildId: 1, userId: 1 }, { unique: true });
        await users.createIndex({ guildId: 1, points: -1 });
        console.log('🗄️ متصل بقاعدة البيانات');
    } catch (err) {
        users = null;
        console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
    }
}

const ready = () => !!users;

// إضافة/خصم قيم متعددة ويرجع بيانات العضو بعد التعديل (المجموع points = كتابي + صوتي + مكافآت)
async function bump(guildId, userId, inc) {
    if (!users) return null;
    const doc = await users.findOneAndUpdate(
        { guildId, userId },
        // مهم: ممنوع نحط textXp/voiceXp بـ$setOnInsert مع $inc على نفس الحقل
        // (مونقو يرفض: Updating the path 'textXp' would create a conflict at 'textXp')
        // و$inc ينشئ الحقل من نفسه لو مو موجود، فـcreatedAt يكفي هنا.
        { $inc: inc, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: 'after' }
    );
    if (doc && doc.points < 0) {
        await users.updateOne({ guildId, userId }, { $set: { points: 0 } });
        doc.points = 0;
    }
    return doc;
}

// مكافآت (ألعاب/إدارة): تزيد المجموع فقط بدون ما تنسب لمصدر
const add = (guildId, userId, amount) => bump(guildId, userId, { points: amount });
// خبرة التفاعل الكتابي
const addText = (guildId, userId, amount) => bump(guildId, userId, { points: amount, textXp: amount });
// خبرة التفاعل الصوتي (وقت التواجد بالفويس)
const addVoice = (guildId, userId, amount) => bump(guildId, userId, { points: amount, voiceXp: amount });

// جلب بيانات عضو (يرجع أصفار لو ما عنده سجل)
async function get(guildId, userId) {
    if (!users) return { points: 0, textXp: 0, voiceXp: 0 };
    const d = (await users.findOne({ guildId, userId })) || {};
    return { points: d.points || 0, textXp: d.textXp || 0, voiceXp: d.voiceXp || 0 };
}

// تعديل مباشر (من لوحة التحكم): قيم مطلقة
async function setXp(guildId, userId, patch) {
    if (!users) return null;
    const set = {};
    for (const field of ['points', 'textXp', 'voiceXp']) {
        const v = Number(patch[field]);
        if (Number.isFinite(v)) set[field] = Math.max(0, Math.floor(v));
    }
    if (!Object.keys(set).length) return null;
    return users.findOneAndUpdate(
        { guildId, userId },
        { $set: set, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: 'after' }
    );
}

// ترتيب العضو بالسيرفر (حسب المجموع)
async function rankOf(guildId, pointsVal) {
    if (!users) return 1;
    return (await users.countDocuments({ guildId, points: { $gt: pointsVal } })) + 1;
}

// قائمة المتصدرين (تنحسب من المجموع)
async function top(guildId, limit = 25) {
    if (!users) return [];
    return users.find({ guildId, points: { $gt: 0 } }).sort({ points: -1 }).limit(Math.min(100, limit)).toArray();
}

// ملف الرتبة الكامل: كتابي + صوتي + إجمالي + الترتيب + حدود المستويات
async function profile(guildId, userId) {
    const d = await get(guildId, userId);
    const totalLevel = levelOf(d.points), textLevel = levelOf(d.textXp), voiceLevel = levelOf(d.voiceXp);
    const rank = await rankOf(guildId, d.points);
    return {
        ...d, rank, totalLevel, textLevel, voiceLevel,
        lo: needFor(totalLevel), hi: needFor(totalLevel + 1),
        textLo: needFor(textLevel), textHi: needFor(textLevel + 1),
        voiceLo: needFor(voiceLevel), voiceHi: needFor(voiceLevel + 1)
    };
}

// يرسل بطاقة الرتبة (صورة احترافية) مع بديل نصي لو الرسم معطل
async function sendRank(target, user, guildId) {
    const p = await profile(guildId, user.id);
    // الرد الوهمي (أوامر الكلام) يدعم deferReply كذلك — والرسالة العادية ترجع reply مباشرة
    const send = (o) => (target.deferred && typeof target.editReply === 'function') ? target.editReply(o) : target.reply(o);
    if (cards.available()) {
        if (typeof target.deferReply === 'function') await target.deferReply().catch(() => {});
        const png = await art.guard(cards.rankCard({
            avatarURL: user.displayAvatarURL({ extension: 'png', size: 256 }),
            username: user.username, displayName: user.globalName || user.username,
            totalXp: p.points, totalLevel: p.totalLevel, lo: p.lo, hi: p.hi,
            textXp: p.textXp, textLevel: p.textLevel,
            voiceXp: p.voiceXp, voiceLevel: p.voiceLevel, rank: p.rank
        }), 7000, 'بطاقة الرتبة');
        if (png) return send({ files: [new AttachmentBuilder(png, { name: 'rank.png' })] }).catch(() => {});
    }
    const filled = Math.round(((p.points - p.lo) / Math.max(1, p.hi - p.lo)) * 10);
    const e = new EmbedBuilder().setColor(0xb3121e).setTitle(user.username)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: 'كتابي', value: `${p.textXp} (م${p.textLevel})`, inline: true },
            { name: 'صوتي', value: `${p.voiceXp} (م${p.voiceLevel})`, inline: true },
            { name: 'الإجمالي', value: `${p.points} (م${p.totalLevel})`, inline: true },
            { name: 'الترتيب', value: `#${p.rank}`, inline: true }
        )
        .setDescription(`${'█'.repeat(filled)}${'░'.repeat(10 - filled)}  ${p.points}/${p.hi} XP`);
    return send({ embeds: [e] });
}

const commands = [
    new SlashCommandBuilder().setName('نقاطي').setDescription('اعرض نقاطك ومستواك')
        .addUserOption(o => o.setName('عضو').setDescription('عضو آخر')).setDMPermission(false),
    new SlashCommandBuilder().setName('المتصدرين').setDescription('قائمة أعلى 10 أعضاء بالنقاط').setDMPermission(false),
    new SlashCommandBuilder().setName('نقاط_اضافة').setDescription('إضافة أو خصم نقاط (للإدارة فقط)')
        .addUserOption(o => o.setName('عضو').setDescription('العضو').setRequired(true))
        .addIntegerOption(o => o.setName('العدد').setDescription('رقم سالب للخصم').setRequired(true).setMinValue(-100000).setMaxValue(100000))
        .setDMPermission(false)
].map(c => c.toJSON());

async function handle(i, ctx) {
    if (!['نقاطي', 'المتصدرين', 'نقاط_اضافة'].includes(i.commandName)) return false;
    const EPH = MessageFlags.Ephemeral;
    if (!users) {
        await i.reply({ content: '⚠️ نظام النقاط غير مفعل بعد (قاعدة البيانات غير متصلة).', flags: EPH });
        return true;
    }
    const g = i.guild.id;
    try {
        if (i.commandName === 'نقاطي') {
            const u = i.options.getUser('عضو') || i.user;
            await sendRank(i, u, g);
        } else if (i.commandName === 'المتصدرين') {
            const top10 = await top(g, 10);
            if (!top10.length) { await i.reply('ما أحد عنده نقاط للحين!'); return true; }
            if (cards.available()) {
                try {
                    await i.deferReply();
                    const entries = [];
                    for (const d of top10) {
                        const user = await i.client.users.fetch(d.userId).catch(() => null);
                        entries.push({
                            name: user ? user.username : d.userId,
                            avatarURL: user ? user.displayAvatarURL({ extension: 'png', size: 64 }) : null,
                            points: d.points || 0,
                            totalLevel: levelOf(d.points || 0)
                        });
                    }
                    const png = await art.guard(cards.leaderboardCard(entries), 9000, 'بطاقة المتصدرين');
                    if (png) return i.editReply({ files: [new AttachmentBuilder(png, { name: 'leaderboard.png' })] });
                } catch (err) { console.error('❌ فشل رسم بطاقة المتصدرين:', err.message); }
            }
            const medals = ['🥇', '🥈', '🥉'];
            const lines = top10.map((d, k) => `${medals[k] || `**${k + 1}.**`} <@${d.userId}> — ${d.points} (مستوى ${levelOf(d.points)})`);
            const e = new EmbedBuilder().setColor(0xb3121e).setTitle('🏆 المتصدرين')
                .setDescription(lines.join('\n'));
            await (i.deferred ? i.editReply({ embeds: [e] }) : i.reply({ embeds: [e] }));
        } else {
            const tier = ctx.getTier(i.user.id, i.member);
            const top = ctx.access ? ctx.access.isTop(i.guild, i.member, tier, ctx.CONFIG) : (tier === 'arthur' || tier === 'ida');
            if (!top) {
                await i.reply({ content: ctx.access ? ctx.access.denyTextOwner(i.guild, ctx.CONFIG) : '⛔ هذا الأمر للإدارة فقط! 👑', flags: EPH });
                return true;
            }
            const u = i.options.getUser('عضو'), n = i.options.getInteger('العدد');
            const doc = await add(g, u.id, n);
            await i.reply(`${n >= 0 ? '➕' : '➖'} ${u}: ${n >= 0 ? '+' : ''}${n} نقطة، المجموع الآن **${doc.points}**`);
        }
    } catch (err) {
        console.error('❌ خطأ نقاط:', err.message);
        const msg = { content: '⚠️ صار خطأ بقاعدة البيانات.', flags: EPH };
        if (i.deferred && !i.replied) i.editReply(msg).catch(() => {});
        else if (!i.replied) i.reply(msg).catch(() => {});
    }
    return true;
}

module.exports = {
    init, commands, handle,
    // بيانات ومستويات
    ready, get, add, addText, addVoice, setXp, rankOf, top, profile, sendRank,
    levelOf, needFor
};
