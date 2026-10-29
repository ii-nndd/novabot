require('dotenv').config();
const {
    Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags, EmbedBuilder
} = require('discord.js');
const {
    joinVoiceChannel, entersState, VoiceConnectionStatus
} = require('@discordjs/voice');
const express = require('express');
const R = require('./replies');
const store = require('./store');
const botcontrol = require('./botcontrol');
const mountDashboard = require('./dashboard');
const welcome = require('./welcome');
const tickets = require('./tickets');
const admin = require('./admin');
const nlcommands = require('./nlcommands');
const points = require('./points');
const levels = require('./levels');
const games = require('./games');
const economy = require('./economy');
const giveaway = require('./giveaway');
const selfroles = require('./selfroles');
const jail = require('./jail');
const trap = require('./trap');
const guard = require('./guard');
const presence = require('./presence');
const hub = require('./hub');
const colors = require('./colors');
const reactions = require('./reactions');
const ai = require('./ai');
const extra = require('./extra');
const replies2 = require('./replies2');
const mountPanel = require('./panel');
const tunnel = require('./tunnel');
const tsfunnel = require('./tsfunnel');
const access = require('./access');
const cmdaccess = require('./cmdaccess');

// ====================================================================
// 1. الإعدادات (عدل الآي ديهات هنا فقط)
// ====================================================================
// ⚙️ كل الآيديات تنقرأ من .env أولاً — ولو ما كانت موجودة ترجع لقيم سيرفر نوفا.
//    يعني تقدر تشغّل البوت على أي سيرفر جديد بدون ما تلمس الكود: عدّل .env بس.
const CONFIG = {
    GUILD_ID: process.env.GUILD_ID || '1556028798183546900',
    VOICE_CHANNEL_ID: process.env.VOICE_CHANNEL_ID || '1556028799865327729',
    ARTHUR_ID: process.env.ARTHUR_ID || '848996426918002731',
    ROYAL_ROLE_ID: process.env.ROYAL_ROLE_ID || '1558453195976740975',
    SPECIAL_USER_ID: process.env.SPECIAL_USER_ID || '1542941271205875812',
    // اختياري: آي دي روم الكتابة اللي يرسل فيه ترحيب دخول ارثر وإيدا (اتركه فاضي لتعطيله)
    WELCOME_TEXT_CHANNEL_ID: process.env.WELCOME_TEXT_CHANNEL_ID || '',
    // اختياري: آي دي روم يسجل فيه البوت كل أوامر الإدارة (اتركه فاضي لتعطيله)
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || '',
    // أعضاء لهم شخصية/ردود خاصة بالبوت (بدون صلاحيات إدارية، بس أسلوب كلام مختلف)
    // الصيغة: 'آيدي العضو': 'اسم_الشخصية' — والردود تتحط بـ replies.base.js تحت greet.اسم_الشخصية الخ
    PERSONAS: {
        '1543980212537135148': 'rawan',  // روان - هوشة وتماسيك، أحياناً "عمتي" وأحياناً إنكار
        '1550879705115398156': 'nabd'    // نبض ارثر / حبيبة ارثر - دلع وحنية خاصة
    },
    // رتبة "بدون احترام": اللي عندهم هالرتبة بس يرجع لهم أسلوب البوت الفظ القديم. الكل غيرهم (حتى بدون رتبة) يعامله البوت باحترام
    DISRESPECT_ROLE_ID: process.env.DISRESPECT_ROLE_ID || '1559161253249949776',
    // 👑 ملكية بالسر (بدون صلاحيات صاحب البوت ولا ظهور): الافتراضي إيفا
    SECRET_ROYAL_IDS: process.env.SECRET_ROYAL_IDS || '1550879705115398156'
};

// 💘 أزواج «الحب» الثابتة — نسبتها ما تنزل ولا تتغير أبداً مهما صار.
// الصيغة: { a: 'آيدي الأول', b: 'آيدي الثاني', pct: النسبة } — وتشتغل بالاتجاهين.
const LOVE_FIXED = [
    { a: '848996426918002731', b: '1550879705115398156', pct: 100 },  // عبد ❤️ إيفا (ثابت 100%)
    { a: '1564243042850832505', b: '1542941271205875812', pct: 100 }  // البوت ❤️ إيدا (ثابت 100%)
];

// 💘 مسموح لهم باستخدام أمر /حب زيادة على الملكيين (آيديات مفصولة بفاصلة) — من .env:
//    LOVE_ALLOW_IDS=123456789,987654321
const LOVE_ALLOW_IDS = String(process.env.LOVE_ALLOW_IDS || '').split(/[,\s]+/).filter(Boolean);

// نسبة الحب: لو الزوجين بالقائمة الثابتة نرجّع نسبتهم المحفوظة، وإلا الحساب القديم
function lovePercent(x, y) {
    const p = [String(x), String(y)];
    const hit = LOVE_FIXED.find(o => (o.a === p[0] && o.b === p[1]) || (o.a === p[1] && o.b === p[0]));
    if (hit) return { percent: hit.pct, fixed: true };
    try {
        return { percent: Number((BigInt(p[0]) + BigInt(p[1])) % 101n), fixed: false };
    } catch {
        return { percent: 50, fixed: false };
    }
}

// 🔒 نسجّل الإعدادات بنظام الصلاحية/القفل (access) — عشان أي ملف يقدر يسأل «هذا السيرفر مفعّل؟»
access.boot(CONFIG);

// ====================================================================
// 2. سيرفر الويب (للفحص المستمر من الاستضافة)
// ====================================================================
const app = express();
const PORT = process.env.PORT || 3000;
// الجذر يحوّل مباشرة للوحة التحكم، عشان أول ما تفتح رابط الموقع يطلع لك الداشبورد
app.get('/', (req, res) => res.redirect('/dashboard'));
// نقطة فحص للاستضافة (Render) — ترجع 200 دائماً عشان الخدمة ما تعتبر ميتة
app.get('/health', (req, res) => {
    const up = Math.floor(process.uptime());
    const share = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
    res.status(200).send(`Nova 24/7 OK | bot=${client.isReady() ? 'online' : 'connecting'} | uptime=${up}s${share ? ' | ' + share : ''}`);
});
mountPanel(app, express, R);
const webServer = app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));
// أي خطأ في سيرفر الويب يتسجل فقط ولا يوقّف البوت
webServer.on('error', (err) => console.error('⚠️ خطأ في سيرفر الويب:', err.message));

// ====================================================================
// 3. العميل
// ====================================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,  // للترحيب وصفحة الأعضاء: فعّل Server Members Intent في موقع المطورين
        // 🎮 مرآة نشاط الملكيين (اختياري): فعّل Presence Intent في موقع المطورين — ولو مو مفعّل البوت يشتغل عادي بدونه
        GatewayIntentBits.GuildPresences,
        // 🛡️ درع نوفا: لاستقبال أحداث الحظر (GuildBans = GuildModeration في v14)
        (GatewayIntentBits.GuildModeration ?? GatewayIntentBits.GuildBans)
    ].filter(i => i !== undefined)
});

// ====================================================================
// 4. أدوات مساعدة
// ====================================================================
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rp = (key) => pick(R.get(key));

// لوحة التحكم الكاملة (/dashboard)
mountDashboard(app, express, client, CONFIG);
welcome.init(client);

// 👑 ملكية بالسر: ناس يعاملهم البوت كـ«ملكي» (نفس صلاحيات رتبة الملكي)
//    بدون ما ياخذون صلاحيات صاحب البوت (ما يفتحون اللوحة ولا الصفحات الخاصة).
//    من .env: SECRET_ROYAL_IDS=آيدي,آيدي  (الافتراضي: إيفا)
const secretRoyal = (id) => String(CONFIG.SECRET_ROYAL_IDS || '').split(/[,\s]+/).filter(Boolean).indexOf(String(id)) >= 0;

function getTier(userId, member) {
    if (userId === CONFIG.ARTHUR_ID) return 'arthur';
    if (userId === CONFIG.SPECIAL_USER_ID) return 'ida';
    if (secretRoyal(userId)) return 'royal';   // 👑 ملكي بالسر (إيفا)
    const guild = member && member.guild ? member.guild : null;
    // 🌐 أي سيرفر غير سيرفرنا: «الملكي» = صاحب السيرفر + اللي أعطاه صلاحية الدخول
    if (guild && !access.isNova(guild.id, CONFIG)) {
        if (access.isRoyal(guild, member, CONFIG)) return 'royal';
        if (member && member.roles && member.roles.cache.has(CONFIG.DISRESPECT_ROLE_ID)) return 'disrespect';
        return 'peasant';
    }
    if (member && member.roles && member.roles.cache.has(CONFIG.ROYAL_ROLE_ID)) return 'royal';
    if (member && member.roles && member.roles.cache.has(CONFIG.DISRESPECT_ROLE_ID)) return 'disrespect';
    return 'peasant';   // الافتراضي (بدون رتبة) = يعامله البوت باحترام عادي
}
const hasAccess = (tier) => tier === 'arthur' || tier === 'ida' || tier === 'royal';

