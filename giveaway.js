// نظام القرعات: زر "دخول القرعة"، واختيار فائز/فائزين تلقائي عند انتهاء الوقت.
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } = require('discord.js');
const store = require('./store');
const art = require('./art');

const EPH = MessageFlags.Ephemeral;
const timers = new Map(); // messageId -> Timeout

const allGw = () => store.read('giveaways.json', {});
const save = (all) => store.write('giveaways.json', all);

function pickWinners(entrants, n) {
    const pool = [...entrants];
    const winners = [];
    while (pool.length && winners.length < n) winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return winners;
}

async function endGiveaway(client, messageId) {
    const all = allGw();
    const gw = all[messageId];
    if (!gw || gw.ended) return;
    gw.ended = true;
    timers.delete(messageId);
    if (refreshers.has(messageId)) { clearTimeout(refreshers.get(messageId)); refreshers.delete(messageId); }
    save(all);   // نسجّل الإنهاء فوراً (حتى لو فشل جلب الروم) عشان ما ينعاد
    try {
        const ch = await client.channels.fetch(gw.channelId).catch(() => null);
        if (!ch) return;
        const msg = await ch.messages.fetch(messageId).catch(() => null);
        const winners = pickWinners(gw.entrants, gw.winners);
        gw.wonIds = winners;        // نحفظ الفائزين عشان تظهر بلوحة التحكم
        gw.wonAt = Date.now();
        save(all);
        const text = winners.length ? winners.map(id => `<@${id}>`).join(' ، ') : 'ما فيه أحد دخل القرعة 😢';
        const e = new EmbedBuilder().setColor(0xb3121e).setTitle(`🎉 انتهت القرعة: ${gw.prize}`)
            .setDescription(`عدد المتسابقين: **${gw.entrants.length}**\nالفايز${gw.winners > 1 ? 'ين' : ''}: ${text}`);
        if (msg && [...msg.attachments.values()].some(a => a.name === 'giveaway.png')) e.setImage('attachment://giveaway.png');
        if (msg) await msg.edit({ embeds: [e], components: [] }).catch(() => {});
        if (winners.length) await ch.send({ content: `🎉 مبروك ${text}! فزتوا بـ **${gw.prize}**`, allowedMentions: { users: winners } });
    } catch (err) { console.error('❌ قرعة:', err.message); }
}

// ===== مشترك بين أمر السلاش ولوحة التحكم =====
function embedFor(prize, winners, endsAt, by, entrants = 0) {
    return new EmbedBuilder().setColor(0xb3121e).setTitle(`🎉 قرعة: ${prize}`)
        .setDescription(`اضغط الزر عشان تدخل القرعة!\nعدد الفائزين: **${winners}**\nالمتسابقون الآن: **${entrants}**\nتنتهي: <t:${Math.floor(endsAt / 1000)}:R>`)
        .setFooter({ text: by ? `بدأها ${by}` : 'من لوحة الإدارة' });
}
const joinRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gw_join').setLabel('🎉 دخول القرعة').setStyle(ButtonStyle.Success));

// يبني رسالة بدء القرعة كاملة: الـEmbed + الزر + بانر «قرعة نوفا» المصمم
async function startPayload(prize, winners, endsAt, by, entrants = 0) {
    const e = embedFor(prize, winners, endsAt, by, entrants);
    const payload = { embeds: [e], components: [joinRow()] };
    if (art.available()) {
        // بمهلة قصوى: لو الرسم تعطّل نرسل القرعة نص عادي بدل ما نعلّق الأمر
        const buf = await art.guard(art.giveawayCard({ prize, winners, endsAt, by, entrants }), 6000, 'بانر القرعة');
        if (buf) {
            e.setImage('attachment://giveaway.png');
            payload.files = [new AttachmentBuilder(buf, { name: 'giveaway.png' })];
        }
    }
    return payload;
}

// تسجيل قرعة جديدة (رسالة موجودة) + ضبط مؤقّت الإنهاء التلقائي
function register(client, msg, { guildId, channelId, prize, winners, endsAt, by }) {
    const all = allGw();
    all[msg.id] = { guildId, channelId, prize, winners, endsAt, by, entrants: [], ended: false };
    save(all);
    if (timers.has(msg.id)) clearTimeout(timers.get(msg.id));
    timers.set(msg.id, setTimeout(() => endGiveaway(client, msg.id), Math.max(0, endsAt - Date.now())));
    return msg.id;
}

