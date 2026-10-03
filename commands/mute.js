const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed, infoEmbed } = require('../utils/embeds');
const { parseDuration } = require('../utils/parseDuration');
const { formatRemaining, pickTickInterval } = require('../utils/formatDuration');
const { setActiveTimer, clearActiveTimer } = require('../utils/activeTimers');

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord siniri: 28 gun

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Bir uyeyi susturur (sesli + yazili), kanit gerekli')
    .addUserOption(opt => opt.setName('uye').setDescription('Susturulacak uye').setRequired(true))
    .addStringOption(opt => opt.setName('sure').setDescription('Ornek: 10m, 2h, 1d').setRequired(true))
    .addAttachmentOption(opt => opt.setName('kanit').setDescription('Kanit resmi').setRequired(true))
    .addStringOption(opt => opt.setName('sebep').setDescription('Susturma sebebi').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('uye');
    const durationInput = interaction.options.getString('sure');
    const attachment = interaction.options.getAttachment('kanit');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    if (!(attachment.contentType || '').startsWith('image/')) {
      return interaction.reply({ embeds: [warningEmbed('Kanit Gecersiz', 'Ekledigin dosya bir resim olmali.')], ephemeral: true });
    }

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu uye sunucuda bulunamadi.')], ephemeral: true });
    }

    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      return interaction.reply({ embeds: [warningEmbed('Gecersiz Sure', 'Sureyi `10m`, `2h`, `1d` seklinde yaz. (s/m/h/d)')], ephemeral: true });
    }

    if (durationMs > MAX_TIMEOUT_MS) {
      return interaction.reply({ embeds: [warningEmbed('Sure Cok Uzun', 'En fazla 28 gun susturabilirsin.')], ephemeral: true });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ embeds: [warningEmbed('Gecersiz', 'Kendini susturamazsin.')], ephemeral: true });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ embeds: [warningEmbed('Yetersiz Rol', 'Bu uyenin rolu seninkine esit veya yuksek.')], ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ embeds: [errorEmbed('Bu uyeyi susturamiyorum, rol hiyerarsisi buna izin vermiyor.')], ephemeral: true });
    }

    await interaction.deferReply();

    try {
      await member.timeout(durationMs, reason);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Susturma islemi basarisiz oldu.')] });
    }

    const expiresAt = Date.now() + durationMs;

    const embed = successEmbed('Uye Susturuldu', `**${member.user.tag}** hem sesli hem yazili olarak susturuldu.`)
      .setColor(0xe67e22)
      .addFields(
        { name: 'Kalan Sure', value: `${formatRemaining(durationMs)} kaldi`, inline: true },
        { name: 'Sebep', value: reason },
      )
      .setImage(attachment.url)
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`unmute_${member.id}`).setLabel('Unmute').setStyle(ButtonStyle.Primary),
    );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const timerKey = `mute_${interaction.guild.id}_${member.id}`;

    const tick = async () => {
      const remaining = expiresAt - Date.now();

      if (remaining <= 0) {
        clearActiveTimer(timerKey);

        const expiredEmbed = infoEmbed('Sure Doldu - Susturma Kalkti', `**${member.user.tag}** kullanicisinin susturmasi suresi doldugu icin kalkti.`)
          .setTimestamp();

        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true).setLabel('Suresi Doldu'),
        );

        await message.edit({ embeds: [expiredEmbed], components: [disabledRow] }).catch(() => {});
        return;
      }

      const updatedEmbed = EmbedBuilder.from(embed).setFields(
        { name: 'Kalan Sure', value: `${formatRemaining(remaining)} kaldi`, inline: true },
        { name: 'Sebep', value: reason },
      );
      await message.edit({ embeds: [updatedEmbed], components: [row] }).catch(() => {});

      const nextTick = pickTickInterval(remaining);
      setActiveTimer(timerKey, setTimeout(tick, Math.min(nextTick, remaining)));
    };

    setActiveTimer(timerKey, setTimeout(tick, Math.min(pickTickInterval(durationMs), durationMs)));
  },
};