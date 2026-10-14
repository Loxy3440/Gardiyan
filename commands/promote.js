const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { registerCommandGrant, needsApproval } = require('../utils/askPerm');
const { getConfig } = require('../utils/guildConfig');
const { getLadder, currentRank, blockedReason } = require('../utils/rankLadder');

// Üyeyi "üye rolleri" basamaklarında bir üst role çıkarır (/setroles ile ayarlanır).
// Yetkili rollerine terfi vermez; yetkili olan üyelere uygulanmaz.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Üyeyi üye rolleri arasında bir üst role yükseltir (yetkili rollerine geçmez).')
    .addUserOption(opt => opt.setName('uye').setDescription('Yükseltilecek üye').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const member = interaction.options.getMember('uye');
    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu uye sunucuda bulunamadı.')], ephemeral: true });
    }

    const config = await getConfig(interaction.guild.id);
    const info = getLadder(interaction.guild, config);

    const blocked = blockedReason(member, info);
    if (blocked) return interaction.reply({ embeds: [warningEmbed('İşlem Yapılamaz', blocked)], ephemeral: true });

    if (!info.ladder.length) {
      return interaction.reply({ embeds: [warningEmbed('Rol Yok', 'Terfi için üye rolü bulunamadı. `/setroles` ile üye rollerini ayarla.')], ephemeral: true });
    }

    const { index, role: currentTop } = currentRank(member, info.ladder);
    const nextRole = info.ladder[index + 1];

    if (!nextRole) {
      const extra = info.staff.size ? ' Bir üst basamak yetkili rolleri olduğu için terfi verilmez.' : '';
      return interaction.reply({ embeds: [warningEmbed('Zaten En Üst Seviyede', `**${member.user.tag}** üye rollerinin en yükseğinde.${extra}`)], ephemeral: true });
    }

    if (nextRole.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ embeds: [errorEmbed('Bu rolu veremiyorum, botun rolu yeterince yuksek degil.')], ephemeral: true });
    }

    const pending = await needsApproval(interaction.guild);

    try {
      registerCommandGrant(interaction.guild.id, member.id, nextRole.id, interaction.user.id, { replaceRoleId: currentTop?.id });
      await member.roles.add(nextRole, `Promote - Yetkili: ${interaction.user.tag}`);
      if (currentTop && !pending) {
        await member.roles.remove(currentTop, `Promote - Yetkili: ${interaction.user.tag}`);
      }
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Rol Değiştirilirken bir Hata Oluştu.')], ephemeral: true });
    }

    if (pending) {
      return interaction.reply({
        embeds: [
          warningEmbed(
            'Onay Bekleniyor',
            `**${member.user.tag}** için **${nextRole.name}** terfi isteği izin kanalına gönderildi. ` +
              `Kurucu veya bir yönetici onaylarsa **${nextRole.name}** verilecek${currentTop ? ` ve **${currentTop.name}** alınacak` : ''}.`,
          ),
        ],
      });
    }

    const embed = successEmbed('Uye Yukseltildi', `**${member.user.tag}** artık **${nextRole.name}** rolune sahip.`)
      .addFields({ name: 'Önceki Rol', value: currentTop ? currentTop.name : 'Yoktu', inline: true })
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
