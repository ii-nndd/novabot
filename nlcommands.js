// أوامر الإدارة بالكلام الطبيعي: "يا عبد مسح 20" / "يا عبد طرد @فلان يسب الناس" / "يا عبد ميوت @فلان 10 دقايق مزعج"
// يعيد استخدام منطق admin.js (run) ببناء "تفاعل وهمي" من رسالة عادية.

const nz = (t) => t.replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

// كلمة مفتاحية -> اسم الأمر الحقيقي بـ admin.js
// مهم: أي أمر "فك_X" لازم يتحط قبل X بالترتيب هنا، لأن "فك ميوت" مثلاً فيها substring "ميوت"
// ولو كانت "ميوت" قبلها بالقائمة بتنطابق غلط. نفس الشي لسجن/فك_سجن وحظر/فك_حظر.
const KEYWORDS = [
    [['فكحظر', 'فك حظر', 'الغاءحظر', 'فكالحظر'], 'فك_حظر'],
    [['طرد', 'اطرد'], 'طرد'],
    [['حظر', 'باند', 'بان', 'احظر'], 'حظر'],
    [['فكميوت', 'فك ميوت', 'فككتم', 'فك كتم'], 'فك_ميوت'],
    [['ميوت', 'كتم', 'تايماوت', 'تايم اوت'], 'ميوت'],
    [['فكسجن', 'فك سجن'], 'فك_سجن'],
    [['سجن', 'اسجن'], 'سجن'],
    [['مسح', 'امسح', 'نظف'], 'مسح'],
    [['قفل', 'اقفل'], 'قفل'],
    [['فتح', 'افتح'], 'فتح'],
    [['بطيء', 'سلومود', 'سلو مود'], 'بطيء'],
    [['رتبهاضافه', 'اعطرتبه', 'اضفرتبه'], 'رتبة_اضافة'],
    [['رتبهازاله', 'اسحبرتبه', 'شيلرتبه'], 'رتبة_ازالة'],
    [['لقب', 'غيرلقب', 'غيراللقب'], 'لقب'],
    [['تحذيرات'], 'تحذيرات'],
    [['تحذير', 'انذار', 'حذر'], 'تحذير'],
    [['معلوماتعضو', 'معلومات عضو'], 'معلومات_عضو'],
    [['معلوماتسيرفر', 'معلومات سيرفر', 'معلوماتالسيرفر'], 'معلومات_سيرفر']
];

function findCommand(rawContent) {
    const flat = nz(rawContent).replace(/[^\u0600-\u06FF\s]/g, ' ');
    for (const [words, name] of KEYWORDS) {
        for (const w of words) {
            if (flat.includes(nz(w))) return { name, word: w };
        }
    }
    return null;
}

