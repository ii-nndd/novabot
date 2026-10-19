// نظام اقتصاد نوفا: عملة يومية + رصيد + تحويل + متجر رتب (MongoDB عبر store.js)
const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const store = require('./store');
const art = require('./art');

const EPH = MessageFlags.Ephemeral;
const COIN = '🪙';

// ===== الراتب اليومي: صار قابلاً للتعديل من لوحة التحكم (economy.cfg.json) =====
const DAILY_DEF = { min: 100, max: 250, cdHours: 20 }; // الافتراضي لو ما تعدل من اللوحة
const daily = () => Object.assign({}, DAILY_DEF, store.read('economy.cfg.json', {}) || {});
function setDaily(b = {}) {
    const cur = daily();
    const int = (v, lo, hi, d) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
    };
    const cfg = {
        min: int(b.min, 1, 1000000, cur.min),
        max: int(b.max, 1, 1000000, cur.max),
        cdHours: int(b.cdHours, 1, 168, cur.cdHours)
    };
    if (cfg.max < cfg.min) cfg.max = cfg.min;
    store.write('economy.cfg.json', cfg);
    return cfg;
}

const allBal = () => store.read('economy.json', {});
function get(gid, uid) {
    const a = allBal();
    return (a[gid] && a[gid][uid]) || { balance: 0, lastDaily: 0 };
}
function save(gid, uid, patch) {
    const a = allBal();
    a[gid] = a[gid] || {};
    a[gid][uid] = { ...get(gid, uid), ...patch };
    store.write('economy.json', a);
    return a[gid][uid];
}
function addBalance(gid, uid, amount) {
    const cur = get(gid, uid);
    return save(gid, uid, { balance: Math.max(0, cur.balance + amount) });
}

const shopAll = () => store.read('shop.json', {});
const shopFor = (gid) => shopAll()[gid] || [];
function shopSave(gid, items) { const a = shopAll(); a[gid] = items; store.write('shop.json', a); }

// ===== إدارة المتجر (تستخدمها لوحة التحكم) =====
const price = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 1 && n <= 100000000 ? n : null; };
function shopAdd(gid, roleId, p) {
    const id = String(roleId || '').trim(), pr = price(p);
    if (!/^\d{5,25}$/.test(id)) throw new Error('آيدي الرتبة غير صالح');
    if (pr === null) throw new Error('السعر لازم يكون رقم من 1 وأعلى');
    const items = shopFor(gid).slice();
    if (items.some(it => it.roleId === id)) throw new Error('هذي الرتبة موجودة بالمتجر خلاص');
    items.push({ roleId: id, price: pr });
    shopSave(gid, items);
    return items;
}
function shopUpdate(gid, index, p) {
    const items = shopFor(gid).slice(), i = Number(index), pr = price(p);
    if (!items[i]) throw new Error('العنصر مو موجود');
    if (pr === null) throw new Error('السعر لازم يكون رقم من 1 وأعلى');
    items[i] = { roleId: items[i].roleId, price: pr };
    shopSave(gid, items);
    return items;
}
function shopRemove(gid, index) {
    const items = shopFor(gid).slice(), i = Number(index);
    if (!items[i]) throw new Error('العنصر مو موجود');
    items.splice(i, 1);
    shopSave(gid, items);
    return items;
}
function shopMove(gid, index, dir) {
    const items = shopFor(gid).slice(), i = Number(index);
    const j = i + (Number(dir) < 0 ? -1 : 1);
    if (!items[i] || !items[j]) return items;
    const t = items[i]; items[i] = items[j]; items[j] = t;
    shopSave(gid, items);
    return items;
}

// ===== أرصدة الأعضاء (تستخدمها لوحة التحكم) =====
const balances = (gid) => Object.assign({}, allBal()[gid] || {});
function setBalance(gid, uid, value) {
    const n = Math.floor(Number(value));
    if (!/^\d{5,25}$/.test(String(uid || '')) || !Number.isFinite(n) || n < 0 || n > 1000000000) throw new Error('رقم الرصيد غير صالح');
    return save(gid, String(uid), { balance: n });
}

