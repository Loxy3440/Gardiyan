const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { warningEmbed } = require('../utils/embeds');
const { addPrivateMessage } = require('../utils/privateMessages');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('m')
    .setDescription('Bir kullaniciya sadece kendisinin gorebilecegi bir mesaj/dosya birakir')
    .addUserOption(opt => opt.setName('kullanici').setDescription('Mesajin gidecegi kullanici').setRequired(true))
    .addStringOption(opt => opt.setName('mesaj').setDescription('Mesaj metni').setRequired(false))
    .addAttachmentOption(opt => opt.setName('dosya').setDescription('Gonderilecek dosya/gorsel/video').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('kullanici');
    const content = interaction.options.getString('mesaj');
    const attachment = interaction.options.getAttachment('dosya');

    if (!content && !attachment) {
      return interaction.reply({ embeds: [warningEmbed('Eksik Bilgi', 'Mesaj metni veya dosyadan en az birini eklemelisin.')], ephemeral: true });
    }

    if (target.bot) {
      return interaction.reply({ embeds: [warningEmbed('Gecersiz Hedef', 'Bir bota ozel mesaj birakamazsin.')], ephemeral: true });
    }

    const record = await addPrivateMessage(
      interaction.guild.id,
      interaction.user.id,
      target.id,
      content,
      attachment?.url,
      attachment?.contentType,
    );

    const noticeEmbed = new EmbedBuilder()
      .setTitle('📩 Ozel Bir Mesaj Var')
      .setDescription(`${target} icin bir mesaj birakildi. Sadece **${target.tag}** asagidaki butona basarak gorebilir.`)
      .setColor(0x5865f2)
      .setFooter({ text: `Gonderen: ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pmreveal_${record._id.toHexString()}`)
        .setLabel('Mesaji Gor')
        .setEmoji('📨')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({ embeds: [noticeEmbed], components: [row] });
  },
};