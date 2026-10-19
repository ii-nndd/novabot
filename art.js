// ============================================================================
//  art.js — محرك صور نوفا: هوية بصرية واحدة لكل أنظمة البوت
// ----------------------------------------------------------------------------
//  ليش ملف منفصل؟ عشان كل صور البوت تطلع من نفس العائلة: نفس الخلفية الغامقة،
//  نفس الأحمر القرمزي والذهبي، نفس شعار نوفا، ونفس الخط (ليلى ثلث).
//
//  يستخدمه: الترحيب · الوداع · الألعاب الأربعة · الفوز · الراتب اليومي ·
//  ترقية المستوى · القرعات · أي تنبيه/إشعار عام (noticeCard).
//
//  ⚠️ دروس الرسم بالعربي (تعلّمناها بالتجربة — لا تكسرها):
//   1) ctx.direction='rtl' لازم للنص العربي وإلا ترتيب الكلمات ينقلب.
//   2) ممنوع إيموجي داخل الصورة (يطلع مربع فارغ لأن خط ليلى ما فيه إيموجي)
//      → نرسم الأيقونات بأنفسنا بالـ vectors (crown/trophy/coin/clock…).
//   3) الأرقام والرموز اللاتينية تُرسم منفصلة وباتجاه ltr عشان الـ bidi
//      → استخدم numLabel() / statCell() بدل خلط رقم داخل جملة عربية.
//   4) عند الفشل بأي رسم، الرجوع للنص العادي مسؤولية اللي يستدعي (لا نكسر الأمر).
// ============================================================================
const path = require('path');

let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); }
catch { console.error('⚠️ @napi-rs/canvas غير مثبت، صور نوفا معطلة (الأوامر ترجع نص عادي)'); }

const FONT_PATH = path.join(__dirname, 'Layla-Thuluth.ttf');
const FAMILY = 'Nova';
// سلسلة احتياطية: خط ليلى ما فيه إيموجي ولا الحروف المزخرفة (𝕹𝖔𝖛𝖆 / ＮＯＶＡ) ولا بعض
// اللاتيني (ö)، فنخلي سكيا يجرّب خطوط النظام بعدها بدل ما يطلع مربع فاضي □.
const FONT_STACK = FAMILY + ', DejaVu Sans, Arial, Segoe UI, Noto Sans, Tahoma, sans-serif';
let fontOk = false, sysFonts = 0;
if (canvasLib) {
    try { canvasLib.GlobalFonts.registerFromPath(FONT_PATH, FAMILY); fontOk = true; }
    catch (e) { console.error('❌ فشل تحميل خط نوفا (تأكد إن Layla-Thuluth.ttf بجذر المشروع):', e.message); }
    // خطوط النظام (DejaVu/Arial...) عشان الحروف اللي مو بخط ليلى تنرسم بدل المربع
    try { sysFonts = canvasLib.GlobalFonts.loadSystemFonts(); } catch { /* بيئات بلا خطوط نظام */ }
}
const available = () => !!canvasLib && fontOk;

// ===== الألوان (هوية نوفا) =====
const C = {
    ink1: '#1a1622', ink2: '#0a090d',
    crimson: '#b3121e', crimsonHi: '#e8283c',
    orange: '#ff8a3d', gold: '#ffc85a', goldDeep: '#a9701a',
    txt: '#f6f3fb', mut: '#9a95ab', dim: '#6f6a80',
    glass: 'rgba(255,255,255,.045)', line: 'rgba(255,255,255,.10)'
};

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const isAr = (s) => /[\u0600-\u06FF]/.test(String(s || ''));
const autoDir = (s) => (isAr(s) ? 'rtl' : 'ltr');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ===== تنظيف النص قبل الرسم =====
// المشكلة: خط ليلى (ثلث) ما فيه إيموجي ولا الحروف "المزخرفة" اللي يستخدمونها بأسماء
// السيرفرات/الأعضاء (𝕹𝖔𝖛𝖆 · ＮＯＶＡ · ⓃⓄⓋⒶ · 🅰) ولا بعض اللاتيني — فيطلع مربع فاضي □.
// الحل على ٣ طبقات:  (١) نطبّع المزخرف لحروف عادية  (٢) نشيل الإيموجي  (٣) قائمة سماح صارمة.
const FANCY_MAP = (() => {
    const m = new Map();
    // Mathematical Alphanumeric Symbols: عريض/مائل/مخطوط/fraktur/double-struck/sans/mono
    const bases = [0x1D400, 0x1D434, 0x1D468, 0x1D49C, 0x1D4D0, 0x1D504, 0x1D538,
        0x1D56C, 0x1D5A0, 0x1D5D4, 0x1D608, 0x1D63C, 0x1D670];
    for (let i = 0; i < 26; i++) {
        for (const b of bases) {
            m.set(b + i, String.fromCharCode(65 + i));
            m.set(b + 26 + i, String.fromCharCode(97 + i));
        }
    }
    for (let i = 0; i < 10; i++)
        for (const b of [0x1D7CE, 0x1D7D8, 0x1D7E2, 0x1D7EC, 0x1D7F6]) m.set(b + i, String(i));
    // العرض الكامل (ＮＯＶＡ ｎｏｖａ １２３ ！)
    for (let c = 0xFF01; c <= 0xFF5E; c++) m.set(c, String.fromCharCode(c - 0xFEE0));
    // الدوائر والمربعات (Ⓐ ⓐ ① 🅐 🅰 🄐 🄰 ⑴)
    for (let i = 0; i < 26; i++) {
        m.set(0x24B6 + i, String.fromCharCode(65 + i));   // Ⓐ
        m.set(0x24D0 + i, String.fromCharCode(97 + i));   // ⓐ
        for (const b of [0x1F110, 0x1F130, 0x1F150, 0x1F170]) m.set(b + i, String.fromCharCode(65 + i));
    }
    for (let i = 0; i < 10; i++) { m.set(0x2460 + i, String(i + 1)); m.set(0x2474 + i, String(i + 1)); m.set(0x2488 + i, String(i + 1)); }
    m.set(0x00B2, '2'); m.set(0x00B3, '3'); m.set(0x00B9, '1');   // ²³¹
    for (let i = 0; i < 10; i++) { m.set(0x2070 + i, String(i)); m.set(0x2080 + i, String(i)); }
    // حروف شبيهة (سيريلي/يوناني) شائعة بأسماء الديسكورد — نحوّلها لاتيني بدل ما تصير فراغ
    const homo = {
        'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's',
        'А': 'A', 'В': 'B', 'Е': 'E', 'З': '3', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C',
        'Т': 'T', 'У': 'Y', 'Х': 'X', 'І': 'I', 'Ѕ': 'S', 'Њ': 'H', 'ԁ': 'd', 'ɡ': 'g',
        'α': 'a', 'β': 'b', 'ε': 'e', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'ν': 'v', 'κ': 'k', 'μ': 'u',
        'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N',
        'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', '₩': 'W', '₪': 'N'
    };
    for (const [k, v] of Object.entries(homo)) m.set(k.codePointAt(0), v);
    return m;
})();

