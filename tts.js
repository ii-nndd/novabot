// ============================================================================
// 🎙️ tts.js — «صوت العبد»: يحوّل أي نص لصوت عربي فخم (Gemini TTS) ويرسله ملف
//              + يتكلمه بالروم الصوتي اللي البوت فيه.
// ----------------------------------------------------------------------------
// • الأصوات: ٦ أصوات (رهيب · فخم · وقور · هادي · دافي · رصين) — من Google Gemini.
// • الصيغة: الرد يرجع PCM 24kHz → نلفّه WAV (بلا أي مكتبة إضافية) ونرسله.
// • الفويس: نعيد ترديد 24k→48k ونحوّل mono→stereo ثم نلعب StreamType.Raw
//           (opusscript موجود بالمشروع — فما نحتاج ffmpeg أبداً).
// • لو فشل Gemini (حد يومي/شبكة) → رجوع تلقائي لصوت Google Translate (MP3).
// • الحدود: ٥٠٠ حرف بالطلب، ٩٠٠ حرف كحد أقصى (نقسّمه ونوصل المقاطع).
// • الإعدادات في ttscfg.json (عبر store) — global + لكل سيرفر.
// ============================================================================
const { Readable } = require('stream');
const { once } = require('events');
const store = require('./store');
const access = require('./access');
const ai = require('./ai');
const vc = require('@discordjs/voice');
const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const FILE = 'ttscfg.json';
const KEY = 'tts';

let CL = null;          // client
let CFG = null;         // CONFIG
let OPS = {};           // دوال من index.js (move/voice)

const BUILD = '2026-10-29.3';

// ===== الأصوات =====
// name = اسم الصوت عند Google · tone = وصف يمرّر له لتثبيت الأداء
const VOICES = {
    raheb: { name: 'Fenrir', label: 'رهيب 👹', desc: 'عميق قوي يرجّف القلب', tone: '' },
    fakhem: { name: 'Charon', label: 'فخم 👑', desc: 'عميق واثق هادئ (الافتراضي)', tone: '' },
    waqar: { name: 'Orus', label: 'وقور 🗿', desc: 'ثقيل رزين بوقار', tone: '' },
    hani: { name: 'Iapetus', label: 'هادي 🌙', desc: 'ناعم هادئ مريح', tone: '' },
    dafi: { name: 'Algenib', label: 'دافي 🔥', desc: 'دافئ قريب من القلب', tone: '' },
    rasin: { name: 'Kore', label: 'رصين 📜', desc: 'واضح رسمي مرتب', tone: '' }
};
const VOICE_KEYS = Object.keys(VOICES);

// موديلات الصوت — بالترتيب: الأسرع والأثبت أولاً، ولو خلص حد موديل ننزل للي بعده تلقائياً
// (كل موديل له حد يومي مستقل — فلو واحد 429 الباقي يشتغل)
const MODELS = [
    'gemini-3.8-flash-lite-tts',
    'gemini-3.1-flash-tts-preview',
    'gemini-3.8-flash-tts',
    'gemini-2.5-flash-preview-tts'
];

const MAX_TEXT = 900;        // أقصى طول نص بالأمر
const CHUNK = 400;           // أقصى طول مقطع نرسله للموديل
const TRY_MS = 28_000;       // مهلة محاولة واحدة
const BUDGET_MS = 70_000;    // ميزانية كل المحاولات
const MAX_PARALLEL = 2;      // كم طلب صوتي شغال بنفس الوقت (حماية للـAPI)

const DEF = {
    enabled: true,
    voice: 'fakhem',
    speakInVoice: true,
    mp3Fallback: true,
    maxChars: 400,
    cooldownSec: 8
};

// ===== الإعدادات =====
function rawAll() { return store.read(FILE, {}) || {}; }

