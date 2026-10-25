// الألعاب: سرعة الكتابة، رياضيات، كلمة مبعثرة، أعلام. كل فوز يعطي نقاط.
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const points = require('./points');
const R = require('./replies');
const cards = require('./cards');
const art = require('./art');

const EPH = MessageFlags.Ephemeral;
const active = new Set();      // رومات فيها لعبة شغالة
const startCd = new Map();     // كولداون بدء اللعبة لكل عضو
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// توحيد النص العربي للمقارنة
const norm = (s) => String(s)
    .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim().toLowerCase();
const loose = (s) => norm(s).replace(/^ال/, '').replace(/ /g, '');
const digits = (s) => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();


// القوائم تتقرأ من لوحة التحكم (أو الافتراضي لو ما تعدلت)
const sentences = () => R.get('games.sentences');
const words = () => R.get('games.words');
const flags = () => R.get('games.flags')
    .map(l => { const [e, n] = l.split('=>'); return [(e || '').trim(), (n || '').split('|').map(x => x.trim()).filter(Boolean)]; })
    .filter(([e, n]) => e && n.length);

const games = {
    سرعة() {
        const s = pick(sentences());
        return {
            title: '⌨️ سرعة الكتابة', body: `اكتب الجملة بأسرع ما تقدر:\n\n## ${s}`, seconds: 30, answer: s,
            cardMain: s, cardSmall: 'اكتب الجملة بالضبط بأسرع ما تقدر', kind: 'text', iconName: 'type', game: 'سرعة الكتابة',
            check: (t) => norm(t) === norm(s), pts: (sec) => Math.max(5, Math.round(20 - sec))
        };
    },
    رياضيات() {
        const op = pick(['+', '-', '×']);
        let a = rand(10, 99), b = rand(10, 99);
        if (op === '×') { a = rand(2, 12); b = rand(2, 12); }
        if (op === '-' && b > a) [a, b] = [b, a];
        const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
        return {
            title: '🧮 رياضيات سريعة', body: `كم ناتج:\n\n## ${a} ${op} ${b}`, seconds: 15, answer: ans,
            cardMain: `${a} ${op} ${b}`, cardSmall: 'اكتب الناتج أرقام فقط', kind: 'digits', iconName: 'bolt', game: 'رياضيات سريعة',
            check: (t) => digits(t) === String(ans), pts: (sec) => (sec < 5 ? 15 : 10)
        };
    },
    مبعثرة() {
        const w = pick(words());
        let sc = w;
        while (sc === w) sc = [...w].sort(() => Math.random() - 0.5).join('');
        return {
            title: '🔤 الكلمة المبعثرة', body: `رتّب الحروف وكوّن الكلمة:\n\n## ${[...sc].join('  ')}`, seconds: 20, answer: w,
            cardMain: sc, cardSmall: 'رتّب الحروف وكوّن الكلمة', kind: 'tiles', iconName: 'tiles', game: 'الكلمة المبعثرة',
            check: (t) => norm(t) === norm(w), pts: () => 10
        };
    },
    اعلام() {
        const [emoji, names] = pick(flags());
        return {
            title: '🏳️ خمّن العلم', body: `وش اسم هالدولة؟\n\n# ${emoji}`, seconds: 20, answer: names[0],
            cardMain: emoji, flagEmoji: emoji, cardSmall: 'اكتب اسم الدولة', kind: 'flag', iconName: 'flag', game: 'خمّن العلم',
            check: (t) => names.some(n => loose(n) === loose(t)), pts: () => 10
        };
    },
    كلمة_السر() {
        const w = pick(words());
        const masked = [...w].map(ch => (ch === ' ' ? ' ' : '•')).join(' ');
        return {
            title: '🔐 كلمة السر', body: `خمّن الكلمة — عدد حروفها **${w.length}**\n\n## ${masked}`, seconds: 25, answer: w,
            cardMain: masked, cardSmall: `خمّن الكلمة — ${w.length} حروف`, kind: 'text', iconName: 'type', game: 'كلمة السر',
            check: (t) => norm(t) === norm(w), pts: () => 10
        };
    }
};

const commands = [
    ['سرعة', 'لعبة سرعة الكتابة'], ['رياضيات', 'لعبة الرياضيات السريعة'],
    ['مبعثرة', 'رتّب الحروف المبعثرة'], ['اعلام', 'خمّن العلم'],
    ['كلمة_السر', 'خمّن الكلمة من عدد حروفها']
].map(([n, d]) => new SlashCommandBuilder().setName(n).setDescription(d).setDMPermission(false).toJSON());