function deFancy(s) {
    let out = '';
    for (const ch of s) {
        const cp = ch.codePointAt(0);
        out += FANCY_MAP.has(cp) ? FANCY_MAP.get(cp) : ch;
    }
    return out;
}

// قائمة سماح صارمة: عربي + لاتيني + أرقام + ترقيم آمن. أي محرف ثاني يُشال نهائياً
// (أفضل من مربع فاضي □ داخل الصورة).
const KEEP_RE = /[^0-9A-Za-z\u00C0-\u024F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF \t.,:;!?()\[\]{}<>'"+\-*\/\\%&@#_=|~^$\u06D4]/g;

// الإيموجي والرموز (شكل ولون/أسهم/رموز فنية)
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;
// محارف خفية/تحكم (ZWJ · LRM · RLM · علامات الاتجاه) — تطلع مربع فاضي أو تخرب الترتيب
const INVISIBLE_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD\u034F\u180E\u3164\uFFA0]/g;

function san(s) {
    let t = String(s == null ? '' : s);
    t = deFancy(t);                                  // ١) 𝕹𝖔𝖛𝖆 → Nova
    t = t.replace(INVISIBLE_RE, '');                 // ٢) المحارف الخفية
    t = t.replace(EMOJI_RE, '');                     // ٣) الإيموجي
    t = t.replace(/[\u2013\u2014\u2015]/g, '-')      // ٤) رموز مزخرفة → بديل آمن
        .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2026/g, '...').replace(/\u00D7/g, 'x').replace(/\u00F7/g, '/')
        .replace(/[\u2022\u00B7\u25CF]/g, '-').replace(/\u00A0/g, ' ');
    t = t.replace(KEEP_RE, '');                      // ٥) قائمة السماح (لا مربعات)
    return t.replace(/[ \t]{2,}/g, ' ').trim();
}

// اسم نظيف مع بديل لو صار فراغ بعد التنظيف (اسم كله إيموجي مثلاً)، ومقصوص لو طويل
// عشان الأسماء الطويلة ما تزحف فوق الصورة الشخصية أو تطلع من الإطار.
const clip = (s, n) => {
    const t = san(s);
    return t.length > n ? t.slice(0, Math.max(0, n - 3)).trimEnd() + '...' : t;
};
const nm = (s, fallback, n) => clip(san(s) || fallback, n || 1000);

// ===== أدوات رسم أساسية =====
function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

// نص واحد: يضبط الخط والاتجاه والمحاذاة تلقائياً لو ما تحددت
function T(ctx, s, x, y, o = {}) {
    const str = san(s);
    const size = o.size || 32;
    ctx.font = (o.weight || '500') + ' ' + size + 'px ' + FONT_STACK;
    ctx.fillStyle = o.color || C.txt;
    ctx.textAlign = o.align || (isAr(str) ? 'right' : 'left');
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.direction = o.dir || autoDir(str);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.glow) { ctx.save(); ctx.shadowColor = o.glowColor || 'rgba(255,150,60,.5)'; ctx.shadowBlur = o.glow; }
    ctx.fillText(str, x, y);
    if (o.glow) ctx.restore();
    if (o.alpha != null) ctx.globalAlpha = 1;
    return ctx.measureText(str).width;
}

// نص بتدرّج ذهبي + توهّج (للعناوين الكبيرة)
function goldText(ctx, s, x, y, size, align, o = {}) {
    const str = san(s);
    ctx.font = '600 ' + size + 'px ' + FONT_STACK;
    ctx.textAlign = align || 'right';
    ctx.direction = o.dir || autoDir(str);
    ctx.textBaseline = 'alphabetic';
    const w = ctx.measureText(str).width;
    const x0 = align === 'center' ? x - w / 2 : align === 'left' ? x : x - w;
    const g = ctx.createLinearGradient(x0, y - size, x0 + w, y + size * 0.1);
    g.addColorStop(0, '#fff5de'); g.addColorStop(.38, C.gold);
    g.addColorStop(.7, o.mid || C.orange); g.addColorStop(1, o.end || '#e0631f');
    ctx.save();
    ctx.shadowColor = o.glowColor || 'rgba(255,150,60,.42)'; ctx.shadowBlur = o.glow == null ? 24 : o.glow;
    ctx.fillStyle = g; ctx.fillText(str, x, y);
    ctx.restore();
    return w;
}

// نص عربي + رقم بجانبه (بدون خلل bidi): العربي عند x والرقم على يساره، ويقدر يجي بعد الرقم لاحقة
function numLabel(ctx, x, y, label, num, o = {}) {
    const size = o.size || 30;
    const wl = T(ctx, label, x, y, { size, color: o.color || C.mut, align: 'right' });
    const nx = x - wl - (o.gap == null ? 14 : o.gap);
    const wn = T(ctx, nf(num), nx, y, {
        size: o.numSize || size, weight: '600', color: o.numColor || C.gold, align: 'right', dir: 'ltr'
    });
    if (o.suffix) T(ctx, o.suffix, nx - wn - 10, y, { size, color: o.color || C.mut, align: 'right' });
}

// لفّ نص عربي على أسطر (يُستخدم بعد ضبط ctx.font)
function wrapLines(ctx, text, maxWidth) {
    const words = san(text).split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (cur && ctx.measureText(test).width > maxWidth) { lines.push(cur); cur = w; }
        else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
}

// لفّ نص حول نقطة (يحتاج ctx.textAlign='center' + ctx.font مضبوط)
function wrapCentered(ctx, text, cx, cy, maxWidth, lineHeight) {
    const lines = wrapLines(ctx, text, maxWidth);
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
    return lines.length;
}

// لفّ نص بمحاذاة يمين (يحتاج ctx.textAlign='right' + ctx.font مضبوط)
function wrapRight(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = wrapLines(ctx, text, maxWidth);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
    return lines.length;
}

// ===== الخلفية والإطار =====
function stars(ctx, w, h, n, seed0) {
    let seed = seed0 || 42;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h, r = rnd() * 1.4 + 0.4;
        ctx.globalAlpha = rnd() * 0.5 + 0.22;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function bg(ctx, w, h, o = {}) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, C.ink1); g.addColorStop(1, C.ink2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    const gl = ctx.createRadialGradient(w * 0.5, -h * 0.18, 12, w * 0.5, -h * 0.18, w * 0.8);
    gl.addColorStop(0, 'rgba(179,18,30,.42)'); gl.addColorStop(1, 'rgba(179,18,30,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);

    const gg = ctx.createRadialGradient(w * 0.94, h * 1.1, 12, w * 0.94, h * 1.1, w * 0.6);
    gg.addColorStop(0, 'rgba(255,200,90,.15)'); gg.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = .035; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for (let x = -h; x < w; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
    ctx.restore();
    stars(ctx, w, h, Math.round((w * h) / 11000), o.seed || 42);
}

function corner(ctx, x, y, sx, sy, len, color) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * len, y);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.stroke();
}

