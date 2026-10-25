// 🎮 أوامر إضافية — ألعاب تفاعلية + أدوات + أوامر إدارية ناقصة
// ----------------------------------------------------------------------------
//  الألعاب:
//    ⭕ /إكس_او      — لعبة إكس أو بين عضوين بأزرار (الفائز +20 نقطة · تعادل +5)
//    💰 /من_سيربح    — ٥ أسئلة اختيار من متعدد بأزرار (١٠ نقاط لكل جواب صح)
//  الأدوات:
//    📊 /استفتاء     — تصويت من ٢ إلى ٥ خيارات بأزرار + نسب حية
//    🤔 /لو_خيرتك    — اختيار صعب عشوائي بين شيئين + نسب
//    ⏰ /تذكير       — يذكّرك بعد عدد دقائق (بمنشن)
//    🖼️ /افاتار      — صورة العضو + بانره
//  الإدارة (للملكيين):
//    ⚠️ /تحذيراتي          — تحذيراتك انت (يشتغل للكل)
//    🚫 /قائمة_المحظورين   — المحظورين بالسبب
//    🧹 /مسح_عضو          — حذف آخر رسائل عضو معيّن
//
//  ملاحظات: كل الحالات بالذاكرة (ما تنحفظ على القرص) — إعادة التشغيل تنهي الألعاب.
// ============================================================================
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const store = require('./store');
const points = require('./points');

const EPH = MessageFlags.Ephemeral;
const COLOR = 0xb3121e;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rid = () => Math.random().toString(36).slice(2, 9);
const at = (t) => `<t:${Math.floor(t / 1000)}:R>`;

// ===== المستخدم مؤهل للأوامر الإدارية؟ =====
function isRoyal(i, ctx) {
    try {
        const tier = ctx.getTier(i.user.id, i.member);
        const top = (ctx.access && ctx.access.isTop)
            ? ctx.access.isTop(i.guild, i.member, tier, ctx.CONFIG)
            : (tier === 'arthur' || tier === 'ida');
        return !!(top || tier === 'royal');
    } catch { return false; }
}

// ============================================================================
// ⭕ إكس أو
// ============================================================================
const xo = new Map();               // id -> { id, x, o, turn, board, gid, over }
const XO_LIFE = 5 * 60_000;         // تنتهي اللعبة بعد ٥ دقائق
const XO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function xoResult(b) {
    for (const [a, c, d] of XO_LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return b.every(Boolean) ? 'draw' : null;
}

function xoRows(g) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
            const idx = r * 3 + c;
            const v = g.board[idx];
            row.addComponents(new ButtonBuilder()
                .setCustomId('xo:' + g.id + ':' + idx)
                .setLabel(v === 'x' ? 'X' : v === 'o' ? 'O' : '·')
                .setStyle(v === 'x' ? ButtonStyle.Danger : v === 'o' ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!!v || !!g.over));
        }
        rows.push(row);
    }
    return rows;
}

const xoText = (g) => `⭕ **إكس أو**\n❌ <@${g.x}> ضد ⭕ <@${g.o}>\n`
    + (g.over ? '⌛ انتهت' : `الدور: ${g.turn === 'x' ? `<@${g.x}>` : `<@${g.o}>`}`);

async function startXO(i) {
    const opp = i.options.getUser('الخصم');
    if (!opp) return i.reply({ content: 'اختار خصمك أول 🙂', flags: EPH });
    if (opp.bot) return i.reply({ content: '🤖 ما أقدر ألعب ضد بوت — اختار عضو حقيقي.', flags: EPH });
    if (opp.id === i.user.id) return i.reply({ content: '🙃 تحتاج خصم غيرك!', flags: EPH });

    const id = rid();
    const g = { id, x: i.user.id, o: opp.id, turn: 'x', board: Array(9).fill(''), gid: i.guild.id, over: false, at: Date.now() };
    xo.set(id, g);
    setTimeout(() => xo.delete(id), XO_LIFE);
    return i.reply({ content: xoText(g), components: xoRows(g) });
}