function get(gid) {
    const all = rawAll();
    const g = (all.guilds && all.guilds[gid]) || {};
    const base = all.global || {};
    const out = { ...DEF, ...base, ...g };
    if (!VOICES[out.voice]) out.voice = DEF.voice;
    out.maxChars = Math.max(50, Math.min(MAX_TEXT, Number(out.maxChars) || MAX_TEXT));
    out.cooldownSec = Math.max(0, Math.min(120, Number(out.cooldownSec) || 0));
    out.enabled = out.enabled !== false;
    out.speakInVoice = out.speakInVoice !== false;
    out.mp3Fallback = out.mp3Fallback !== false;
    return out;
}

function set(gid, body = {}) {
    const all = rawAll();
    const scope = gid ? 'guilds' : 'global';
    const cur = all[scope] || {};
    const key = gid || '__x';
    const prev = cur[key] || {};
    const next = { ...prev };

    if ('enabled' in body) next.enabled = !!body.enabled;
    if ('speakInVoice' in body) next.speakInVoice = !!body.speakInVoice;
    if ('mp3Fallback' in body) next.mp3Fallback = !!body.mp3Fallback;
    if ('voice' in body) { const v = String(body.voice || '').trim(); if (VOICES[v]) next.voice = v; }
    if ('maxChars' in body) next.maxChars = Math.max(50, Math.min(MAX_TEXT, Number(body.maxChars) || MAX_TEXT));
    if ('cooldownSec' in body) next.cooldownSec = Math.max(0, Math.min(120, Number(body.cooldownSec) || 0));
    next.at = Date.now();

    if (!gid) all.global = { ...(all.global || {}), ...next };
    else all.guilds = { ...(all.guilds || {}), [gid]: next };
    store.write(FILE, all);
    return get(gid);
}

function reset(gid) {
    const all = rawAll();
    if (gid) { if (all.guilds) delete all.guilds[gid]; }
    else all.global = {};
    store.write(FILE, all);
    return get(gid);
}

// ===== المفتاح (نفس مفتاح الذكاء الاصطناعي) =====
function keyOf(gid) {
    try {
        const c = ai.get(gid);
        if (c && c.key) return String(c.key);
    } catch { }
    return String(process.env.AI_KEY || '').trim();
}

function ready(gid) { return !!(keyOf(gid) || process.env.AI_KEY); }

// ===== أدوات نصية =====
function clean(t) {
    return String(t == null ? '' : t)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// نقسّم النص لمقاطع ≤ CHUNK على نهايات الجمل، وإلا على أقرب مسافة
function splitText(t, size = CHUNK) {
    const s = clean(t);
    const out = [];
    let rest = s;
    while (rest.length > size) {
        let cut = -1;
        for (const p of ['. ', '؟ ', '! ', '، ', '\n', ' ']) {
            const i = rest.lastIndexOf(p, size);
            if (i > cut) cut = i;
        }
        if (cut < size * 0.4) cut = rest.lastIndexOf(' ', size);
        if (cut <= 0) cut = size;
        const piece = rest.slice(0, cut).trim();
        if (piece) out.push(piece);
        rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out.slice(0, 8);
}

// ===== WAV (من PCM خام) =====
function wav(pcm, rate = 24000) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write('WAVE', 8);
    h.write('fmt ', 12);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);          // PCM
    h.writeUInt16LE(1, 22);          // mono
    h.writeUInt32LE(rate, 24);
    h.writeUInt32LE(rate * 2, 28);   // byte rate
    h.writeUInt16LE(2, 32);          // block align
    h.writeUInt16LE(16, 34);         // bits
    h.write('data', 36);
    h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}

// PCM 24kHz mono → 48kHz stereo (اللي يفهمه ديسكورد)
function toDiscordPcm(pcm) {
    const n = Math.floor(pcm.length / 2);
    if (!n) return Buffer.alloc(0);
    const outSamples = n * 2;
    const out = Buffer.alloc(outSamples * 4);
    for (let i = 0; i < outSamples; i++) {
        const pos = i / 2;
        const i0 = Math.floor(pos);
        const i1 = i0 + 1 < n ? i0 + 1 : n - 1;
        const frac = pos - i0;
        const a = pcm.readInt16LE(i0 * 2);
        const b = pcm.readInt16LE(i1 * 2);
        const v = Math.max(-32768, Math.min(32767, Math.round(a * (1 - frac) + b * frac)));
        const off = i * 4;
        out.writeInt16LE(v, off);
        out.writeInt16LE(v, off + 2);
    }
    return out;
}

