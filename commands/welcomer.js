const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');
const { buildStatusEmbed, buildSelectRow } = require('../utils/welcomeLeaveUI');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcomer')
    .setDescription('Karsilama mesajini ve kanalini yonetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed('welcome', config)], components: [buildSelectRow('welcome')] });
  },
};