async function xoClick(i) {
    const [, id, idxRaw] = i.customId.split(':');
    const g = xo.get(id);
    if (!g) return i.reply({ content: '⌛ هذي اللعبة انتهت — سوّ وحدة جديدة بـ`/إكس_او`.', flags: EPH });
    const idx = Number(idxRaw);
    const me = i.user.id;
    const sym = me === g.x ? 'x' : me === g.o ? 'o' : null;
    if (!sym) return i.reply({ content: '🚫 هذي مو لعبتك — سوّ لعبتك مع خصمك.', flags: EPH });
    if (g.over) return i.reply({ content: '⌛ انتهت اللعبة.', flags: EPH });
    if (sym !== g.turn) return i.reply({ content: '⏳ مو دورك، انتظر خصمك.', flags: EPH });
    if (g.board[idx] || !Number.isInteger(idx)) return i.reply({ content: '🚫 المربع مشغول.', flags: EPH });

    g.board[idx] = sym;
    const w = xoResult(g.board);
    if (w) {
        g.over = true;
        xo.delete(id);
        let tail = '';
        if (w === 'draw') {
            await points.add(g.gid, g.x, 5).catch(() => null);
            await points.add(g.gid, g.o, 5).catch(() => null);
            tail = '\n🤝 **تعادل!** كل واحد +5 نقاط';
        } else {
            const winner = w === 'x' ? g.x : g.o;
            const doc = await points.add(g.gid, winner, 20).catch(() => null);
            tail = `\n🏆 الفائز: <@${winner}> **+20 نقطة**` + (doc ? ` (المجموع ${doc.points})` : '');
        }
        return i.update({ content: `⭕ **إكس أو** — ${w === 'draw' ? 'تعادل 🤝' : `الفائز <@${w === 'x' ? g.x : g.o}> 🏆`}${tail}`, components: xoRows(g) });
    }
    g.turn = g.turn === 'x' ? 'o' : 'x';
    return i.update({ content: xoText(g), components: xoRows(g) });
}

// ============================================================================
// 💰 من سيربح
// ============================================================================
const MQ = [
    { q: 'ما أطول نهر في العالم؟', a: ['النيل', 'الأمازون', 'المسيسيبي', 'الفرات'], c: 0 },
    { q: 'كم عدد أيام السنة الميلادية العادية؟', a: ['365', '366', '360', '354'], c: 0 },
    { q: 'ما عاصمة اليابان؟', a: ['طوكيو', 'بكين', 'سيول', 'بانكوك'], c: 0 },
    { q: 'أي كوكب هو الأقرب للشمس؟', a: ['عطارد', 'الزهرة', 'الأرض', 'المريخ'], c: 0 },
    { q: 'كم عدد قارات العالم؟', a: ['7', '6', '5', '8'], c: 0 },
    { q: 'ما أكبر محيط في العالم؟', a: ['الهادي', 'الأطلسي', 'الهندي', 'المتجمد الشمالي'], c: 0 },
    { q: 'أي حيوان يُلقّب بـ«سفينة الصحراء»؟', a: ['الجمل', 'الحصان', 'الفيل', 'النعامة'], c: 0 },
    { q: 'كم عدد لاعبي فريق كرة القدم داخل الملعب؟', a: ['11', '10', '12', '9'], c: 0 },
    { q: 'ما العنصر الكيميائي رمزه O؟', a: ['الأكسجين', 'الذهب', 'الحديد', 'الكربون'], c: 0 },
    { q: 'في أي قارة تقع مصر؟', a: ['أفريقيا', 'آسيا', 'أوروبا', 'أستراليا'], c: 0 },
    { q: 'ما أسرع حيوان بري؟', a: ['الفهد', 'الأسد', 'الحصان', 'الغزال'], c: 0 },
    { q: 'كم عدد حروف اللغة العربية؟', a: ['28', '26', '29', '27'], c: 0 },
    { q: 'ما أكبر كوكب في المجموعة الشمسية؟', a: ['المشتري', 'زحل', 'الأرض', 'نبتون'], c: 0 },
    { q: 'من رسم لوحة الموناليزا؟', a: ['ليوناردو دافنشي', 'بيكاسو', 'فان جوخ', 'مايكل أنجلو'], c: 0 },
    { q: 'كم عدد أضلاع الشكل السداسي؟', a: ['6', '5', '7', '8'], c: 0 },
    { q: 'ما العملة الرسمية في اليابان؟', a: ['الين', 'اليوان', 'الوون', 'الروبية'], c: 0 },
    { q: 'أي بحر يفصل بين مصر والسعودية؟', a: ['البحر الأحمر', 'البحر المتوسط', 'الخليج العربي', 'بحر العرب'], c: 0 },
    { q: 'ما أطول جبل في العالم؟', a: ['إيفرست', 'كليمنجارو', 'مونت بلانك', 'الألب'], c: 0 },
    { q: 'كم عدد أشهر السنة؟', a: ['12', '11', '13', '10'], c: 0 },
    { q: 'ما الحيوان الذي يُعرف بملك الغابة؟', a: ['الأسد', 'النمر', 'الفيل', 'الذئب'], c: 0 }
];
const mq = new Map();               // id -> { id, uid, gid, qs, qi, score }
const MQ_ROUNDS = 5;
const MQ_TIME = 30_000;

