const { handleRoleUpdate } = require('../utils/askPerm');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    try {
      await handleRoleUpdate(oldMember, newMember);
    } catch (err) {
      console.error('[guildMemberUpdate]', err);
    }
  },
};
