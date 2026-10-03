const { getActivityConfig } = require('./activityConfig');

// Discord.js ActivityType degerleri: Playing=0, Listening=2, Watching=3, Competing=5
const TYPE_MAP = {
  PLAYING: 0,
  LISTENING: 2,
  WATCHING: 3,
  COMPETING: 5,
};

let rotateTimer = null;
let rotateIndex = 0;

function applyOne(client, entry) {
  if (!client.user) return;
  client.user.setActivity(entry.text, { type: TYPE_MAP[entry.type] ?? 3 });
}

// Kaydedilen aktivite listesini/suresini okuyup uygular ve gerekirse donguyu (rotation) yeniden baslatir.
// /setactivity komutundan bir degisiklik yapildiginda veya bot acilirken cagrilir.
async function startActivityRotation(client) {
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
  rotateIndex = 0;

  let config;
  try {
    config = await getActivityConfig();
  } catch (err) {
    console.error('[ACTIVITY] Config okunamadi, varsayilan kullaniliyor:', err.message);
    client.user.setActivity('/help', { type: 3 });
    return;
  }

  if (!config.list.length) {
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

module.exports = { startActivityRotation, TYPE_MAP };