async function play(i, ctx, g) {
    const ch = i.channel;
    if (active.has(ch.id)) return i.reply({ content: '⏳ فيه لعبة شغالة بالروم، انتظر تخلص.', flags: EPH });
    if (Date.now() - (startCd.get(i.user.id) || 0) < 15_000)
        return i.reply({ content: '⏳ استنى شوي قبل لعبة جديدة.', flags: EPH });
    startCd.set(i.user.id, Date.now());
    active.add(ch.id);
    try {
        let promptSent = false;

        // نأجّل الرد أول: الرسم + تنزيل صورة العلم ممكن ياخذوا ثانيتين، ومهلة ديسكورد ٣ ثواني
        // → بدون التأجيل تطلع «did not respond». (الرد الوهمي بالكلام يدعمها كمان.)
        if (typeof i.deferReply === 'function') await i.deferReply().catch(() => {});
        const send = (o) => (i.editReply ? i.editReply(o).catch(() => {}) : i.reply(o));

        // ١) بطاقة نوفا الجديدة (نفس الهوية لكل الألعاب الأربعة — والعلم يجيب صورته الحقيقية)
        if (g.cardMain && art.available()) {
            let flag = null;
            if (g.flagEmoji) flag = await art.guard(art.flagImage(g.flagEmoji), 5000, 'علم اللعبة');
            if (!g.flagEmoji || flag) {
                const png = await art.guard(art.gameCard({
                    kind: g.kind || 'text', game: g.game || g.title, main: g.cardMain,
                    hint: g.cardSmall, seconds: g.seconds, flag, iconName: g.iconName
                }), 6000, 'بطاقة السؤال');
                if (png) { await send({ files: [new AttachmentBuilder(png, { name: 'game.png' })] }); promptSent = true; }
            }
        }

        // ٢) رجوع للبطاقة القديمة (بدون الأعلام — الإيموجي يطلع مربع بالبطاقة القديمة)، ٣) رجوع للـEmbed النصي
        if (!promptSent && g.cardMain && !g.flagEmoji && cards.available()) {
            const png = await art.guard(cards.gamePromptCard({ title: g.title, mainText: g.cardMain, small: g.cardSmall, seconds: g.seconds }), 6000, 'بطاقة السؤال القديمة');
            if (png) { await send({ files: [new AttachmentBuilder(png, { name: 'game.png' })] }); promptSent = true; }
        }
        if (!promptSent) {
            await send({ embeds: [new EmbedBuilder().setColor(0xb3121e).setTitle(g.title)
                .setDescription(g.body).setFooter({ text: `عندك ${g.seconds} ثانية، أول جواب صح يفوز` })] });
        }

        const t0 = Date.now();
        const got = await ch.awaitMessages({
            filter: (m) => !m.author.bot && g.check(m.content), max: 1, time: g.seconds * 1000
        });
        if (!got.size) return ch.send(`⌛ انتهى الوقت! الجواب: **${g.answer}**`);

        const m = got.first(), sec = (Date.now() - t0) / 1000, pts = g.pts(sec);
        const doc = await points.add(m.guild.id, m.author.id, pts).catch(() => null);
        const leveledUp = doc ? points.levelOf(doc.points) > points.levelOf(doc.points - pts) : false;
        const who = m.member ? m.member.displayName : m.author.username;

        if (art.available()) {
            const png = await art.guard(art.winCard({
                avatarURL: m.author.displayAvatarURL({ extension: 'png', size: 256 }),
                name: who, game: g.game || g.title, seconds: sec, points: pts,
                total: doc ? doc.points : null, leveledUp, level: doc ? points.levelOf(doc.points) : 0
            }), 6000, 'بطاقة الفوز');
            if (png) {
                await m.reply({ files: [new AttachmentBuilder(png, { name: 'win.png' })] }).catch(() => {});
                return;
            }
        }

        if (cards.available()) {
            const png = await art.guard(cards.gameWinCard({
                avatarURL: m.author.displayAvatarURL({ extension: 'png', size: 128 }),
                username: m.author.username, gameTitle: g.title, seconds: sec, points: pts,
                totalPoints: doc ? doc.points : null, leveledUp, level: doc ? points.levelOf(doc.points) : 0
            }), 6000, 'بطاقة الفوز القديمة');
            if (png) {
                await m.reply({ files: [new AttachmentBuilder(png, { name: 'win.png' })] }).catch(() => {});
                return;
            }
        }

        const tier = ctx.getTier(m.author.id, m.member);
        const icon = tier === 'arthur' ? '👑' : tier === 'ida' ? '🌸' : '🏆';
        let extra = '';
        if (doc) {
            extra = ` (+${pts} نقطة، المجموع ${doc.points})`;
            if (leveledUp) extra += `\n🎉 مبروك وصلت **المستوى ${points.levelOf(doc.points)}**!`;
        }
        await m.reply(`${icon} فاز ${m.author} خلال **${sec.toFixed(1)}** ثانية!${extra}`);
    } catch (err) {
        console.error('❌ خطأ لعبة:', err.message);
    } finally {
        active.delete(ch.id);
    }
}

async function handle(i, ctx) {
    if (!games[i.commandName]) return false;
    let g;
    try { g = games[i.commandName](); }
    catch { await i.reply({ content: '⚠️ قائمة هذي اللعبة فاضية أو فيها خطأ، راجعها من اللوحة.', flags: EPH }); return true; }
    await play(i, ctx, g);
    return true;
}

module.exports = { commands, handle, isActive: (id) => active.has(id) };
