const { getDb } = require('./db');
const { ObjectId } = require('mongodb');

async function addPrivateMessage(guildId, senderId, targetId, content, attachmentUrl, attachmentType) {
  const db = getDb();
  const doc = {
    guildId,
    senderId,
    targetId,
    content: content || null,
    attachmentUrl: attachmentUrl || null,
    attachmentType: attachmentType || null,
    createdAt: new Date(),
  };
  const result = await db.collection('privateMessages').insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function getPrivateMessage(id) {
  const db = getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection('privateMessages').findOne({ _id: new ObjectId(id) });
}

module.exports = { addPrivateMessage, getPrivateMessage };