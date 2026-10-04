const { getDb } = require('./db');

// Aktif (kazanani beklenen) eventler bellekte tutulur: channelId -> event.
// Boylece her mesajda veritabanina gitmeden hizlica kontrol edilir.
const activeByChannel = new Map();

function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

function applyPlaceholders(text, { user, server, channel }) {
  return String(text || '')
    .replace(/{user}/g, user)
    .replace(/{server}/g, server)
    .replace(/{kanal}/g, channel);
}

async function createEvent({ guildId, channelIds, announcement, word, winMessage, sendAt, createdBy }) {
  const db = getDb();
  const doc = {
    guildId,
    channelIds,
    announcement,
    word,
    winMessage,
    sendAt,
    createdBy,
    status: 'scheduled', // scheduled -> sending -> active -> finished | failed
    createdAt: new Date(),
  };
  const result = await db.collection('events').insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

// Zamani gelen eventleri tek tek "sending" durumuna alir (ayni event iki kez gonderilmesin diye atomik).
async function claimDueEvents() {
  const db = getDb();
  const claimed = [];
  while (true) {
    const ev = await db.collection('events').findOneAndUpdate(
      { status: 'scheduled', sendAt: { $lte: new Date() } },
      { $set: { status: 'sending' } },
      { returnDocument: 'after' },
    );
    if (!ev) break;
    claimed.push(ev);
  }
  return claimed;
}

async function setEventStatus(id, fields) {
  const db = getDb();
  await db.collection('events').updateOne({ _id: id }, { $set: fields });
}

// Bot acilisinda: aktif eventleri belleğe yukle, yarida kalan "sending" eventleri tekrar siraya al.
async function loadActiveEvents() {
  const db = getDb();
  await db.collection('events').updateMany({ status: 'sending' }, { $set: { status: 'scheduled' } });
  const active = await db.collection('events').find({ status: 'active' }).toArray();
  activeByChannel.clear();
  for (const ev of active) activeByChannel.set(ev.activeChannelId, ev);
  return active.length;
}

function getActiveEvent(channelId) {
  return activeByChannel.get(channelId) || null;
}

function isWinningMessage(event, content) {
  return normalize(content) === normalize(event.word);
}

// Ilk yazani belirler: sadece durumu hala "active" olan event kazanan alabilir (yaris durumuna karsi atomik).
async function claimWinner(event, userId) {
  const db = getDb();
  const won = await db.collection('events').findOneAndUpdate(
    { _id: event._id, status: 'active' },
    { $set: { status: 'finished', winnerId: userId, finishedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (activeByChannel.get(event.activeChannelId)?._id?.equals?.(event._id)) {
    activeByChannel.delete(event.activeChannelId);
  }
  return won;
}

// Zamani gelen eventleri gonderir: kanallar arasindan rastgele birini secer.
async function runDueEvents(client) {
  const due = await claimDueEvents();

  for (const ev of due) {
    const guild = client.guilds.cache.get(ev.guildId);
    if (!guild) {
      await setEventStatus(ev._id, { status: 'failed', failReason: 'Sunucu bulunamadi' });
      continue;
    }

    // Rastgele siralama: ilk secilen kanala gonderilemezse siradakini dene.
    const shuffled = [...ev.channelIds].sort(() => Math.random() - 0.5);
    let sentChannel = null;
    let sentMessage = null;

    for (const channelId of shuffled) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) continue;
      try {
        sentMessage = await channel.send({ content: `${ev.announcement}\n**${ev.word}**` });
        sentChannel = channel;
        break;
      } catch (err) {
        console.error('[EVENT] Kanala gonderilemedi:', channelId, err.message);
      }
    }

    if (!sentChannel) {
      await setEventStatus(ev._id, { status: 'failed', failReason: 'Hicbir kanala mesaj gonderilemedi' });
      continue;
    }

    const activeEvent = { ...ev, status: 'active', activeChannelId: sentChannel.id, messageId: sentMessage.id };
    activeByChannel.set(sentChannel.id, activeEvent); // once bellege, sonra DB'ye (hizli yazan kacirilmasin)
    await setEventStatus(ev._id, {
      status: 'active',
      activeChannelId: sentChannel.id,
      messageId: sentMessage.id,
      startedAt: new Date(),
    });
    console.log(`[EVENT] Basladi: ${guild.name} #${sentChannel.name} (kelime: ${ev.word})`);
  }
}

module.exports = {
  createEvent,
  loadActiveEvents,
  runDueEvents,
  getActiveEvent,
  isWinningMessage,
  claimWinner,
  applyPlaceholders,
};