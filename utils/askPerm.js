const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AuditLogEvent,
  ChannelType,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getConfig, setConfig } = require('./guildConfig');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------- Botun kendi komutlarıyla verilen roller ----------
// Denetim kaydında rolü veren olarak botun kendisi görünür. Rolü gerçekte kimin istediğini
// bilebilmek için /rolver, /promote, /klan komutları rolü vermeden hemen önce buraya kayıt bırakır.
// Otorol gibi sistem işlemleri ise botun kendi ID'siyle kaydedilir ve izin istenmez.
const commandGrants = new Map(); // `${guildId}:${userId}:${roleId}` -> rolü isteyen kişinin ID'si

function registerCommandGrant(guildId, userId, roleId, invokerId) {
  const key = `${guildId}:${userId}:${roleId}`;
  commandGrants.set(key, invokerId);
  setTimeout(() => commandGrants.delete(key), 30_000);
}

function takeCommandGrant(guildId, userId, roleId) {
  const key = `${guildId}:${userId}:${roleId}`;
  const invokerId = commandGrants.get(key) || null;
  commandGrants.delete(key);
  return invokerId;
}

// ---------- Yardımcılar ----------
function isActive(config) {
  return Boolean(config.askPermChannelId && config.askPermRoleId);
}

async function getRequestChannel(guild, config) {
  const channel =
    guild.channels.cache.get(config.askPermChannelId) ||
    (await guild.channels.fetch(config.askPermChannelId).catch(() => null));
  return channel && channel.isTextBased() ? channel : null;
}

// Sunucu sahibi ve kurucu rolündekiler kendi işlemleri için izin beklemez.
async function isExempt(guild, userId, config) {
  if (userId === guild.ownerId) return true;
  const member = await guild.members.fetch(userId).catch(() => null);
  return Boolean(member && member.roles.cache.has(config.askPermRoleId));
}

async function findBotAdder(guild, botId) {
  await sleep(1500); // denetim kaydının oluşması için kısa bir bekleme
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
    const entry = logs.entries.find(e => e.target?.id === botId && Date.now() - e.createdTimestamp < 30_000);
    return entry?.executor ?? null;
  } catch {
    return null;
  }
}

async function findRoleExecutor(guild, userId, roleId) {
  await sleep(1500);
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 8 });
    const entry = logs.entries.find(
      e =>
        e.target?.id === userId &&
        Date.now() - e.createdTimestamp < 30_000 &&
        e.changes.some(c => c.key === '$add' && Array.isArray(c.new) && c.new.some(r => r.id === roleId)),
    );
    return entry?.executor ?? null;
  } catch {
    return null;
  }
}

// ---------- İstek mesajları (saf fonksiyonlar) ----------
function decisionRow(customIdSuffix) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`askperm_${customIdSuffix.replace('{d}', 'yes')}`).setLabel('Evet').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`askperm_${customIdSuffix.replace('{d}', 'no')}`).setLabel('Hayır').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
}