// الإطار الموحّد لكل الصور: خلفية + شريط علوي + إطار داخلي + زوايا ذهبية
function frame(ctx, w, h, o = {}) {
    bg(ctx, w, h, o);
    const bar = ctx.createLinearGradient(0, 0, w, 0);
    bar.addColorStop(0, 'rgba(179,18,30,0)'); bar.addColorStop(.5, C.crimson); bar.addColorStop(1, 'rgba(179,18,30,0)');
    ctx.fillStyle = bar; ctx.fillRect(0, 0, w, 5);
    const i = 11;
    roundRect(ctx, i, i, w - i * 2, h - i * 2, 24);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,200,90,.15)'; ctx.stroke();
    const gold = 'rgba(255,200,90,.34)';
    corner(ctx, i + 16, i + 16, 1, 1, 30, gold);
    corner(ctx, w - i - 16, i + 16, -1, 1, 30, gold);
    corner(ctx, i + 16, h - i - 16, 1, -1, 30, gold);
    corner(ctx, w - i - 16, h - i - 16, -1, -1, 30, gold);
}

function glass(ctx, x, y, w, h, r = 24, fill = C.glass, line = C.line) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill; ctx.fill();
    if (line) { ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.stroke(); }
}

// الشعار (nova-icon.png، وإلا نجمة مرسومة)
const LOGO_PATH = path.join(__dirname, 'nova-icon.png');
let logoImg = null, logoTried = false;
async function loadLogo() {
    if (logoTried) return logoImg;
    logoTried = true;
    try { logoImg = await canvasLib.loadImage(LOGO_PATH); }
    catch { logoImg = null; }
    return logoImg;
}

// نجمة نوفا (نفس شعار اللوحة)
function novaMark(ctx, cx, cy, r, alpha = 1, color) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (!color) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, '#fff6e8'); g.addColorStop(.45, C.orange); g.addColorStop(1, C.crimson);
        ctx.fillStyle = g;
    } else ctx.fillStyle = color;
    const spikes = 8, inner = r * 0.42;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 ? inner : r;
        const a = (Math.PI / spikes) * i - Math.PI / 2;
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

async function drawLogo(ctx, cx, cy, size, alpha = 1) {
    const img = await loadLogo();
    if (img) {
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
        ctx.restore();
    } else novaMark(ctx, cx, cy, size / 2, alpha);
}

// علامة مائية كبيرة خفيفة (تعطي إحساس الهوية بدون ما تشوّش)
async function watermark(ctx, w, h) {
    await drawLogo(ctx, w - 210, h - 150, 360, 0.055);
    novaMark(ctx, 130, h - 120, 90, 0.05);
}

// ترويسة الصفحة: شعار صغير + NOVA يسار، واسم السيرفر يمين
async function brand(ctx, w, { server, pad = 48, y = 74 } = {}) {
    await drawLogo(ctx, pad + 24, y - 12, 48, 1);
    let x = pad + 58;
    const letters = 'NOVA';
    ctx.font = '600 28px ' + FONT_STACK;
    ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillStyle = C.gold;
    for (const ch of letters) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + 5; }
    // اسم السيرفر داخل كبسولة — نقيس النص بعد التنظيف (لا مربعات، ولا يزحف على الشعار)
    const srv0 = san(server);
    if (srv0) {
        const srv = srv0.length > 28 ? srv0.slice(0, 28) + '...' : srv0;
        ctx.font = '500 26px ' + FONT_STACK;
        const tw = ctx.measureText(srv).width;
        const pw = Math.min(tw + 44, w * 0.52), px = w - pad - pw, py = y - 32;
        glass(ctx, px, py, pw, 50, 25, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.22)');
        T(ctx, srv, px + pw - 22, y + 1, { size: 26, color: '#e9e4f2', align: 'right' });
    }
}

// شريط العنوان في وسط الترويسة
function titleBand(ctx, w, { title, icon: ic, y = 100, size = 42, icSize = 40 }) {
    const tw = T(ctx, title, w / 2, y, { size, weight: '600', color: C.gold, align: 'center' });
    if (ic) icon(ctx, ic, w / 2 - tw / 2 - 44, y - size * 0.33, icSize, C.gold);
    const line = ctx.createLinearGradient(w / 2 - 190, 0, w / 2 + 190, 0);
    line.addColorStop(0, 'rgba(255,200,90,0)'); line.addColorStop(.5, 'rgba(255,200,90,.75)');
    line.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = line; ctx.fillRect(w / 2 - 190, y + 20, 380, 3);
}

function footer(ctx, w, h, text) {
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, 'rgba(255,255,255,0)'); line.addColorStop(.5, 'rgba(255,255,255,.12)');
    line.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = line; ctx.fillRect(60, h - 52, w - 120, 1.5);
    T(ctx, text, w / 2, h - 22, { size: 24, color: C.dim, align: 'center', dir: 'rtl' });
}

