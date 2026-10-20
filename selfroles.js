// نظام الرتب الذاتية: رسالة فيها أزرار، كل زر يعطي/يسحب رتبة معينة عند الضغط (تبديل).
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const EPH = MessageFlags.Ephemeral;

function buildCommand() {
    const b = new SlashCommandBuilder().setName('رتب_لوحة').setDescription('إنشاء لوحة رتب ذاتية (للإدارة فقط)')
        .addStringOption(o => o.setName('العنوان').setDescription('عنوان اللوحة').setRequired(true).setMaxLength(100))
        .setDMPermission(false);
    for (let n = 1; n <= 5; n++) {
        b.addRoleOption(o => o.setName(`رتبة${n}`).setDescription(`الرتبة ${n}`).setRequired(n === 1));
        b.addStringOption(o => o.setName(`زر${n}`).setDescription(`نص الزر ${n} (افتراضي اسم الرتبة)`).setMaxLength(40));
    }
    return b;
}

const commands = [buildCommand()].map(c => c.toJSON());

async function handle(i, ctx) {
    if (i.commandName !== 'رتب_لوحة') return false;
    const tier = ctx.getTier(i.user.id, i.member);
    const top = (ctx.access && ctx.access.isTop) ? ctx.access.isTop(i.guild, i.member, tier, ctx.CONFIG) : (tier === 'arthur' || tier === 'ida');
    if (!top) {
        await i.reply({ content: ctx.access ? ctx.access.denyTextOwner(i.guild, ctx.CONFIG) : '⛔ هذا الأمر للإدارة فقط! 👑', flags: EPH });
        return true;
    }
    try {
        const row = new ActionRowBuilder();
        let count = 0;
        for (let n = 1; n <= 5; n++) {
            const role = i.options.getRole(`رتبة${n}`);
            if (!role) continue;
            if (role.managed || role.position >= i.guild.members.me.roles.highest.position) {
                return i.reply({ content: `⚠️ ما أقدر أتحكم برتبة **${role.name}** (رتبتي لازم تكون أعلى منها).`, flags: EPH });
            }
            const label = (i.options.getString(`زر${n}`) || role.name).slice(0, 40);
            row.addComponents(new ButtonBuilder().setCustomId(`role_pick_${role.id}`).setLabel(label).setStyle(ButtonStyle.Secondary));
            count++;
        }
        if (!count) return i.reply({ content: '⚠️ لازم تحدد رتبة وحدة على الأقل.', flags: EPH });
        const e = new EmbedBuilder().setColor(0xb3121e).setTitle(i.options.getString('العنوان'))
            .setDescription('اضغط على الزر عشان تاخذ أو تشيل الرتبة!');
        await i.reply({ embeds: [e], components: [row] });
    } catch (err) {
        console.error('❌ خطأ لوحة رتب:', err.message);
        if (!i.replied && !i.deferred) i.reply({ content: '⚠️ صار خطأ.', flags: EPH }).catch(() => {});
    }
    return true;
}

async function handleButton(i) {
    if (!i.customId.startsWith('role_pick_')) return false;
    const roleId = i.customId.replace('role_pick_', '');
    try {
        const has = i.member.roles.cache.has(roleId);
        if (has) { await i.member.roles.remove(roleId, 'رتب ذاتية'); await i.reply({ content: `➖ شلنا عنك <@&${roleId}>`, flags: EPH }); }
        else { await i.member.roles.add(roleId, 'رتب ذاتية'); await i.reply({ content: `➕ عطيناك <@&${roleId}>`, flags: EPH }); }
    } catch (err) {
        console.error('❌ خطأ زر رتبة:', err.message);
        await i.reply({ content: '⚠️ ما قدرت، تأكد إن رتبتي أعلى من هذي الرتبة وعندي صلاحية Manage Roles.', flags: EPH }).catch(() => {});
    }
    return true;
}

module.exports = { commands, handle, handleButton };
