const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { clearActiveTimer } = require('../utils/activeTimers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription("Bir uyenin susturmasini kaldirir")
    .addUserOption(opt => opt.setName('uye').setDescription('Susturmasi kaldirilacak uye').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Sebep').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('uye');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu uye sunucuda bulunamadi.')], ephemeral: true });
    }

    if (!member.communicationDisabledUntil || member.communicationDisabledUntil < new Date()) {
      return interaction.reply({ embeds: [warningEmbed('Susturulmamis', `**${member.user.tag}** su anda susturulmus degil.`)], ephemeral: true });
    }

    await interaction.deferReply();

    try {
      await member.timeout(null, reason);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Susturma kaldirma islemi basarisiz oldu.')] });
    }

    clearActiveTimer(`mute_${interaction.guild.id}_${member.id}`);

    const embed = successEmbed('Susturma Kaldirildi', `**${member.user.tag}** artik tekrar konusabilir.`)
      .addFields({ name: 'Sebep', value: reason })
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};