// ===== أيقونات مرسومة (بدل الإيموجي اللي يطلع مربعات) =====
function icon(ctx, name, cx, cy, size, color) {
    const s = size / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.085);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (name) {
        case 'sparkle': {
            const r = s, i = s * 0.32;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.quadraticCurveTo(i * 0.55, -i * 0.55, r, 0);
            ctx.quadraticCurveTo(i * 0.55, i * 0.55, 0, r);
            ctx.quadraticCurveTo(-i * 0.55, i * 0.55, -r, 0);
            ctx.quadraticCurveTo(-i * 0.55, -i * 0.55, 0, -r);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'crown': {
            const w = s * 1.15, h = s * 0.72;
            ctx.beginPath();
            ctx.moveTo(-w, h * 0.55); ctx.lineTo(-w, -h * 0.18);
            ctx.lineTo(-w * 0.4, h * 0.22); ctx.lineTo(0, -h * 0.72);
            ctx.lineTo(w * 0.4, h * 0.22); ctx.lineTo(w, -h * 0.18);
            ctx.lineTo(w, h * 0.55); ctx.closePath(); ctx.fill(); break;
        }
        case 'trophy': {
            const w = s * 0.72, h = s * 0.9;
            ctx.beginPath();
            ctx.moveTo(-w, -h);
            ctx.bezierCurveTo(-w, h * 0.25, -w * 0.55, h * 0.55, 0, h * 0.55);
            ctx.bezierCurveTo(w * 0.55, h * 0.55, w, h * 0.25, w, -h);
            ctx.closePath(); ctx.fill();
            ctx.fillRect(-w * 0.16, h * 0.55, w * 0.32, h * 0.32);
            ctx.fillRect(-w * 0.78, h * 0.85, w * 1.56, h * 0.22);
            ctx.beginPath(); ctx.arc(-w * 1.02, -h * 0.4, w * 0.5, Math.PI * 0.62, Math.PI * 1.62); ctx.stroke();
            ctx.beginPath(); ctx.arc(w * 1.02, -h * 0.4, w * 0.5, Math.PI * 1.38, Math.PI * 0.38); ctx.stroke();
            break;
        }
        case 'medal': {
            ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.55, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-s * 0.42, -s * 0.62); ctx.lineTo(-s * 0.12, s * 0.2);
            ctx.lineTo(-s * 0.5, s * 0.95); ctx.lineTo(-s * 0.78, s * 0.3);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(s * 0.42, -s * 0.62); ctx.lineTo(s * 0.12, s * 0.2);
            ctx.lineTo(s * 0.5, s * 0.95); ctx.lineTo(s * 0.78, s * 0.3);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'coin': {
            ctx.beginPath(); ctx.arc(0, 0, s * 0.92, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, 0, s * 0.68, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = Math.max(2, size * 0.07); ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,.42)';
            const r = s * 0.36, i = r * 0.34;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.quadraticCurveTo(i * 0.6, -i * 0.6, r, 0);
            ctx.quadraticCurveTo(i * 0.6, i * 0.6, 0, r);
            ctx.quadraticCurveTo(-i * 0.6, i * 0.6, -r, 0);
            ctx.quadraticCurveTo(-i * 0.6, -i * 0.6, 0, -r);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'clock': {
            ctx.beginPath(); ctx.arc(0, 0, s * 0.88, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.52); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.44, s * 0.12); ctx.stroke();
            break;
        }
        case 'bolt': {
            ctx.beginPath();
            ctx.moveTo(s * 0.28, -s); ctx.lineTo(-s * 0.62, s * 0.08);
            ctx.lineTo(-s * 0.06, s * 0.08); ctx.lineTo(-s * 0.3, s);
            ctx.lineTo(s * 0.62, -s * 0.1); ctx.lineTo(s * 0.06, -s * 0.1);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'gift': {
            ctx.strokeRect(-s * 0.82, -s * 0.35, s * 1.64, s * 1.2);
            ctx.beginPath(); ctx.moveTo(0, -s * 0.35); ctx.lineTo(0, s * 0.85); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-s * 0.2, -s * 0.35);
            ctx.bezierCurveTo(-s * 1.05, -s * 0.62, -s * 0.34, -s * 1.15, -s * 0.2, -s * 0.35);
            ctx.closePath(); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.2, -s * 0.35);
            ctx.bezierCurveTo(s * 1.05, -s * 0.62, s * 0.34, -s * 1.15, s * 0.2, -s * 0.35);
            ctx.closePath(); ctx.stroke(); break;
        }
        case 'heart': {
            ctx.beginPath();
            ctx.moveTo(0, s * 0.78);
            ctx.bezierCurveTo(-s * 1.25, -s * 0.1, -s * 0.5, -s * 1.05, 0, -s * 0.35);
            ctx.bezierCurveTo(s * 0.5, -s * 1.05, s * 1.25, -s * 0.1, 0, s * 0.78);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'alert': {
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.95); ctx.lineTo(s * 0.95, s * 0.8); ctx.lineTo(-s * 0.95, s * 0.8);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,.55)';
            ctx.fillRect(-s * 0.09, -s * 0.45, s * 0.18, s * 0.72);
            ctx.beginPath(); ctx.arc(0, s * 0.5, s * 0.13, 0, Math.PI * 2); ctx.fill(); break;
        }
        case 'horn': {   // مكبّر صوت — للإعلانات
            // البوق
            ctx.beginPath();
            ctx.moveTo(-s * 0.92, -s * 0.34);
            ctx.lineTo(s * 0.34, -s * 0.95);
            ctx.lineTo(s * 0.34, s * 0.6);
            ctx.lineTo(-s * 0.92, s * 0.2);
            ctx.closePath(); ctx.fill();
            // المقبض
            ctx.beginPath();
            ctx.moveTo(-s * 0.68, s * 0.16); ctx.lineTo(-s * 0.46, s * 1.05);
            ctx.lineTo(-s * 0.06, s * 0.95); ctx.lineTo(-s * 0.28, s * 0.24);
            ctx.closePath(); ctx.fill();
            // الموجات
            ctx.beginPath(); ctx.arc(s * 0.54, -s * 0.18, s * 0.42, -0.95, 0.75); ctx.stroke();
            ctx.beginPath(); ctx.arc(s * 0.54, -s * 0.18, s * 0.78, -0.85, 0.65); ctx.stroke();
            break;
        }
        case 'check': {
            ctx.beginPath(); ctx.moveTo(-s * 0.8, s * 0.05); ctx.lineTo(-s * 0.2, s * 0.62);
            ctx.lineTo(s * 0.85, -s * 0.62); ctx.stroke(); break;
        }
        case 'lock': {
            ctx.beginPath(); ctx.arc(0, -s * 0.28, s * 0.45, Math.PI, 0); ctx.stroke();
            ctx.fillRect(-s * 0.72, -s * 0.32, s * 1.44, s * 1.15); break;
        }
        case 'shield': {
            ctx.beginPath();
            ctx.moveTo(0, -s); ctx.lineTo(s * 0.85, -s * 0.6);
            ctx.quadraticCurveTo(s * 0.85, s * 0.4, 0, s);
            ctx.quadraticCurveTo(-s * 0.85, s * 0.4, -s * 0.85, -s * 0.6);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'flag': {
            ctx.beginPath(); ctx.moveTo(-s * 0.7, -s); ctx.lineTo(-s * 0.7, s); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-s * 0.7, -s * 0.92);
            ctx.quadraticCurveTo(0, -s * 0.5, s * 0.8, -s * 0.8);
            ctx.lineTo(s * 0.8, s * 0.12);
            ctx.quadraticCurveTo(0, s * 0.42, -s * 0.7, -s * 0.02);
            ctx.closePath(); ctx.fill(); break;
        }
        case 'type': {
            roundRect(ctx, -s * 0.95, -s * 0.62, s * 1.9, s * 1.24, s * 0.18); ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle;
            for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
                if (r === 2 && (c < 2 || c > 3)) continue;
                ctx.beginPath();
                ctx.arc(-s * 0.62 + c * s * 0.31, -s * 0.3 + r * s * 0.32, s * 0.085, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
        }
        case 'tiles': {
            for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
                roundRect(ctx, -s * 0.9 + c * s * 0.98, -s * 0.9 + r * s * 0.98, s * 0.76, s * 0.76, s * 0.16);
                ctx.stroke();
            }
            break;
        }
        case 'person': {
            ctx.beginPath(); ctx.arc(0, -s * 0.34, s * 0.42, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-s * 0.82, s * 0.95);
            ctx.bezierCurveTo(-s * 0.82, s * 0.12, s * 0.82, s * 0.12, s * 0.82, s * 0.95);
            ctx.closePath(); ctx.fill(); break;
        }
        default: {
            ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2); ctx.stroke();
        }
    }
    ctx.restore();
}