// شخصية خاصة لعضو معين (بدون ما تأثر على صلاحياته)، ولو ما فيها رد لهالتصنيف يرجع لرد الرتبة العادي
const getPersona = (userId) => CONFIG.PERSONAS[userId] || null;
function rpFor(category, userId, tier) {
    const persona = getPersona(userId);
    if (persona) {
        const arr = R.get(`${category}.${persona}`);
        if (arr.length) return pick(arr);
    }
    return rp(`${category}.${tier}`);
}

// كولداون لكل مستخدم (ثواني)
const cooldowns = new Map();
function onCooldown(userId, seconds = 5) {
    const now = Date.now();
    const last = cooldowns.get(userId) || 0;
    if (now - last < seconds * 1000) return true;
    cooldowns.set(userId, now);
    return false;
}
// تنظيف الكولداون القديم كل 10 دقايق
setInterval(() => {
    const limit = Date.now() - 60_000;
    for (const [id, t] of cooldowns) if (t < limit) cooldowns.delete(id);
}, 10 * 60_000);

// ====================================================================
// 5. الفويس + إعادة الاتصال التلقائي
// الروم الصوتي ومفتاح التشغيل يتقروا من botcontrol (يعدلها الداشبورد فوراً)
// ====================================================================
let connection = null;
let connecting = false;
let currentVoiceId = '';   // الروم اللي البوت فيه حالياً

// الروم الصوتي المستهدف: المحدد من الداشبورد، وإلا الافتراضي من CONFIG
const voiceTargetId = () => botcontrol.voiceChannelId(CONFIG.GUILD_ID, CONFIG.VOICE_CHANNEL_ID);

const isInVoice = () => !!connection && connection.state.status === VoiceConnectionStatus.Ready;

// تهدئة تدريجية عند فشل الفويس — عشان ما نغرق ديسكورد بمحاولات متكررة
// (مهم: أي فشل متكرر = ترافيك زيادة، ووقت حدود ديسكورد على الـIP المشترك يطوّل الحجب)
let voiceFails = 0;              // كم مرة فشل الاتصال ورا بعض
let voiceBlockedUntil = 0;       // ما نحاول قبل هذا الوقت

async function connectToVoice(force = false) {
    if (connecting) return;
    if (Date.now() < voiceBlockedUntil) return;   // في تهدئة جارية — ما نحاول
    const targetId = voiceTargetId();
    if (!targetId) return;
    // لو متصل أصلاً بنفس الروم المطلوب، ما نسوي شي (إلا لو force)
    if (!force && isInVoice() && currentVoiceId === targetId) return;
    connecting = true;
    let conn = null;
    try {
        const channel = await client.channels.fetch(targetId);
        if (!channel || !channel.isVoiceBased()) return;

        if (connection) {
            try { connection.destroy(); } catch {}
        }

        conn = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });
        connection = conn;
        currentVoiceId = channel.id;

        conn.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                // لو ديسكورد نقله أو يحاول يرجعه نعطيه فرصة
                await Promise.race([
                    entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(conn, VoiceConnectionStatus.Connecting, 5_000)
                ]);
            } catch {
                try { conn.destroy(); } catch {}
            }
        });

        conn.on(VoiceConnectionStatus.Destroyed, () => {
            if (connection === conn) connection = null;
        });

        await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
        voiceFails = 0; voiceBlockedUntil = 0;
        console.log(`🎙️ دخل الفويس بنجاح (${channel.name})`);
    } catch (err) {
        console.error('❌ فشل الدخول للفويس:', err.message);
        // تنظيف المحاولة الفاشلة عشان الحارس يقدر يعيد المحاولة
        try { if (conn) conn.destroy(); } catch {}
        if (connection === conn) connection = null;
        currentVoiceId = '';
        // تهدئة تدريجية: ١٥ث → ٣٠ → ٦٠ → ١٢٠ → ٢٤٠ → ٤٨٠ → ١٠ دقايق (حد أقصى)
        voiceFails = Math.min(voiceFails + 1, 7);
        const wait = Math.min(15_000 * Math.pow(2, voiceFails - 1), 10 * 60_000);
        voiceBlockedUntil = Date.now() + wait;
        console.log(`⏳ تهدئة الفويس ${Math.round(wait / 1000)} ثانية (فشل ${voiceFails} مرة ورا بعض)`);
        if (botcontrol.voiceEnabled(CONFIG.GUILD_ID)) {
            const t = setTimeout(() => connectToVoice(true), wait);
            if (t.unref) t.unref();
        }
    } finally {
        connecting = false;
    }
}

function disconnectFromVoice() {
    if (connection) {
        try { connection.destroy(); } catch {}
        connection = null;
    }
    currentVoiceId = '';
}

// 🎙️ «تعال» = البوت يجي عند اللي ناداه (لو هو داخل روم صوتي) — ويحفظ نفس الروم
// عشان يبقى فيه 24/7 (الحارس يرجع البوت لهالروم). لو اللي نادى مو بفويس → الروم المحفوظ.
async function comeToMe(member) {
    // أمر صريح من العضو → نلغي أي تهدئة جارية
    voiceFails = 0; voiceBlockedUntil = 0;
    const ch = member && member.voice && member.voice.channel;
    const target = ch && typeof ch.isVoiceBased === 'function' && ch.isVoiceBased() ? ch : null;
    try {
        botcontrol.set(CONFIG.GUILD_ID, target
            ? { voiceEnabled: true, voiceChannelId: target.id }
            : { voiceEnabled: true });
    } catch (e) { console.error('❌ حفظ روم الفويس:', e.message); }
    await connectToVoice(true);
    return target;
}

// حارس: كل دقيقة يتأكد إن البوت بالروم الصوتي الصح، وإلا يرجعه/ينقله
setInterval(() => {
    if (connecting) return;
    if (!client.isReady()) return;   // البوت مو مسجل دخول؟ ما نكرر محاولات الفويس عبث
    const target = voiceTargetId();
    const want = botcontrol.voiceEnabled(CONFIG.GUILD_ID) && !!target;
    // المفتاح مطفي أو ما فيه روم: نتأكد إن البوت خارج الفويس
    if (!want) { if (connection || isInVoice()) disconnectFromVoice(); return; }
    const dead = !connection || connection.state.status === VoiceConnectionStatus.Destroyed;
    if (dead || currentVoiceId !== target) {
        console.log('🔁 مزامنة الفويس مع إعدادات اللوحة...');
        connectToVoice(true);
    }
}, 60_000);

// يخلي الداشبورد يقدر يدخل/يطلع/ينقل البوت فوراً عند الحفظ
botcontrol.onVoiceChange((gid) => {
    if (gid !== CONFIG.GUILD_ID) return;
    if (!botcontrol.voiceEnabled(gid)) return disconnectFromVoice();
    connectToVoice(true);
});

// حالة الفويس للوحة التحكم
client.voiceInfo = () => ({ inVoice: isInVoice(), channelId: currentVoiceId || '' });

