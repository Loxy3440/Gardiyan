const { getConfig } = require('../utils/guildConfig');
const { renderTemplate } = require('../utils/messageTemplate');

module.exports = {
  name: 'guildMemberAdd',
  once: false,
  async execute(member) {
    try {
      const config = await getConfig(member.guild.id);

      if (config.autoRoleEnabled) {
        const roleId = member.user.bot ? config.autoRoleBotId : config.autoRoleId;
        const role = roleId ? member.guild.roles.cache.get(roleId) : null;
        if (role) {
          await member.roles.add(role, 'Otomatik rol (otorol)').catch(err => console.error('[AUTOROLE]', err.message));
        }
      }

      // ---------- CHANNELBIP: yeni uye katilinca ayarlanan kanallara mesaj at ----------
      if (config.channelBips?.length) {
        for (const entry of config.channelBips) {
          const bipChannel = member.guild.channels.cache.get(entry.channelId);
          if (!bipChannel || !bipChannel.isTextBased()) continue;

          const text = (entry.message || '{user}')
            .replace(/{user}/g, member.toString())
            .replace(/{server}/g, member.guild.name);

          const sent = await bipChannel.send({ content: text }).catch(() => null);
          if (sent) {
            setTimeout(() => sent.delete().catch(() => {}), 1000);
          }
        }
      }

      if (!config.welcomeEnabled || !config.welcomeChannelId) return;

      const channel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (!channel) return;

      const template = config.welcomeMessage || 'content: Hos geldin {user}!';
      const payload = renderTemplate(template, { user: member.toString(), server: member.guild.name });

      await channel.send(payload);
    } catch (err) {
      console.error('[guildMemberAdd]', err);
    }
  },
};