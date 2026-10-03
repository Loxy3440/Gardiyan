const { getConfig } = require('../utils/guildConfig');

// /trigger icin bellek-ici bekleme (cooldown) takibi. Bot yeniden baslatilinca sifirlanir, bu kasitli.
const triggerCooldowns = new Map(); // key: `${guildId}:${watchId}` -> son gonderim zamani (ms)

module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    try {
      if (message.author.bot || !message.guild) return;

      const config = await getConfig(message.guild.id);

      // ---------- /copy: bu kanaldaki yaziyi baska bir kanala kopyala ----------
      const copyEntry = config.copyChannels?.find(c => c.sourceChannelId === message.channel.id);
      if (copyEntry) {
        const targetChannel = message.guild.channels.cache.get(copyEntry.targetChannelId);
        if (targetChannel) {
          const fileUrls = message.attachments.map(a => a.url);
          await targetChannel
            .send({
              content: `**${message.author.tag}:** ${message.content || ''}`.trim(),
              files: fileUrls.length ? fileUrls : undefined,
            })
            .catch(() => {});
        }
      }

      // ---------- /trigger: izlenen kategori/kanalda hareketlilik olunca bildirim gonder ----------
      if (config.activityTriggers?.length) {
        const matching = config.activityTriggers.find(t =>
          t.watchType === 'category' ? message.channel.parentId === t.watchId : t.watchId === message.channel.id,
        );

        if (matching) {
          const key = `${message.guild.id}:${matching.watchId}`;
          const lastSent = triggerCooldowns.get(key) || 0;
          const now = Date.now();

          if (now - lastSent >= (matching.cooldownSeconds || 600) * 1000) {
            triggerCooldowns.set(key, now);

            const notifyChannel = message.guild.channels.cache.get(matching.notifyChannelId);
            if (notifyChannel) {
              const text = (matching.message || '')
                .replace(/{kanal}/g, `<#${message.channel.id}>`)
                .replace(/{user}/g, `<@${message.author.id}>`)
                .replace(/{server}/g, message.guild.name);

              if (text) await notifyChannel.send({ content: text }).catch(() => {});
            }
          }
        }
      }

      // ---------- BOT ETIKETLENIRSE VEYA BOTUN MESAJINA YANIT VERILIRSE ----------
      const mentioned = message.mentions.has(message.client.user) && !message.mentions.everyone;
      let isReplyToBot = false;

      if (!mentioned && message.reference?.messageId) {
        const replied = await message.fetchReference().catch(() => null);
        isReplyToBot = replied?.author?.id === message.client.user.id;
      }

      if (mentioned || isReplyToBot) {
        const prompt = message.content.replace(/<@!?\d+>/g, '').trim().toLowerCase();

        // Once: bot etiketlenip/yanitlanip belirli bir sey yazilirsa -> /setmention ile tanimli ozel cevap
        const specific = prompt
          ? config.mentionTriggers?.find(r => r.trigger.trim().toLowerCase() === prompt)
          : null;

        if (specific) {
          const parts = [];
          if (specific.response) parts.push(specific.response);
          if (specific.mediaUrl) parts.push(specific.mediaUrl);
          if (parts.length) {
            await message.reply({ content: parts.join('\n') }).catch(() => {});
          }
          return;
        }

        // Ozel bir tetikleyici yoksa -> /mention ile ayarlanan genel cevap (ikisi ayni anda calismaz)
        if (config.mentionEnabled) {
          const text = (config.mentionMessage || '')
            .replace(/{user}/g, `<@${message.author.id}>`)
            .replace(/{server}/g, message.guild.name);

          const parts = [];
          if (text) parts.push(text);
          if (config.mentionMediaUrl) parts.push(config.mentionMediaUrl);

          if (parts.length) {
            await message.reply({ content: parts.join('\n') }).catch(() => {});
          }
        }
        return;
      }

      // ---------- OTOMATIK MESAJ (TETIKLEYICI -> CEVAP) ----------
      if (!config.autoResponses || !config.autoResponses.length) return;

      const content = message.content.trim().toLowerCase();
      if (!content) return;

      const match = config.autoResponses.find(r => r.trigger.trim().toLowerCase() === content);
      if (!match) return;

      const parts = [];
      if (match.response) parts.push(match.response);
      if (match.mediaUrl) parts.push(match.mediaUrl);
      if (!parts.length) return;

      await message.channel.send({ content: parts.join('\n') }).catch(() => {});
    } catch (err) {
      console.error('[messageCreate]', err);
    }
  },
};