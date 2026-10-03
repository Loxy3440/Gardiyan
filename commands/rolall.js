const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolall')
    .setDescription('Sunucudaki herkese bir rol verir')
    .addRoleOption(opt => opt.setName('rol').setDescription('Verilecek rol').setRequired(true))
    .addBooleanOption(opt =>
      opt.setName('botlar-dahil').setDescription('Botlara da verilsin mi? (varsayilan: hayir)').setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const role = interaction.options.getRole('rol');
    const includeBots = interaction.options.getBoolean('botlar-dahil') ?? false;

    if (role.managed) {
      return interaction.reply({
        embeds: [errorEmbed('Bu rol bir entegrasyona (bot/boost rolu vb.) ait, elle verilemez.')],
        ephemeral: true,
      });
    }

    const botMember = interaction.guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        embeds: [errorEmbed('Bu rol benim en yuksek rolumden yuksek veya esit konumda, once rolumu yukselt.')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const members = await interaction.guild.members.fetch();
    const targets = members.filter(m => (includeBots || !m.user.bot) && !m.roles.cache.has(role.id));

    if (!targets.size) {
      return interaction.editReply({ embeds: [successEmbed('Yapilacak Bir Sey Yok', 'Hedeflenen herkeste zaten bu rol var.')] });
    }

    let success = 0;
    let failed = 0;

    for (const member of targets.values()) {
      try {
        await member.roles.add(role, `/rolall - ${interaction.user.tag}`);
        success++;
      } catch {
        failed++;
      }
    }

    return interaction.editReply({
      embeds: [
        successEmbed(
          'Rol Dagitildi',
          `**${role.name}** rolu **${success}** uyeye verildi.${failed ? ` **${failed}** uyeye verilemedi (yetki/hiyerarsi sorunu olabilir).` : ''}`,
        ),
      ],
    });
  },
};