// ====================================================================
// 6. تعريف أوامر السلاش
// ====================================================================
const commands = [
    new SlashCommandBuilder().setName('تعال').setDescription('البوت يجي عندك في رومك الصوتي (للملكيين فقط)'),
    new SlashCommandBuilder().setName('اطلع').setDescription('يطلع البوت من الفويس (للملكيين فقط)'),
    new SlashCommandBuilder().setName('حالة').setDescription('حالة البوت'),
    new SlashCommandBuilder().setName('نكتة').setDescription('نكتة من العبد'),
    new SlashCommandBuilder().setName('تنبيه').setDescription('تنبيه ملكي (للملكيين فقط)'),
    new SlashCommandBuilder().setName('فلوس').setDescription('اسأل عن راتبك'),
    new SlashCommandBuilder().setName('سيرفر').setDescription('نبذة عن هذا السيرفر'),
    new SlashCommandBuilder().setName('شعر').setDescription('شعر ملكي (للملكيين فقط)'),
    new SlashCommandBuilder().setName('اكل').setDescription('اطلب أكل من العبد (للملكيين فقط)'),
    new SlashCommandBuilder().setName('بينج').setDescription('سرعة البوت'),
    new SlashCommandBuilder().setName('عملة').setDescription('ارمي عملة'),
    new SlashCommandBuilder().setName('نرد').setDescription('ارمي نرد')
        .addIntegerOption(o => o.setName('اوجه').setDescription('عدد أوجه النرد (الافتراضي 6)').setMinValue(2).setMaxValue(1000)),
    new SlashCommandBuilder().setName('اختار').setDescription('البوت يختار لك من بين خيارات')
        .addStringOption(o => o.setName('خيارات').setDescription('افصل بينها بفاصلة، مثال: بيتزا, برجر, كبسة').setRequired(true)),
    new SlashCommandBuilder().setName('حجر').setDescription('حجر ورقة مقص ضد البوت')
        .addStringOption(o => o.setName('اختيارك').setDescription('اختر').setRequired(true)
            .addChoices(
                { name: 'حجر 🪨', value: 'rock' },
                { name: 'ورقة 📄', value: 'paper' },
                { name: 'مقص ✂️', value: 'scissors' }
            )),
    new SlashCommandBuilder().setName('تخمين').setDescription('خمن الرقم من 1 إلى 10')
        .addIntegerOption(o => o.setName('رقم').setDescription('تخمينك').setRequired(true).setMinValue(1).setMaxValue(10)),
    new SlashCommandBuilder().setName('حب').setDescription('نسبة التوافق بين شخصين (للإدارة والأسماء المحددة)')
        .addUserOption(o => o.setName('الاول').setDescription('الشخص الأول').setRequired(true))
        .addUserOption(o => o.setName('الثاني').setDescription('الشخص الثاني (الافتراضي أنت)')),
    new SlashCommandBuilder().setName('كرة').setDescription('كرة الحظ، اسأل سؤال')
        .addStringOption(o => o.setName('سؤال').setDescription('سؤالك').setRequired(true)),
    new SlashCommandBuilder().setName('ألوان').setDescription('يعيد توليد صورة الألوان ويحدّث بانل الألوان (للملكيين فقط)'),
    new SlashCommandBuilder().setName('مساعدة').setDescription('قائمة الأوامر')
].map(c => c.toJSON()).concat(admin.commands, points.commands, levels.commands, games.commands, tickets.commands, economy.commands, giveaway.commands, selfroles.commands, guard.commands, hub.commands, ai.commands, extra.commands);

// 🔁 مزامنة أوامر سيرفر واحد:
//    مفعّل → تنزل كل الأوامر · مقفول 🔒 → تنمسح أوامره (ما يقدر أحد يجرّب البوت)
//    (اللوحة تناديها لما تفعّل/تقفل سيرفر — فالتغيير يصير فوراً بدون إعادة تشغيل)
client.novaCommands = commands;
client.syncGuildCommands = async (g) => {
    if (!g) return false;
    try {
        await g.commands.set(access.isApproved(g.id, CONFIG) ? commands : []);
        return true;
    } catch (e) {
        console.error(`❌ مزامنة أوامر ${g.name || g.id}:`, e.message);
        return false;
    }
};

// ====================================================================
// 7. تشغيل البوت (جاهز للعمل + إعادة التشغيل التلقائي)
// ====================================================================
let systemsReady = false;   // الأنظمة تُهيأ مرة واحدة فقط (عشان ما تتكرر عند إعادة الاتصال)
async function onClientReady() {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    // 🔒 وضع السيرفر الواحد (PUBLIC_BOT غير مفعّل): نطلع من أي سيرفر غير سيرفرنا
    //    شرط استضافات البوتات المجانية — البوت خاص بسيرفر واحد وما يخدم سيرفرات ثانية
    if (!access.publicBot()) {
        console.log('🔒 وضع السيرفر الواحد: البوت لسيرفر نوفا فقط (يطلع من أي سيرفر ثاني)');
        for (const g of [...client.guilds.cache.values()]) {
            if (access.isNova(g.id, CONFIG)) continue;
            console.log(`🚪 طلعت من سيرفر غير مصرّح: ${g.name} (${g.id}) — البوت لسيرفر واحد فقط`);
            try { await g.leave(); } catch (e) { console.error('❌ ما قدرت أطلع من', g.id, e.message); }
        }
    }
    // 🌐 الأوامر لكل سيرفر البوت فيه — **بس السيرفرات المفعّلة**.
    // 🔒 أي سيرفر جديد يظل مقفول (بدون أوامر ولا ردود) لحد ما نفعّله من اللوحة.
    let regd = 0, locked = 0;
    for (const g of client.guilds.cache.values()) {
        if (access.isApproved(g.id, CONFIG)) {
            try { await g.commands.set(commands); regd++; }
            catch (err) { console.error(`❌ فشل تسجيل الأوامر بسيرفر ${g.name || g.id}:`, err.message); }
        } else {
            locked++;
            try { await g.commands.set([]); } catch {}
        }
    }
    console.log(`✅ تم تسجيل أوامر السلاش في ${regd} سيرفر${locked ? ` · 🔒 ${locked} سيرفر مقفول (ما تنزل له أوامر)` : ''}`);

    if (!systemsReady) {
        systemsReady = true;
        await store.init();
        R.reload();
        points.init();
        levels.init(client, CONFIG);
        giveaway.reschedule(client);
        jail.init(client);
        trap.init(client, CONFIG);
        reactions.init(client);          // 😍 تفاعل تلقائي مع الصور (بدون صلاحيات إضافية)
        ai.init(client, CONFIG);         // 🤖 الذكاء الاصطناعي (منشن/رد/أمر اسأل)
        guard.init(client, CONFIG);
        presence.init(client, CONFIG);
        colors.init(client, CONFIG);
    }

    // يخلي البوت يبيّن أونلاين دائماً (ولو أحد غيّر حالته لتختفي)
    setOnline();
    connectToVoice();
    colors.ensure(client, CONFIG);   // نتأكد إن بانل الألوان موجود ومحدّث
    hub.ensure(client, CONFIG);      // 🎛️ نتأكد لوحة التحكم موجودة ومحدّثة
}
client.on('clientReady', onClientReady);

// 🌐 سيرفر جديد أضاف البوت: 🔒 يظل **مقفول** — ما يرد ولا تنزل أوامره
//    إلا لما **ارثر/إيدا يفعّلونه** من اللوحة («السيرفرات 🌐» ← تفعيل)
client.on('guildCreate', async (guild) => {
    // 🔒 وضع السيرفر الواحد: البوت ما ينضاف لسيرفرات ثانية — نطلع فوراً ونعتذر لصاحب السيرفر
    if (!access.publicBot() && !access.isNova(guild.id, CONFIG)) {
        console.log(`🚪 سيرفر جديد (${guild.name}) — البوت خاص بسيرفر واحد، أطلع فوراً`);
        try {
            const o = await guild.fetchOwner().catch(() => null);
            if (o) await o.send(
                `اعتذر 🙏 — **${guild.name}** أضاف البوت، لكن هذا البوت **خاص بسيرفر واحد** (بوت نوفا) `
                + `وما يقدر يشتغل بسيرفرات ثانية، فطلعت من السيرفر.`
            ).catch(() => {});
        } catch { }
        try { await guild.leave(); } catch (e) { console.error('❌ ما قدرت أطلع:', e.message); }
        return;
    }
    console.log(`➕ دخلت سيرفر جديد: ${guild.name} (${guild.id}) — 🔒 مقفول لحد ما يفعّله ارثر/إيدا`);
    // نمسح أي أوامر قديمة (احتياط) — ما فيه شي يشتغل بهالسيرفر
    try { await client.syncGuildCommands(client.guilds.cache.get(guild.id) || guild); } catch {}
    // ١) ننبّه أصحاب البوت (ارثر/إيدا) عشان يفعّلونه
    const note = `➕ دخلت سيرفر جديد: **${guild.name}**\nآيديه: \`${guild.id}\``
        + `\n👥 ${guild.memberCount || '؟'} عضو · 🔒 البوت **مقفول** فيه (ما يرد ولا تنزل أوامره).`
        + `\nلتفعيله: اللوحة ← «السيرفرات 🌐» ← تفعيل.`;
    for (const id of access.superIds(CONFIG)) {
        try { const u = await client.users.fetch(id); await u.send(note); } catch {}
    }
    // ٢) نطمّن صاحب السيرفر الجديد ونقول له البوت مقفول
    try {
        const o = await guild.fetchOwner().catch(() => null);
        if (o) await o.send(
            `أهلاً! أنا **العبد 🐾** — بوت نوفا.\n`
            + `انضفت لسيرفر **${guild.name}**، لكن البوت **مقفول** حالياً 🔒 — ما يرد ولا تنزل أوامره.`
            + `\nلطلب التفعيل تواصل مع إدارة نوفا (صاحب البوت).`
        ).catch(() => {});
    } catch { }
});

