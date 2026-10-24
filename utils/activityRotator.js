const { getActivityConfig } = require('./activityConfig');

// Discord.js ActivityType degerleri: Playing=0, Streaming=1, Listening=2, Watching=3, Competing=5
const TYPE_MAP = {
  PLAYING: 0,
  STREAMING: 1,
  LISTENING: 2,
  WATCHING: 3,
  COMPETING: 5,
  CUSTOM: 4, // özel durum yazısı ("Oynuyor" gibi bir ön ek olmadan sadece metin)
};

let rotateTimer = null;
let refreshTimer = null;
let rotateIndex = 0;
let currentEntry = null;
let currentRendered = null;
let currentStatus = 'online';

// Üye sayısı hangi sunucudan okunacak (.env STATS_GUILD_ID ile değiştirilebilir).
const STATS_GUILD_ID = process.env.STATS_GUILD_ID || '1554352519084253265';

function getMemberCount(client) {
  const guild = client.guilds.cache.get(STATS_GUILD_ID);
  if (guild) return guild.memberCount;
  // Bot o sunucuda değilse tüm sunucuların toplamını göster.
  return client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
}

// Aktivite metnindeki {uye} / {members} / {sunucu} yer tutucularını anlık değerle değiştirir.
function renderText(client, text) {
  return String(text)
    .replace(/\{(uye|members)\}/gi, getMemberCount(client).toLocaleString('tr-TR'))
    .replace(/\{(sunucu|guilds)\}/gi, String(client.guilds.cache.size));
}

function applyOne(client, entry) {
  if (!client.user) return;
  currentEntry = entry;
  currentRendered = { type: entry.type, text: renderText(client, entry.text) };
  if (entry.type === 'CUSTOM') {
    client.user.setPresence({ activities: [{ name: 'Custom Status', type: 4, state: renderText(client, entry.text) }], status: currentStatus });
    return;
  }
  const options = { type: TYPE_MAP[entry.type] ?? 3 };
  if (entry.type === 'STREAMING') {
    if (entry.url) options.url = entry.url; // url yoksa Discord normal "Oynuyor" gibi gosterir
  }
  client.user.setActivity(renderText(client, entry.text), options);
}

// Üye katılıp/ayrılınca ve düzenli aralıkla çağrılır: şu an gösterilen aktiviteyi güncel sayıyla yeniler.
function refreshActivity(client) {
  if (currentEntry && /\{(uye|members|sunucu|guilds)\}/i.test(currentEntry.text)) applyOne(client, currentEntry);
}

// Kaydedilen aktivite listesini/suresini okuyup uygular ve gerekirse donguyu (rotation) yeniden baslatir.
// /setactivity komutundan bir degisiklik yapildiginda veya bot acilirken cagrilir.
async function startActivityRotation(client) {
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
  rotateIndex = 0;
  currentEntry = null;

  if (!refreshTimer) {
    refreshTimer = setInterval(() => refreshActivity(client), 60_000);
    refreshTimer.unref?.();
  }

  let config;
  try {
    config = await getActivityConfig();
    currentStatus = config.status || 'online';
    client.user.setStatus(currentStatus);
  } catch (err) {
    console.error('[ACTIVITY] Config okunamadi, varsayilan kullaniliyor:', err.message);
    client.user.setActivity('/help', { type: 3 });
    return;
  }

  if (!config.list.length) {
    currentRendered = { type: 'WATCHING', text: '/help' };
    client.user.setActivity('/help', { type: 3 }); // varsayilan
    return;
  }

  applyOne(client, config.list[0]);

  if (config.list.length > 1) {
    const intervalMs = Math.max(5, config.intervalSeconds || 15) * 1000;
    rotateTimer = setInterval(async () => {
      try {
        const cfg = await getActivityConfig();
        if (!cfg.list.length) return;
        rotateIndex = (rotateIndex + 1) % cfg.list.length;
        applyOne(client, cfg.list[rotateIndex]);
      } catch (err) {
        console.error('[ACTIVITY] Dongu hatasi:', err.message);
      }
    }, intervalMs);
  }
}

// Panelden (veya komutla) botun durumunu değiştirir; ayar veritabanına yazılır, bot yeniden başlasa da korunur.
function setBotStatus(client, status) {
  currentStatus = status;
  client.user?.setStatus(status);
}

// Panelde gösterilecek anlık görünüm.
function getPresenceView(client) {
  return {
    status: currentStatus,
    activity: currentRendered,
    bot: client.user ? { name: client.user.username, avatar: client.user.displayAvatarURL({ size: 128 }) } : null,
  };
}

module.exports = { setBotStatus, getPresenceView, startActivityRotation, refreshActivity, getMemberCount, STATS_GUILD_ID, TYPE_MAP };