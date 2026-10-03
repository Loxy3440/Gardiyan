const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getConfig } = require('../utils/guildConfig');

function buildStatusEmbed(config) {
  const list = config.autoResponses.length
    ? config.autoResponses.map(r => `\`${r.trigger}\` -> ${r.response || '*(sadece medya)*'}${r.mediaUrl ? ' 📎' : ''}`).join('\n')
    : 'Tanimli otomatik mesaj yok.';

  return new EmbedBuilder()
    .setTitle('Otomatik Mesajlar (Automessage)')
    .setColor(0x5865f2)
    .setDescription('Biri asagidaki tetikleyicilerden birini tam olarak yazarsa bot otomatik cevap verir.')
    .addFields({ name: `Tanimli Mesajlar (${config.autoResponses.length})`, value: list })
    .setFooter({ text: 'Asagidaki menuden ekle / sil' });
}

function buildSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('auto_menu')
    .setPlaceholder('Bir islem sec...')
    .addOptions(
      { label: 'Otomatik Mesaj Ekle/Guncelle', value: 'add_autoresponse', emoji: '💬' },
      { label: 'Otomatik Mesaj Sil', value: 'remove_autoresponse', emoji: '🗑️' },
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('auto')
    .setDescription('Otomatik mesajlari (automessage) yonetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);
    await interaction.reply({ embeds: [buildStatusEmbed(config)], components: [buildSelectRow()] });
  },

  buildStatusEmbed,
  buildSelectRow,
};