function buildBotRequest({ botId, botTag, botAvatarUrl, createdTimestamp, adderId, founderRoleId }) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Ekleme İzni')
    .setColor(0xe67e22)
    .setThumbnail(botAvatarUrl)
    .setDescription('Sunucuya yeni bir bot eklendi. Bu botun sunucuda kalmasına izin veriyor musunuz?')
    .addFields(
      { name: 'Bot', value: `${botTag} (<@${botId}>)`, inline: true },
      { name: 'Ekleyen', value: adderId ? `<@${adderId}>` : 'Bilinmiyor', inline: true },
      { name: 'Hesap Oluşturulma', value: `<t:${Math.floor(createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: 'Kararı yalnızca kurucu rolündekiler verebilir.' })
    .setTimestamp();

  return {
    content: `<@&${founderRoleId}>`,
    embeds: [embed],
    components: [decisionRow(`bot_{d}_${botId}`)],
    allowedMentions: { roles: [founderRoleId] },
  };
}

function buildRoleRequest({ userId, roleId, executorId, founderRoleId }) {
  const embed = new EmbedBuilder()
    .setTitle('🏷️ Rol Verme İzni')
    .setColor(0xe67e22)
    .setDescription('Bir üyeye rol verildi. Bu rolün verilmesine izin veriyor musunuz?')
    .addFields(
      { name: 'Üye', value: `<@${userId}>`, inline: true },
      { name: 'Rol', value: `<@&${roleId}>`, inline: true },
      { name: 'Veren', value: executorId ? `<@${executorId}>` : 'Bilinmiyor', inline: true },
    )
    .setFooter({ text: 'Kararı yalnızca kurucu rolündekiler verebilir.' })
    .setTimestamp();

  return {
    content: `<@&${founderRoleId}>`,
    embeds: [embed],
    components: [decisionRow(`role_{d}_${userId}_${roleId}`)],
    allowedMentions: { roles: [founderRoleId] },
  };
}

// ---------- Olay girişleri ----------
// Sunucuya bir bot katıldığında çağrılır (normal üyeler için izin istenmez).
async function handleBotJoin(member) {
  if (!member.user.bot || member.id === member.client.user.id) return;

  const config = await getConfig(member.guild.id);
  if (!isActive(config) || !config.askPermBotEnabled) return;

  const adder = await findBotAdder(member.guild, member.id);
  if (adder && (await isExempt(member.guild, adder.id, config))) return;

  const channel = await getRequestChannel(member.guild, config);
  if (!channel) return;

  await channel.send(
    buildBotRequest({
      botId: member.id,
      botTag: member.user.tag,
      botAvatarUrl: member.user.displayAvatarURL(),
      createdTimestamp: member.user.createdTimestamp,
      adderId: adder?.id ?? null,
      founderRoleId: config.askPermRoleId,
    }),
  );
}

// Bir üyeye rol eklendiğinde çağrılır.
async function handleRoleUpdate(oldMember, newMember) {
  if (oldMember.partial) return;

  const added = newMember.roles.cache.filter(
    r => !oldMember.roles.cache.has(r.id) && !r.managed && r.id !== newMember.guild.id,
  );
  if (!added.size) return;

  const config = await getConfig(newMember.guild.id);
  if (!isActive(config) || !config.askPermRoleEnabled) return;

  const channel = await getRequestChannel(newMember.guild, config);
  if (!channel) return;

  const botId = newMember.client.user.id;

  for (const role of added.values()) {
    let executorId = takeCommandGrant(newMember.guild.id, newMember.id, role.id);

    if (!executorId) {
      const executor = await findRoleExecutor(newMember.guild, newMember.id, role.id);
      executorId = executor?.id ?? null;
    }

    if (executorId === botId) continue; // botun kendi sistem işlemi (otorol vb.)
    if (executorId && (await isExempt(newMember.guild, executorId, config))) continue;

    await channel.send(
      buildRoleRequest({
        userId: newMember.id,
        roleId: role.id,
        executorId,
        founderRoleId: config.askPermRoleId,
      }),
    );
  }
}

// ---------- Karar butonları ----------
async function decideBot(interaction, botId, approved) {
  const who = `<@${interaction.user.id}>`;

  if (approved) {
    return new EmbedBuilder()
      .setTitle('✅ Bot Onaylandı')
      .setColor(0x57f287)
      .setDescription(`<@${botId}> botunun sunucuda kalmasına ${who} izin verdi.`)
      .setTimestamp();
  }

  const botMember = await interaction.guild.members.fetch(botId).catch(() => null);
  let result;
  if (!botMember) {
    result = 'Bot zaten sunucuda değil.';
  } else {
    try {
      await botMember.kick(`İzin reddedildi - ${interaction.user.tag}`);
      result = 'Bot sunucudan atıldı.';
    } catch {
      result = 'Ancak bot sunucudan atılamadı. (Yetkimi ve rol sıramı kontrol et.)';
    }
  }

  return new EmbedBuilder()
    .setTitle('❌ Bot Reddedildi')
    .setColor(0xed4245)
    .setDescription(`<@${botId}> botu ${who} tarafından reddedildi. ${result}`)
    .setTimestamp();
}

async function decideRole(interaction, userId, roleId, approved) {
  const who = `<@${interaction.user.id}>`;

  if (approved) {
    return new EmbedBuilder()
      .setTitle('✅ Rol Onaylandı')
      .setColor(0x57f287)
      .setDescription(`<@&${roleId}> rolünün <@${userId}> üyesinde kalmasına ${who} izin verdi.`)
      .setTimestamp();
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  let result;
  if (!member) {
    result = 'Üye sunucuda olmadığı için geri alınacak bir şey yok.';
  } else if (!member.roles.cache.has(roleId)) {
    result = 'Üyede bu rol zaten yok.';
  } else {
    try {
      await member.roles.remove(roleId, `İzin reddedildi - ${interaction.user.tag}`);
      result = 'Rol üyeden geri alındı.';
    } catch {
      result = 'Ancak rol geri alınamadı. (Yetkimi ve rol sıramı kontrol et.)';
    }
  }

  return new EmbedBuilder()
    .setTitle('❌ Rol Reddedildi')
    .setColor(0xed4245)
    .setDescription(`<@&${roleId}> rolünün <@${userId}> üyesine verilmesi ${who} tarafından reddedildi. ${result}`)
    .setTimestamp();
}

async function handleDecision(interaction) {
  const parts = interaction.customId.split('_'); // askperm, bot|role, yes|no, ...ID'ler
  const kind = parts[1];
  const approved = parts[2] === 'yes';

  const config = await getConfig(interaction.guild.id);
  const isFounder = Boolean(config.askPermRoleId) && interaction.member.roles.cache.has(config.askPermRoleId);

  if (!isFounder) {
    return interaction.reply({ content: '🚫 Bu kararı yalnızca kurucu rolündekiler verebilir.', ephemeral: true });
  }

  await interaction.deferUpdate();

  let embed;
  if (kind === 'bot') embed = await decideBot(interaction, parts[3], approved);
  else if (kind === 'role') embed = await decideRole(interaction, parts[3], parts[4], approved);
  else return;

  await interaction.editReply({ content: '', embeds: [embed], components: [] });
}

// ---------- /askperm paneli ----------
async function handleAskPermInteraction(interaction) {
  const id = interaction.customId;
  if (!id || !id.startsWith('askperm_') || !interaction.guild) return false;

  if (interaction.isButton()) {
    await handleDecision(interaction);
    return true;
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '🚫 Bu paneli yalnızca yöneticiler kullanabilir.', ephemeral: true });
    return true;
  }

  const cmd = interaction.client.commands.get('askperm');
  const panel = async () => {
    const config = await getConfig(interaction.guild.id);
    return { embeds: [cmd.buildStatusEmbed(config)], components: [cmd.buildSelectRow()] };
  };

  if (interaction.isStringSelectMenu() && id === 'askperm_menu') {
    const selected = interaction.values[0];

    if (selected === 'set_channel') {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId('askperm_channel_select')
        .setPlaceholder('İzin istekleri hangi kanala gitsin?')
        .setChannelTypes(ChannelType.GuildText);
      await interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
      return true;
    }

    if (selected === 'set_role') {
      const menu = new RoleSelectMenuBuilder()
        .setCustomId('askperm_role_select')
        .setPlaceholder('Kurucu rolünü seç...');
      await interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
      return true;
    }

    if (selected === 'toggle_bot' || selected === 'toggle_role') {
      const config = await getConfig(interaction.guild.id);
      const field = selected === 'toggle_bot' ? 'askPermBotEnabled' : 'askPermRoleEnabled';
      await setConfig(interaction.guild.id, { [field]: !config[field] });
      await interaction.update(await panel());
      return true;
    }

    return true;
  }

  if (interaction.isChannelSelectMenu() && id === 'askperm_channel_select') {
    await setConfig(interaction.guild.id, { askPermChannelId: interaction.values[0] });
    await interaction.update(await panel());
    return true;
  }

  if (interaction.isRoleSelectMenu() && id === 'askperm_role_select') {
    await setConfig(interaction.guild.id, { askPermRoleId: interaction.values[0] });
    await interaction.update(await panel());
    return true;
  }

  return true;
}

module.exports = {
  registerCommandGrant,
  handleBotJoin,
  handleRoleUpdate,
  handleAskPermInteraction,
  buildBotRequest,
  buildRoleRequest,
};
