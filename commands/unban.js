const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Yasaklı kullanıcının banını kaldırır')
    .addStringOption(opt => opt.setName('kullanici_id').setDescription('Yasaklı kullanıcının ID numarası').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('unban sebebi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('kullanici_id');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    if (!/^\d{15,25}$/.test(userId)) {
      return interaction.reply({ embeds: [warningEmbed('Geçersiz ID', 'Kullanıcı ID numarası sadece rakamlardan oluşmalı.')], ephemeral: true });
    }

    await interaction.deferReply();

    let banEntry;
    try {
      banEntry = await interaction.guild.bans.fetch(userId);
    } catch {
      return interaction.editReply({ embeds: [warningEmbed('Bulunamadı', 'Bu kullanıcı yasaklı değil veya bulunamadı.')] });
    }

    try {
      await interaction.guild.bans.remove(userId, reason);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Yasak kaldırma işlemi başarısız oldu.')] });
    }

    const embed = successEmbed('Yasak kaldırıldı', `**${banEntry.user.tag}** artik sunucuya tekrar katılabilir.`)
      .addFields({ name: 'Sebep', value: reason })
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
