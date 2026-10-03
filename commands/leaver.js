const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');
const { buildStatusEmbed, buildSelectRow } = require('../utils/welcomeLeaveUI');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaver')
    .setDescription('Ayrilma mesajini ve kanalini yonetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed('leave', config)], components: [buildSelectRow('leave')] });
  },
};