// ===== Gemini TTS =====
async function fetchJson(url, body, ms) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => { try { ctl.abort(); } catch { } }, Math.max(4000, ms)) : null;
    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctl ? ctl.signal : undefined
        });
        const raw = await r.text();
        let d = null;
        try { d = raw ? JSON.parse(raw) : null; } catch { }
        return { ok: r.ok, status: r.status, data: d, raw };
    } finally { if (timer) clearTimeout(timer); }
}

async function geminiPcm(text, voiceKey, key, budgetLeft) {
    const v = VOICES[voiceKey] || VOICES[DEF.voice];
    let last = null;
    let quota = false;
    for (const model of MODELS) {
        const ms = Math.min(TRY_MS, budgetLeft);
        if (ms < 3000) break;
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model
            + ':generateContent?key=' + encodeURIComponent(key);
        const body = {
            contents: [{ parts: [{ text: (v.tone ? v.tone + '\n' : '') + text }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.name } } }
            }
        };
        try {
            const r = await fetchJson(url, body, ms);
            if (!r.ok) {
                const st = r.status;
                const msg = (r.data && r.data.error && r.data.error.message) || r.raw || '';
                last = new Error('الصوت رفض الطلب (' + st + ')' + (msg ? ': ' + String(msg).slice(0, 120) : ''));
                if (st === 429) { quota = true; continue; }
                if (st === 400 || st === 404 || st === 503) continue;
                throw last;
            }
            const c = r.data && r.data.candidates && r.data.candidates[0];
            const part = c && c.content && c.content.parts && c.content.parts[0];
            const b64 = part && part.inlineData && part.inlineData.data;
            if (!b64) {
                last = new Error('الصوت ما رجع شي' + (c && c.finishReason ? ' (' + c.finishReason + ')' : ''));
                continue;
            }
            const mime = String((part.inlineData && part.inlineData.mimeType) || '');
            const m = mime.match(/rate=(\d+)/);
            const rate = m ? Number(m[1]) : 24000;
            return { pcm: Buffer.from(b64, 'base64'), rate, model };
        } catch (e) {
            last = e;
            if (/abort/i.test(String(e && e.message))) continue;
            throw e;
        }
    }
    if (quota) throw new Error('حد الصوت اليومي خلص من Gemini (429) — انتظر شوي أو جدّد مفتاح AI_KEY من اللوحة.');
    throw last || new Error('ما قدرت أولد الصوت');
}

// ===== بديل: Google Translate TTS (MP3) =====
function gttsChunks(t) {
    const s = clean(t);
    const out = [];
    let rest = s;
    while (rest.length > 170) {
        let cut = rest.lastIndexOf(' ', 170);
        if (cut < 80) cut = 170;
        out.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out.slice(0, 6);
}

async function gttsMp3(text) {
    const parts = [];
    for (const piece of gttsChunks(text)) {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar'
            + '&ttsspeed=0.85&total=1&idx=0&textlen=' + encodeURIComponent(piece.length)
            + '&q=' + encodeURIComponent(piece);
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => { try { ctl.abort(); } catch { } }, 15000) : null;
        try {
            const r = await fetch(url, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    referer: 'https://translate.google.com/'
                },
                signal: ctl ? ctl.signal : undefined
            });
            if (!r.ok) throw new Error('بديل الصوت رفض الطلب (' + r.status + ')');
            parts.push(Buffer.from(await r.arrayBuffer()));
        } finally { if (timer) clearTimeout(timer); }
    }
    const buf = Buffer.concat(parts);
    if (!buf.length) throw new Error('بديل الصوت ما رجع شي');
    return buf;
}

