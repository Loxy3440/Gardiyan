const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Bir kanala yavas mod uygular')
    .addIntegerOption(opt => opt.setName('saniye').setDescription('Yavas mod suresi (saniye), 0 = kapali').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(opt => opt.setName('kanal').setDescription('Hedef kanal (bos birakilirsa bulundugun kanal)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('saniye');
    const channel = interaction.options.getChannel('kanal') || interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds, `Yetkili: ${interaction.user.tag}`);
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Yavas mod ayarlanirken bir hata olustu.')], ephemeral: true });
    }

    const embed = seconds === 0
      ? successEmbed('Yavas Mod Kapatildi', `${channel} icin yavas mod kapatildi.`)
      : successEmbed('Yavas Mod Ayarlandi', `${channel} icin yavas mod **${seconds} saniye** olarak ayarlandi.`);

    embed.setFooter({ text: `Yetkili: ${interaction.user.tag}` }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
