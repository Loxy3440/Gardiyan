const { getDb } = require('./db');

const DEFAULT_CONFIG = {
  welcomeChannelId: null,
  welcomeMessage: 'Hos geldin {user}!',
  welcomeEnabled: false,
  leaveChannelId: null,
  leaveMessage: '{user} sunucudan ayrildi.',
  leaveEnabled: false,
  autoResponses: [], // [{ trigger: 'hi', response: 'Hello' }, ...]
  mentionEnabled: false,
  mentionMessage: 'Merhaba {user}, nasil yardimci olabilirim?',
  mentionMediaUrl: null,
  mentionTriggers: [], // [{ trigger: 'naber', response: 'iyi' }, ...] - bot etiketlenip/yanitlanip bu yazilirsa ozel cevap
  autoRoleEnabled: false,
  autoRoleId: null, // oyuncu (insan) uyelere verilecek rol
  autoRoleBotId: null, // bot uyelere verilecek rol
  copyChannels: [], // [{ sourceChannelId, targetChannelId }, ...] - /copy ile acilan kopyalama modlari
  vcChannelId: null, // /vcc ile ayarlanan, bot acilista otomatik girecegi ses kanali
  activityTriggers: [], // [{ watchId, watchType: 'category'|'channel', notifyChannelId, message, newChannelMessage, cooldownSeconds }, ...]
  channelBips: [], // [{ channelId, message }, ...] - yeni uye katilinca bu kanallara mesaj atilir
  askPermChannelId: null, // /askperm: izin isteklerinin gönderileceği kanal
  askPermRoleId: null, // /askperm: kararı verebilecek kurucu rolü
  askPermBotEnabled: true, // bot eklenince izin iste
  askPermRoleEnabled: true, // rol verilince izin iste
  tagRoleId: null, // /settag: sunucu etiketini takana verilecek rol
  tagChannelId: null, // /settag: rol verilince üyenin etiketlenip mesajın silineceği kanal
};

async function getConfig(guildId) {
  const db = getDb();
  const config = await db.collection('guildConfig').findOne({ guildId });
  return { guildId, ...DEFAULT_CONFIG, ...(config || {}) };
}

async function setConfig(guildId, update) {
  const db = getDb();
  await db.collection('guildConfig').updateOne({ guildId }, { $set: update }, { upsert: true });
}

// Ayni tetikleyici (buyuk/kucuk harf onemsiz) varsa cevabini gunceller, yoksa yenisini ekler.
// cooldownSeconds: ayni kullanici ayni tetikleyiciyi bu sure dolmadan tekrar yazarsa,
// bot cevabi tekrar vermez, bunun yerine kac saniye kaldigini soyler (spam onleme).
async function upsertAutoResponse(guildId, trigger, response, mediaUrl = null, cooldownSeconds = 3) {
  const config = await getConfig(guildId);
  const normalized = trigger.trim();
  const list = config.autoResponses.filter(r => r.trigger.toLowerCase() !== normalized.toLowerCase());
  list.push({ trigger: normalized, response: response || '', mediaUrl: mediaUrl || null, cooldownSeconds: cooldownSeconds || 3 });
  await setConfig(guildId, { autoResponses: list });
  return list;
}

async function removeAutoResponse(guildId, trigger) {
  const config = await getConfig(guildId);
  const list = config.autoResponses.filter(r => r.trigger.toLowerCase() !== trigger.toLowerCase());
  await setConfig(guildId, { autoResponses: list });
  return list;
}

// Ayni tetikleyici (buyuk/kucuk harf onemsiz) varsa cevabini gunceller, yoksa yenisini ekler.
async function upsertMentionTrigger(guildId, trigger, response, mediaUrl = null) {
  const config = await getConfig(guildId);
  const normalized = trigger.trim();
  const list = config.mentionTriggers.filter(r => r.trigger.toLowerCase() !== normalized.toLowerCase());
  list.push({ trigger: normalized, response: response || '', mediaUrl: mediaUrl || null });
  await setConfig(guildId, { mentionTriggers: list });
  return list;
}

async function removeMentionTrigger(guildId, trigger) {
  const config = await getConfig(guildId);
  const list = config.mentionTriggers.filter(r => r.trigger.toLowerCase() !== trigger.toLowerCase());
  await setConfig(guildId, { mentionTriggers: list });
  return list;
}

// Kaynak kanalda yaziyi hedef kanala kopyalamayi acar (varsa gunceller).
async function setCopyChannel(guildId, sourceChannelId, targetChannelId) {
  const config = await getConfig(guildId);
  const list = config.copyChannels.filter(c => c.sourceChannelId !== sourceChannelId);
  list.push({ sourceChannelId, targetChannelId });
  await setConfig(guildId, { copyChannels: list });
  return list;
}

async function removeCopyChannel(guildId, sourceChannelId) {
  const config = await getConfig(guildId);
  const list = config.copyChannels.filter(c => c.sourceChannelId !== sourceChannelId);
  await setConfig(guildId, { copyChannels: list });
  return list;
}

// Ayni hedefi (watchId) izleyen tetikleyici varsa gunceller, yoksa yenisini ekler.
async function upsertActivityTrigger(guildId, trigger) {
  const config = await getConfig(guildId);
  const list = config.activityTriggers.filter(t => t.watchId !== trigger.watchId);
  list.push(trigger);
  await setConfig(guildId, { activityTriggers: list });
  return list;
}

async function removeActivityTrigger(guildId, watchId) {
  const config = await getConfig(guildId);
  const list = config.activityTriggers.filter(t => t.watchId !== watchId);
  await setConfig(guildId, { activityTriggers: list });
  return list;
}

// Ayni kanal (channelId) icin varsa mesaji gunceller, yoksa yenisini ekler.
async function upsertChannelBip(guildId, channelId, message) {
  const config = await getConfig(guildId);
  const list = config.channelBips.filter(c => c.channelId !== channelId);
  list.push({ channelId, message });
  await setConfig(guildId, { channelBips: list });
  return list;
}

async function removeChannelBip(guildId, channelId) {
  const config = await getConfig(guildId);
  const list = config.channelBips.filter(c => c.channelId !== channelId);
  await setConfig(guildId, { channelBips: list });
  return list;
}

module.exports = {
  getConfig,
  setConfig,
  upsertAutoResponse,
  removeAutoResponse,
  upsertMentionTrigger,
  removeMentionTrigger,
  setCopyChannel,
  removeCopyChannel,
  upsertActivityTrigger,
  removeActivityTrigger,
  upsertChannelBip,
  removeChannelBip,
};