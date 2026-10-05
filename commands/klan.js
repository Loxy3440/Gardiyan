const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { getConfig } = require('../utils/guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('klan')
    .setDescription('Secilen uyeye /setklan ile ayarlanan klan rolunu verir')
    .addUserOption(opt => opt.setName('uye').setDescription('Klan rolu verilecek uye').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const config = await getConfig(interaction.guild.id);

    if (!config.clanRoleId) {
      return interaction.reply({ embeds: [warningEmbed('Klan Rolu Yok', 'Once `/setklan` ile bir klan rolu sec.')], ephemeral: true });
    }

    const role = interaction.guild.roles.cache.get(config.clanRoleId);
    if (!role) {
      return interaction.reply({ embeds: [errorEmbed('Ayarlanan klan rolu silinmis. `/setklan` ile yeniden sec.')], ephemeral: true });
    }

    const member = interaction.options.getMember('uye');
    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu kullanici sunucuda degil.')], ephemeral: true });
    }
    if (member.roles.cache.has(role.id)) {
      return interaction.reply({ embeds: [warningEmbed('Zaten Var', `${member} kisisinde ${role} rolu zaten var.`)], ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= me.roles.highest.position) {
      return interaction.reply({
        embeds: [errorEmbed(`Bot ${role} rolunu veremiyor. Botun **Rolleri Yonet** yetkisi olmali ve bot rolu ${role} rolunun ustunde olmali.`)],
        ephemeral: true,
      });
    }

    try {
      await member.roles.add(role, `Klan rolu: ${interaction.user.tag} verdi`);
    } catch (err) {
      return interaction.reply({ embeds: [errorEmbed(`Rol verilemedi: ${err.message}`)], ephemeral: true });
    }

    await interaction.reply({ embeds: [successEmbed('Klan Rolu Verildi', `${member} kisisine ${role} rolu verildi.`)] });
  },
};