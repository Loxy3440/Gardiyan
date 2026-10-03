const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Bir uyenin sunucudaki davet linklerini ve toplam kullanim sayisini gosterir')
    .addUserOption(opt => opt.setName('uye').setDescription('Davetleri gosterilecek uye').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('uye') || interaction.user;

    await interaction.deferReply();

    let allInvites;
    try {
      allInvites = await interaction.guild.invites.fetch();
    } catch (err) {
      console.error('[INVITES]', err);
      return interaction.editReply({
        embeds: [errorEmbed('Davetler alinirken bir hata olustu. Botun "Sunucuyu Yonet" yetkisi oldugundan emin ol.')],
      });
    }

    const userInvites = allInvites.filter(inv => inv.inviter?.id === user.id);
    const totalUses = userInvites.reduce((sum, inv) => sum + (inv.uses ?? 0), 0);

    const embed = new EmbedBuilder()
      .setTitle(`${user.tag} - Davetler`)
      .setColor(0x5865f2)
      .setThumbnail(user.displayAvatarURL())
      .setDescription(`Toplam **${totalUses}** kullanim, **${userInvites.size}** aktif davet linki.`)
      .setFooter({ text: userInvites.size ? 'Detaylari gormek icin asagidaki butona tikla' : 'Bu kullanicinin aktif bir davet linki yok' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`invites_details_${user.id}`).setLabel('Detaylar').setStyle(ButtonStyle.Secondary).setEmoji('📋'),
    );

    await interaction.editReply({ embeds: [embed], components: userInvites.size ? [row] : [] });
  },
};