// ===== الطابور (حماية للـAPI) =====
let running = 0;
const waiting = [];
function slot() {
    if (running < MAX_PARALLEL) { running++; return Promise.resolve(); }
    return new Promise(res => waiting.push(res)).then(() => { running++; });
}
function freeSlot() {
    running = Math.max(0, running - 1);
    const next = waiting.shift();
    if (next) next();
}

// ===== توليد الصوت =====
// يرجع { kind:'wav'|'mp3', buf, ms, voice, model }
async function synth(text, opts = {}) {
    const gid = opts.gid || '';
    const cfg = get(gid);
    const t = clean(text).slice(0, cfg.maxChars);
    if (!t) throw new Error('اكتب النص أول');
    const voice = VOICES[opts.voice] ? opts.voice : cfg.voice;
    const key = keyOf(gid);
    const t0 = Date.now();

    await slot();
    try {
        if (key) {
            try {
                const pieces = [];
                let rate = 24000;
                let model = MODELS[0];
                for (const piece of splitText(t)) {
                    const left = BUDGET_MS - (Date.now() - t0);
                    if (left < 4000) break;
                    const r = await geminiPcm(piece, voice, key, left);
                    pieces.push(r.pcm);
                    rate = r.rate || rate;
                    model = r.model || model;
                }
                const pcm = Buffer.concat(pieces);
                if (pcm.length) {
                    return { kind: 'wav', buf: wav(pcm, rate), ms: Date.now() - t0, voice, model };
                }
            } catch (e) {
                if (!cfg.mp3Fallback) throw e;
            }
        }
        if (!cfg.mp3Fallback) throw new Error('ما فيه مفتاح AI_KEY — أضفه من اللوحة ← «الذكاء الاصطناعي».');
        const mp3 = await gttsMp3(t);
        return { kind: 'mp3', buf: mp3, ms: Date.now() - t0, voice: 'google', model: 'gtts' };
    } finally { freeSlot(); }
}

// ===== التكلم بالروم الصوتي =====
async function speakGuild(gid, pcm) {
    const conn = vc.getVoiceConnection(gid);
    if (!conn) return { ok: false, why: 'البوت مو داخل روم صوتي' };
    if (conn.state.status !== vc.VoiceConnectionStatus.Ready) return { ok: false, why: 'الاتصال الصوتي مو جاهز' };
    const raw = toDiscordPcm(pcm);
    if (!raw.length) return { ok: false, why: 'الصوت فاضي' };
    const player = vc.createAudioPlayer({ behaviors: { noSubscriber: vc.NoSubscriberBehavior.Play } });
    try {
        conn.subscribe(player);
        const res = vc.createAudioResource(Readable.from(raw), { inputType: vc.StreamType.Raw });
        player.play(res);
        await vc.entersState(player, vc.AudioPlayerStatus.Idle, Math.max(15_000, Math.round((raw.length / 192000) * 1000) + 15_000));
        return { ok: true };
    } catch (e) {
        return { ok: false, why: String((e && e.message) || 'فشل التشغيل') };
    } finally {
        try { player.stop(true); } catch { }
    }
}

// ===== الأمر /قول =====
const commands = [
    new SlashCommandBuilder()
        .setName('قول')
        .setDescription('🎙️ العبد يحوّل كلامك لصوت فخم — ملف صوتي + يتكلمه بالروم الصوتي')
        .addStringOption(o => o.setName('نص').setDescription('النص اللي تبيه بصوت العبد').setRequired(true).setMaxLength(900))
        .addStringOption(o => o
            .setName('صوت')
            .setDescription('نوع الصوت (الافتراضي: فخم)')
            .addChoices(...VOICE_KEYS.map(k => ({ name: VOICES[k].label + ' — ' + VOICES[k].desc, value: k }))))
        .addChannelOption(o => o.setName('روم').setDescription('روم صوتي معيّن ينقله ويتكلم فيه (اختياري)'))
].map(c => c.toJSON());