// 🔒 حراسة دورية (وضع السيرفر الواحد): كل ١٠ دقايق نتأكد إن البوت ما صار بسيرفر ثاني
const singleSweep = setInterval(() => {
    try {
        if (access.publicBot() || !client.isReady()) return;
        for (const g of [...client.guilds.cache.values()]) {
            if (access.isNova(g.id, CONFIG)) continue;
            console.log(`🚪 (حراسة دورية) طلعت من سيرفر غير مصرّح: ${g.name} (${g.id})`);
            try { g.leave().catch(() => {}); } catch { }
        }
    } catch (e) { console.error('❌ حراسة السيرفرات:', e.message); }
}, 10 * 60_000);
if (singleSweep.unref) singleSweep.unref();

// إجبار الحالة على "أونلاين" — أساس بقاء البوت ظاهر 24/7
function setOnline() {
    try { if (client.user) client.user.setStatus('online'); } catch {}
}

// ====================================================================
// 8. معالج أوامر السلاش
// ====================================================================
const eightBall = [
    'أكيد! ✅', 'بدون شك 👌', 'الأمور تبشر بخير 🌟', 'يمكن 🤔',
    'اسأل بعدين ⏳', 'ما أتوقع ❌', 'لا والله 🚫', 'مستحيل 💀'
];
const rpsNames = { rock: '🪨 حجر', paper: '📄 ورقة', scissors: '✂️ مقص' };
const rpsBeats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