// يدور على رقم + وحدة زمن (دقيقة/ساعة/يوم/ثانية) عشان المدة
function extractDuration(text) {
    const m = text.match(/(\d{1,5})\s*(يوم|ايام|ساعه|ساعة|ساعات|دقيقه|دقيقة|دقايق|ثانيه|ثانية|ثواني)?/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = m[2] || '';
    let minutes = n;
    if (/ثاني/.test(unit)) minutes = Math.max(1, Math.round(n / 60));
    else if (/ساع/.test(unit)) minutes = n * 60;
    else if (/يوم|ايام/.test(unit)) minutes = n * 1440;
    return { minutes: Math.min(40320, minutes), seconds: Math.min(21600, /ثاني/.test(unit) ? n : minutes * 60), raw: m[0], hasUnit: !!unit };
}

// يشيل المنشنات وكلمة النداء والأمر والمدة من النص عشان يبقى السبب بس
function extractReason(content, extras) {
    let t = content
        .replace(/<@!?\d+>/g, ' ').replace(/<@&\d+>/g, ' ').replace(/<#\d+>/g, ' ')
        .replace(/يا\s*عبد/g, ' ').replace(/\bالعبد\b/g, ' ').replace(/\bعبد\b/g, ' ');
    for (const e of extras) if (e) t = t.split(e).join(' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t || null;
}

const NEEDS_TARGET = new Set(['طرد', 'حظر', 'ميوت', 'فك_ميوت', 'تحذير', 'تحذيرات', 'لقب', 'رتبة_اضافة', 'رتبة_ازالة', 'سجن', 'فك_سجن']);
const NEEDS_ROLE = new Set(['رتبة_اضافة', 'رتبة_ازالة']);

async function handle(message, tier, ctx, admin) {
    const found = findCommand(message.content);
    if (!found) return false;

    const level = admin.LEVEL[found.name];
    if (!level) return false;
    const owner = (ctx.access && ctx.access.isTop) ? ctx.access.isTop(message.guild, message.member, tier, ctx.CONFIG) : (tier === 'arthur' || tier === 'ida');
    if (!(owner || (level === 'royal' && tier === 'royal'))) {
        await message.reply(level === 'owner'
            ? (ctx.access ? ctx.access.denyTextOwner(message.guild, ctx.CONFIG) : '⛔ هذا الأمر للإدارة فقط! 👑')
            : (ctx.access ? ctx.access.denyTextRanks(message.guild, ctx.CONFIG) : '⛔ هذا الأمر للإدارة فقط! 💅'));
        return true;
    }

    const mentionedMembers = [...message.mentions.members.values()].filter(m => m.id !== message.client.user.id);
    const target = mentionedMembers[0] || null;
    const role = message.mentions.roles.first() || null;
    // نشيل المنشنات أول قبل ما ندور على أرقام، عشان آي دي المنشن ما يتلخبط مع رقم المدة/العدد
    const noMentions = message.content.replace(/<@!?\d+>/g, ' ').replace(/<@&\d+>/g, ' ').replace(/<#\d+>/g, ' ');
    const dur = extractDuration(noMentions);
    const reason = extractReason(message.content, [found.word, dur && dur.raw]);

    if (NEEDS_ROLE.has(found.name) && !role) {
        await message.reply('⚠️ منشن الرتبة اللي تبيها كمان (مثال: يا عبد رتبة_اضافة @فلان @الرتبة).');
        return true;
    }
    if (NEEDS_TARGET.has(found.name) && !target) {
        await message.reply('⚠️ منشن العضو اللي تقصده (مثال: يا عبد ' + found.word + ' @فلان).');
        return true;
    }

    // الرد على الرسالة يفشل لو انحذفت (أمر «مسح» يمسح الرسالة نفسها)
    // → نرجع نرسل بالروم عادي عشان التأكيد يوصل دايماً بدون خطأ.
    const send = (o) => {
        const payload = typeof o === 'string' ? o : (o && o.content != null ? o.content : '');
        return message.reply(payload).catch(() => message.channel.send(payload).catch(() => {}));
    };
    const i = {
        commandName: found.name,
        guild: message.guild, channel: message.channel, user: message.author,
        member: message.member, client: message.client,
        deferred: false, replied: false,
        reply: async (o) => { i.replied = true; return send(o); },
        deferReply: async () => { i.deferred = true; },
        editReply: async (o) => send(o),
        options: {
            getMember: (name) => (name === 'عضو' ? target : null),
            getUser: (name) => (name === 'عضو' ? (target ? target.user : null) : null),
            getRole: (name) => (name === 'الرتبة' ? role : null),
            getChannel: () => null,
            getString: (name) => {
                if (name === 'السبب') return reason || 'بدون سبب';
                if (name === 'الايدي') { const m = noMentions.match(/\b\d{17,20}\b/); return m ? m[0] : null; }
                if (name === 'اللقب') return reason || '';
                return null;
            },
            getInteger: (name) => {
                if (name === 'الدقائق') return (dur && dur.minutes) || 10;
                if (name === 'العدد') {
                    const m = noMentions.match(/\b(\d{1,3})\b/);
                    return m ? Math.min(100, Math.max(1, parseInt(m[1], 10))) : 10;
                }
                if (name === 'الثواني') return (dur && dur.seconds) || 0;
                if (name === 'ايام') return 0;
                return null;
            }
        }
    };

    try {
        await admin.run(i, tier, ctx);
    } catch (err) {
        console.error('❌ خطأ أمر نصي:', found.name, err.message);
        if (!i.replied) await send('⚠️ ما قدرت أنفذ. تأكد إن رتبتي أعلى من العضو/الرتبة وإني عندي الصلاحية.');
    }
    return true;
}

module.exports = { handle };