// نخلط الخيارات عشان الجواب الصحيح ما يكون دايماً الأول
function mqBuild() {
    return MQ.slice().sort(() => Math.random() - 0.5).slice(0, MQ_ROUNDS).map(q => {
        const opts = q.a.map((t, k) => ({ t, ok: k === q.c })).sort(() => Math.random() - 0.5);
        return { q: q.q, opts, c: opts.findIndex(o => o.ok) };
    });
}

function mqRows(g) {
    const q = g.qs[g.qi];
    const row = new ActionRowBuilder();
    const letters = ['أ', 'ب', 'ج', 'د'];
    q.opts.forEach((o, k) => {
        row.addComponents(new ButtonBuilder()
            .setCustomId(`mq:${g.id}:${g.qi}:${k}`)
            .setLabel(letters[k] + ') ' + o.t)
            .setStyle(ButtonStyle.Secondary));
    });
    return [row];
}

function mqText(g) {
    const q = g.qs[g.qi];
    return `💰 **من سيربح** — سؤال **${g.qi + 1}** من **${g.qs.length}**\n`
        + `النقاط: **${g.score}**\n\n## ${q.q}`;
}

async function startMQ(i) {
    const g = { id: rid(), uid: i.user.id, gid: i.guild.id, qs: mqBuild(), qi: 0, score: 0 };
    mq.set(g.id, g);
    setTimeout(() => mq.delete(g.id), (MQ_TIME + 5000) * MQ_ROUNDS);
    return i.reply({ content: mqText(g), components: mqRows(g) });
}

async function mqClick(i) {
    const [, id, qiRaw, chRaw] = i.customId.split(':');
    const g = mq.get(id);
    if (!g) return i.reply({ content: '⌛ خلصت اللعبة — ابدأ واحدة جديدة بـ`/من_سيربح`.', flags: EPH });
    if (i.user.id !== g.uid) return i.reply({ content: '🚫 هذي مو لعبتك — سوّ لعبتك انت.', flags: EPH });
    if (Number(qiRaw) !== g.qi) return i.reply({ content: '⌛ هذا سؤال قديم.', flags: EPH });

    const q = g.qs[g.qi];
    const ch = Number(chRaw);
    const right = ch === q.c;
    if (right) g.score += 10;
    const letters = ['أ', 'ب', 'ج', 'د'];
    const head = right ? '✅ صح!' : `❌ غلط — الجواب: **${letters[q.c]}) ${q.opts[q.c].t}**`;
    g.qi++;

    if (!right || g.qi >= g.qs.length) {
        mq.delete(id);
        const doc = g.score ? await points.add(g.gid, g.uid, g.score).catch(() => null) : null;
        return i.update({
            content: `${head}\n\n🏁 **خلصت!** مجموعك **${g.score}** نقطة`
                + (doc ? ` — رصيدك الحالي ${doc.points}` : '') + '\n(ابدأ جولة جديدة بـ`/من_سيربح`)',
            components: []
        });
    }
    return i.update({ content: `${head}\n\n` + mqText(g), components: mqRows(g) });
}