// ===== تحديث البانر حيّاً =====
// كل ما دخل/طلع عضو نعيد رسم البطاقة ونحدّث العدّاد بالرسالة.
// بمهلة ١.٥ ثانية عشان لو دخلوا كذا واحد بنفس اللحظة ما نضرب الليمت بتحديثات كثيرة.
const refreshers = new Map();   // messageId -> Timeout
function scheduleRefresh(client, id) {
    if (refreshers.has(id)) return;
    refreshers.set(id, setTimeout(() => {
        refreshers.delete(id);
        refreshBanner(client, id).catch(() => {});
    }, 1500));
}
async function refreshBanner(client, id) {
    const all = allGw();
    const gw = all[id];
    if (!gw || gw.ended) return;
    const ch = await client.channels.fetch(gw.channelId).catch(() => null);
    if (!ch) return;
    const msg = await ch.messages.fetch(id).catch(() => null);
    if (!msg) return;
    const n = gw.entrants.length;
    const e = embedFor(gw.prize, gw.winners, gw.endsAt, gw.by, n);
    const payload = { embeds: [e] };
    const had = [...msg.attachments.values()].some(a => a.name === 'giveaway.png');
    let buf = null;
    if (art.available()) {
        buf = await art.guard(art.giveawayCard({ prize: gw.prize, winners: gw.winners, endsAt: gw.endsAt, by: gw.by, entrants: n }), 6000, 'بانر القرعة');
    }
    if (buf) {
        e.setImage('attachment://giveaway.png');
        payload.files = [new AttachmentBuilder(buf, { name: 'giveaway.png' })];
    } else if (had) {
        e.setImage('attachment://giveaway.png');   // نخلي الصورة القديمة لو الرسم فشل
    }
    await msg.edit(payload).catch(() => {});
}
// بدء قرعة من أي مكان (لوحة التحكم): ترسل رسالة جديدة بالروم
async function launch(client, channel, { prize, winners, mins, by }) {
    const p = String(prize || '').trim().slice(0, 200);
    const n = Math.min(10, Math.max(1, Math.floor(Number(winners) || 1)));
    const m = Math.min(10080, Math.max(1, Math.floor(Number(mins) || 1)));
    if (!p) throw new Error('اكتب الجائزة');
    const endsAt = Date.now() + m * 60_000;
    const msg = await channel.send(await startPayload(p, n, endsAt, by, 0));
    register(client, msg, { guildId: channel.guild.id, channelId: channel.id, prize: p, winners: n, endsAt, by });
    return { id: msg.id, endsAt };
}
const list = () => allGw();
// إنهاء قرعة فوراً (نفس زر «إنهاء» بالأمر)
const end = (client, id) => endGiveaway(client, String(id || ''));
// إلغاء قرعة: يشيل المؤقّت + يحذف الرسالة + يمسحها من التخزين
async function cancel(client, id) {
    const key = String(id || '');
    const all = allGw();
    const gw = all[key];
    if (!gw) throw new Error('ما لقيت قرعة بهذا الآي دي');
    if (timers.has(key)) { clearTimeout(timers.get(key)); timers.delete(key); }
    if (refreshers.has(key)) { clearTimeout(refreshers.get(key)); refreshers.delete(key); }
    try {
        const ch = await client.channels.fetch(gw.channelId).catch(() => null);
        const msg = ch ? await ch.messages.fetch(key).catch(() => null) : null;
        if (msg) await msg.delete().catch(() => {});
    } catch (err) { console.error('❌ إلغاء قرعة:', err.message); }
    delete all[key];
    save(all);
}
// إعادة سحب الفائزين لقرعة منتهية (راتب ثاني)
async function reroll(client, id) {
    const key = String(id || '');
    const all = allGw();
    const gw = all[key];
    if (!gw) throw new Error('ما لقيت قرعة بهذا الآي دي');
    if (!gw.entrants.length) throw new Error('ما فيه أحد دخل القرعة');
    const winners = pickWinners(gw.entrants, gw.winners);
    const ch = await client.channels.fetch(gw.channelId).catch(() => null);
    if (!ch) throw new Error('الروم مو موجود');
    const text = winners.map(w => `<@${w}>`).join(' ، ');
    await ch.send({ content: `🔄 إعادة سحب قرعة **${gw.prize}** — الفايز${gw.winners > 1 ? 'ين' : ''}: ${text}`, allowedMentions: { users: winners } });
    return winners;
}

