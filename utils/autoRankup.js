// Otomatik rank up (davete göre terfi).
// Basamak listesi /autorankup (veya panel) ile ayarlanır, örn: Ekip -> Has Ekip (5 davet) -> Usta (10 davet).
// - İlk rol başlangıç rolüdür (davet gerekmez). Sonraki her rol, "bir önceki rolden sonra" kaç davet gerektiğini söyler.
// - Üye bir rol aldığı andan itibaren yaptığı davetler sayılır; rank atlayınca sayaç 0'dan başlar.
// - Sayılan davetler: hâlâ sunucuda olan ve yan hesap (yeni açılmış hesap) olmayan, kişi başına tekil davetler (/invites "gerçek" sayısı gibi).
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('./db');
const { getConfig, setConfig } = require('./guildConfig');
const { registerCommandGrant } = require('./askPerm');

const MAX_STEPS = 25;
const MAX_INVITES = 1000;

class RankupError extends Error {}

const progressCol = () => getDb().collection('rankupProgress'); // { guildId, userId, roleId, since }

// ---------- Ayarlar ----------
function getSettings(config) {
  const a = config.autoRankup || {};
  const steps = (Array.isArray(a.steps) ? a.steps : [])
    .filter(s => s && s.roleId)
    .map((s, i) => ({ roleId: String(s.roleId), invites: i === 0 ? 0 : Math.max(1, Math.floor(Number(s.invites)) || 1) }));
  return { enabled: Boolean(a.enabled), channelId: a.channelId || null, enabledAt: a.enabledAt ? new Date(a.enabledAt) : null, steps };
}

async function saveSettings(guildId, next) {
  const steps = next.steps.map((s, i) => ({ roleId: s.roleId, invites: i === 0 ? 0 : s.invites }));
  await setConfig(guildId, {
    autoRankup: { enabled: Boolean(next.enabled), channelId: next.channelId || null, enabledAt: next.enabledAt || null, steps },
  });
}

// Basamak listesini doğrular; geçerli hâlini döner (ilk basamağın daveti 0'a sabitlenir).
function validateSteps(guild, steps) {
  if (!Array.isArray(steps)) throw new RankupError('Liste geçersiz.');
  if (steps.length > MAX_STEPS) throw new RankupError(`En fazla ${MAX_STEPS} basamak olabilir.`);
  const seen = new Set();
  return steps.map((s, i) => {
    const roleId = String(s?.roleId || '');
    const role = guild.roles.cache.get(roleId);
    if (!role || role.id === guild.id) throw new RankupError(`${i + 1}. sıradaki rol sunucuda bulunamadı.`);
    if (role.managed) throw new RankupError(`"${role.name}" bot/entegrasyon rolü, basamak olamaz.`);
    if (seen.has(roleId)) throw new RankupError(`"${role.name}" listede birden fazla kez var.`);
    seen.add(roleId);
    let invites = 0;
    if (i > 0) {
      invites = Math.floor(Number(s.invites));
      if (!Number.isFinite(invites) || invites < 1 || invites > MAX_INVITES) {
        throw new RankupError(`"${role.name}" için gereken davet 1 ile ${MAX_INVITES} arasında olmalı.`);
      }
    }
    return { roleId, invites };
  });
}

// ---------- Sayım / durum ----------
async function countInvites(guildId, userId, since) {
  const query = { guildId, inviterId: userId };
  if (since) query.joinedAt = { $gt: since }; // sıfırlama anından SONRAKİ davetler (rank atlatan davet bir sonrakine sayılmaz)
  const list = await getDb().collection('inviteJoins').find(query, { projection: { inviteeId: 1, left: 1, isFake: 1 } }).toArray();
  return new Set(list.filter(r => !r.left && !r.isFake).map(r => r.inviteeId)).size;
}

// Üyenin sahip olduğu en yüksek basamak (yoksa -1).
function currentIndex(member, steps) {
  let idx = -1;
  steps.forEach((s, i) => { if (member.roles.cache.has(s.roleId)) idx = i; });
  return idx;
}

async function setProgress(guildId, userId, roleId, since) {
  await progressCol().updateOne({ guildId, userId }, { $set: { roleId, since } }, { upsert: true });
}

// Üyenin mevcut basamağı, sıradaki basamağı ve o basamaktan beri yaptığı davet sayısı.
async function getStatus(guild, member, settings) {
  const idx = currentIndex(member, settings.steps);
  if (idx < 0) return { idx: -1 };
  const current = settings.steps[idx];
  const next = settings.steps[idx + 1] || null;

  const rec = await progressCol().findOne({ guildId: guild.id, userId: member.id });
  let since;
  if (rec && rec.roleId === current.roleId) {
    since = rec.since;
  } else {
    // Kayıt yok: sistem açıldığı andan itibaren say. Rol bot kapalıyken değiştiyse: şimdiden başlat.
    since = !rec && settings.enabledAt ? settings.enabledAt : new Date();
    await setProgress(guild.id, member.id, current.roleId, since);
  }
  const count = next ? await countInvites(guild.id, member.id, since) : 0;
  return { idx, current, next, count, since };
}

// ---------- Terfi ----------
const busy = new Set();