// ===== الصور (مع كاش عشان ما ننزّل نفس الصورة كل مرة) =====
const imgCache = new Map();
const LOAD_MS = 6000;   // مهلة قصوى للصورة الوحدة (شامل قراءة البيانات)
async function loadImg(url) {
    if (!url) return null;
    const hit = imgCache.get(url);
    if (hit) {
        if (hit.img) return hit.img;
        if (Date.now() - hit.at < 300_000) return null;   // فشل قريب: ننتظر ٥ دقايق
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), LOAD_MS);
    try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        // مهم: المهلة تغطي قراءة البيانات بعد الهيدرز كمان (كانت تتوقف قبله = تعليق)
        const buf = Buffer.from(await res.arrayBuffer());
        const img = await canvasLib.loadImage(buf);
        if (imgCache.size > 400) imgCache.clear();
        imgCache.set(url, { img, at: Date.now() });
        return img;
    } catch {
        imgCache.set(url, { img: null, at: Date.now() });
        return null;
    } finally { clearTimeout(t); }
}

// غلاف أمان: لو الرسم أو تنزيل الصور تعطّل، يرجع null بدل ما يعلّق الأمر
async function guard(promise, ms = 8000, what = 'صورة') {
    let t;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise((_, rej) => { t = setTimeout(() => rej(new Error('تجاوز المهلة ' + ms + 'ms')), ms); })
        ]);
    } catch (e) {
        console.error('⚠️ تعذّر رسم ' + what + ':', e.message);
        return null;
    } finally { clearTimeout(t); }
}

// علم الدولة من الإيموجي (🇦🇪 → ae) عبر flagcdn مع بديل jsDelivr
function flagCode(emoji) {
    const cps = [...String(emoji || '').trim()];
    if (cps.length < 2) return '';
    const a = cps[0].codePointAt(0), b = cps[1].codePointAt(0);
    if (a < 0x1F1E6 || a > 0x1F1FF || b < 0x1F1E6 || b > 0x1F1FF) return '';
    return String.fromCharCode(a - 0x1F1E6 + 97, b - 0x1F1E6 + 97);
}
async function flagImage(emoji) {
    const cc = flagCode(emoji);
    if (!cc || !canvasLib) return null;
    return (await loadImg('https://flagcdn.com/w640/' + cc + '.png'))
        || (await loadImg('https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/png250px/' + cc + '.png'));
}

// صورة شخصية دائرية مع إطار ذهبي + توهّج
async function drawAvatar(ctx, url, cx, cy, r, ring = true) {
    const img = await loadImg(url);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.shadowColor = 'rgba(179,18,30,.55)'; ctx.shadowBlur = 34;
    ctx.fillStyle = '#241f2c'; ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    else {
        ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        icon(ctx, 'person', cx, cy + r * 0.08, r * 1.15, 'rgba(255,255,255,.32)');
    }
    ctx.restore();

    if (!ring) return;
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, C.gold); g.addColorStop(.5, C.orange); g.addColorStop(1, C.crimsonHi);
    ctx.lineWidth = Math.max(4, r * 0.07); ctx.strokeStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(cx, cy, r - r * 0.045, 0, Math.PI * 2); ctx.stroke();
}

function drawFlag(ctx, img, cx, cy, maxW, maxH) {
    const ratio = img.width / img.height;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const x = cx - w / 2, y = cy - h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 14);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, 10); ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    roundRect(ctx, x, y, w, h, 10);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,200,90,.5)'; ctx.stroke();
}

// ===== ١) بطاقة الترحيب (ولكم) =====
async function welcomeCard({ avatarURL, name, tag, server, count, subtitle, members }) {
    const W = 1024, H = 520, PAD = 52;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 17 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { server, y: 78 });

    // البطل: ولكم
    const hw = goldText(ctx, 'ولكم', W - PAD, 236, 118, 'right');
    novaMark(ctx, W - PAD - hw - 40, 206, 25, .95);
    novaMark(ctx, W - PAD - hw - 96, 242, 14, .7);
    novaMark(ctx, W - PAD - 16, 166, 17, .8);

    // الصورة الشخصية
    const AR = 104, AX = PAD + AR, AY = 300;
    await drawAvatar(ctx, avatarURL, AX, AY, AR);

    // الاسم + الوصف
    const RX = W - PAD;
    T(ctx, nm(name, 'عضو جديد', 26), RX, 316, { size: 52, weight: '600', color: '#ffffff', align: 'right' });
    const tg = clip(tag, 26);
    if (tg) T(ctx, tg, RX, 358, { size: 28, color: C.mut, align: 'right' });
    T(ctx, clip(subtitle, 64) || ('نوّرت ' + (clip(server, 28) || 'السيرفر')), RX, 404, { size: 30, color: C.gold, align: 'right' });

    // شريط سفلي: العضو رقم + الأعضاء + التاريخ
    const sy = 442, sh = 58, sx = PAD, sw = W - PAD * 2;
    glass(ctx, sx, sy, sw, sh, 22, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.16)');
    const cells = 3, cw = sw / cells;
    for (let i = 1; i < cells; i++) {
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.fillRect(sx + cw * i, sy + 12, 1.5, sh - 24);
    }
    const cxOf = (i) => sx + sw - cw * (i - 1) - 26;   // من اليمين لليسار
    T(ctx, nf(count), cxOf(1), sy + 30, { size: 32, weight: '600', color: C.gold, align: 'right', dir: 'ltr' });
    T(ctx, 'ترتيب انضمامك', cxOf(1), sy + 52, { size: 22, color: C.mut, align: 'right' });
    T(ctx, nf(members || count), cxOf(2), sy + 30, { size: 32, weight: '600', color: C.txt, align: 'right', dir: 'ltr' });
    T(ctx, 'أعضاء السيرفر', cxOf(2), sy + 52, { size: 22, color: C.mut, align: 'right' });
    T(ctx, new Date().toLocaleDateString('en-GB'), cxOf(3), sy + 30, { size: 30, weight: '600', color: C.txt, align: 'right', dir: 'ltr' });
    T(ctx, 'تاريخ الانضمام', cxOf(3), sy + 52, { size: 22, color: C.mut, align: 'right' });

    return cv.toBuffer('image/png');
}

// ===== ٢) بطاقة الوداع =====
async function leaveCard({ avatarURL, name, server, count }) {
    return noticeCard({
        title: 'وداعاً', iconName: 'person', avatarURL, name,
        sub: server, lines: ['غادر السيرفر — نتمنى نشوفك مرة ثانية'],
        tone: 'muted', stats: [{ label: 'الأعضاء الآن', value: count }]
    });
}