const owner = (tier) => tier === 'arthur' || tier === 'ida';

const commands = [
    new SlashCommandBuilder().setName('يومي').setDescription(`استلم ${COIN} عملتك اليومية`).setDMPermission(false),
    new SlashCommandBuilder().setName('رصيد').setDescription('اعرض رصيدك أو رصيد عضو')
        .addUserOption(o => o.setName('عضو').setDescription('عضو آخر')).setDMPermission(false),
    new SlashCommandBuilder().setName('تحويل').setDescription('حوّل عملة لعضو آخر')
        .addUserOption(o => o.setName('عضو').setDescription('المستلم').setRequired(true))
        .addIntegerOption(o => o.setName('المبلغ').setDescription('المبلغ').setRequired(true).setMinValue(1))
        .setDMPermission(false),
    new SlashCommandBuilder().setName('المتجر').setDescription('اعرض متجر الرتب').setDMPermission(false),
    new SlashCommandBuilder().setName('شراء').setDescription('اشترِ رتبة من المتجر')
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم العنصر في /المتجر').setRequired(true).setMinValue(1))
        .setDMPermission(false),
    new SlashCommandBuilder().setName('متجر_اضافة').setDescription('إضافة رتبة للمتجر (ارثر وإيدا فقط)')
        .addRoleOption(o => o.setName('الرتبة').setDescription('الرتبة').setRequired(true))
        .addIntegerOption(o => o.setName('السعر').setDescription(`السعر بالـ${COIN}`).setRequired(true).setMinValue(1))
        .setDMPermission(false),
    new SlashCommandBuilder().setName('متجر_حذف').setDescription('حذف عنصر من المتجر (ارثر وإيدا فقط)')
        .addIntegerOption(o => o.setName('رقم').setDescription('رقم العنصر').setRequired(true).setMinValue(1))
        .setDMPermission(false)
].map(c => c.toJSON());

const NAMES = ['يومي', 'رصيد', 'تحويل', 'المتجر', 'شراء', 'متجر_اضافة', 'متجر_حذف'];

// استلام الراتب اليومي — يستخدمه أمر /يومي وخيار «الراتب اليومي» بلوحة التحكم (hub.js).
// eph=true يعني الرد مخفي للعضو نفسه (لوحة التحكم ما تبغى تزعج الروم).
async function claimDaily(i, eph = false) {
    const g = i.guild.id;
    const D = daily();
    const cur = get(g, i.user.id);
    const left = D.cdHours * 3600_000 - (Date.now() - cur.lastDaily);
    if (left > 0) {
        const h = Math.max(1, Math.ceil(left / 3600_000));
        return i.reply({ content: `⏳ خذيت راتبك اليوم! رجع بعد حوالي **${h}** ساعة.`, flags: EPH });
    }
    const amount = D.min + Math.floor(Math.random() * (D.max - D.min + 1));
    const doc = save(g, i.user.id, { balance: cur.balance + amount, lastDaily: Date.now() });
    const txt = `${COIN} استلمت راتبك اليومي: **+${amount}**\nرصيدك الآن: **${doc.balance}** ${COIN}`;
    // بطاقة الراتب المصممة (نفس هوية نوفا) — نأجّل الرد لأن الرسم + الصورة ياخذون وقت
    if (art.available()) {
        await i.deferReply(eph ? { flags: EPH } : undefined).catch(() => {});
        const png = await art.guard(art.dailyCard({
            avatarURL: i.user.displayAvatarURL({ extension: 'png', size: 256 }),
            name: i.member ? i.member.displayName : i.user.username,
            amount, balance: doc.balance, cdHours: D.cdHours
        }), 6000, 'بطاقة الراتب اليومي');
        if (png) return i.editReply({ files: [new AttachmentBuilder(png, { name: 'daily.png' })] }).catch(() => {});
        return i.editReply(txt).catch(() => {});
    }
    if (eph) {
        await i.deferReply({ flags: EPH }).catch(() => {});
        return i.editReply(txt).catch(() => {});
    }
    return i.reply(txt);
}

