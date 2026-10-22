const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('./guildConfig');

// Log kanalına giden işlem türleri: başlık + renk
const ACTIONS = {
  mute: { title: '🔇 Mute', color: 0xe67e22 },
  unmute: { title: '🔊 Unmute', color: 0x57f287 },
  ban: { title: '🔨 Ban', color: 0xed4245 },
  unban: { title: '♻️ Unban', color: 0x57f287 },
  kick: { title: '👢 Kick', color: 0xe67e22 },
  promote: { title: '⬆️ Promote', color: 0x3ba55d },
  demote: { title: '⬇️ Demote', color: 0xfaa61a },
  addnick: { title: '🏷️ Toplu Takma Ad', color: 0x5865f2 },
};

// Bir moderasyon işlemini ayarlı log kanalına yazar. Kanal yoksa/yazılamazsa sessizce geçer (komutu bozmaz).
// opts: { action, target (User|Member|{id,tag}), moderator (User), reason, fields: [{name,value,inline}], imageUrl, fromPanel }
async function logAction(guild, opts) {
  try {
    if (!guild) return false;
    const config = await getConfig(guild.id);
    if (!config.logChannelId) return false;
    const channel = guild.channels.cache.get(config.logChannelId) || (await guild.channels.fetch(config.logChannelId).catch(() => null));
    if (!channel || !channel.isTextBased()) return false;

    const meta = ACTIONS[opts.action] || { title: opts.action, color: 0x99aab5 };
    const embed = new EmbedBuilder().setTitle(meta.title).setColor(meta.color).setTimestamp();

    const t = opts.target?.user || opts.target;
    if (t) embed.addFields({ name: 'Hedef', value: `${t.tag || t.username || t.id} (<@${t.id}>)`, inline: true });
    const m = opts.moderator?.user || opts.moderator;
    if (m) embed.addFields({ name: 'Yetkili', value: `${m.tag || m.username} (<@${m.id}>)`, inline: true });
    embed.addFields({ name: 'Kaynak', value: opts.fromPanel ? '🌐 Web paneli' : '💬 Discord', inline: true });
    if (opts.reason) embed.addFields({ name: 'Sebep', value: String(opts.reason).slice(0, 1000) });
    for (const f of opts.fields || []) embed.addFields({ name: f.name, value: String(f.value).slice(0, 1000), inline: !!f.inline });
    if (opts.imageUrl) embed.setImage(opts.imageUrl);

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return true;
  } catch (err) {
    console.error('[MODLOG]', err.message);
    return false;
  }
}

module.exports = { logAction, ACTIONS };