// ============================================================================
// 📊 استفتاء + 🤔 لو خيرتك
// ============================================================================
const polls = new Map();            // id -> { id, gid, question, opts, votes: Map(uid->idx), multi }
const WYR = [
    ['بيتزا', 'برجر'], ['بحر', 'جبل'], ['قهوة', 'شاي'], ['ليل', 'نهار'],
    ['سفر للفضاء', 'سفر لأعماق البحر'], ['تقرأ كتاب', 'تسمع بودكاست'],
    ['تعيش بدون نت', 'تعيش بدون قهوة'], ['سيارة سريعة', 'بيت كبير'],
    ['مقابلة شخصية', 'مكالمة فيديو'], ['صيف', 'شتاء'], ['حلو', 'مالح'],
    ['تعرف المستقبل', 'تغيّر الماضي']
];
const BARS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

function pollEmbed(p, closed) {
    const total = p.votes.size || 0;
    const lines = p.opts.map((o, k) => {
        const n = [...p.votes.values()].filter(v => v === k).length;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const bar = '▰'.repeat(Math.round(pct / 10)) + '▱'.repeat(10 - Math.round(pct / 10));
        return `${BARS[k]} **${o}**\n${bar} ${pct}% (${n})`;
    }).join('\n\n');
    return new EmbedBuilder().setColor(COLOR)
        .setTitle(p.wyr ? '🤔 لو خيرتك…' : '📊 استفتاء')
        .setDescription(`## ${p.question}\n\n${lines}`)
        .setFooter({ text: (closed ? 'انتهى التصويت · ' : '') + `${total} مصوّت` });
}

function pollRows(p, closed) {
    const row = new ActionRowBuilder();
    p.opts.forEach((o, k) => {
        row.addComponents(new ButtonBuilder()
            .setCustomId(`poll:${p.id}:${k}`)
            .setLabel((BARS[k] + ' ' + o).slice(0, 80))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!!closed));
    });
    return [row];
}

async function startPoll(i, wyr) {
    let opts, question;
    if (wyr) {
        const pair = pick(WYR);
        question = 'أي وحدة تختار؟';
        opts = pair.slice();
    } else {
        question = String(i.options.getString('سؤال') || '').trim();
        opts = String(i.options.getString('خيارات') || '').split(/[|،,]/).map(x => x.trim()).filter(Boolean).slice(0, 5);
        if (!question) return i.reply({ content: 'اكتب سؤال الاستفتاء 🙂', flags: EPH });
        if (opts.length < 2) return i.reply({ content: 'حط خيارين على الأقل، افصل بينها بـ`|`\nمثال: `بيتزا | برجر | كبسة`', flags: EPH });
    }
    const p = { id: rid(), gid: i.guild.id, question, opts, votes: new Map(), wyr: !!wyr };
    polls.set(p.id, p);
    setTimeout(() => polls.delete(p.id), 24 * 3600_000);
    return i.reply({ embeds: [pollEmbed(p)], components: pollRows(p) });
}

async function pollClick(i) {
    const [, id, kRaw] = i.customId.split(':');
    const p = polls.get(id);
    if (!p) return i.reply({ content: '⌛ هذا التصويت انتهى.', flags: EPH });
    const k = Number(kRaw);
    const old = p.votes.get(i.user.id);
    p.votes.set(i.user.id, k);
    await i.update({ embeds: [pollEmbed(p)], components: pollRows(p) }).catch(() => {});
    if (old === k) return;
    return;
}

// ============================================================================
// ⏰ تذكير
// ============================================================================
const reminders = new Map();        // uid -> عدد التذكيرات النشطة
const REM_MAX = 5;

async function remind(i) {
    const mins = i.options.getInteger('بعد');
    const what = String(i.options.getString('وش') || '').trim().slice(0, 300);
    if (!mins || mins < 1) return i.reply({ content: 'حدد المدة بالدقائق (١ على الأقل).', flags: EPH });
    if (!what) return i.reply({ content: 'اكتب وش أذكّرك فيه 🙂', flags: EPH });
    const n = reminders.get(i.user.id) || 0;
    if (n >= REM_MAX) return i.reply({ content: `⏳ عندك ${n} تذكيرات شغالة — خلّها تخلص أول.`, flags: EPH });

    reminders.set(i.user.id, n + 1);
    const when = Date.now() + mins * 60_000;
    const ch = i.channel;
    const uid = i.user.id;
    setTimeout(async () => {
        reminders.set(uid, Math.max(0, (reminders.get(uid) || 1) - 1));
        try { await ch.send(`⏰ <@${uid}> تذكيرك: **${what}**`); } catch { }
    }, mins * 60_000);

    return i.reply({
        content: `⏰ أبشر — أذكّرك ${at(when)} (بعد **${mins}** دقيقة)\n📝 ${what}`,
        flags: EPH
    });
}

