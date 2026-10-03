const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');

// Uyeyi, atanabilir roller listesinde (pozisyona gore siralanmis) bir sonraki
// role yukseltir. Onceki en yuksek rolu kaldirir, yeni rolu ekler.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Uyeyi rol hiyerarsisinde bir ust role yukseltir')
    .addUserOption(opt => opt.setName('uye').setDescription('Yukseltilecek uye').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const member = interaction.options.getMember('uye');
    if (!member) {
      return interaction.reply({ embeds: [errorEmbed('Bu uye sunucuda bulunamadi.')], ephemeral: true });
    }

    const assignableRoles = interaction.guild.roles.cache
      .filter(r => !r.managed && r.id !== interaction.guild.id)
      .sort((a, b) => a.position - b.position);

    if (assignableRoles.size === 0) {
      return interaction.reply({ embeds: [warningEmbed('Rol Yok', 'Sunucuda atanabilir rol bulunamadi.')], ephemeral: true });
    }

    const rolesArray = [...assignableRoles.values()];
    const memberRoles = rolesArray.filter(r => member.roles.cache.has(r.id));
    const currentTop = memberRoles.length ? memberRoles[memberRoles.length - 1] : null;

    let nextRole;
    if (!currentTop) {
      nextRole = rolesArray[0];
    } else {
      const currentIndex = rolesArray.findIndex(r => r.id === currentTop.id);
      nextRole = rolesArray[currentIndex + 1];
    }

    if (!nextRole) {
      return interaction.reply({ embeds: [warningEmbed('Zaten En Ust Seviyede', `**${member.user.tag}** zaten en yuksek rolde.`)], ephemeral: true });
    }

    if (nextRole.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ embeds: [errorEmbed('Bu rolu veremiyorum, botun rolu yeterince yuksek degil.')], ephemeral: true });
    }

    try {
      await member.roles.add(nextRole, `Promote - Yetkili: ${interaction.user.tag}`);
      if (currentTop) {
        await member.roles.remove(currentTop, `Promote - Yetkili: ${interaction.user.tag}`);
      }
    } catch {
      return interaction.reply({ embeds: [errorEmbed('Rol degistirilirken bir hata olustu.')], ephemeral: true });
    }

    const embed = successEmbed('Uye Yukseltildi', `**${member.user.tag}** artik **${nextRole.name}** rolune sahip.`)
      .addFields({ name: 'Onceki Rol', value: currentTop ? currentTop.name : 'Yoktu', inline: true })
      .setFooter({ text: `Yetkili: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
