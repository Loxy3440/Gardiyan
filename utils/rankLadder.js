// Promote/demote basamakları: sadece "üye rolleri" arasında gezilir.
// Yetkili rolleri hiçbir zaman verilmez, bot rolleri basamağa girmez.
function getLadder(guild, config) {
  const bot = new Set(config.roleBotIds || []);
  const staff = new Set(config.roleStaffIds || []);
  const memberIds = (config.roleMemberIds || []).filter(id => guild.roles.cache.has(id));

  let roles;
  if (memberIds.length) {
    roles = memberIds.map(id => guild.roles.cache.get(id));
  } else {
    // Üye rolleri ayarlanmamışsa eski davranış: tüm roller, ama bot ve yetkili rolleri hariç.
    roles = [...guild.roles.cache.values()].filter(r => !r.managed && r.id !== guild.id);
  }
  roles = roles.filter(r => !bot.has(r.id) && !staff.has(r.id) && !r.managed && r.id !== guild.id).sort((a, b) => a.position - b.position);

  return { ladder: roles, configured: memberIds.length > 0, staff, bot };
}

// Üyenin basamaklardaki en yüksek rolü (yoksa null) ve sırası.
function currentRank(member, ladder) {
  let idx = -1;
  ladder.forEach((r, i) => { if (member.roles.cache.has(r.id)) idx = i; });
  return { index: idx, role: idx >= 0 ? ladder[idx] : null };
}

// Terfi/tenzil yapılamayacak üye mi? (bot ya da yetkili) -> neden metni döner, yapılabilirse null.
function blockedReason(member, info) {
  if (member.user.bot) return 'Botlara terfi/tenzil uygulanmaz.';
  const staffRole = [...info.staff].map(id => member.roles.cache.get(id)).find(Boolean);
  if (staffRole) return `**${member.user.tag}** yetkili (**${staffRole.name}**). Yetkililer terfi/tenzil ile değiştirilmez, bu rolleri elle yönet.`;
  return null;
}

module.exports = { getLadder, currentRank, blockedReason };