client.on('interactionCreate', async (interaction) => {
  try {
    // 🔒 سيرفر مقفول = ما فيه أي تفاعل (ولا حتى أزرار القرعات والتذاكر).
    //    الأوامر أصلاً ما تنزل له، وهذا احتياط لو بقت نسخة قديمة مسجّلة عند ديسكورد.
    if (interaction.guild && !access.canRun(interaction.guild.id, interaction.user && interaction.user.id, CONFIG)) {
        if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: access.denyTextLocked, flags: 64 }).catch(() => {});
        }
        return;
    }
    if (interaction.isButton()) {
        if (await tickets.handleButton(interaction, { getTier, CONFIG, pick, access })) return;
        if (await giveaway.handleButton(interaction)) return;
        if (await selfroles.handleButton(interaction)) return;
        if (await extra.handleButton(interaction)) return;      // ⭕ إكس أو · 💰 من سيربح · 📊 استفتاء
        return;
    }
    // قائمة اختيار لون السيرفر (StringSelectMenu) — مستقلة عن باقي الأنظمة
    if (interaction.isStringSelectMenu()) {
        if (await hub.handleSelect(interaction, { getTier, CONFIG, pick, access })) return;   // 🎛️ لوحة التحكم
        if (await colors.handleSelect(interaction)) return;
        return;
    }
    // ✉️ نافذة كتابة (رسالة العضو للإدارة من لوحة التحكم)
    if (interaction.isModalSubmit()) {
        if (await hub.handleModal(interaction, { getTier, CONFIG, pick, access })) return;
        return;
    }
    if (!interaction.isChatInputCommand()) return;
    // 🛡️ أمر الحماية يشتغل من أي روم (لو صار نك لازم نقدر نقفل السيرفر بأسرع وقت)
    if (await guard.handle(interaction, { getTier, CONFIG, pick, access })) return;
    // الرومات المسموح فيها: لو الروم معطّل، نرد برسالة واضحة بدل السكوت (السكوت يطلع «التطبيق لم يستجب»)
    if (interaction.guild && interaction.channel && !botcontrol.canInteract(interaction.guild.id, interaction.channel.id)) {
        return interaction.reply({
            content: '🔒 البوت **معطّل في هذا الروم** — عشان كذا ما رد عليك.\nاكتب هنا: **يا عبد شغل البوت** ويرجع فوراً، أو فعّله من اللوحة ← «التحكم بالبوت».',
            flags: MessageFlags.Ephemeral
        }).catch(() => {});
    }
    // 🔐 صلاحية الأوامر (تُدار من اللوحة ← «الأوامر»): من يقدر يستخدم أي أمر
    //    «مساعدة» و«حماية» مستثنين دايماً (حماية = لازم تشتغل بأي وقت، ومساعدة = عشان يعرف الأوامر)
    if (interaction.guild && ['حماية', 'مساعدة'].indexOf(interaction.commandName) < 0) {
        const gate = cmdaccess.check(interaction.guild.id, interaction.commandName, {
            userId: interaction.user.id,
            member: interaction.member,
            tier: getTier(interaction.user.id, interaction.member),
            extraIds: LOVE_ALLOW_IDS
        });
        if (!gate.ok) {
            return interaction.reply({ content: gate.text, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
    if (await tickets.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await games.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await points.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await levels.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await admin.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await economy.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await hub.handle(interaction, { getTier, CONFIG, pick, access })) return;   // 🎛️ /لوحة_تحكم
    if (await ai.handle(interaction)) return;                                        // 🤖 /اسأل
    if (await extra.handle(interaction, { getTier, CONFIG, pick, access })) return;  // 🎮 أوامر إضافية
    if (await giveaway.handle(interaction, { getTier, CONFIG, pick, access })) return;
    if (await selfroles.handle(interaction, { getTier, CONFIG, pick, access })) return;

    const tier = getTier(interaction.user.id, interaction.member);
    const name = interaction.commandName;
    const denied = () => interaction.reply({
        content: access.denyText(interaction.guild, CONFIG),
        flags: MessageFlags.Ephemeral
    });
    // 🌐 ردود الأوامر: بسيرفرنا مثل ما هي · بأي سيرفر ثاني تُنقّى (ما نذكر ارثر/إيدا/نوفا)
    const say = (t) => interaction.reply(
        typeof t === 'string' ? access.clean(t, interaction.guild, CONFIG)
            : (t && typeof t === 'object' && !Array.isArray(t) && typeof t.content === 'string'
                ? { ...t, content: access.clean(t.content, interaction.guild, CONFIG) } : t)
    );

    try {
        switch (name) {
            case 'تعال': {
                if (!hasAccess(tier)) return denied();
                const ch = await comeToMe(interaction.member);
                return say(ch
                    ? `🫡 أبشر يا طويل العمر، جيت عندك في **${ch.name}** 🎙️`
                    : '🫡 أبشر، دخلت الفويس المحدد 🎙️\n(ادخل روم صوتي وقل «يا عبد تعال» وأجيك عندك على طول)');
            }

            case 'اطلع':
                if (!hasAccess(tier)) return denied();
                botcontrol.set(CONFIG.GUILD_ID, { voiceEnabled: false });
                disconnectFromVoice();
                return say('👋 سمعاً وطاعة، طلعت من الفويس يا طويل العمر! 🚪');

            case 'حالة': {
                const e = new EmbedBuilder().setColor(0xb3121e).setDescription(rpFor('status', interaction.user.id, tier))
                    .addFields({ name: '📡 الفويس', value: isInVoice() ? 'متصل ✅' : 'غير متصل ❌', inline: true });
                return say({ embeds: [e] });
            }

            case 'نكتة':
                return say(`🎭 ${rp('jokes')}`);

            case 'تنبيه':
                if (!hasAccess(tier)) return denied();
                return say(rp('alerts'));

            case 'فلوس':
                return say(
                    (tier === 'arthur' || tier === 'ida')
                        ? '💰 يا فخامة المقام، خزينة نوفا كلها تحت أمرك، تبي نحول لك مليار دولار الحين؟ 🪙👑'
                        : '💸 راتبك في نوفا هو كف محترم لو عدت تسأل أسئلة مالها داعي! 😂'
                );

            case 'سيرفر':
                return say(access.isNova(interaction.guild && interaction.guild.id, CONFIG)
                    ? '🌟 سيرفر نوفا أطخم وأفخم سيرفر بالديسكورد بفضل وجود مولاي ارثر والملكة إيدا على عرشه! 🔥👑'
                    : '🌟 هذا السيرفر منوّر بوجودكم، وأنا العبد جاهز أخدمكم فيه! 🔥');

            case 'شعر':
                if (!hasAccess(tier)) return denied();
                return say(rp('poems'));

            case 'اكل':
                if (!hasAccess(tier)) return denied();
                return say(rp('food.'+tier));

            case 'بينج': {
                const sent = await say({ content: '🏓 ...', fetchReply: true });
                const latency = sent.createdTimestamp - interaction.createdTimestamp;
                return interaction.editReply(`🏓 بونغ! التأخير: **${latency}ms** | الويب سوكت: **${client.ws.ping}ms**`);
            }

            case 'عملة':
                return say(Math.random() < 0.5 ? '🪙 طلعت: **صورة**' : '🪙 طلعت: **كتابة**');

            case 'نرد': {
                const sides = interaction.options.getInteger('اوجه') ?? 6;
                return say(`🎲 رميت نرد (${sides} وجه) وطلع: **${1 + Math.floor(Math.random() * sides)}**`);
            }

            case 'اختار': {
                const opts = interaction.options.getString('خيارات')
                    .split(/[,،]/).map(s => s.trim()).filter(Boolean);
                if (opts.length < 2) {
                    return say({ content: '⚠️ اكتب خيارين على الأقل وافصل بينها بفاصلة.', flags: MessageFlags.Ephemeral });
                }
                return say(`🤔 اخترت لك: **${pick(opts)}**`);
            }

            case 'حجر': {
                const mine = interaction.options.getString('اختيارك');
                const bot = pick(['rock', 'paper', 'scissors']);
                let result = 'تعادل 🤝';
                if (rpsBeats[mine] === bot) result = 'فزت! 🎉';
                else if (rpsBeats[bot] === mine) result = 'خسرت! 😂';
                return say(`أنت: ${rpsNames[mine]}\nأنا: ${rpsNames[bot]}\n**${result}**`);
            }

            case 'تخمين': {
                const guess = interaction.options.getInteger('رقم');
                const num = 1 + Math.floor(Math.random() * 10);
                return say(
                    guess === num
                        ? `🎯 الرقم كان **${num}**، خمنت صح! 🎉`
                        : `❌ الرقم كان **${num}**، حاول مرة ثانية!`
                );
            }

            case 'حب': {
                // 🔒 الصلاحية تُدار من اللوحة ← صفحة «الأوامر» (والافتراضي: الإدارة والملكي)
                const a = interaction.options.getUser('الاول');
                const b = interaction.options.getUser('الثاني') ?? interaction.user;
                const r = lovePercent(a.id, b.id);
                return say(
                    `💘 نسبة التوافق بين ${a} و ${b}: **${r.percent}%**`
                    + (r.fixed ? '\n💞 نسبة ثابتة للأبد — ما تنزل ولا تنقص أبداً.' : '')
                );
            }

            case 'كرة':
                return say(`🔮 سؤالك: ${interaction.options.getString('سؤال')}\nالجواب: **${pick(eightBall)}**`);

            case 'ألوان': {
                if (!hasAccess(tier)) return denied();
                if (!interaction.guild) return say({ content: '⚠️ هذا الأمر داخل السيرفر فقط.', flags: MessageFlags.Ephemeral });
                await interaction.deferReply();
                try {
                    const cfg = colors.get(interaction.guild.id);
                    const r = await colors.sendPanel(interaction.guild, interaction.guild.id);
                    let files;
                    try { files = [{ attachment: await colors.renderImage(cfg), name: 'nova-colors.png' }]; } catch { files = undefined; }
                    return interaction.editReply({ content: `🎨 تم توليد صورة الألوان وتحديث البانل في <#${r.channelId}> ✅`, files });
                } catch (e) {
                    return interaction.editReply('⚠️ ' + (e.message || 'تعذر تحديث بانل الألوان'));
                }
            }

            case 'مساعدة': {
                const helpEmbed = new EmbedBuilder()
                    .setColor(0xb3121e)
                    .setTitle('🛠️ أوامر العبد')
                    .setThumbnail(interaction.client.user.displayAvatarURL())
                    .addFields(
                        { name: '👑 ملكية', value: '`/تعال` `/اطلع` `/تنبيه` `/شعر` `/اكل` `/ألوان`' },
                        { name: '🎮 ترفيه وألعاب', value: '`/نكتة` `/نرد` `/عملة` `/اختار` `/حجر` `/تخمين` `/حب` `/كرة` `/سرعة` `/رياضيات` `/مبعثرة` `/اعلام`' },
                        { name: '💰 اقتصاد ونقاط', value: '`/نقاطي` `/رتبة` `/rank` `/المتصدرين` `/يومي` `/رصيد` `/تحويل` `/المتجر` `/شراء`' },
                        { name: '🎉 فعاليات', value: '`/قرعة_بدء` `/قرعة_انهاء` `/رتب_لوحة`' },
                        { name: '📊 عام', value: '`/حالة` `/بينج` `/فلوس` `/سيرفر`' },
                        { name: '🛡️ إدارة', value: '`/طرد` `/حظر` `/فك_حظر` `/ميوت` `/فك_ميوت` `/مسح` `/قفل` `/فتح` `/بطيء` `/رتبة_اضافة` `/رتبة_ازالة` `/لقب` `/صوت` `/نقل` `/اعلان` `/تحذير` `/تحذيرات` `/شيل_تحذير` `/معلومات_عضو` `/معلومات_سيرفر` `/متجر_اضافة` `/متجر_حذف`' },
                        { name: '💬 بالكلام', value: 'نادني: **يا عبد نكتة** / **يا عبد سرعة** / **يا عبد رتبتي** / **يا عبد نرد 20** / **يا عبد الألوان** (يولّد صورة الألوان ويحدّث البانل)، أو رد على رسالتي. وأمر سريع: **!rank** أو **!رتبة**.\n🛡️ وحتى الإدارة بالكلام: **يا عبد طرد @فلان يسب الناس** / **يا عبد ميوت @فلان 10 دقايق مزعج** / **يا عبد مسح 20** / **يا عبد باند @فلان**.\n🎛️ والتحكم بالبوت: **يا عبد فك البوت** (يفك نفسه من الروم) / **يا عبد شغل البوت** (يرجع للتفاعل).' }
                    );
                return say({ embeds: [helpEmbed] });
            }
        }
        // 🛟 احتياط: لو ما فيه أي معالج تعرّف على الأمر → نرد بدل ما نسكت (السكوت = «التطبيق لم يستجب»)
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
                content: '🤔 هذا الأمر ما له معالج في هذي النسخة — أبلغ الإدارة (‎/مساعدة تعرض الأوامر الشغّالة).',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    } catch (err) {
        console.error('❌ خطأ في الأمر:', name, err);
        if (!interaction.replied && !interaction.deferred) {
            interaction.reply({ content: '⚠️ صار خطأ، حاول مرة ثانية.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
  } catch (err) {
    // 🛟 الحماية الأخيرة: أي خطأ قبل الوصول لمعالج الأمر → نرد بسببه بدل ما ديسكورد يقول «التطبيق لم يستجب»
    console.error('❌ خطأ بالتفاعل:', err);
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '⚠️ خطأ: ' + String((err && err.message) || err).slice(0, 180),
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    } catch { }
  }
});

// ====================================================================
// 9. الردود النصية (لما أحد ينادي البوت فقط)
// ====================================================================
// كلمات مطابقة كاملة (تفادي التفعيل بالغلط مثل "كفاية" أو "جبل")
const HIT_WORDS = ['اضربك', 'ضربك', 'كف', 'طراق', 'طق', 'ادقك', 'تسطير'];
const RUDE_WORDS = ['غبي', 'حمار', 'انقلع', 'جب', 'زق'];
const FOOD_WORDS = ['جوعان', 'اكل', 'أكل', 'جوعانين'];
const THANKS_WORDS = ['شكرا', 'شكراً', 'مشكور', 'يعطيك', 'يسلمو'];
const WHERE_WORDS = ['وينك', 'وينكم'];
const MOVE_WORDS = ['قوم', 'تحرك'];
const HELP_WORDS = ['اوامر', 'أوامر', 'مساعدة'];
const POEM_WORDS = ['شعر', 'قصيدة'];

function tokenize(text) {
    return text.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

// توحيد النص العربي (أ/إ/آ=ا، ة=ه، ى=ي، بدون تشكيل) لمطابقة الأوامر
const nz = (t) => t.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

// يحوّل رسالة عادية لشكل شبيه بالسلاش عشان نستخدم نفس كود الألعاب والنقاط
const asInteraction = (message, name) => {
    // الرد على الرسالة يفشل لو انحذفت (مثل أمر «يا عبد مسح 20» اللي يمسح نفسه)
    // → نرجع نرسل بالروم عادي عشان التأكيد يوصل دايماً بدل ما يطلع خطأ.
    const send = (o) => {
        const payload = typeof o === 'string' ? o : { ...o, flags: undefined };
        return message.reply(payload).catch(() => message.channel.send(payload).catch(() => {}));
    };
    const it = {
        commandName: name, client, channel: message.channel, guild: message.guild,
        user: message.author, member: message.member, replied: false, deferred: false,
        options: { getUser: () => null, getInteger: () => null, getString: () => null },
        reply: (o) => { it.replied = true; return send(o); },
        deferReply: async () => { it.deferred = true; },
        editReply: (o) => send(o)
    };
    return it;
};

const TEXT_GAMES = { 'سرعه': 'سرعة', 'رياضيات': 'رياضيات', 'مبعثره': 'مبعثرة', 'اعلام': 'اعلام', 'كلمه': 'كلمة_السر', 'السر': 'كلمة_السر' };

// البوت ينادى فقط بـ: يا عبد / عبد / منشن / الرد على رسالته
async function isCalled(message, tokens, content) {
    if (message.mentions.has(client.user, { ignoreEveryone: true, ignoreRoles: true }) ||
        content.includes('يا عبد') || tokens.includes('عبد') || tokens.includes('العبد')) return true;
    if (message.reference && message.reference.messageId) {
        const ref = await message.fetchReference().catch(() => null);
        return !!ref && ref.author.id === client.user.id;
    }
    return false;
}

// أوامر الكلام لتفعيل/تعطيل البوت في الروم الحالي: "يا عبد فك البوت" / "يا عبد شغل البوت"
// ترجع true لو تعاملنا مع الرسالة (تفك البوت أو ترجعه) عشان نوقف باقي المعالجة.
const norm = (t) => t.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
async function handleChannelToggle(message) {
    const c = norm(message.content);
    const called = message.mentions.has(client.user, { ignoreEveryone: true, ignoreRoles: true }) || c.includes('يا عبد');
    if (!called) return false;

    const off = ['فك البوت', 'افك البوت', 'فكيني', 'عطل البوت', 'طفي البوت', 'اوقف البوت', 'فك التفاعل', 'عطل التفاعل']
        .some(k => c.includes(k));
    const on = ['شغل البوت', 'فعل البوت', 'رجع البوت', 'ارجع البوت', 'شغل التفاعل', 'فعل التفاعل']
        .some(k => c.includes(k));
    if (!off && !on) return false;

    const tier = getTier(message.author.id, message.member);
    if (!hasAccess(tier)) {
        await message.reply(access.denyText(message.guild, CONFIG)).catch(() => {});
        return true;
    }
    botcontrol.toggleChannel(message.guild.id, message.channel.id, on);
    await message.reply(on
        ? '✅ رجعت للتفاعل في هذا الروم.'
        : '⛔ تم، فكيت نفسي من هذا الروم. لو تبي ترجعني بأي وقت كتب: **يا عبد شغل البوت**.').catch(() => {});
    return true;
}

// 💬 ردود الخاص (المحرر الجديد): أقسام سيرفر نوفا اللي مفعّل عليها «تشغل بالخاص».
//    الخاص ما له سيرفر، فالمصدر هو إعدادات سيرفرنا — وكل قسم لازم يفعّل خيار الخاص بنفسه.
client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot || message.guild) return;
        const content = (message.content || '').trim();
        if (!content) return;
        // بوابة القفل: الخاص يُحسب على سيرفر نوفا (وهو مفعّل دائماً) — و`replies2.match` نفسه يرفض أي سيرفر مقفول
        if (!access.canRun(CONFIG.GUILD_ID, message.author.id, CONFIG)) return;
        if (onCooldown(message.author.id, 5)) return;
        const hit = replies2.match({
            gid: CONFIG.GUILD_ID,
            member: null,
            userId: message.author.id,
            content,
            called: true,
            isDM: true,
            guildName: 'الخاص',
            displayName: message.author.username
        });
        if (!hit) return;
        await message.reply(hit.text).catch(() => {});
    } catch { }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 🔒 سيرفر مقفول (ما فعّلناه من اللوحة) = تجاهل كامل: ولا رد، ولا خبرة، ولا أي نظام.
    //    (ارثر/إيدا مستثنين عشان يقدرون يجرّبون بأي مكان)
    if (!access.canRun(message.guild.id, message.author.id, CONFIG)) return;

    // أوامر تفعيل/تعطيل البوت بالروم: تشتغل حتى لو الروم معطّل عشان تقدر ترجع البوت بأمر
    if (await handleChannelToggle(message)) return;

    // الرومات المسموح فيها: لو الروم معطّل أو خارج القائمة المسموحة، البوت يتجاهل الرسالة تماماً.
    // ملاحظة: روم الفخ (trap.js) له معالج مستقل، فالحظر التلقائي ما يتأثر بهذا السطر أبداً.
    if (!botcontrol.canInteract(message.guild.id, message.channel.id)) return;

    levels.onMessage(message).catch(() => {});

    const content = message.content.trim();
    if (!content) return;

    // 🤖 الذكاء الاصطناعي: منشن البوت أو رد على رسالته → يجاوب الذكاء بدل الرد العام
    if (ai.shouldAnswer(message, client)) {
        if (onCooldown(message.author.id, ai.get(message.guild.id).cooldownSec || 1)) return;
        return void ai.answer(message, { content }).catch(() => {});
    }

    // أمر بادئة تعجب: !rank / !رتبة / !متصدرين / !نقاطي (بدون الحاجة لمناداة البوت)
    const bang = content.match(/^!\s*(rank|رتبة|رتبه|مستوى|متصدرين|المتصدرين|top|نقاطي)\s*$/i);
    if (bang) {
        const key = bang[1].toLowerCase();
        if (key === 'rank' || key === 'رتبة' || key === 'رتبه' || key === 'مستوى') return void levels.handle(asInteraction(message, 'رتبة'), { getTier, CONFIG, pick, access }).catch(() => {});
        if (key === 'نقاطي') return void points.handle(asInteraction(message, 'نقاطي'), { getTier, CONFIG, pick, access }).catch(() => {});
        return void points.handle(asInteraction(message, 'المتصدرين'), { getTier, CONFIG, pick, access }).catch(() => {});
    }

    const tokens = tokenize(content);
    const called = await isCalled(message, tokens, content);

    // 💬 الردود المخصصة (محرر الردود الجديد): تُفحص **قبل** أي نظام قديم.
    //    لو ما طابقت شي، يكمل الوضع القديم حرفياً زي ما هو (نوفا ما يتغيّر).
    const hit = replies2.match({
        gid: message.guild.id,
        member: message.member,
        userId: message.author.id,
        content,
        called,
        isDM: false,
        guildName: message.guild.name,
        displayName: (message.member && message.member.displayName) || message.author.username
    });
    if (hit) {
        if (onCooldown(message.author.id, 4)) return;
        return void message.reply(access.clean(hit.text, message.guild, CONFIG)).catch(() => {});
    }

    if (!called) return;   // بدون نداء: ما يرد أبداً
    if (onCooldown(message.author.id)) return;

    const tier = getTier(message.author.id, message.member);
    const canAdmin = hasAccess(tier);
    const persona = getPersona(message.author.id);
    const ctx = { getTier, CONFIG, pick, access };

    // أوامر الإدارة بالكلام الطبيعي: يا عبد <مسح/طرد/حظر/ميوت/الخ> <منشن> <مدة> <سبب>
    if (await nlcommands.handle(message, tier, ctx, admin)) return;

    const ntok = tokens.map(nz).filter(t => !['يا', 'عبد', 'العبد'].includes(t));
    const w = (...list) => ntok.some(t => list.includes(t));
    const deny = () => say(access.denyText(message.guild, CONFIG));
    // 🌐 كل ردود الكلام تمر من هنا: بسيرفرنا مثل ما هي، وبأي سيرفر ثاني تنقية (ما نذكر ارثر/إيدا/نوفا)
    const say = (t) => message.reply(
        typeof t === 'string' ? access.clean(t, message.guild, CONFIG)
            : (t && typeof t === 'object' && typeof t.content === 'string'
                ? { ...t, content: access.clean(t.content, message.guild, CONFIG) } : t)
    );

    // الكلمات الخاصة (من اللوحة) - حسب الرتبة، وحسب الشخصية الخاصة (روان/نبض ارثر) لو موجودة
    if (canAdmin || persona) {
        const personaWords = persona ? R.get('custom.' + persona) : [];
        const matches = [...R.get('custom.' + tier), ...R.get('custom.all'), ...personaWords]
            .map(l => l.split('=>').map(x => x.trim()))
            .filter(([k, r]) => k && r && content.includes(k));
        if (matches.length) return say(pick(matches)[1]);
    }

    // «يا عبد الألوان» / «يا عبد حدّث الألوان» / «يا عبد صورة الألوان» → يعيد توليد صورة الألوان ويحدّث البانل
    if (w('الوان', 'الالوان')) {
        if (!canAdmin) return deny();
        try {
            const cfg = colors.get(message.guild.id);
            const r = await colors.sendPanel(message.guild, message.guild.id);
            let files;
            try { files = [{ attachment: await colors.renderImage(cfg), name: 'nova-colors.png' }]; } catch { files = undefined; }
            return say({ content: `🎨 هذا بانل الألوان محدّث بالصورة في <#${r.channelId}> ✅`, files });
        } catch (e) {
            return say('⚠️ ' + (e.message || 'تعذر تحديث بانل الألوان'));
        }
    }

    // أوامر بالكلام: يا عبد + اسم الأمر
    if (w('تعال', 'ادخل', 'دخلني')) {
        if (!canAdmin) return deny();
        const ch = await comeToMe(message.member);
        return say(ch
            ? `🫡 أبشر يا طويل العمر، جيت عندك في **${ch.name}** 🎙️`
            : '🫡 أبشر، دخلت الفويس المحدد 🎙️\n(ادخل روم صوتي وقل «يا عبد تعال» وأجيك عندك على طول)');
    }
    if (w('اطلع', 'اخرج')) {
        if (!canAdmin) return deny();
        botcontrol.set(CONFIG.GUILD_ID, { voiceEnabled: false }); disconnectFromVoice();
        return say('👋 سمعاً وطاعة، طلعت من الفويس يا طويل العمر! 🚪');
    }
    if (w('تنبيه')) { if (!canAdmin) return deny(); return say(rp('alerts')); }
    if (w('نكته')) return say(`🎭 ${rp('jokes')}`);
    if (w('عمله')) return say(Math.random() < 0.5 ? '🪙 طلعت: **صورة**' : '🪙 طلعت: **كتابة**');
    if (w('نرد')) {
        const sides = tokens.map(Number).find(n => Number.isInteger(n) && n >= 2 && n <= 1000) || 6;
        return say(`🎲 رميت نرد (${sides} وجه) وطلع: **${1 + Math.floor(Math.random() * sides)}**`);
    }
    if (w('حاله', 'status')) {
        return say(`${rpFor('status', message.author.id, tier)}\n📡 الفويس: ${isInVoice() ? 'متصل ✅' : 'غير متصل ❌'}`);
    }
    if (w('فلوس', 'راتب')) {
        return say((tier === 'arthur' || tier === 'ida')
            ? '💰 يا فخامة المقام، خزينة نوفا كلها تحت أمرك، تبي نحول لك مليار دولار الحين؟ 🪙👑'
            : '💸 راتبك في نوفا هو كف محترم لو عدت تسأل أسئلة مالها داعي! 😂');
    }
    if (w('سيرفر')) return say(access.isNova(message.guild.id, CONFIG)
        ? '🌟 سيرفر نوفا أطخم وأفخم سيرفر بالديسكورد بفضل وجود مولاي ارثر والملكة إيدا على عرشه! 🔥👑'
        : '🌟 هذا السيرفر منوّر بوجودكم، وأنا العبد جاهز أخدمكم فيه! 🔥');
    if (w('مساعده', 'اوامر')) return say(rp('help'));
    for (const [word, name] of Object.entries(TEXT_GAMES)) {
        if (w(word)) return games.handle(asInteraction(message, name), ctx);
    }
    if (w('نقاطي')) return points.handle(asInteraction(message, 'نقاطي'), ctx);
    if (w('المتصدرين')) return points.handle(asInteraction(message, 'المتصدرين'), ctx);
    if (w('رتبتي', 'رتبه', 'مستواي', 'مستوي')) return levels.handle(asInteraction(message, 'رتبة'), ctx);

    // لو فيه لعبة شغالة بالروم، ردك عليها (الجواب) ما يعتبر كلام مع البوت
    if (games.isActive(message.channel.id)) return;

    const has = (list) => tokens.some(t => list.includes(t));

    // ضرب
    if (has(HIT_WORDS)) return say(rpFor('hit', message.author.id, tier));

    // رتبة "بدون احترام" بس هي اللي ياخذ أسلوب البوت الفظ القديم (إلا لو عنده شخصية خاصة تطغى عليها)
    if (tier === 'disrespect' && !persona) {
        return say(has(RUDE_WORDS) ? rp('rude') : rp('greet.disrespect'));
    }

    if (has(FOOD_WORDS)) return say(rpFor('food', message.author.id, tier));
    if (has(THANKS_WORDS)) return say(rpFor('thanks', message.author.id, tier));
    if (has(WHERE_WORDS)) return say(rpFor('where', message.author.id, tier));
    if (has(MOVE_WORDS)) return say(rpFor('move', message.author.id, tier));
    if (has(POEM_WORDS)) return say(rp('poems'));

    // 🤖 (اختياري من اللوحة) أي كلام موجّه للبوت ما عرفه النظام القديم → الذكاء الاصطناعي
    const aiCfg = ai.get(message.guild.id);
    if (aiCfg.fallback && ai.ready(message.guild.id) && content.length >= 6
        && !onCooldown(message.author.id, aiCfg.cooldownSec || 1)) {
        return void ai.answer(message, { content }).catch(() => {});
    }

    return say(rpFor('greet', message.author.id, tier));
});

// ====================================================================
// 10. ترحيب تلقائي عند دخول ارثر أو إيدا الفويس
// ====================================================================
const welcomeCooldown = new Map();
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!CONFIG.WELCOME_TEXT_CHANNEL_ID) return;
        if (newState.channelId !== CONFIG.VOICE_CHANNEL_ID || oldState.channelId === CONFIG.VOICE_CHANNEL_ID) return;

        const id = newState.id;
        const key = id === CONFIG.ARTHUR_ID ? 'arthur' : id === CONFIG.SPECIAL_USER_ID ? 'ida' : null;
        if (!key) return;

        const last = welcomeCooldown.get(id) || 0;
        if (Date.now() - last < 10 * 60_000) return;
        welcomeCooldown.set(id, Date.now());

        const ch = await client.channels.fetch(CONFIG.WELCOME_TEXT_CHANNEL_ID);
        if (ch && ch.isTextBased()) ch.send(rp('welcome.'+key));
    } catch (err) {
        console.error('❌ ترحيب:', err.message);
    }
});

