const { getDb } = require('./db');

// Bu ayar tum sunucular icin gecerlidir (Discord presence/activity bot bazlidir, sunucu bazli degil).
const DOC_ID = 'activity';

const DEFAULT_ACTIVITY_CONFIG = {
  list: [], // [{ type: 'PLAYING'|'WATCHING'|'LISTENING'|'COMPETING'|'STREAMING', text: '/help', url?: 'https://twitch.tv/...' }, ...]
  intervalSeconds: 15,
};

async function getActivityConfig() {
  const db = getDb();
  const config = await db.collection('botConfig').findOne({ _id: DOC_ID });
  return { ...DEFAULT_ACTIVITY_CONFIG, ...(config || {}) };
}

async function setActivityConfig(update) {
  const db = getDb();
  await db.collection('botConfig').updateOne({ _id: DOC_ID }, { $set: update }, { upsert: true });
}

// Streaming (Yayinda) durumu icin Discord sadece Twitch veya YouTube adresi kabul eder.
function isStreamUrl(url) {
  return /^https:\/\/(www\.|m\.)?(twitch\.tv|youtube\.com|youtu\.be)\/\S+$/i.test(String(url || '').trim());
}

async function addActivity(type, text, url = null) {
  const config = await getActivityConfig();
  const entry = { type, text };
  if (type === 'STREAMING') entry.url = String(url).trim();
  const list = [...config.list, entry];
  await setActivityConfig({ list });
  return list;
}

async function removeActivity(index) {
  const config = await getActivityConfig();
  const list = config.list.filter((_, i) => i !== index);
  await setActivityConfig({ list });
  return list;
}

module.exports = { getActivityConfig, setActivityConfig, addActivity, removeActivity, isStreamUrl };