async function reply(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
        return await interaction.reply(payload);
    } catch { }
}

// ينفّذ الأمر لو كان /قول — يرجع true لو تعاملنا معه
async function handle(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'قول') return false;
    const gid = (interaction.guild && interaction.guild.id) || '';
    const cfg = get(gid);
    const text = clean(interaction.options.getString('نص'));
    const voice = interaction.options.getString('صوت') || cfg.voice;
    const wantCh = interaction.options.getChannel('روم');

    try { await interaction.deferReply(); } catch { return true; }

    if (!cfg.enabled) return await reply(interaction, { content: '🎙️ الصوت مقفول حالياً — فعّله من اللوحة.' }), true;
    if (!text) return await reply(interaction, { content: '✍️ اكتب النص اللي تبيني أقوله.' }), true;

    try {
        // لو طلب روم معيّن → ننقل البوت له أول
        let moved = '';
        if (wantCh && gid && typeof OPS.move === 'function') {
            const ok = await OPS.move(interaction.guild, wantCh).catch(() => false);
            if (ok) moved = wantCh.name || '';
        }

        const out = await synth(text, { gid, voice });
        const name = 'abd-voice.' + (out.kind === 'mp3' ? 'mp3' : 'wav');
        const spoken = cfg.speakInVoice ? await speakGuild(gid, out.kind === 'wav'
            ? out.buf.subarray(44) : Buffer.alloc(0)) : { ok: false, why: '' };

        const note = spoken.ok
            ? '🔊 وقُلتُها بالروم الصوتي بعد.'
            : (wantCh && !moved ? '⚠️ ما قدرت أدخل الروم الصوتي — تأكد إن عندي صلاحية «الاتصال» و«التحدث».' : '');

        return await reply(interaction, {
            content: `🎙️ **صوت العبد** — ${VOICES[out.voice] ? VOICES[out.voice].label : '🎧'}\n`
                + '```' + text.slice(0, 300) + '```'
                + (note ? '\n' + note : ''),
            files: [{ attachment: out.buf, name }]
        }), true;
    } catch (e) {
        return await reply(interaction, { content: '⚠️ ' + String((e && e.message) || 'تعذر توليد الصوت') }), true;
    }
}

// كلام طبيعي: «يا عبد قول …» — يرجع true لو تعامل معها
async function handleText(message, text, opts = {}) {
    const gid = (message.guild && message.guild.id) || '';
    const cfg = get(gid);
    if (!cfg.enabled) return false;
    const t = clean(text);
    if (!t) return false;
    try {
        const out = await synth(t, { gid, voice: opts.voice || cfg.voice });
        const name = 'abd-voice.' + (out.kind === 'mp3' ? 'mp3' : 'wav');
        const spoken = cfg.speakInVoice ? await speakGuild(gid, out.kind === 'wav' ? out.buf.subarray(44) : Buffer.alloc(0)) : { ok: false };
        await message.reply({
            content: `🎙️ ${spoken.ok ? 'قلتها 🔊' : 'تفضل الصوت 🎧'}`,
            files: [{ attachment: out.buf, name }]
        }).catch(() => { });
        return true;
    } catch (e) {
        await message.reply('⚠️ ' + String((e && e.message) || 'تعذر توليد الصوت')).catch(() => { });
        return true;
    }
}

function init(client, config, ops = {}) {
    CL = client;
    CFG = config;
    OPS = ops || {};
    const k = keyOf(CFG && CFG.GUILD_ID);
    console.log('🎙️ صوت العبد جاهز · ' + VOICE_KEYS.length + ' أصوات' + (k ? ' · مفتاح Gemini موجود' : ' · ⚠️ بدون مفتاح (بيستخدم البديل)'));
}

module.exports = {
    BUILD, VOICES, VOICE_KEYS, MODELS, DEF, MAX_TEXT,
    init, get, set, reset, ready, keyOf,
    synth, splitText, clean, wav, toDiscordPcm, gttsMp3, speakGuild,
    commands, handle, handleText
};
