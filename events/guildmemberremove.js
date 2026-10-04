const { recordLeave } = require('../utils/inviteTracker');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    try {
      await recordLeave(member);
    } catch (err) {
      console.error('[guildMemberRemove]', err);
    }
  },
};