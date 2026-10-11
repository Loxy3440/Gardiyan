const { PermissionFlagsBits } = require('discord.js');
const { getActivityConfig, setActivityConfig, addActivity, removeActivity } = require('./activityConfig');
const { startActivityRotation } = require('./activityRotator');
const { getConfig, upsertMentionTrigger, removeMentionTrigger, upsertAutoResponse, removeAutoResponse } = require('./guildConfig');
const { parseDuration } = require('./parseDuration');
const { clearActiveTimer } = require('./activeTimers');
const { STATS_GUILD_ID } = require('./activityRotator');

const TYPES = ['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING'];
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const str = (v, max, name, required = true) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new ApiError(400, `${name} boş olamaz.`);
  if (s.length > max) throw new ApiError(400, `${name} en fazla ${max} karakter olabilir.`);
  return s;
};

function getGuild(client) {
  const guild = client.guilds.cache.get(STATS_GUILD_ID);
  if (!guild) throw new ApiError(503, 'Bot ayarlı sunucuda değil (STATS_GUILD_ID).');
  return guild;
}

async function getTarget(client, userId, actor) {
  const guild = getGuild(client);
  if (!/^\d{15,25}$/.test(String(userId || ''))) throw new ApiError(400, 'Geçersiz üye.');
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new ApiError(404, 'Üye sunucuda bulunamadı.');
  if (member.id === guild.ownerId) throw new ApiError(400, 'Sunucu sahibine işlem yapılamaz.');
  if (member.id === client.user.id) throw new ApiError(400, 'Bota işlem yapılamaz.');
  if (member.id === actor.id) throw new ApiError(400, 'Kendine işlem yapamazsın.');
  return member;
}

const handlers = {
  // ---- okuma ----
  'GET overview': async client => {
    const guild = getGuild(client);
    const [activity, config] = await Promise.all([getActivityConfig(), getConfig(guild.id)]);
    return {
      guild: { id: guild.id, name: guild.name },
      activity: { list: activity.list, intervalSeconds: activity.intervalSeconds },
      mentionTriggers: config.mentionTriggers || [],
      autoResponses: config.autoResponses || [],
    };
  },

  'GET members': async (client, _b, _a, query) => {
    const guild = getGuild(client);
    const q = (query.get('q') || '').trim();
    if (q.length < 2) return { members: [] };
    const found = await guild.members.search({ query: q.slice(0, 32), limit: 10 });
    return {
      members: [...found.values()].map(m => ({
        id: m.id,
        tag: m.user.tag,
        name: m.displayName,
        avatar: m.displayAvatarURL({ size: 64 }),
        mutedUntil: m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now() ? m.communicationDisabledUntilTimestamp : null,
      })),
    };
  },

  // ---- aktivite ----
  'POST activity/add': async (client, b) => {
    if (!TYPES.includes(b.type)) throw new ApiError(400, 'Geçersiz aktivite türü.');
    await addActivity(b.type, str(b.text, 100, 'Metin'));
    await startActivityRotation(client);
    return { ok: true };
  },
  'POST activity/remove': async (client, b) => {
    const config = await getActivityConfig();
    if (!Number.isInteger(b.index) || b.index < 0 || b.index >= config.list.length) throw new ApiError(400, 'Geçersiz sıra.');
    await removeActivity(b.index);
    await startActivityRotation(client);
    return { ok: true };
  },
  'POST activity/interval': async (client, b) => {
    const s = Number(b.seconds);
    if (!Number.isFinite(s) || s < 5 || s > 3600) throw new ApiError(400, 'Süre 5 ile 3600 saniye arasında olmalı.');
    await setActivityConfig({ intervalSeconds: Math.round(s) });
    await startActivityRotation(client);
    return { ok: true };
  },

  // ---- etiketlenme cevapları (/setmention) ----
  'POST mention/upsert': async (client, b) => {
    const guild = getGuild(client);
    const trigger = str(b.trigger, 100, 'Tetikleyici');
    const response = str(b.response, 1800, 'Cevap', !b.mediaUrl);
    await upsertMentionTrigger(guild.id, trigger, response, b.mediaUrl ? str(b.mediaUrl, 500, 'Medya adresi') : null);
    return { ok: true };
  },
  'POST mention/remove': async (client, b) => {
    await removeMentionTrigger(getGuild(client).id, str(b.trigger, 100, 'Tetikleyici'));
    return { ok: true };
  },

  // ---- otomatik mesajlar (/auto) ----
  'POST auto/upsert': async (client, b) => {
    const guild = getGuild(client);
    const trigger = str(b.trigger, 100, 'Tetikleyici');
    const response = str(b.response, 1800, 'Cevap', !b.mediaUrl);
    const cd = Math.min(Math.max(Math.round(Number(b.cooldownSeconds) || 3), 1), 3600);
    await upsertAutoResponse(guild.id, trigger, response, b.mediaUrl ? str(b.mediaUrl, 500, 'Medya adresi') : null, cd);
    return { ok: true };
  },
  'POST auto/remove': async (client, b) => {
    await removeAutoResponse(getGuild(client).id, str(b.trigger, 100, 'Tetikleyici'));
    return { ok: true };
  },

  // ---- moderasyon ----
  'POST mute': async (client, b, actor) => {
    const member = await getTarget(client, b.userId, actor);
    const ms = parseDuration(String(b.duration || ''));
    if (!ms) throw new ApiError(400, 'Süreyi 10m, 2h, 1d şeklinde yaz.');
    if (ms > MAX_TIMEOUT_MS) throw new ApiError(400, 'En fazla 28 gün susturabilirsin.');
    if (!member.moderatable) throw new ApiError(403, 'Bu üyeyi susturamıyorum (rolü benden yüksek).');
    const reason = str(b.reason, 200, 'Sebep', false) || 'Sebep belirtilmedi';
    await member.timeout(ms, `Panel (${actor.name}): ${reason}`);
    return { ok: true, message: `${member.user.tag} susturuldu.` };
  },
  'POST unmute': async (client, b, actor) => {
    const member = await getTarget(client, b.userId, actor);
    if (!member.moderatable) throw new ApiError(403, 'Bu üyeye işlem yapamıyorum.');
    await member.timeout(null, `Panel (${actor.name}): susturma kaldırıldı`);
    clearActiveTimer(`mute_${member.guild.id}_${member.id}`);
    return { ok: true, message: `${member.user.tag} susturması kaldırıldı.` };
  },
  'POST kick': async (client, b, actor) => {
    const member = await getTarget(client, b.userId, actor);
    if (!member.kickable) throw new ApiError(403, 'Bu üyeyi atamıyorum (rolü benden yüksek).');
    const reason = str(b.reason, 200, 'Sebep', false) || 'Sebep belirtilmedi';
    await member.kick(`Panel (${actor.name}): ${reason}`);
    return { ok: true, message: `${member.user.tag} sunucudan atıldı.` };
  },
};

async function handleAdmin(client, method, route, body, actor, query) {
  const fn = handlers[`${method} ${route}`];
  if (!fn) throw new ApiError(404, 'Bulunamadı.');
  try {
    const result = await fn(client, body || {}, actor, query);
    if (method === 'POST') console.log(`[PANEL] ${actor.name} (${actor.id}) -> ${route}`);
    return result;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[PANEL]', route, err);
    throw new ApiError(500, 'İşlem başarısız: ' + (err.message || 'bilinmeyen hata'));
  }
}

module.exports = { handleAdmin, ApiError };
