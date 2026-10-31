#!/usr/bin/env node
/*
 * 🔁 مولّد نسخة جديدة من بوت نوفا — لسيرفر ثاني (تسليم/تحويل)
 * ------------------------------------------------------------------
 * الاستخدام:  node newbot.js
 *
 * يسألك أسئلة بسيطة (آيدي السيرفر الجديد، توكن البوت الجديد…) ويطلع لك:
 *   C:\Users\<اسمك>\Desktop\<اسم>-bot\            ← مجلد جاهز للرفع
 *   C:\Users\<اسمك>\Desktop\<اسم>-bot.zip         ← نفس المجلد مضغوط
 *
 * مكوّنات النسخة:
 *   • كل ملفات البوت (بدون node_modules / data / .env القديم)
 *   • ملف .env جاهز ومعبّى بآيديات السيرفر الجديد وقاعدة بيانات جديدة
 *   • ملف «ابدأ-هنا.txt» فيه كل الخطوات بالعربي لصاحب السيرفر الجديد
 *
 * ما يلمس مشروعك الأصلي أبداً — قراءة فقط.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const DESKTOP = path.join(os.homedir(), 'Desktop');

// ما ننسخه: مجلدات/ملفات التشغيل والأسرار
const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'tunnels', '.vscode', '.idea', 'logs']);
const SKIP_EXT = new Set(['.zip', '.exe', '.winmd', '.log', '.pid']);
const SKIP_FILES = new Set([
    '.env', '.env.local', '.env.example', '.gitignore', 'nova-panel.png.bak',
    // توثيق داخلي فيه آيديات وسوالف سيرفرنا — ما ينتقل لصاحب سيرفر ثاني
    'AGENTS.md', 'HANDOFF.md', 'README.md', 'render.yaml', 'makebot.js'
]);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
// طابور أسطر يشتغل صح سواء كتبت يدوياً أو دخلت الأسطر من ملف/أنبوب
const queue = [];
let waiter = null;
rl.on('line', (l) => { if (waiter) { const w = waiter; waiter = null; w(l); } else queue.push(l); });
rl.on('close', () => { if (waiter) { const w = waiter; waiter = null; w(''); } });
const nextLine = () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((res) => { waiter = res; }));
const ask = async (q, def = '') => {
    process.stdout.write(def ? `${q} [${def}]: ` : `${q}: `);
    const a = String(await nextLine()).trim();
    return a || def;
};

const isId = (s) => /^\d{16,21}$/.test(String(s || '').trim());
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'novabot';
const rand = (n) => require('crypto').randomBytes(n).toString('hex');

function copyTree(src, dst, report) {
    fs.mkdirSync(dst, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, ent.name);
        const d = path.join(dst, ent.name);
        if (ent.isDirectory()) {
            if (SKIP_DIRS.has(ent.name)) continue;
            copyTree(s, d, report);
        } else {
            if (SKIP_FILES.has(ent.name)) continue;
            if (ent.name.startsWith('.env')) continue;   // .env / .env.القديم.txt / .env.local — كلها أسرار
            if (SKIP_EXT.has(path.extname(ent.name).toLowerCase())) continue;
            fs.copyFileSync(s, d);
            report.files++;
        }
    }
}

function envText(o) {
    return `# =========================================================
# 🤖 بوت نوفا — نسخة سيرفر «${o.name}»
# كل الإعدادات هنا. لا ترفع هذا الملف على GitHub.
# =========================================================

# --- هوية البوت (Discord Developer Portal → Bot) ---
DISCORD_TOKEN=${o.token}
DISCORD_CLIENT_ID=${o.clientId}
DISCORD_CLIENT_SECRET=${o.clientSecret}
SESSION_SECRET=${o.session}

# --- السيرفر الجديد ---
GUILD_ID=${o.guild}
ARTHUR_ID=${o.owner}
SPECIAL_USER_ID=${o.helper}
ROYAL_ROLE_ID=${o.royalRole}
SECRET_ROYAL_IDS=
LOVE_ALLOW_IDS=
DISRESPECT_ROLE_ID=
VOICE_CHANNEL_ID=${o.voice}
WELCOME_TEXT_CHANNEL_ID=
LOG_CHANNEL_ID=

# --- وضع التشغيل: سيرفر واحد بس + بلا نبض بقاء ---
PUBLIC_BOT=0
KEEPALIVE=0
MEMBERS_INTENT=1
PORT=3000

# --- قاعدة البيانات (اتركها فاضية = حفظ محلي يضيع مع كل إعادة تشغيل) ---
MONGODB_URI=${o.mongo}
MONGODB_DB=${o.db}

# --- الرابط الثابت للوحة (Tailscale Funnel) ---
TUNNEL=1
TS_AUTHKEY=${o.tskey}
TS_HOSTNAME=${o.tshost}

# --- الذكاء الاصطناعي / صوت العبد (Gemini مجاني) ---
AI_KEY=${o.aikey}

# --- تنظيف نسخة جديدة: بدون شخصيات ولا أزواج حب من سيرفر نوفا ---
PERSONAS_JSON={}
LOVE_FIXED_JSON=[]
`;
}

function startHereText(o) {
    return `╔══════════════════════════════════════════════════════════╗
║   🤖 بوت نوفا — نسخة سيرفر «${o.name}»
╚══════════════════════════════════════════════════════════╝

هذا المجلد نسخة كاملة جاهزة من البوت، معدّلة لسيرفرك.
كل شي بالعربي، وكل الإعدادات في ملف .env — ما تحتاج تلمس الكود.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
١) سوي بوت (تطبيق) جديد بديسكورد — ٥ دقايق
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• افتح: https://discord.com/developers/applications
• New Application → سمّه اللي تبي → Create
• من القائمة اليسار: Bot
   – Reset Token → Copy   ← هذا التوكن (لا تعطيه أحد)
• نفس الصفحة، تحت: Privileged Gateway Intents
   فعّل:  ✅ SERVER MEMBERS INTENT
   (اختياري للمرايا: ✅ PRESENCE INTENT — لو ما فعّلته البوت يشتغل عادي)
   ثم Save Changes
• من القائمة: OAuth2
   – Client ID و Client Secret → انسخهم
   – Redirects → Add Redirect → اكتب:
        https://${o.tshost}.<tailnet>.ts.net/auth/callback
        (بدّل <tailnet> باسمك بلوحة Tailscale — أو حط الرابط المؤقت أول مرة وشوفه بالكونسول)
     ← بعد ما يشتغل البوت مرة، الكونسول يطبع لك الرابط الصحيح حرفياً.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
٢) عبّي ملف .env
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
افتح .env بأي محرر (Notepad) وعبّي:
  DISCORD_TOKEN=            ← توكن البوت الجديد
  DISCORD_CLIENT_ID=        ← Client ID
  DISCORD_CLIENT_SECRET=    ← Client Secret
  GUILD_ID=                 ← آيدي سيرفرك (كلك يمين على السيرفر → Copy Server ID)
  ARTHUR_ID=                ← آيدي حسابك (أنت صاحب السيرفر = صاحب اللوحة)
  VOICE_CHANNEL_ID=         ← آيدي روم صوتي (اختياري — البوت يدخله 24/7)
  ROYAL_ROLE_ID=            ← آيدي رتبة «الملكي» عندك (اختياري — فاضي = صاحب السيرفر بس)
  MONGODB_URI=              ← رابط MongoDB Atlas (اختياري — بدونه البيانات تضيع مع كل restart)
  TS_AUTHKEY=               ← مفتاح Tailscale (اختياري — للرابط الثابت)
  AI_KEY=                   ← مفتاح Gemini (اختياري — للذكاء الاصطناعي وصوت العبد)
  SPECIAL_USER_ID=          ← آيدي شخص ثاني تبي تعطيه صلاحية كاملة (اختياري)

⚠️ ملاحظة: ما فيه فواصل ولا علامات تنصيص — الصيغة:  GUILD_ID=123456789012345678

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
٣) أضف البوت لسيرفرك
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• من OAuth2 → URL Generator
   Scopes:  ✅ bot   ✅ applications.commands
   Bot Permissions: ✅ Administrator (أسهل) أو:
      Manage Channels · Manage Roles · Kick · Ban · Moderate Members ·
      View Channels · Send Messages · Embed Links · Attach Files ·
      Read Message History · Add Reactions · Manage Messages ·
      Use Slash Commands · Connect · Speak · Manage Webhooks
• انسخ الرابط اللي تحت → افتحه بالمتصفح → اختر سيرفرك → Authorize

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
٤) ارفع البوت على استضافة (مجاني بلا بطاقة: wispbyte.com)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• سوي سيرفر جديد → النوع: Bot (Pterodactyl)
• صورة التشغيل: nodejs_22   ← مو nodejs_lts (قديمة، الفويس ما يشتغل عليها)
• Files → Upload → ارفع ملف ${o.zip} → كلك يمين → Extract/Unarchive
• تأكد إن .env داخل مجلد البوت (بجانب index.js) — ملف مخفي، فعّل Show Hidden
• Startup / أمر التشغيل (سطر واحد بلا أسطر جديدة):
      cd ${o.slug}-main && npm install --omit=dev && node index.js
• Start → راقب الكونسول:
      🤖 Logged in as ...
      💓 نبض البقاء مطفي (KEEPALIVE=0)
      🛡️ درع نوفا شغال
      🎙️ دخل الفويس بنجاح

⚠️ لو طلع «An invalid token was provided» → التوكن غلط أو .env مو بمكانه.
⚠️ لو رفض Presence Intent → البوت يشيله ويكمل تلقائياً.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
٥) لوحة التحكم
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• البوت يطبع بالكونسول رابط اللوحة (Tailscale ثابت أو Cloudflare مؤقت).
• أول ما يفتح السيرفر لازم «يُفعّل» من لوحة صاحب البوت الأصلي:
      صفحة «السيرفرات 🌐» → 🔓 فعّل
  قبل التفعيل: البوت ما يرد ولا تنزل أوامر ولا تنفتح لوحة (حماية).
• بعد التفعيل: تدخل لوحتك من نفس الرابط → /dashboard
  وتقدر تعطي صلاحية الدخول لأي أحد من صفحة «صلاحية الدخول 🔑».

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
٦) وش فيه البوت (كل شي من اللوحة)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
مستويات · اقتصاد (راتب يومي + متجر رتب) · قرعات · تذاكر · رتب ألوان ·
رتب ذاتية · ترحيب (صور) · ألعاب (سرعة/رياضيات/مبعثرة/أعلام/إكس أو/كلمة السر) ·
ردود ذكية · رياكشن تلقائي على الصور · لوحة تحكم برسالة وحدة · حالة البوت ·
درع نوفا (حماية من النك والرايد) · ذكاء اصطناعي · صوت العبد (TTS) · أوامر بالأوامر والكلام الطبيعي.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ مشاكل شائعة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• «التطبيق لم يستجب» → GUILD_ID غلط أو البوت مو بالسيرفر أو السيرفر مقفول 🔒.
• البوت ما يرد → تأكد إن السيرفر مفعّل من صفحة «السيرفرات 🌐».
• النقاط ترجع صفر بعد كل restart → MONGODB_URI مو مضبوط.
• الفويس ما يشتغل → صورة التشغيل لازم nodejs_22 + البوت يحتاج صلاحية Connect/Speak.
• اللوحة ما تفتح → نفس الروابط بس: لازم redirect_uri مسجّل بنفس الرابط بالضبط.

(تم توليد هذي النسخة بتاريخ ${new Date().toISOString().slice(0, 10)})
`;
}

(async () => {
    console.log('\n🔁 مولّد نسخة جديدة من بوت نوفا — لسيرفر ثاني\n' + '─'.repeat(52));
    console.log('اضغط Enter على أي سؤال إذا تبي تتركه فاضي (تعبّيه لاحقاً بـ .env).\n');

    const name = await ask('اسم النسخة (إنجليزي بلا مسافات، مثال: ahmed)', 'newserver');
    const slug = slugify(name);
    const guild = await ask('GUILD_ID (آيدي السيرفر الجديد)');
    const owner = await ask('ARTHUR_ID (آيدي صاحب السيرفر = صاحب اللوحة)');
    const helper = await ask('SPECIAL_USER_ID (آيدي ثاني بصلاحية كاملة — اختياري)');
    const royalRole = await ask('ROYAL_ROLE_ID (رتبة «الملكي» — اختياري)');
    const voice = await ask('VOICE_CHANNEL_ID (روم صوتي للبوت 24/7 — اختياري)');
    const token = await ask('DISCORD_TOKEN (توكن البوت الجديد — اختياري الحين)');
    const clientId = await ask('DISCORD_CLIENT_ID');
    const clientSecret = await ask('DISCORD_CLIENT_SECRET');
    const mongo = await ask('MONGODB_URI (اتركه فاضي = حفظ محلي — أو نفس رابطك بقاعدة جديدة)');
    const tskey = await ask('TS_AUTHKEY (نفق Tailscale للرابط الثابت — اختياري)');
    const tshost = await ask('TS_HOSTNAME (اسم الرابط الثابت، مثال: nova-bot2)', `${slug}-bot`);
    const aikey = await ask('AI_KEY (مفتاح Gemini للذكاء الاصطناعي وصوت العبد — اختياري)');
    const brand = await ask('تبدّل كلمة «نوفا» باسم السيرفر باللوحة والردود؟ (y = نعم / n = لا)', 'y');
    const display = brand && /^y/i.test(brand) ? await ask('اسم السيرفر اللي يظهر باللوحة (عربي)', name) : name;

    if (guild && !isId(guild)) console.log('⚠️ تنبيه: GUILD_ID يبدو مو آيدي صحيح (لازم أرقام فقط).');
    if (owner && !isId(owner)) console.log('⚠️ تنبيه: ARTHUR_ID يبدو مو آيدي صحيح.');

    const db = ('nova_' + slug).replace(/-/g, '_').slice(0, 60);
    const outDir = path.join(DESKTOP, `${slug}-bot`);
    const zipPath = path.join(DESKTOP, `${slug}-bot.zip`);

    if (fs.existsSync(outDir)) {
        const over = await ask(`⚠️ المجلد موجود (${outDir}). نكتب فوقه؟ (y/n)`, 'n');
        if (!/^y/i.test(over)) { console.log('انلغى — ما تغير شي.'); rl.close(); return; }
        fs.rmSync(outDir, { recursive: true, force: true });
    }

    console.log('\n📦 جاري نسخ ملفات البوت…');
    const report = { files: 0 };
    copyTree(ROOT, outDir, report);

    // 🎨 الهوية: «نوفا» ← اسم السيرفر (نصوص ظاهرة بس — ما نلمس أي كود أو متغير)
    if (brand && /^y/i.test(brand) && display && display !== 'نوفا') {
        const targets = ['dashboard.js', 'index.js', 'hub.js', 'welcome.js', 'guard.js', 'admin.js', 'extra.js', 'ai.js', 'tts.js'];
        let changed = 0;
        for (const f of targets) {
            const p = path.join(outDir, f);
            if (!fs.existsSync(p)) continue;
            const before = fs.readFileSync(p, 'utf8');
            const after = before.split('نوفا').join(display);
            if (after !== before) { fs.writeFileSync(p, after, 'utf8'); changed++; }
        }
        console.log(`🎨 بدلنا اسم «نوفا» بـ«${display}» في ${changed} ملف (شكل فقط).`);
    }

    const o = {
        name, slug, guild, owner, helper, royalRole, voice,
        token, clientId, clientSecret, mongo, tskey, tshost, aikey,
        session: rand(32), db, zip: `${slug}-bot.zip`
    };

    fs.writeFileSync(path.join(outDir, '.env'), envText(o), 'utf8');
    fs.writeFileSync(path.join(outDir, 'ابدأ-هنا.txt'), startHereText(o), 'utf8');

    // نسخة احتياطية من التعليمات بره المجلد (تقرأها قبل الرفع)
    fs.writeFileSync(path.join(DESKTOP, `ابدأ-هنا-${slug}.txt`), startHereText(o), 'utf8');

    console.log(`✅ انسخ ${report.files} ملف + .env + ابدأ-هنا.txt`);
    console.log(`📁 المجلد: ${outDir}`);

    try {
        console.log('🗜️ جاري الضغط…');
        if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
        execFileSync('powershell.exe', ['-NoProfile', '-Command',
            `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${zipPath}" -Force`], { stdio: 'ignore' });
        console.log(`✅ الملف المضغوط: ${zipPath}`);
    } catch (e) {
        console.log('⚠️ ما قدرنا نضغط تلقائياً — اضغط المجلد بنفسك (كلك يمين → Send to → Compressed).');
    }

    console.log('\n' + '─'.repeat(52));
    console.log('الخطوات الجاية:');
    console.log('  ١) افتح «ابدأ-هنا.txt» اللي بالمجلد واتبع الخطوات.');
    console.log('  ٢) عبّي .env (التوكن والآيديات) — كل شي مشروح بالملف.');
    console.log('  ٣) ارفع الـZIP على الاستضافة → Restart.');
    console.log('  ٤) فعّل السيرفر من صفحة «السيرفرات 🌐» بلوحة صاحب البوت الأصلي.');
    console.log('\n⚠️ لا ترفع هذا المجلد على GitHub — فيه الأسرار.');
    rl.close();
})().catch((e) => { console.error('⛔ خطأ:', e && e.message || e); try { rl.close(); } catch {} process.exitCode = 1; });