// ============================================================================
// 🖼️ افاتار
// ============================================================================
async function avatar(i) {
    const u = i.options.getUser('عضو') || i.user;
    let full = u;
    try { full = await u.fetch(true); } catch { }
    const e = new EmbedBuilder().setColor(COLOR).setTitle(`🖼️ ${full.username}`)
        .setImage(full.displayAvatarURL({ extension: 'png', size: 1024 }));
    const banner = full.bannerURL ? full.bannerURL({ extension: 'png', size: 1024 }) : null;
    if (banner) e.setThumbnail(banner);
    return i.reply({ embeds: [e] });
}

// ============================================================================
// ⚠️ تحذيراتي
// ============================================================================
async function myWarns(i) {
    const list = store.read('warnings.json', {})[`${i.guild.id}:${i.user.id}`] || [];
    if (!list.length) return i.reply({ content: '✅ ما عندك أي تحذير — سجلك نظيف.', flags: EPH });
    const txt = list.slice(-10).map((w, k) => `**${k + 1}.** ${w.why || 'بدون سبب'} (${at(w.at || Date.now())})`).join('\n');
    return i.reply({ content: `⚠️ عندك **${list.length}** تحذير:\n${txt}`, flags: EPH });
}

// ============================================================================
// 🚫 قائمة المحظورين · 🧹 مسح رسائل عضو
// ============================================================================
async function banList(i, ctx) {
    if (!isRoyal(i, ctx)) return i.reply({ content: ctx.access ? ctx.access.denyTextRanks(i.guild, ctx.CONFIG) : '⛔ للإدارة فقط', flags: EPH });
    let bans;
    try { bans = await i.guild.bans.fetch(); }
    catch { return i.reply({ content: '⚠️ ما أقدر أقرأ قائمة المحظورين — تأكد إن البوت عنده صلاحية **حظر الأعضاء**.', flags: EPH }); }
    if (!bans.size) return i.reply({ content: '✅ ما فيه أحد محظور بهالسيرفر.', flags: EPH });
    const arr = [...bans.values()];
    const txt = arr.slice(0, 25).map((b, k) => `**${k + 1}.** ${b.user.tag} — ${(b.reason || 'بدون سبب').slice(0, 80)}`).join('\n');
    return i.reply({
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`🚫 المحظورين (${arr.length})`)
            .setDescription(txt.slice(0, 3900))
            .setFooter({ text: arr.length > 25 ? `يعرض أول ٢٥ من ${arr.length}` : 'القائمة كاملة' })]
    });
}

async function purgeUser(i, ctx) {
    if (!isRoyal(i, ctx)) return i.reply({ content: ctx.access ? ctx.access.denyTextRanks(i.guild, ctx.CONFIG) : '⛔ للإدارة فقط', flags: EPH });
    const t = i.options.getUser('عضو');
    const n = Math.min(100, Math.max(1, i.options.getInteger('العدد') || 20));
    await i.deferReply({ flags: EPH }).catch(() => { });
    try {
        const msgs = await i.channel.messages.fetch({ limit: 100 });
        const old = Date.now() - 14 * 864e5;
        const arr = [...msgs.values()]
            .filter(m => m.author && m.author.id === t.id && m.createdTimestamp > old)
            .slice(0, n);
        if (!arr.length) return i.editReply(`🤷 ما لقيت رسائل لـ ${t} في آخر ١٠٠ رسالة (أو أقدم من ١٤ يوم).`);
        const done = await i.channel.bulkDelete(arr, true);
        return i.editReply(`🧹 مسحت **${done.size}** رسالة لـ ${t}.`);
    } catch (e) {
        return i.editReply('⚠️ ما قدرت أمسح: ' + (e.message || 'تأكد من صلاحية «إدارة الرسائل» وأن الرسائل أقل من ١٤ يوم.'));
    }
}