// ====================================================================
// 10.5 حماية المسؤولين: لو أحد كتمهم أو صمّمهم بالفويس يرجعون تلقائياً
//      (بسيرفرنا: ارثر/إيدا/الرتبة الملكية · بأي سيرفر ثاني: صاحب السيرفر والمسؤولين)
// ====================================================================
const isRoyal = (id) => id === CONFIG.ARTHUR_ID || id === CONFIG.SPECIAL_USER_ID;
const isRoyalMember = (member) => !!member && access.isRoyal(member.guild, member, CONFIG);

client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        if (!newState.channel || !isRoyalMember(newState.member)) return;
        if (newState.serverMute) await newState.setMute(false, 'حماية ملكية');
        if (newState.serverDeaf) await newState.setDeaf(false, 'حماية ملكية');
    } catch {}
});

// فك التايم اوت تلقائياً (يشتغل فقط لو MEMBERS_INTENT مفعّل)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        if (!isRoyalMember(newMember)) return;
        const until = newMember.communicationDisabledUntilTimestamp;
        if (until && until > Date.now()) await newMember.timeout(null, 'حماية ملكية');
    } catch {}
});

// ====================================================================
// 11. حماية البقاء أونلاين 24/7: منع الكراش + إعادة الاتصال + نبض البقاء
// ====================================================================
// أي استثناء غير متوقع يتسجل فقط — البوت ما يتسكّر أبداً
process.on('unhandledRejection', (err) => console.error('⚠️ unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('⚠️ uncaughtException:', err));

let botBooted = false;        // صار البوت جاهز أول مرة؟
let lastAlive = Date.now();   // آخر لحظة كان البوت فيها متصل
let loginBusy = false;        // فيه عملية (إعادة) تسجيل دخول شغالة؟
let loginFails = 0;           // عدد محاولات إعادة الاتصال الفاشلة (للتهدئة التدريجية)

// أي خطأ بالعميل أو بالبوابة يتسجل فقط، وdiscord.js يرجّع الاتصال لحاله
client.on('error', (err) => console.error('⚠️ خطأ بالعميل:', err.message));
client.on('shardError', (err) => console.error('⚠️ خطأ بالشبكة (shard):', err.message));
client.on('shardDisconnect', (e, id) => console.error(`🔌 انقطع الاتصال (shard ${id}) كود ${e && e.code} — جاري إعادة الاتصال...`));
client.on('shardReconnecting', (id) => console.log(`🔁 يعيد الاتصال (shard ${id})...`));
client.on('shardResume', (id, n) => console.log(`✅ رجع الاتصال (shard ${id}) — أحداث معادة: ${n}`));

// إعادة تسجيل دخول كاملة (تُستدعى من الجلسة المنتهية ومن الحارس)
async function safeLogin(reason) {
    if (loginBusy) return;
    loginBusy = true;
    try {
        console.log(`🔐 إعادة تشغيل الاتصال (${reason})...`);
        try { client.destroy(); } catch {}
        await client.login(process.env.DISCORD_TOKEN);
        lastAlive = Date.now();
        loginFails = 0;
        console.log('✅ البوت رجع أونلاين');
    } catch (err) {
        loginFails++;
        console.error('❌ فشلت إعادة التشغيل:', err.message);
    } finally {
        loginBusy = false;
    }
}

// الجلسة انتهت صلاحيتها (يعني الاتصال ما يرجع لحاله) → نعيد الدخول فوراً
client.on('invalidated', () => {
    console.error('♻️ انتهت صلاحية الجلسة — إعادة تسجيل الدخول تلقائياً');
    safeLogin('invalidated');
});

// مهلة إعادة المحاولة تتباعد لو فشلت (2 → 4 → 8 → 16 → 32 دقيقة كحد أقصى)
const reloginWait = () => 120_000 * Math.pow(2, Math.min(loginFails, 4));

// حارس كل دقيقة: لو البوت مو متصل أكثر من مهلة الانتظار، نعيد تشغيل اتصاله
setInterval(() => {
    if (!botBooted || loginBusy) return;
    if (client.isReady()) { lastAlive = Date.now(); return; }
    if (Date.now() - lastAlive > reloginWait()) {
        console.error('🛡️ الحارس: البوت مو متصل — إعادة تشغيل تلقائية');
        safeLogin('watchdog');
    }
}, 60_000);

// نبض البقاء: يفتح /health كل 5 دقايق عشان استضافة Render المجانية ما تنيّم الخدمة
// ملاحظة: الإقلاع البارد في Render المجاني ممكن ياخذ دقيقة، فالمهلة 90 ثانية
// تحذير: إبقاء الخدمة صاحية 24/7 يستهلك ~744 ساعة من أصل 750 ساعة مجانية بالشهر → تقدر توقف النبض بـ KEEPALIVE=0
const ALIVE_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://divelbot.onrender.com').replace(/\/+$/, '');
const KEEPALIVE_ON = String(process.env.KEEPALIVE ?? '1') !== '0';
let keepAliveOk = false;
async function keepAlive() {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90_000);
        const res = await fetch(ALIVE_URL + '/health', { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) { console.error('💓 نبض البقاء رجع كود', res.status); return; }
        if (!keepAliveOk) {
            keepAliveOk = true;
            console.log(`💓 نبض البقاء شغال — البوت محمي من النوم (${ALIVE_URL})`);
        }
    } catch (err) {
        console.error('💓 تعذّر نبض البقاء (طبيعي وقت الإقلاع البارد):', err.message);
    }
}
if (KEEPALIVE_ON) {
    setTimeout(keepAlive, 15_000);
    setInterval(keepAlive, 5 * 60_000);
} else {
    console.log('💓 نبض البقاء مطفي (KEEPALIVE=0) — الخدمة تنام لو ما فيه زيارات، عشان توفر ساعات Render المجانية');
}

setInterval(() => {
    const mb = process.memoryUsage().heapUsed / 1024 / 1024;
    if (mb > 200) console.log(`🧠 استهلاك الذاكرة: ${mb.toFixed(2)} MB`);
}, 30 * 60_000);

// ====================================================================
// 12. رابط اللوحة العام: Tailscale Funnel (رابط ثابت) ثم نفق Cloudflare (احتياطي)
// ====================================================================
// على Render ما نحتاجها (Render يعطي رابط HTTPS أصلاً). على HeavenCloud/Wispbyte (Pterodactyl):
//   • لو `TS_AUTHKEY` مضبوط → Tailscale Funnel: **رابط ثابت** https://<host>.<tailnet>.ts.net
//     (تسجّل redirect_uri مرة وحدة وتنساه) — أنظف حل ومجاني بلا بطاقة وبلا دومين.
//   • وإلا → نفق Cloudflare السريع (`TUNNEL=1`): رابط يتبدّل كل إقلاع.
// الاثنان يرسلان الرابط لك برسالة خاصة.
async function shareUrl(url, permanent) {
    process.env.PUBLIC_URL = url;
    try {
        const owner = await client.users.fetch(CONFIG.ARTHUR_ID);
        if (permanent) {
            await owner.send(`🔒 **رابط لوحة نوفا الثابت** (ما يتغير أبداً)\n${url}/dashboard\n\nخطوة وحدة فقط (مرة واحدة): أضف هذا في **OAuth2 → Redirects → Add Redirect** ثم Save Changes:\n${url}/auth/callback`);
        } else {
            await owner.send(`🌉 **رابط لوحة نوفا المؤقت**\n${url}/dashboard\n\n_(الرابط يتغير كل إعادة تشغيل. لو طلع «Invalid OAuth2 redirect_uri» أضف ${url}/auth/callback في OAuth2 → Redirects)_`);
        }
    } catch {}
}
tunnel.onUrl = (url) => shareUrl(url, false);
tsfunnel.onUrl = (url) => shareUrl(url, true);
// أول مرة: Tailscale يطلب تفعيل Funnel بضغطة من المالك
tsfunnel.onNeedFunnel = async (link) => {
    try {
        const owner = await client.users.fetch(CONFIG.ARTHUR_ID);
        await owner.send(`🔑 **خطوة وحدة لتفعيل الرابط الثابت**\nاضغط هذا الرابط ووافق على تفعيل Funnel لهذا الجهاز:\n${link}\n\n_(البوت يعيد المحاولة لحاله كل دقيقتين — ما يحتاج تعيد تشغيل شي)_`);
    } catch {}
};
// لو ما انفعّل Funnel خلال ٦ دقايق → نفتح نفق Cloudflare مؤقتاً عشان ما تنقفل اللوحة
let quickTunnelStarted = false;
function startQuickTunnel() {
    if (quickTunnelStarted) return;
    quickTunnelStarted = true;
    tunnel.start(PORT).catch((e) => console.error('🌉 خطأ النفق:', e.message));
}
tsfunnel.onFallback = () => startQuickTunnel();
// ⚠️ مُختبر ١٧ أكتوبر: ديسكورد ما يطبّق redirect_uris عبر الـAPI → نرسل الخطوة اليدوية لو فشل التسجيل
tunnel.onRedirect = async (info) => {
    if (!info || info.ok) return;
    try {
        const owner = await client.users.fetch(CONFIG.ARTHUR_ID);
        await owner.send(`⚠️ **خطوة يدوية مطلوبة لتسجيل الدخول للوحة**\nديسكورد ما يطبّق Redirect URI آلياً (${info.reason}).\nافتح https://discord.com/developers/applications ← تطبيق البوت ← **OAuth2 → Redirects** ← Add Redirect ← والصق:\n${info.want}\nثم **Save Changes**.`);
    } catch {}
};
// نحاول الرابط الثابت (Tailscale Funnel) — ولو ما ضبط ننزل لنفق Cloudflare المؤقت
tsfunnel.start(PORT)
    .then((ok) => { if (!ok) startQuickTunnel(); })
    .catch((e) => { console.error('🌒 خطأ Tailscale:', e.message); startQuickTunnel(); });

// تشغيل البوت. لو Server Members Intent مو مفعل نشغله بدونه (الترحيب وصفحة الأعضاء يتعطلون بس)
// ولو فشل التشغيل (شبكة/توكن) يعيد المحاولة تلقائياً بتباعد متزايد بدل ما يوقف نهائياً
let intentFallbackStep = 0;   // 0 = كل شي · 1 = بلا Presence · 2 = بلا Presence وبلا Members
async function bootBot(attempt = 1) {
    try {
        await client.login(process.env.DISCORD_TOKEN);
        lastAlive = Date.now();
        botBooted = true;
        if (attempt > 1) console.log(`🚀 البوت اشتغل بالمحاولة ${attempt}`);
    } catch (err) {
        const intentsIssue = err.code === 'DisallowedIntents'
            || /disallowed intents|privileged intent/i.test(String(err.message));
        if (intentsIssue && intentFallbackStep < 2) {
            intentFallbackStep++;
            try { client.destroy(); } catch {}
            if (intentFallbackStep === 1 && client.options.intents.has(GatewayIntentBits.GuildPresences)) {
                console.error('⚠️ Presence Intent مو مفعل في موقع المطورين — أطفئ «مرآة نشاط الملكيين» (الحالات الدوّارة تشتغل عادي)');
                client.options.intents.remove(GatewayIntentBits.GuildPresences);
            } else {
                intentFallbackStep = 2;
                console.error('⚠️ Server Members Intent مو مفعل في موقع المطورين، أشغل البوت بدونه (الترحيب وصفحة الأعضاء معطلين)');
                client.options.intents.remove(GatewayIntentBits.GuildMembers);
            }
            return bootBot(attempt);
        }
        console.error('❌ فشل تشغيل البوت:', err.message);
        const wait = Math.min(30_000 * attempt, 5 * 60_000);
        console.log(`⏳ إعادة محاولة التشغيل بعد ${Math.round(wait / 1000)} ثانية...`);
        setTimeout(() => bootBot(attempt + 1), wait);
    }
}
bootBot();
