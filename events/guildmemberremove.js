const { refreshActivity } = require('../utils/activityRotator');
const { recordLeave } = require('../utils/inviteTracker');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    refreshActivity(member.client);
    try {
      await recordLeave(member);
    } catch (err) {
      console.error('[guildMemberRemove]', err);
    }
  },
};