async function announce(guild, settings, member, fromRole, toRole, nextStep) {
  if (!settings.channelId) return;
  const channel = guild.channels.cache.get(settings.channelId);
  if (!channel?.isTextBased?.()) return;
  const me = guild.members.me;
  if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return;

  const nextRole = nextStep ? guild.roles.cache.get(nextStep.roleId) : null;
  const embed = new EmbedBuilder()
    .setTitle('🎉 Rank Atladı')
    .setDescription(`${member} davetleriyle **${fromRole ? fromRole.name : 'önceki rol'}** → **${toRole.name}** rankına yükseldi!`)
    .addFields({
      name: 'Davet sayacı',
      value: nextStep ? `Sıfırlandı: **0/${nextStep.invites}**${nextRole ? ` (sonraki: ${nextRole.name})` : ''}` : 'En üst rank, sayaç kalmadı.',
    })
    .setColor(0x57f287)
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { users: [member.id] } }).catch(err => console.error('[AUTORANKUP] duyuru gönderilemedi:', err.message));
}

// Üyenin davet sayısı yetiyorsa bir üst role çıkarır. Terfi olduysa { from, to, next } döner, olmadıysa null.
async function checkMember(guild, member) {
  if (!member || member.user.bot) return null;
  const key = `${guild.id}:${member.id}`;
  if (busy.has(key)) return null;
  busy.add(key);
  try {
    const settings = getSettings(await getConfig(guild.id));
    if (!settings.enabled || settings.steps.length < 2) return null;

    const st = await getStatus(guild, member, settings);
    if (st.idx < 0 || !st.next || st.count < st.next.invites) return null;

    const role = guild.roles.cache.get(st.next.roleId);
    const me = guild.members.me;
    if (!role || !me?.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= me.roles.highest.position) {
      console.warn(`[AUTORANKUP] ${guild.name}: "${role?.name || st.next.roleId}" rolü verilemedi (rol yok ya da botun rolünden yüksek).`);
      return null;
    }

    // Sistem işlemi: /askperm açık olsa bile izin istenmesin (otorol gibi).
    registerCommandGrant(guild.id, member.id, role.id, guild.client.user.id, { replaceRoleId: st.current.roleId });
    await member.roles.add(role, 'Auto rank up (davet)');
    const from = guild.roles.cache.get(st.current.roleId) || null;
    if (from && from.position < me.roles.highest.position) await member.roles.remove(from, 'Auto rank up (davet)').catch(() => {});

    await setProgress(guild.id, member.id, role.id, new Date()); // sayaç sıfırlanır
    const nextStep = settings.steps[st.idx + 2] || null;
    await announce(guild, settings, member, from, role, nextStep);
    return { from, to: role, next: nextStep };
  } catch (err) {
    console.error('[AUTORANKUP]', err.message);
    return null;
  } finally {
    busy.delete(key);
  }
}

// Yeni üye bir davetle katılınca davet edeni kontrol eder.
async function checkInviter(guild, inviterId) {
  const member = guild.members.cache.get(inviterId) || (await guild.members.fetch(inviterId).catch(() => null));
  return checkMember(guild, member);
}

// Basamak rolü elle (ör. /promote, /rolver) değişince sayaç o andan başlasın.
async function onRoleChange(oldMember, newMember) {
  if (oldMember.partial || newMember.user.bot) return;
  const settings = getSettings(await getConfig(newMember.guild.id));
  if (!settings.steps.length) return;
  const before = currentIndex(oldMember, settings.steps);
  const after = currentIndex(newMember, settings.steps);
  if (before === after) return;
  if (after < 0) await progressCol().deleteOne({ guildId: newMember.guild.id, userId: newMember.id });
  else await setProgress(newMember.guild.id, newMember.id, settings.steps[after].roleId, new Date());
}

// Tüm basamaktaki üyeleri tarar (sistem açılınca ya da bot kapalıyken eksik kalanlar için).
async function sweepGuild(guild) {
  const settings = getSettings(await getConfig(guild.id));
  if (!settings.enabled || settings.steps.length < 2) return { checked: 0, promoted: 0 };
  const members = await guild.members.fetch();
  let checked = 0;
  let promoted = 0;
  for (const m of members.values()) {
    if (m.user.bot || currentIndex(m, settings.steps) < 0) continue;
    checked++;
    if (await checkMember(guild, m)) promoted++;
  }
  return { checked, promoted };
}

// ---------- Gösterim ----------
const roleLabel = (guild, id) => guild.roles.cache.get(id)?.name || 'silinmiş rol';

function ladderText(guild, steps) {
  if (!steps.length) return 'Henüz basamak yok. `/autorankup ekle` ile başla.';
  return steps
    .map((s, i) => (i === 0
      ? `**1.** ${roleLabel(guild, s.roleId)} — başlangıç rolü`
      : `**${i + 1}.** ${roleLabel(guild, s.roleId)} — bir önceki rolden sonra **${s.invites}** davet`))
    .join('\n');
}

const bar = (count, need) => {
  const filled = Math.min(10, Math.floor((Math.min(count, need) / need) * 10));
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
};

module.exports = {
  RankupError,
  MAX_STEPS,
  MAX_INVITES,
  getSettings,
  saveSettings,
  validateSteps,
  countInvites,
  currentIndex,
  getStatus,
  checkMember,
  checkInviter,
  onRoleChange,
  sweepGuild,
  ladderText,
  roleLabel,
  bar,
};
