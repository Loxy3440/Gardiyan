const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Bir uyeyi sunucudan atar (kanit gerekli)')
    .addUserOption(opt => opt.setName('uye').setDescription('Atilacak uye').setRequired(true))
    .addAttachmentOption(opt => opt.setName('kanit').setDescription('Kanit resmi').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Atma sebebi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('uye');
    const attachment = interaction.options.getAttachment('kanit');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    if (!(attachment.contentType || '').startsWith('image/')) {
      return interaction.reply({ embeds: [warningEmbed('Kanit Gecersiz', 'Ekledigin dosya bir resim olmali.')], ephemeral: true });
    }

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu uye sunucuda bulunamadi.')], ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ embeds: [warningEmbed('Gecersiz', 'Kendini atamazsin.')], ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ embeds: [warningEmbed('Yetersiz Rol', 'Bu uyenin rolu seninkine esit veya yuksek.')], ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({ embeds: [errorEmbed('Bu uyeyi atamiyorum, rol hiyerarsisi buna izin vermiyor.')], ephemeral: true });
    }

    await interaction.deferReply();

    const dmEmbed = new EmbedBuilder()
      .setTitle('Sunucudan Atildin')
      .setDescription(`**${interaction.guild.name}** sunucusundan atildin.`)
      .addFields({ name: 'Sebep', value: reason })
      .setImage(attachment.url)
      .setColor(0xe67e22)
      .setTimestamp();

    let dmSent = true;
    try {
      await member.send({ embeds: [dmEmbed] });
    } catch {
      dmSent = false;
    }

    try {
      await member.kick(reason);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Atma islemi basarisiz oldu.')] });
    }

    const resultEmbed = successEmbed('Uye Atildi', `**${member.user.tag}** sunucudan atildi.`)
      .addFields(
        { name: 'Sebep', value: reason },
        { name: 'DM', value: dmSent ? 'Gonderildi' : 'Gonderilemedi', inline: true },
      )
      .setImage(attachment.url)
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });
  },
};
