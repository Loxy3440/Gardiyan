const { refreshActivity } = require('../utils/activityRotator');
const { recordLeave } = require('../utils/inviteTracker');
const { scheduleUpdate } = require('../utils/countChannel');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    refreshActivity(member.client);
    scheduleUpdate(member.guild);
    try {
      await recordLeave(member);
    } catch (err) {
      console.error('[guildMemberRemove]', err);
    }
  },
};