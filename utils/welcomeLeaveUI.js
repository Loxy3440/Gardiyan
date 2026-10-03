const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

function buildStatusEmbed(kind, config) {
  const isWelcome = kind === 'welcome';
  const enabled = isWelcome ? config.welcomeEnabled : config.leaveEnabled;
  const channelId = isWelcome ? config.welcomeChannelId : config.leaveChannelId;
  const template = isWelcome ? config.welcomeMessage : config.leaveMessage;

  return new EmbedBuilder()
    .setTitle(isWelcome ? 'Karsilama Ayarlari (Welcomer)' : 'Ayrilma Ayarlari (Leaver)')
    .setColor(isWelcome ? 0x57f287 : 0xed4245)
    .addFields(
      { name: 'Durum', value: enabled ? '✅ Acik' : '❌ Kapali', inline: true },
      { name: 'Kanal', value: channelId ? `<#${channelId}>` : 'Ayarlanmadi', inline: true },
      { name: 'Mesaj Sablonu', value: '```\n' + (template || '-') + '\n```' },
    )
    .setFooter({ text: 'Degiskenler: {user} {server} | Etiketler: content: / title: / description: / footer: / image:' });
}

function buildSelectRow(kind) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`wlconfig_menu_${kind}`)
    .setPlaceholder('Bir ayar sec...')
    .addOptions(
      { label: 'Kanal Ayarla', value: 'set_channel', emoji: '📥' },
      { label: 'Mesaj Sablonunu Degistir', value: 'set_message', emoji: '✏️' },
      { label: 'Ac/Kapat', value: 'toggle', emoji: '🔁' },
    );

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = { buildStatusEmbed, buildSelectRow };