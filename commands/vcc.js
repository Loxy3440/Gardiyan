const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setConfig, getConfig } = require('../utils/guildConfig');
const { connectToVoice, disconnectFromVoice } = require('../utils/voiceConnection');
const { successEmbed, errorEmbed, warningEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcc')
    .setDescription('Botun acilista otomatik girecegi ses kanalini yonetir')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Botun girecegi ses kanalini ayarlar ve hemen baglanir')
        .addChannelOption(opt =>
          opt.setName('kanal').setDescription('Ses kanali').addChannelTypes(ChannelType.GuildVoice).setRequired(true),
        ),
    )
    .addSubcommand(sub => sub.setName('off').setDescription('Botu ses kanalindan cikarir ve ayari kaldirir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const channel = interaction.options.getChannel('kanal');

      await setConfig(interaction.guild.id, { vcChannelId: channel.id });

      try {
        connectToVoice(channel);
      } catch (err) {
        console.error('[VCC]', err);
        return interaction.reply({
          embeds: [errorEmbed('Kanala baglanilirken bir hata olustu. `@discordjs/voice` ve `libsodium-wrappers` kurulu mu kontrol et (`npm install`).')],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [
          successEmbed(
            'Ses Kanali Ayarlandi',
            `Bot artik acilista otomatik olarak ${channel} kanalina girecek (mikrofon ve kulaklik kapali). Simdi de baglandi.`,
          ),
        ],
      });
    }

    // off
    const config = await getConfig(interaction.guild.id);
    if (!config.vcChannelId) {
      return interaction.reply({ embeds: [warningEmbed('Zaten Kapali', 'Ayarlanmis bir ses kanali yok.')], ephemeral: true });
    }

    disconnectFromVoice(interaction.guild.id);
    await setConfig(interaction.guild.id, { vcChannelId: null });

    return interaction.reply({ embeds: [successEmbed('Kapatildi', 'Bot ses kanalindan cikti ve otomatik baglanma kapatildi.')] });
  },
};