// يعيد جدولة القرعات اللي ما خلصت لو البوت انعاد تشغيله
function reschedule(client) {
    const all = allGw();
    for (const [id, gw] of Object.entries(all)) {
        if (gw.ended) continue;
        const left = gw.endsAt - Date.now();
        if (left <= 0) endGiveaway(client, id);
        else timers.set(id, setTimeout(() => endGiveaway(client, id), left));
    }
}

const commands = [
    new SlashCommandBuilder().setName('قرعة_بدء').setDescription('بدء قرعة جديدة (للإدارة فقط)')
        .addStringOption(o => o.setName('الجائزة').setDescription('وش الجائزة').setRequired(true).setMaxLength(200))
        .addIntegerOption(o => o.setName('الدقائق').setDescription('مدة القرعة بالدقائق').setRequired(true).setMinValue(1).setMaxValue(10080))
        .addIntegerOption(o => o.setName('الفائزين').setDescription('عدد الفائزين (افتراضي 1)').setMinValue(1).setMaxValue(10))
        .setDMPermission(false),
    new SlashCommandBuilder().setName('قرعة_انهاء').setDescription('إنهاء قرعة قبل وقتها')
        .addStringOption(o => o.setName('الايدي').setDescription('آي دي رسالة القرعة').setRequired(true))
        .setDMPermission(false)
].map(c => c.toJSON());

async function handle(i, ctx) {
    if (!['قرعة_بدء', 'قرعة_انهاء'].includes(i.commandName)) return false;
    const tier = ctx.getTier(i.user.id, i.member);
    if (tier !== 'arthur' && tier !== 'ida' && tier !== 'royal') {
        await i.reply({ content: '⛔ هذا الأمر خاص بأهل الرتبة الملكية فصاعداً!', flags: EPH });
        return true;
    }
    try {
        if (i.commandName === 'قرعة_بدء') {
            const prize = i.options.getString('الجائزة');
            const mins = i.options.getInteger('الدقائق');
            const winners = i.options.getInteger('الفائزين') || 1;
            const endsAt = Date.now() + mins * 60_000;
            // نأجّل الرد: رسم البانر ياخذ وقت، ومهلة ديسكورد ٣ ثواني
            await i.deferReply().catch(() => {});
            await i.editReply(await startPayload(prize, winners, endsAt, i.user.username, 0));
            const msg = await i.fetchReply();
            register(i.client, msg, { guildId: i.guild.id, channelId: i.channel.id, prize, winners, endsAt, by: i.user.username });
        } else {
            const id = i.options.getString('الايدي').trim();
            const all = allGw();
            if (!all[id]) return i.reply({ content: '⚠️ ما لقيت قرعة بهذا الآي دي.', flags: EPH });
            if (timers.has(id)) { clearTimeout(timers.get(id)); timers.delete(id); }
            await i.reply('✅ جاري إنهاء القرعة...');
            await endGiveaway(i.client, id);
        }
    } catch (err) {
        console.error('❌ خطأ قرعة:', err.message);
        if (!i.replied && !i.deferred) i.reply({ content: '⚠️ صار خطأ.', flags: EPH }).catch(() => {});
    }
    return true;
}

async function handleButton(i) {
    if (i.customId !== 'gw_join') return false;
    const all = allGw();
    const gw = all[i.message.id];
    if (!gw || gw.ended) { await i.reply({ content: '⚠️ القرعة خلصت.', flags: EPH }); return true; }
    const idx = gw.entrants.indexOf(i.user.id);
    if (idx === -1) {
        gw.entrants.push(i.user.id); save(all);
        await i.reply({ content: `✅ دخلت القرعة بالتوفيق! 🎉\nالمتسابقون الآن: **${gw.entrants.length}**`, flags: EPH });
    } else {
        gw.entrants.splice(idx, 1); save(all);
        await i.reply({ content: `❌ طلعت من القرعة.\nالمتسابقون الآن: **${gw.entrants.length}**`, flags: EPH });
    }
    // نحدّث البانر والعدّاد بالرسالة (بمهلة قصيرة عشان ما نضرب الليمت)
    scheduleRefresh(i.client, i.message.id);
    return true;
}

module.exports = {
    commands, handle, handleButton, reschedule,
    launch, register, list, end, cancel, reroll, pickWinners, startPayload
};
