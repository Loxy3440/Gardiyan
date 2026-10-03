const { getDueTempRoles, removeTempRole } = require('../utils/tempRoles');
const { deleteExpiredWarns } = require('../utils/warns');
const { getConfig } = require('../utils/guildConfig');
const { connectToVoice } = require('../utils/voiceConnection');
const { infoEmbed } = require('../utils/embeds');
const { startActivityRotation } = require('../utils/activityRotator');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`Giris yapildi: ${client.user.tag}`);
    console.log(`[LATENCY] Gateway ping: ${Math.round(client.ws.ping)}ms`);
    await startActivityRotation(client);

    // /vcc ile ayarlanmis ses kanali varsa, her sunucuda bota otomatik baglan (mikrofon+kulaklik kapali).
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await getConfig(guild.id);
        if (!config.vcChannelId) continue;

        const channel = guild.channels.cache.get(config.vcChannelId);
        if (!channel || !channel.isVoiceBased()) continue;

        connectToVoice(channel);
      } catch (err) {
        console.error('[VCC AUTOJOIN]', guild.id, err.message);
      }
    }

    // Suresi dolan gecici rolleri her 5 saniyede bir kontrol et.
    // Not: normalde rolver.js komutu kendi canli sayaciyla rolu zamaninda alir ve
    // bildirim atar. Bu scheduler, bot yeniden baslatildiysa (canli sayac kaybolduysa)
    // veya baska bir sebeple rol zamaninda alinamadiysa devreye giren bir guvenlik agi.
    setInterval(async () => {
      try {
        const due = await getDueTempRoles();
        for (const entry of due) {
          const guild = client.guilds.cache.get(entry.guildId);
          if (!guild) {
            await removeTempRole(entry.guildId, entry.userId, entry.roleId);
            continue;
          }

          const member = await guild.members.fetch(entry.userId).catch(() => null);
          if (member) {
            await member.roles.remove(entry.roleId, 'Gecici rol suresi doldu').catch(() => {});
          }

          await removeTempRole(entry.guildId, entry.userId, entry.roleId);

          // Rolu alan komutun kendi canli sayaci zaten bildirim atmis olabilir,
          // ama bot yeniden baslatildiysa (sayac kaybolduysa) bildirimi burada atariz.
          if (entry.channelId) {
            const channel = guild.channels.cache.get(entry.channelId);
            if (channel && member) {
              const role = guild.roles.cache.get(entry.roleId);
              const embed = infoEmbed('Sure Doldu - Rol Alindi', `**${member.user.tag}** kullanicisindan **${role ? role.name : 'rol'}** rolu, suresi doldugu icin geri alindi.`)
                .setTimestamp();
              await channel.send({ embeds: [embed] }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('[TEMP ROLE SCHEDULER]', err);
      }
    }, 5000);

    // Suresi dolan (2 gunden eski) uyarilari her 1 dakikada bir sil.
    setInterval(async () => {
      try {
        await deleteExpiredWarns();
      } catch (err) {
        console.error('[WARN EXPIRY SCHEDULER]', err);
      }
    }, 60_000);
  },
};