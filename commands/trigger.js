const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getConfig, upsertActivityTrigger, removeActivityTrigger } = require('../utils/guildConfig');
const { successEmbed, warningEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trigger')
    .setDescription('Bir kategori/kanalda hareketlilik olunca mesaj gonderme ayarlarini yonetir')
    .addSubcommand(sub =>
      sub
        .setName('ekle')
        .setDescription('Yeni bir hareketlilik tetikleyicisi ekler')
        .addChannelOption(opt =>
          opt
            .setName('hedef')
            .setDescription('Izlenecek kategori veya kanal')
            .addChannelTypes(ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice)
            .setRequired(true),
        )
        .addChannelOption(opt =>
          opt
            .setName('bildirim')
            .setDescription('Hareketlilik mesajinin gonderilecegi kanal')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addIntegerOption(opt =>
          opt
            .setName('bekleme-dakika')
            .setDescription('Ayni hedef icin tekrar mesaj gondermeden once beklenecek dakika (varsayilan 10)')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(false),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('sil')
        .setDescription('Bir hareketlilik tetikleyicisini kaldirir')
        .addChannelOption(opt =>
          opt
            .setName('hedef')
            .setDescription('Izlemesi kaldirilacak kategori veya kanal')
            .addChannelTypes(ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice)
            .setRequired(true),
        ),
    )
    .addSubcommand(sub => sub.setName('liste').setDescription('Tanimli tum tetikleyicileri listeler'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'ekle') {
      const target = interaction.options.getChannel('hedef');
      const notify = interaction.options.getChannel('bildirim');
      const cooldownMinutes = interaction.options.getInteger('bekleme-dakika') ?? 10;
      const watchType = target.type === ChannelType.GuildCategory ? 'category' : 'channel';

      // Secilen hedef/bildirim/tur/bekleme bilgisini modal customId'sinde tasiyoruz,
      // boylece modal gonderildiginde hangi ayar icin oldugunu biliyoruz.
      const modal = new ModalBuilder()
        .setCustomId(`trigger_modal_add_${target.id}_${notify.id}_${watchType}_${cooldownMinutes}`)
        .setTitle('Tetikleyici Mesaji');

      const messageInput = new TextInputBuilder()
        .setCustomId('trigger_message')
        .setLabel('Hareketlilik mesaji')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder('ornek: {kanal} kanalinda hareketlilik var!');

      modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

      if (watchType === 'category') {
        const newChannelInput = new TextInputBuilder()
          .setCustomId('trigger_newchannel_message')
          .setLabel('Yeni kanal acilinca gonderilecek mesaj')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setPlaceholder('bos birakirsan yeni kanala otomatik mesaj atilmaz');

        modal.addComponents(new ActionRowBuilder().addComponents(newChannelInput));
      }

      return interaction.showModal(modal);
    }

    if (sub === 'sil') {
      const target = interaction.options.getChannel('hedef');
      const config = await getConfig(interaction.guild.id);
      const exists = config.activityTriggers.some(t => t.watchId === target.id);

      if (!exists) {
        return interaction.reply({ embeds: [warningEmbed('Bulunamadi', `${target} icin tanimli bir tetikleyici yok.`)], ephemeral: true });
      }

      await removeActivityTrigger(interaction.guild.id, target.id);
      return interaction.reply({ embeds: [successEmbed('Kaldirildi', `${target} icin tetikleyici kaldirildi.`)] });
    }

    // liste
    const config = await getConfig(interaction.guild.id);

    if (!config.activityTriggers.length) {
      return interaction.reply({ embeds: [warningEmbed('Tetikleyici Yok', 'Henuz tanimli bir hareketlilik tetikleyicisi yok.')] });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Hareketlilik Tetikleyicileri (${config.activityTriggers.length})`)
      .setColor(0x5865f2)
      .setDescription(
        config.activityTriggers
          .map(t => {
            const label = t.watchType === 'category' ? 'Kategori' : 'Kanal';
            const extra = t.newChannelMessage ? ' | Yeni kanal mesaji aktif' : '';
            return `${label}: <#${t.watchId}> -> <#${t.notifyChannelId}> | ${Math.round(t.cooldownSeconds / 60)} dk bekleme${extra}`;
          })
          .join('\n'),
      );

    return interaction.reply({ embeds: [embed] });
  },
};