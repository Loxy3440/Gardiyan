const { handleRoleUpdate } = require('../utils/askPerm');
const { syncMember } = require('../utils/tagRole');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    try {
      await handleRoleUpdate(oldMember, newMember);
    } catch (err) {
      console.error('[guildMemberUpdate]', err);
    }
    try {
      await syncMember(newMember);
    } catch (err) {
      console.error('[TAG]', err);
    }
  },
};