// ===== ٣) بطاقة سؤال اللعبة (كل الألعاب) =====
async function gameCard({ kind = 'text', game, main, hint, seconds = 30, flag, iconName }) {
    const W = 1024, H = 576, PAD = 56;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 23 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { y: 76 });
    titleBand(ctx, W, {
        title: game, icon: iconName || (kind === 'flag' ? 'flag' : kind === 'tiles' ? 'tiles' : kind === 'digits' ? 'bolt' : 'type'),
        y: 128, size: 40, icSize: 38
    });

    // لوحة السؤال
    const px = PAD, py = 168, pw = W - PAD * 2, ph = 226;
    glass(ctx, px, py, pw, ph, 26, 'rgba(255,255,255,.04)', 'rgba(255,255,255,.10)');

    // شريحة الوقت (فوق يسار اللوحة)
    const tw2 = 150, tx = px + 18, ty = py - 30;
    const tg = ctx.createLinearGradient(tx, ty, tx + tw2, ty + 56);
    tg.addColorStop(0, C.crimsonHi); tg.addColorStop(1, C.crimson);
    glass(ctx, tx, ty, tw2, 56, 28, tg, 'rgba(255,200,90,.45)');
    icon(ctx, 'clock', tx + 34, ty + 28, 34, '#fff');
    T(ctx, String(seconds), tx + tw2 - 26, ty + 40, { size: 34, weight: '600', color: '#fff', align: 'right', dir: 'ltr' });

    if (kind === 'flag' && flag) {
        drawFlag(ctx, flag, W / 2, py + ph / 2, 300, 180);
    } else if (kind === 'tiles') {
        const chars = [...String(main)];
        const tw = 64, gap = 12, total = chars.length * tw + (chars.length - 1) * gap;
        let x = W / 2 + total / 2 - tw;
        for (const ch of chars) {
            glass(ctx, x, py + ph / 2 - 40, tw, 80, 16, 'rgba(255,200,90,.10)', 'rgba(255,200,90,.30)');
            T(ctx, ch, x + tw / 2, py + ph / 2 + 14, { size: 46, weight: '600', color: '#fff', align: 'center', dir: 'ltr' });
            x -= tw + gap;
        }
    } else if (kind === 'digits') {
        T(ctx, String(main).replace(/×/g, 'x').replace(/÷/g, '/'), W / 2, py + ph / 2 + 36, {
            size: 104, weight: '600', color: '#fff', align: 'center', dir: 'ltr'
        });
    } else {
        ctx.textAlign = 'center'; ctx.direction = 'rtl';
        const len = String(main).length;
        const size = len > 46 ? 38 : len > 30 ? 48 : 60;
        ctx.font = '600 ' + size + 'px ' + FONT_STACK;
        wrapCentered(ctx, main, W / 2, py + ph / 2, pw - 110, size * 1.35);
    }

    T(ctx, hint, W / 2, py + ph + 58, { size: 32, color: C.orange, align: 'center' });

    // شريط الوقت
    const by = py + ph + 92;
    glass(ctx, PAD, by, W - PAD * 2, 16, 8, 'rgba(255,255,255,.07)', null);
    const bg2 = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
    bg2.addColorStop(0, C.crimsonHi); bg2.addColorStop(.55, C.orange); bg2.addColorStop(1, C.gold);
    roundRect(ctx, PAD, by, W - PAD * 2, 16, 8); ctx.fillStyle = bg2; ctx.fill();

    footer(ctx, W, H, 'أول جواب صحيح يفوز بالنقاط');
    return cv.toBuffer('image/png');
}

// ===== ٤) بطاقة الفوز =====
async function winCard({ avatarURL, name, game, seconds, points, total, leveledUp, level }) {
    const W = 1024, H = 500, PAD = 52;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 31 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { y: 76 });
    titleBand(ctx, W, { title: 'فوز جديد', icon: 'trophy', y: 128, size: 40, icSize: 40 });

    const RX = W - PAD;
    const AR = 96, AX = PAD + AR, AY = 312;
    await drawAvatar(ctx, avatarURL, AX, AY, AR);

    T(ctx, nm(name, 'عضو', 26), RX, 244, { size: 52, weight: '600', color: '#ffffff', align: 'right' });
    T(ctx, clip(game, 30), RX, 290, { size: 30, color: C.gold, align: 'right' });
    numLabel(ctx, RX, 344, 'خلال ثانية', Number(seconds || 0).toFixed(1), { size: 30, numSize: 34, color: C.mut, numColor: C.txt });

    // شرائح النقاط
    let cx = RX;
    const chip = (label, value, c0, c1) => {
        ctx.font = '600 30px ' + FONT_STACK;
        const vw = ctx.measureText(nf(value)).width;
        ctx.font = '500 28px ' + FONT_STACK;
        const lw = ctx.measureText(label).width;
        const w = vw + lw + 74;
        const y = 372, h = 54, x = cx - w;
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, c0); g.addColorStop(1, c1);
        glass(ctx, x, y, w, h, 27, g, 'rgba(255,200,90,.35)');
        T(ctx, nf(value), x + w - 26, y + 37, { size: 30, weight: '600', color: '#fff', align: 'right', dir: 'ltr' });
        T(ctx, label, x + w - 26 - vw - 16, y + 37, { size: 28, color: '#ffeccb', align: 'right' });
        cx = x - 14;
    };
    chip('نقطة', points || 0, 'rgba(179,18,30,.96)', 'rgba(120,10,20,.96)');
    if (total != null) chip('المجموع', total, 'rgba(255,200,90,.20)', 'rgba(255,138,61,.14)');

    if (leveledUp) {
        // شارة «وصل مستوى جديد» بعرض البطاقة
        const bx = PAD, bw = W - PAD * 2, by = 444, bh = 50;
        const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
        g.addColorStop(0, 'rgba(255,200,90,.22)'); g.addColorStop(1, 'rgba(255,138,61,.16)');
        glass(ctx, bx, by, bw, bh, 25, g, 'rgba(255,200,90,.5)');
        icon(ctx, 'crown', bx + 44, by + bh / 2, 34, C.gold);
        numLabel(ctx, bx + bw - 28, by + 34, 'وصل مستوى جديد', level, { size: 30, numSize: 34, color: C.gold, numColor: '#fff' });
    } else {
        footer(ctx, W, H, 'نظام نقاط نوفا');
    }
    return cv.toBuffer('image/png');
}

