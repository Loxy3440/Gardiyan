const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');

function buildStatusEmbed(config) {
  return new EmbedBuilder()
    .setTitle('Otomatik Rol (Otorol)')
    .setColor(0x5865f2)
    .setDescription('Sunucuya yeni katilan uyelere, oyuncu ya da bot olmalarina gore farkli rol otomatik verilir.')
    .addFields(
      { name: 'Durum', value: config.autoRoleEnabled ? '✅ Acik' : '❌ Kapali', inline: true },
      { name: 'Oyuncu Rolu', value: config.autoRoleId ? `<@&${config.autoRoleId}>` : 'Ayarlanmadi', inline: true },
      { name: 'Bot Rolu', value: config.autoRoleBotId ? `<@&${config.autoRoleBotId}>` : 'Ayarlanmadi', inline: true },
    )
    .setFooter({ text: 'Asagidaki menuden ayarla' });
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('autorole_menu')
    .setPlaceholder('Bir islem sec...')
    .addOptions(
      { label: 'Oyuncu Rolu Ayarla', value: 'set_role_player', emoji: '🙋' },
      { label: 'Bot Rolu Ayarla', value: 'set_role_bot', emoji: '🤖' },
      { label: 'Ac/Kapat', value: 'toggle', emoji: '🔁' },
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Yeni katilan oyuncu ve botlara otomatik verilecek rolleri yonetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed(config)], components: [buildSelectRow()] });
  },

  buildStatusEmbed,
  buildSelectRow,
};