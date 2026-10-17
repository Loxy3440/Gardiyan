const { handleRoleUpdate } = require('../utils/askPerm');
const { syncMember } = require('../utils/tagRole');
const { onRoleChange } = require('../utils/autoRankup');

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
    try {
      await onRoleChange(oldMember, newMember); // auto rank up: rol değişince davet sayacı o andan başlar
    } catch (err) {
      console.error('[AUTORANKUP]', err);
    }
  },
};
