const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');

function buildStatusEmbed(config) {
  const active = Boolean(config.askPermChannelId && config.askPermRoleId);

  return new EmbedBuilder()
    .setTitle('🔐 İzin Sistemi (Askperm)')
    .setColor(active ? 0x5865f2 : 0xe67e22)
    .setDescription(
      'Sunucuya bir bot eklendiğinde veya bir üyeye rol verildiğinde, seçtiğin kanala onay isteği gönderilir. ' +
        'Kararı yalnızca kurucu rolündekiler verebilir.',
    )
    .addFields(
      {
        name: 'Durum',
        value: active ? '✅ Aktif' : '⚠️ Pasif (izin kanalı ve kurucu rolü ayarlanmalı)',
      },
      { name: 'İzin Kanalı', value: config.askPermChannelId ? `<#${config.askPermChannelId}>` : 'Ayarlanmadı', inline: true },
      { name: 'Kurucu Rolü', value: config.askPermRoleId ? `<@&${config.askPermRoleId}>` : 'Ayarlanmadı', inline: true },
      { name: 'Bot İzni', value: config.askPermBotEnabled ? '✅ Açık' : '❌ Kapalı', inline: true },
      { name: 'Rol İzni', value: config.askPermRoleEnabled ? '✅ Açık' : '❌ Kapalı', inline: true },
    )
    .setFooter({ text: 'Normal üyelerin katılımı için izin istenmez, yalnızca botlar için.' });
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('askperm_menu')
    .setPlaceholder('Bir işlem seç...')
    .addOptions(
      { label: 'İzin Kanalını Ayarla', value: 'set_channel', emoji: '📢' },
      { label: 'Kurucu Rolünü Ayarla', value: 'set_role', emoji: '👑' },
      { label: 'Bot İznini Aç/Kapat', value: 'toggle_bot', emoji: '🤖' },
      { label: 'Rol İznini Aç/Kapat', value: 'toggle_role', emoji: '🏷️' },
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('askperm')
    .setDescription('Bot ekleme ve rol verme için onay sistemini yönetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed(config)], components: [buildSelectRow()] });
  },

  buildStatusEmbed,
  buildSelectRow,
};
