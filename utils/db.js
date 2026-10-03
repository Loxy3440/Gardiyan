const { MongoClient } = require('mongodb');

let client;
let db;

async function connectDB() {
  if (db) return db;
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.MONGO_DB_NAME || 'discordbot');
  console.log('[MONGODB] Baglanti basarili.');
  return db;
}

function getDb() {
  if (!db) throw new Error('Veritabani henuz baglanmadi. Once connectDB() cagirilmali.');
  return db;
}

module.exports = { connectDB, getDb };