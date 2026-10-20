// روم الفخ: أي حد يكتب فيه (غير المستثنيين بالآيدي) ينحظر تلقائي فوراً. ضد بوتات السبام/الهاك اللي تكتب بكل روم تشوفه.
const store = require('./store');
const access = require('./access');

const DEF = { enabled: false, channelId: '', exemptIds: [] };

const all = () => store.read('trapcfg.json', {});
const get = (gid) => ({ ...DEF, ...(all()[gid] || {}) });

function set(gid, b) {
    const id = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : '');
    const ids = String(b.exemptIdsText || '')
        .split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d{5,25}$/.test(s));
    const a = all();
    a[gid] = { enabled: !!b.enabled, channelId: id(b.channelId), exemptIds: [...new Set(ids)] };
    store.write('trapcfg.json', a);
    return a[gid];
}

function init(client, CONFIG) {
    client.on('messageCreate', async (message) => {
        try {
            if (!message.guild || message.author.id === client.user.id) return;
            const cfg = get(message.guild.id);
            if (!cfg.enabled || !cfg.channelId || message.channel.id !== cfg.channelId) return;

            const uid = message.author.id;
            if (cfg.exemptIds.includes(uid)) return;
            const member = message.member;
            // 🌐 مستثنى: صاحب السيرفر · المسؤولين · الرتبة الملكية (بسيرفرنا) — عشان ما ينحظر بالغلط
            if (message.guild.ownerId === uid) return;
            if (member && access.isRoyal(message.guild, member, CONFIG)) return;

            await message.delete().catch(() => {});
            // حظر نهائي (بدون مدة) لأي شخص يكتب أي حرف برّوم الفخ
            await message.guild.members.ban(uid, { reason: '🪤 كتب برّوم الفخ (حظر نهائي تلقائي - نظام مكافحة السبام/الراقات)' });

            // نسجّل المحظور عشان يبين بصفحة "المحظورين" بلوحة التحكم
            try {
                const rec = store.read('trapbans.json', {});
                rec[uid] = { at: Date.now(), tag: message.author.tag, name: message.author.username };
                store.write('trapbans.json', rec);
            } catch {}

            if (CONFIG.LOG_CHANNEL_ID) {
                try {
                    const log = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
                    await log.send(`🪤 حظر نهائي تلقائي: <@${uid}> (\`${uid}\`) كتب برّوم الفخ وانحظر فوراً.`);
                } catch {}
            }
        } catch (err) { console.error('❌ روم الفخ:', err.message); }
    });
}

module.exports = { get, set, init };
