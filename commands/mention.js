const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');

function buildStatusEmbed(config) {
  return new EmbedBuilder()
    .setTitle('Etiketlenme Cevabi (Mention)')
    .setColor(0x5865f2)
    .setDescription('Bot etiketlendiginde (@Bot) veya botun bir mesajina yanit verildiginde bu cevabi gonderir.')
    .addFields(
      { name: 'Durum', value: config.mentionEnabled ? '✅ Acik' : '❌ Kapali', inline: true },
      { name: 'Cevap Metni', value: '```\n' + (config.mentionMessage || '-') + '\n```' },
    )
    .setFooter({ text: 'Degiskenler: {user} {server} | Asagidaki menuden ayarla' });
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('mention_menu')
    .setPlaceholder('Bir islem sec...')
    .addOptions(
      { label: 'Cevap Metnini Degistir', value: 'set_message', emoji: '✏️' },
      { label: 'Ac/Kapat', value: 'toggle', emoji: '🔁' },
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mention')
    .setDescription('Bot etiketlendiginde veya yanitlandiginda verecegi cevabi yonetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed(config)], components: [buildSelectRow()] });
  },

  buildStatusEmbed,
  buildSelectRow,
};