// ============================================================================
// الأوامر
// ============================================================================
const commands = [
    new SlashCommandBuilder().setName('إكس_او').setDescription('لعبة إكس أو بين عضوين ⭕')
        .addUserOption(o => o.setName('الخصم').setDescription('اللي تلعب ضده').setRequired(true)),
    new SlashCommandBuilder().setName('من_سيربح').setDescription('٥ أسئلة اختيار من متعدد وجوائز نقاط 💰'),
    new SlashCommandBuilder().setName('استفتاء').setDescription('تصويت بين ٢ إلى ٥ خيارات 📊')
        .addStringOption(o => o.setName('سؤال').setDescription('سؤال التصويت').setRequired(true).setMaxLength(200))
        .addStringOption(o => o.setName('خيارات').setDescription('افصل بينها بـ | مثال: بيتزا | برجر | كبسة').setRequired(true).setMaxLength(300)),
    new SlashCommandBuilder().setName('لو_خيرتك').setDescription('اختيار صعب بين شيئين 🤔'),
    new SlashCommandBuilder().setName('تذكير').setDescription('أذكّرك بعد عدد دقائق ⏰')
        .addIntegerOption(o => o.setName('بعد').setDescription('بعد كم دقيقة؟').setRequired(true).setMinValue(1).setMaxValue(2880))
        .addStringOption(o => o.setName('وش').setDescription('وش أذكّرك فيه؟').setRequired(true).setMaxLength(300)),
    new SlashCommandBuilder().setName('افاتار').setDescription('صورة العضو وبانره 🖼️')
        .addUserOption(o => o.setName('عضو').setDescription('العضو (الافتراضي أنت)')),
    new SlashCommandBuilder().setName('تحذيراتي').setDescription('تشوف تحذيراتك انت ⚠️'),
    new SlashCommandBuilder().setName('قائمة_المحظورين').setDescription('كل المحظورين وأسبابهم 🚫'),
    new SlashCommandBuilder().setName('مسح_عضو').setDescription('حذف آخر رسائل عضو معيّن 🧹')
        .addUserOption(o => o.setName('عضو').setDescription('العضو').setRequired(true))
        .addIntegerOption(o => o.setName('العدد').setDescription('كم رسالة؟ (الافتراضي ٢٠ · الحد ١٠٠)').setMinValue(1).setMaxValue(100))
].map(c => { try { c.setDMPermission(false); } catch { } return c.toJSON(); });

const NAMES = ['إكس_او', 'من_سيربح', 'استفتاء', 'لو_خيرتك', 'تذكير', 'افاتار', 'تحذيراتي', 'قائمة_المحظورين', 'مسح_عضو'];

async function handle(i, ctx) {
    if (!NAMES.includes(i.commandName)) return false;
    try {
        switch (i.commandName) {
            case 'إكس_او': await startXO(i); break;
            case 'من_سيربح': await startMQ(i); break;
            case 'استفتاء': await startPoll(i, false); break;
            case 'لو_خيرتك': await startPoll(i, true); break;
            case 'تذكير': await remind(i); break;
            case 'افاتار': await avatar(i); break;
            case 'تحذيراتي': await myWarns(i); break;
            case 'قائمة_المحظورين': await banList(i, ctx); break;
            case 'مسح_عضو': await purgeUser(i, ctx); break;
        }
    } catch (e) {
        console.error('❌ خطأ بالأمر الإضافي:', i.commandName, e.message);
        const msg = { content: '⚠️ ما قدرت أنفذ الأمر: ' + String(e.message || '').slice(0, 120), flags: EPH };
        if (i.replied || i.deferred) await i.followUp(msg).catch(() => { });
        else await i.reply(msg).catch(() => { });
    }
    return true;
}

async function handleButton(i) {
    const id = String((i && i.customId) || '');
    try {
        if (id.startsWith('xo:')) { await xoClick(i); return true; }
        if (id.startsWith('mq:')) { await mqClick(i); return true; }
        if (id.startsWith('poll:')) { await pollClick(i); return true; }
    } catch (e) {
        console.error('❌ خطأ بزر:', id, e.message);
        await i.reply({ content: '⚠️ صار خطأ، جرّب مرة ثانية.', flags: EPH }).catch(() => { });
        return true;
    }
    return false;
}

module.exports = {
    commands, handle, handleButton,
    // للاختبار
    xoClick, mqClick, pollClick, xoResult, xo, mq, polls, MQ, WYR, BARS,
    XO_LIFE, MQ_ROUNDS, REM_MAX, isRoyal
};
