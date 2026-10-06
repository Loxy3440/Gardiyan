const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');

function buildStatusEmbed(config) {
  return new EmbedBuilder()
    .setTitle('Etiketlenme Cevabı')
    .setColor(0x5865f2)
    .setDescription('Bot etiketlendiğinde (@Bot) veya botun bir mesajına yanıt verildiğinde bu cevabi gönderir.')
    .addFields(
      { name: 'Durum', value: config.mentionEnabled ? 'Açık' : 'Kapalı', inline: true },
      { name: 'Cevap Metni', value: '```\n' + (config.mentionMessage || '-') + '\n```' },
    )
    .setFooter({ text: 'Degiskenler: {user} {server} | Aşağıdaki Menüyü Kullan' });
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('mention_menu')
    .setPlaceholder('Bir islem sec...')
    .addOptions(
      { label: 'Cevap Metnini Degistir', value: 'set_message', emoji: '<:984149edit:1557005371066024076>' },
      { label: 'Ac/Kapat', value: 'toggle', emoji: '<:750227restore:1556735107589742662>' },
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mention')
    .setDescription('Bot etiketlendiğinde veya mesajına yanıt verildiğinde gönderilecek cevabı ayarlar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed(config)], components: [buildSelectRow()] });
  },

  buildStatusEmbed,
  buildSelectRow,
};