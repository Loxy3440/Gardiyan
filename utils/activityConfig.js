const { getDb } = require('./db');

// Bu ayar tum sunucular icin gecerlidir (Discord presence/activity bot bazlidir, sunucu bazli degil).
const DOC_ID = 'activity';

const DEFAULT_ACTIVITY_CONFIG = {
  list: [], // [{ type: 'PLAYING'|'WATCHING'|'LISTENING'|'COMPETING', text: '/help' }, ...]
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

async function addActivity(type, text) {
  const config = await getActivityConfig();
  const list = [...config.list, { type, text }];
  await setActivityConfig({ list });
  return list;
}

async function removeActivity(index) {
  const config = await getActivityConfig();
  const list = config.list.filter((_, i) => i !== index);
  await setActivityConfig({ list });
  return list;
}

module.exports = { getActivityConfig, setActivityConfig, addActivity, removeActivity };