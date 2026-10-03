const { EmbedBuilder } = require('discord.js');

const KNOWN_KEYS = ['content', 'title', 'description', 'footer', 'image'];
const KEY_LINE_REGEX = /^(content|title|description|footer|image)\s*:\s*(.*)$/i;

// "content: Hos geldin {user}!\ntitle: Yeni Uye\nfooter: {server}" gibi bir metni
// { content, title, description, footer, image } parcalarina ayirir.
// Hicbir etiket kullanilmamissa (eski sistemdeki gibi duz yazi), tamamini content sayar.
function parseTemplate(text) {
  const lines = text.split(/\r?\n/);
  const result = {};
  let currentKey = null;
  let foundAnyKey = false;

  for (const line of lines) {
    const match = KEY_LINE_REGEX.exec(line);
    if (match) {
      foundAnyKey = true;
      currentKey = match[1].toLowerCase();
      result[currentKey] = match[2];
    } else if (currentKey) {
      result[currentKey] += (result[currentKey] ? '\n' : '') + line;
    }
  }

  if (!foundAnyKey) {
    return { content: text.trim() };
  }

  for (const key of KNOWN_KEYS) {
    if (result[key] !== undefined) result[key] = result[key].trim();
  }

  return result;
}

function applyVariables(text, vars) {
  if (!text) return text;
  return text.replaceAll('{user}', vars.user).replaceAll('{server}', vars.server);
}

// Ham sablon metnini, degiskenleri (user/server) yerine koyup Discord mesaj payload'una cevirir.
// { content?, embeds? } dondurur - dogrudan channel.send()'e verilebilir.
function renderTemplate(rawText, vars) {
  const replaced = applyVariables(rawText, vars);
  const parsed = parseTemplate(replaced);

  const payload = {};
  if (parsed.content) payload.content = parsed.content;

  const hasEmbedFields = parsed.title || parsed.description || parsed.footer || parsed.image;
  if (hasEmbedFields) {
    const embed = new EmbedBuilder().setColor(0x5865f2);
    if (parsed.title) embed.setTitle(parsed.title.slice(0, 256));
    if (parsed.description) embed.setDescription(parsed.description.slice(0, 4000));
    if (parsed.footer) embed.setFooter({ text: parsed.footer.slice(0, 2048) });
    if (parsed.image) embed.setImage(parsed.image);
    payload.embeds = [embed];
  }

  if (!payload.content && !payload.embeds) {
    payload.content = replaced;
  }

  return payload;
}

module.exports = { parseTemplate, renderTemplate };