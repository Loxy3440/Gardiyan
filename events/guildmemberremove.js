const { getConfig } = require('../utils/guildConfig');
const { renderTemplate } = require('../utils/messageTemplate');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    try {
      const config = await getConfig(member.guild.id);
      if (!config.leaveEnabled || !config.leaveChannelId) return;

      const channel = member.guild.channels.cache.get(config.leaveChannelId);
      if (!channel) return;

      const userTag = member.user ? member.user.tag : 'Bir uye';
      const template = config.leaveMessage || 'content: {user} sunucudan ayrildi.';
      const payload = renderTemplate(template, { user: userTag, server: member.guild.name });

      await channel.send(payload);
    } catch (err) {
      console.error('[guildMemberRemove]', err);
    }
  },
};