// ===== ٥) بطاقة الراتب اليومي =====
async function dailyCard({ avatarURL, name, amount, balance, cdHours }) {
    const W = 1024, H = 520, PAD = 52;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 41 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { y: 76 });
    titleBand(ctx, W, { title: 'راتبك اليومي', icon: 'coin', y: 132, size: 40, icSize: 42 });

    const RX = W - PAD;

    // بطاقة الرصيد (أعلى اليمين)
    const cw = 336, chx = RX - cw, chy = 180, chh = 78;
    glass(ctx, chx, chy, cw, chh, 24, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.18)');
    T(ctx, nf(balance), RX - 28, chy + 38, { size: 36, weight: '600', color: C.gold, align: 'right', dir: 'ltr' });
    T(ctx, 'رصيدك الآن', RX - 28, chy + 64, { size: 22, color: C.mut, align: 'right' });

    const AR = 92, AX = PAD + AR, AY = 318;
    await drawAvatar(ctx, avatarURL, AX, AY, AR);
    T(ctx, nm(name, 'عضو', 26), RX, 288, { size: 46, weight: '600', color: '#fff', align: 'right' });
    numLabel(ctx, RX, 338, 'الراتب القادم بعد', cdHours, { size: 26, suffix: 'ساعة' });

    // المبلغ الكبير
    const gw = goldText(ctx, '+' + nf(amount), RX, 448, 96, 'right');
    icon(ctx, 'coin', RX - gw - 56, 416, 64, C.gold);

    footer(ctx, W, H, 'راتب يومي تلقائي — تعدّله من لوحة التحكم');
    return cv.toBuffer('image/png');
}

// ===== ٦) بطاقة ترقية المستوى =====
async function levelUpCard({ avatarURL, name, level, points, lo, hi, rank }) {
    const W = 1024, H = 500, PAD = 52;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 53 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { y: 76 });
    titleBand(ctx, W, { title: 'مستوى جديد', icon: 'crown', y: 130, size: 40, icSize: 44 });

    const RX = W - PAD;
    const AR = 90, AX = PAD + AR, AY = 300;
    await drawAvatar(ctx, avatarURL, AX, AY, AR);
    T(ctx, nm(name, 'عضو', 26), RX, 270, { size: 46, weight: '600', color: '#fff', align: 'right' });

    // شارة المستوى (دائرة ذهبية وسط الفراغ)
    const bx = 540, by = 294, bR = 72;
    const g = ctx.createLinearGradient(bx - bR, by - bR, bx + bR, by + bR);
    g.addColorStop(0, C.gold); g.addColorStop(.55, C.orange); g.addColorStop(1, C.crimson);
    ctx.save();
    ctx.shadowColor = 'rgba(255,150,60,.5)'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(bx, by, bR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    T(ctx, 'المستوى', bx, by - 12, { size: 22, weight: '600', color: 'rgba(50,20,0,.75)', align: 'center' });
    T(ctx, String(level || 0), bx, by + 40, { size: 58, weight: '600', color: '#2a1400', align: 'center', dir: 'ltr' });

    // التقدم
    numLabel(ctx, RX, 372, 'التقدم للمستوى', (level || 0) + 1, { size: 26, numSize: 28 });
    const barX = PAD, barW = W - PAD * 2, barY = 392, barH = 26;
    glass(ctx, barX, barY, barW, barH, 13, 'rgba(255,255,255,.08)', null);
    const pct = hi > lo ? clamp(((points || 0) - lo) / (hi - lo), 0, 1) : 0;
    if (pct > 0) {
        roundRect(ctx, barX, barY, Math.max(barH, barW * pct), barH, 13);
        const g2 = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        g2.addColorStop(0, C.orange); g2.addColorStop(1, C.crimsonHi);
        ctx.fillStyle = g2; ctx.fill();
    }
    T(ctx, nf(points) + ' / ' + nf(hi), RX, 456, { size: 26, color: C.txt, align: 'right', dir: 'ltr' });
    if (rank) {
        const rh = 46, rw = 200, rx = PAD, ry = 432;
        glass(ctx, rx, ry, rw, rh, 23, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.18)');
        numLabel(ctx, rx + rw - 24, ry + 32, 'ترتيبك', rank, { size: 25, numSize: 26, numColor: C.txt });
    }
    return cv.toBuffer('image/png');
}

// ===== ٧) بطاقة عامة للتنبيهات/الإشعارات =====
async function noticeCard({ title, iconName = 'sparkle', lines = [], avatarURL, name, sub, tone = 'gold', stats = [], server }) {
    const W = 1024, PAD = 52, LH = 46, FS = 34;
    // نقيس الأسطر الحقيقية قبل ما نحدد ارتفاع الصورة
    const mctx = canvasLib.createCanvas(10, 10).getContext('2d');
    mctx.font = '500 ' + FS + 'px ' + FONT_STACK;
    // لو فيه صورة شخصية نقلّل عرض الأسطر عشان أطول سطر ما يزحف فوقها
    const bodyW = W - PAD * 2 - 24 - (avatarURL ? 180 : 0);
    const wrapped = [];
    for (const l of lines) for (const one of wrapLines(mctx, l, bodyW)) wrapped.push(one);

    const top = 200 + (avatarURL ? 132 : 0);
    const statsH = stats.length ? 108 : 0;
    const H = top + Math.max(1, wrapped.length) * LH + 40 + statsH;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 67 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { server, y: 76 });
    const color = tone === 'bad' ? '#ff6b6b' : tone === 'muted' ? '#c9c4d6' : C.gold;
    titleBand(ctx, W, { title, icon: iconName, y: 128, size: 40, icSize: 40 });

    if (avatarURL) {
        const AR = 78;
        await drawAvatar(ctx, avatarURL, PAD + AR, top - 62, AR);
        T(ctx, nm(name, 'عضو', 34), W - PAD, top - 74, { size: 44, weight: '600', color: '#fff', align: 'right' });
        const sb = clip(sub, 42);
        if (sb) T(ctx, sb, W - PAD, top - 32, { size: 28, color: C.mut, align: 'right' });
    }

    ctx.textAlign = 'right'; ctx.direction = 'rtl';
    ctx.fillStyle = tone === 'bad' ? '#ffd9d9' : '#e8e3f2';
    ctx.font = '500 ' + FS + 'px ' + FONT_STACK;
    wrapped.forEach((l, i) => ctx.fillText(l, W - PAD, top + 30 + i * LH));

    if (stats.length) {
        const sy = H - 88, sh = 64, gap = 14;
        const sw = (W - PAD * 2 - gap * (stats.length - 1)) / stats.length;
        let x = W - PAD - sw;
        for (const s of stats) {
            glass(ctx, x, sy, sw, sh, 22, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.16)');
            T(ctx, nf(s.value), x + sw - 26, sy + 32, { size: 30, weight: '600', color: color, align: 'right', dir: 'ltr' });
            T(ctx, s.label, x + sw - 26, sy + 56, { size: 22, color: C.mut, align: 'right' });
            x -= sw + gap;
        }
    }
    footer(ctx, W, H, 'نوفا — بوت السيرفر');
    return cv.toBuffer('image/png');
}

