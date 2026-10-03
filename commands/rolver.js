const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed, infoEmbed } = require('../utils/embeds');
const { parseDuration } = require('../utils/parseDuration');
const { formatRemaining, pickTickInterval } = require('../utils/formatDuration');
const { addTempRole, removeTempRole } = require('../utils/tempRoles');
const { setActiveTimer, clearActiveTimer } = require('../utils/activeTimers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolver')
    .setDescription('Bir uyeye rol verir (sure opsiyonel, bos = suresiz)')
    .addUserOption(opt => opt.setName('uye').setDescription('Rol verilecek uye').setRequired(true))
    .addRoleOption(opt => opt.setName('rol').setDescription('Verilecek rol').setRequired(true))
    .addStringOption(opt => opt.setName('sure').setDescription('Ornek: 10s, 10m, 2h, 1d (bos birakilirsa suresiz)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const member = interaction.options.getMember('uye');
    const role = interaction.options.getRole('rol');
    const durationInput = interaction.options.getString('sure');

    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu uye sunucuda bulunamadi.')], ephemeral: true });
    }

    if (role.managed || role.id === interaction.guild.id) {
      return interaction.reply({ embeds: [warningEmbed('Gecersiz Rol', 'Bu rol verilemez.')], ephemeral: true });
    }

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ embeds: [errorEmbed('Bu rolu veremiyorum, botun rolu yeterince yuksek degil.')], ephemeral: true });
    }

    let durationMs = null;
    if (durationInput) {
      durationMs = parseDuration(durationInput);
      if (!durationMs) {
        return interaction.reply({ embeds: [warningEmbed('Gecersiz Sure', 'Sureyi `10s`, `10m`, `2h`, `1d` seklinde yaz. (s/m/h/d)')], ephemeral: true });
      }
    }

    try {
      await member.roles.add(role, `Yetkili: ${interaction.user.tag}`);
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Rol verilirken bir hata olustu.')], ephemeral: true });
    }

    const expiresAt = durationMs ? Date.now() + durationMs : null;

    if (durationMs) {
      await addTempRole(interaction.guild.id, member.id, role.id, new Date(expiresAt), interaction.channel.id);
    }

    const embed = successEmbed('Rol Verildi', `**${member.user.tag}** kullanicisina **${role.name}** rolu verildi.`)
      .addFields({ name: 'Sure', value: durationMs ? formatRemaining(durationMs) + ' kaldi' : 'Suresiz', inline: true })
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roltakeback_${member.id}_${role.id}`).setLabel('Geri Al').setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    if (!durationMs) return;

    const timerKey = `role_${interaction.guild.id}_${member.id}_${role.id}`;

    const tick = async () => {
      const remaining = expiresAt - Date.now();

      if (remaining <= 0) {
        clearActiveTimer(timerKey);

        const guildMember = await interaction.guild.members.fetch(member.id).catch(() => null);
        if (guildMember) {
          await guildMember.roles.remove(role.id, 'Gecici rol suresi doldu').catch(() => {});
        }
        await removeTempRole(interaction.guild.id, member.id, role.id).catch(() => {});

        const expiredEmbed = infoEmbed('Sure Doldu - Rol Alindi', `**${member.user.tag}** kullanicisindan **${role.name}** rolu, suresi doldugu icin geri alindi.`)
          .setTimestamp();

        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(row.components[0]).setDisabled(true).setLabel('Suresi Doldu'),
        );

        await message.edit({ embeds: [expiredEmbed], components: [disabledRow] }).catch(() => {});
        return;
      }

      const updatedEmbed = EmbedBuilder.from(embed).setFields({ name: 'Sure', value: `${formatRemaining(remaining)} kaldi`, inline: true });
      await message.edit({ embeds: [updatedEmbed], components: [row] }).catch(() => {});

      const nextTick = pickTickInterval(remaining);
      setActiveTimer(timerKey, setTimeout(tick, Math.min(nextTick, remaining)));
    };

    setActiveTimer(timerKey, setTimeout(tick, Math.min(pickTickInterval(durationMs), durationMs)));
  },
};