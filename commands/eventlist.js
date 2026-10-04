const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildListView } = require('../utils/eventListUI');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventlist')
    .setDescription('Bekleyen ve aktif eventleri listeler; duzenleme ve silme menusunu acar')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const view = await buildListView(interaction.guild.id);
    await interaction.reply({ ...view, ephemeral: true });
  },
};