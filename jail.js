// نظام "روم السجن": رتبة وحدة تخفي كل الرومات عن صاحبها إلا روم سجن مخصص (شات + فويس).
// مهم: مجرد ما ترتب "رتبة السجن" فوق رتبة العضو العادي ما يكفي! لو عند العضو رتبة ثانية فيها سماح صريح
// لرؤية روم معين (Allow overwrite)، ديسكورد يرجّح السماح على المنع بين الرتب المختلفة بغض النظر عن ترتيبها.
// عشان كذا وقت السجن نسحب كل رتب العضو الثانية مؤقتاً (ونحفظها) ونخليه بس برتبة السجن، وقت الإفراج نرجعها له.
const store = require('./store');
const access = require('./access');

const DEF = { enabled: false, roleId: '', textChannelId: '', voiceChannelId: '' };

const all = () => store.read('jailcfg.json', {});
const get = (gid) => ({ ...DEF, ...(all()[gid] || {}) });

function set(gid, b) {
    const id = (v) => (/^\d{5,25}$/.test(String(v || '')) ? String(v) : '');
    const a = all();
    a[gid] = {
        enabled: !!b.enabled,
        roleId: id(b.roleId),
        textChannelId: id(b.textChannelId),
        voiceChannelId: id(b.voiceChannelId)
    };
    store.write('jailcfg.json', a);
}

// يطبق منع/سماح رؤية روم وحد لرتبة السجن
async function syncChannel(channel, cfg) {
    if (!cfg.roleId || !channel.permissionOverwrites) return;
    const isJailChannel = channel.id === cfg.textChannelId || channel.id === cfg.voiceChannelId;
    await channel.permissionOverwrites.edit(cfg.roleId, { ViewChannel: isJailChannel ? true : false }, { reason: 'مزامنة نظام السجن' });
}

// يطبق على كل رومات السيرفر دفعة وحدة (زر "مزامنة الآن" باللوحة)
async function syncAll(guild, cfg) {
    await guild.channels.fetch();
    const channels = [...guild.channels.cache.values()];
    let ok = 0, fail = 0;
    for (const ch of channels) {
        try { await syncChannel(ch, cfg); ok++; }
        catch (err) { fail++; console.error('❌ مزامنة سجن:', ch.name, err.message); }
    }
    return { total: channels.length, ok, fail };
}

// يراقب أي روم جديد وينطبق عليه نفس منع الرؤية تلقائياً (بدون ما تحتاج تسوي شي يدوي كل مرة)
function init(client) {
    client.on('channelCreate', async (channel) => {
        try {
            if (!channel.guild) return;
            if (!access.isApproved(channel.guild.id)) return;   // 🔒 سيرفر مقفول
            const cfg = get(channel.guild.id);
            if (!cfg.enabled || !cfg.roleId) return;
            await syncChannel(channel, cfg);
        } catch (err) { console.error('❌ مزامنة روم جديد (سجن):', err.message); }
    });
}

const savedRolesAll = () => store.read('jailedroles.json', {});
const saveRoles = (gid, uid, roleIds) => {
    const a = savedRolesAll();
    a[gid] = a[gid] || {};
    a[gid][uid] = roleIds;
    store.write('jailedroles.json', a);
};
const takeSavedRoles = (gid, uid) => {
    const a = savedRolesAll();
    const roles = (a[gid] && a[gid][uid]) || null;
    if (a[gid]) { delete a[gid][uid]; store.write('jailedroles.json', a); }
    return roles;
};

async function jailMember(member, cfg, reason) {
    if (!cfg.roleId) throw new Error('رتبة السجن مو محددة بعد، اضبطها من /dashboard أول.');
    if (member.roles.cache.has(cfg.roleId)) throw new Error('العضو مسجون أصلاً.');
    // نحفظ رتبه الحالية (غير @everyone والرتب المدارة تلقائياً زي رتبة البوست) عشان نرجعها له وقت الإفراج
    const others = member.roles.cache.filter(r => r.id !== member.guild.id && !r.managed).map(r => r.id);
    saveRoles(member.guild.id, member.id, others);
    if (others.length) await member.roles.remove(others, reason || 'سجن');
    await member.roles.add(cfg.roleId, reason || 'سجن');
}
async function unjailMember(member, cfg, reason) {
    if (!cfg.roleId) throw new Error('رتبة السجن مو محددة بعد.');
    const saved = takeSavedRoles(member.guild.id, member.id);
    await member.roles.remove(cfg.roleId, reason || 'فك سجن');
    if (saved && saved.length) {
        const valid = saved.filter(id => member.guild.roles.cache.has(id));
        if (valid.length) await member.roles.add(valid, reason || 'فك سجن').catch(() => {});
    }
}

module.exports = { get, set, syncChannel, syncAll, init, jailMember, unjailMember };
