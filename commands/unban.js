const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Yasakli bir kullaniciyi affeder')
    .addStringOption(opt => opt.setName('kullanici_id').setDescription('Yasakli kullanicinin ID numarasi').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Affetme sebebi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString('kullanici_id');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    if (!/^\d{15,25}$/.test(userId)) {
      return interaction.reply({ embeds: [warningEmbed('Gecersiz ID', 'Kullanici ID numarasi sadece rakamlardan olusmali.')], ephemeral: true });
    }

    await interaction.deferReply();

    let banEntry;
    try {
      banEntry = await interaction.guild.bans.fetch(userId);
    } catch {
      return interaction.editReply({ embeds: [warningEmbed('Bulunamadi', 'Bu kullanici yasakli degil veya bulunamadi.')] });
    }

    try {
      await interaction.guild.bans.remove(userId, reason);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Yasak kaldirma islemi basarisiz oldu.')] });
    }

    const embed = successEmbed('Yasak Kaldirildi', `**${banEntry.user.tag}** artik sunucuya tekrar katilabilir.`)
      .addFields({ name: 'Sebep', value: reason })
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