async function handle(i, ctx) {
    if (!NAMES.includes(i.commandName)) return false;
    const g = i.guild.id;
    try {
        switch (i.commandName) {
            case 'يومي':
                return claimDaily(i);
            case 'رصيد': {
                const u = i.options.getUser('عضو') || i.user;
                const doc = get(g, u.id);
                return i.reply(`${COIN} رصيد ${u}: **${doc.balance}**`);
            }
            case 'تحويل': {
                const u = i.options.getUser('عضو');
                const amt = i.options.getInteger('المبلغ');
                if (u.id === i.user.id) return i.reply({ content: '⚠️ ما تقدر تحول لنفسك!', flags: EPH });
                if (u.bot) return i.reply({ content: '⚠️ ما تقدر تحول لبوت!', flags: EPH });
                const me = get(g, i.user.id);
                if (me.balance < amt) return i.reply({ content: `⚠️ رصيدك ما يكفي (${me.balance} ${COIN}).`, flags: EPH });
                save(g, i.user.id, { balance: me.balance - amt });
                addBalance(g, u.id, amt);
                return i.reply(`✅ حولت **${amt}** ${COIN} لـ ${u}`);
            }
            case 'المتجر': {
                const items = shopFor(g);
                if (!items.length) return i.reply({ content: '🛒 المتجر فاضي حالياً.', flags: EPH });
                const lines = items.map((it, k) => `**${k + 1}.** <@&${it.roleId}> — ${it.price} ${COIN}`);
                return i.reply({ embeds: [new EmbedBuilder().setColor(0xb3121e).setTitle('🛒 متجر نوفا').setDescription(lines.join('\n'))] });
            }
            case 'شراء': {
                const idx = i.options.getInteger('رقم') - 1;
                const items = shopFor(g);
                const item = items[idx];
                if (!item) return i.reply({ content: '⚠️ ما فيه عنصر بهذا الرقم.', flags: EPH });
                if (i.member.roles.cache.has(item.roleId)) return i.reply({ content: '⚠️ الرتبة عندك خلاص!', flags: EPH });
                const me = get(g, i.user.id);
                if (me.balance < item.price) return i.reply({ content: `⚠️ رصيدك ما يكفي (تحتاج ${item.price} ${COIN}).`, flags: EPH });
                await i.member.roles.add(item.roleId, 'شراء من متجر نوفا');
                save(g, i.user.id, { balance: me.balance - item.price });
                return i.reply(`✅ مبروك! اشتريت <@&${item.roleId}>`);
            }
            case 'متجر_اضافة': {
                if (!owner(ctx.getTier(i.user.id, i.member))) return i.reply({ content: '⛔ خاص بمولاي ارثر والملكة إيدا فقط!', flags: EPH });
                const role = i.options.getRole('الرتبة'), price = i.options.getInteger('السعر');
                const items = shopFor(g);
                items.push({ roleId: role.id, price });
                shopSave(g, items);
                return i.reply(`✅ ضفت **${role.name}** للمتجر بسعر ${price} ${COIN}`);
            }
            case 'متجر_حذف': {
                if (!owner(ctx.getTier(i.user.id, i.member))) return i.reply({ content: '⛔ خاص بمولاي ارثر والملكة إيدا فقط!', flags: EPH });
                const idx = i.options.getInteger('رقم') - 1;
                const items = shopFor(g);
                if (!items[idx]) return i.reply({ content: '⚠️ ما فيه عنصر بهذا الرقم.', flags: EPH });
                items.splice(idx, 1);
                shopSave(g, items);
                return i.reply('✅ تم الحذف من المتجر');
            }
        }
    } catch (err) {
        console.error('❌ خطأ اقتصاد:', err.message);
        if (!i.replied && !i.deferred) i.reply({ content: '⚠️ صار خطأ، حاول مرة ثانية.', flags: EPH }).catch(() => {});
    }
    return true;
}

module.exports = {
    commands, handle, claimDaily, get, addBalance,
    daily, setDaily, balances, setBalance,
    shopFor, shopAdd, shopUpdate, shopRemove, shopMove
};