// ===== ٨) بطاقة القرعة =====
async function giveawayCard({ prize, winners = 1, endsAt, by, entrants = 0 }) {
    const W = 1024, H = 500, PAD = 52;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 79 });
    await watermark(ctx, W, H);
    await brand(ctx, W, { y: 76 });
    titleBand(ctx, W, { title: 'قرعة نوفا', icon: 'gift', y: 128, size: 42, icSize: 44 });

    // الجائزة
    ctx.textAlign = 'center'; ctx.direction = 'rtl';
    const len = String(prize || '').length;
    const size = len > 40 ? 40 : len > 24 ? 52 : 66;
    ctx.font = '600 ' + size + 'px ' + FONT_STACK;
    ctx.fillStyle = '#fff';
    wrapCentered(ctx, prize || 'جائزة', W / 2, 260, W - PAD * 2 - 60, size * 1.3);
    const line = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
    line.addColorStop(0, 'rgba(255,200,90,0)'); line.addColorStop(.5, 'rgba(255,200,90,.8)');
    line.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = line; ctx.fillRect(W / 2 - 200, 300, 400, 3);

    // شرائح المعلومات
    const stats = [
        { label: 'عدد الفائزين', value: winners },
        { label: 'المتسابقون الآن', value: entrants },
        { label: 'المتبقي بالدقائق', value: String(Math.max(0, Math.round((endsAt - Date.now()) / 60000))) }
    ];
    const sy = 352, sh = 84, gap = 16;
    const sw = (W - PAD * 2 - gap * 2) / 3;
    let x = W - PAD - sw;
    for (const s of stats) {
        glass(ctx, x, sy, sw, sh, 26, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.18)');
        T(ctx, nf(s.value), x + sw / 2, sy + 42, { size: 36, weight: '600', color: C.gold, align: 'center', dir: 'ltr' });
        T(ctx, s.label, x + sw / 2, sy + 70, { size: 23, color: C.mut, align: 'center' });
        x -= sw + gap;
    }
    // «بدأها <اسم>» — نرسم العربي والاسم منفصلين (خط ليلى ما يمزج العربي مع اللاتيني صح)
    const byn = clip(by, 22);
    if (byn) {
        const lab = 'بدأها';
        ctx.font = '500 24px ' + FONT_STACK;
        const w1 = ctx.measureText(lab).width, w2 = ctx.measureText(byn).width;
        const left = W / 2 - (w1 + w2 + 12) / 2;
        T(ctx, lab, left + w2 + 12 + w1, sy - 16, { size: 24, color: C.dim, align: 'right' });
        T(ctx, byn, left + w2, sy - 16, { size: 24, color: C.gold, align: 'right' });
    }
    footer(ctx, W, H, 'اضغط زر الدخول بالأسفل للمشاركة');
    return cv.toBuffer('image/png');
}

// ===== ١٠) بانر «لوحة التحكم» — صورة رسالة البانل (بانر كبير + شريط الخيارات) =====
// نفس فكرة بانرات السيرفرات: عنوان ضخم + قائمة الخيارات ككبسولات مرقّمة + سهم.
function fitText(ctx, s, maxW, size, weight) {
    ctx.font = (weight || '500') + ' ' + size + 'px ' + FONT_STACK;
    let t = san(s);
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(t + '...').width > maxW) t = t.slice(0, -1);
    return t + '...';
}

async function panelCard({ title = 'لوحة التحكم', subtitle = 'CONTROL PANEL', server, items = [], footerText } = {}) {
    const W = 1024, PAD = 52, X = W - PAD;
    const list = (items || []).filter(Boolean).slice(0, 8);
    const H = list.length ? 660 : 516;
    const cv = canvasLib.createCanvas(W, H);
    const ctx = cv.getContext('2d');
    roundRect(ctx, 0, 0, W, H, 30); ctx.clip();
    frame(ctx, W, H, { seed: 24 });
    await watermark(ctx, W, H);

    // زخرفة على اليسار: حلقتان ذهبيتان + نجمة نوفا خفيفة
    const cx = 262, cy = H / 2 + 6;
    ctx.save(); ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.arc(cx, cy, 170, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,200,90,.15)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 200, Math.PI * .12, Math.PI * .88);
    ctx.strokeStyle = 'rgba(255,200,90,.10)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    novaMark(ctx, cx, cy, 200, .08);

    await brand(ctx, W, { server, y: 76 });

    // العنوان الكبير + السطر الإنجليزي + خط ذهبي
    const yT = list.length ? 246 : 236;
    goldText(ctx, nm(title, 'لوحة التحكم', 26), X, yT, 92, 'right', { glow: 30 });
    T(ctx, nm(subtitle, 'CONTROL PANEL', 24).toUpperCase(), X, yT + 46, { size: 27, weight: '600', color: 'rgba(255,200,90,.60)', align: 'right', dir: 'ltr' });
    const lg = ctx.createLinearGradient(X - 430, 0, X, 0);
    lg.addColorStop(0, 'rgba(255,200,90,0)'); lg.addColorStop(1, 'rgba(255,200,90,.8)');
    ctx.fillStyle = lg; ctx.fillRect(X - 430, yT + 66, 430, 3);

    // كبسولات الخيارات: عمودين × ٤
    if (list.length) {
        const colW = (W - PAD * 2 - 26) / 2, y0 = yT + 94;
        list.forEach((it, k) => {
            const col = k % 2, r = Math.floor(k / 2);
            const x = X - colW - col * (colW + 26);
            const y = y0 + r * 62;
            glass(ctx, x, y, colW, 50, 24, 'rgba(255,255,255,.05)', 'rgba(255,200,90,.16)');
            // رقم دائري على اليمين
            ctx.beginPath(); ctx.arc(x + colW - 26, y + 25, 15, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,200,90,.15)'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,200,90,.38)'; ctx.lineWidth = 1.5; ctx.stroke();
            T(ctx, String(k + 1), x + colW - 26, y + 34, { size: 20, weight: '600', color: C.gold, align: 'center', dir: 'ltr' });
            // نص الخيار
            T(ctx, fitText(ctx, it, colW - 104, 23), x + colW - 52, y + 32, { size: 23, color: C.txt, align: 'right' });
            // سهم على اليسار ❯
            const ax = x + 22, ay = y + 25;
            ctx.beginPath();
            ctx.moveTo(ax, ay - 8); ctx.lineTo(ax + 7, ay); ctx.lineTo(ax, ay + 8);
            ctx.strokeStyle = 'rgba(255,200,90,.6)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.stroke();
        });
    }

    footer(ctx, W, H, footerText || 'اضغط على الخيار اللي تبية من القائمة تحت');
    return cv.toBuffer('image/png');
}

module.exports = {
    available, FONT_PATH, FAMILY, FONT_STACK, C, san, nm, nf, guard, sysFonts,
    welcomeCard, leaveCard, gameCard, winCard, dailyCard, levelUpCard, noticeCard, giveawayCard,
    panelCard, flagImage, flagCode, loadImg
};
