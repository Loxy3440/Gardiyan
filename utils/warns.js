const { getDb } = require('./db');

async function nextCaseNumber(guildId) {
  const db = getDb();
  const last = await db.collection('warns').find({ guildId }).sort({ caseNumber: -1 }).limit(1).toArray();
  return last.length ? last[0].caseNumber + 1 : 1;
}

async function addWarn(guildId, userId, moderatorId, reason) {
  const db = getDb();
  const caseNumber = await nextCaseNumber(guildId);

  const warn = {
    guildId,
    userId,
    moderatorId,
    reason,
    caseNumber,
    timestamp: new Date(),
  };

  await db.collection('warns').insertOne(warn);
  return warn;
}

async function getWarns(guildId, userId) {
  const db = getDb();
  return db.collection('warns').find({ guildId, userId }).sort({ timestamp: -1 }).toArray();
}

module.exports = { addWarn, getWarns };