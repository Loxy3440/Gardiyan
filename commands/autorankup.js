const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { getConfig } = require('../utils/guildConfig');
const {
  RankupError,
  MAX_INVITES,
  getSettings,
  saveSettings,
  validateSteps,
  getStatus,
  sweepGuild,
  ladderText,
  roleLabel,
  bar,
} = require('../utils/autoRankup');

// Davete göre otomatik rank up. Örn: Ekip -> (5 davet) -> Has Ekip -> (10 davet) -> Usta.
// Her rank atlayışta davet sayacı sıfırlanır. Panelde "Auto rank up" sekmesinden de ayarlanır.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorankup')
    .setDescription('Davet sayısına göre otomatik rank atlatma sistemini ayarlar')
    .addSubcommand(sub =>
      sub
        .setName('ekle')
        .setDescription('Listenin sonuna bir rol ekler (ilk eklenen rol başlangıç rolüdür)')
        .addRoleOption(opt => opt.setName('rol').setDescription('Eklenecek rol').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('invite').setDescription('Bir önceki rolden sonra bu role geçmek için gereken davet (ilk rol için boş bırak)').setMinValue(1).setMaxValue(MAX_INVITES)),
    )
    .addSubcommand(sub =>
      sub
        .setName('cikar')
        .setDescription('Bir rolü listeden çıkarır')
        .addRoleOption(opt => opt.setName('rol').setDescription('Çıkarılacak rol').setRequired(true)),
    )
    .addSubcommand(sub => sub.setName('liste').setDescription('Basamak listesini ve sistemin durumunu gösterir'))
    .addSubcommand(sub =>
      sub
        .setName('durum')
        .setDescription('Bir üyenin rankını ve sıradaki rank için davet ilerlemesini gösterir')
        .addUserOption(opt => opt.setName('uye').setDescription('Üye (boşsa sen)')),
    )
    .addSubcommand(sub => sub.setName('ac').setDescription('Otomatik rank upı açar'))
    .addSubcommand(sub => sub.setName('kapat').setDescription('Otomatik rank upı kapatır (liste silinmez)'))
    .addSubcommand(sub =>
      sub
        .setName('kanal')
        .setDescription('Rank atlayınca duyuru yapılacak kanalı seçer (boş bırakırsan duyuru kapanır)')
        .addChannelOption(opt => opt.setName('kanal').setDescription('Duyuru kanalı').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
    )
    .addSubcommand(sub => sub.setName('kontrol').setDescription('Listedeki rollere sahip herkesi şimdi kontrol eder, hak edenleri yükseltir'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const settings = getSettings(await getConfig(guild.id));
    const fail = text => interaction.reply({ embeds: [errorEmbed(text)], ephemeral: true });
    const me = guild.members.me;

    try {
      if (sub === 'ekle') {
        const role = interaction.options.getRole('rol', true);
        const invites = interaction.options.getInteger('invite');
        if (settings.steps.length && invites == null) {
          return fail('Listede zaten rol var: bu role geçmek için kaç davet gerektiğini `invite` ile yaz.');
        }
        const steps = validateSteps(guild, [...settings.steps, { roleId: role.id, invites: invites ?? 0 }]);
        await saveSettings(guild.id, { ...settings, steps });

        const tooHigh = me && role.position >= me.roles.highest.position;
        const embed = successEmbed('Basamak Eklendi', ladderText(guild, steps));
        if (tooHigh) embed.addFields({ name: '⚠️ Dikkat', value: `Botun rolü **${role.name}** rolünden düşük, bu rolü veremez. Botun rolünü yukarı taşı.` });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'cikar') {
        const role = interaction.options.getRole('rol', true);
        if (!settings.steps.some(s => s.roleId === role.id)) return fail('Bu rol listede yok.');
        const steps = validateSteps(guild, settings.steps.filter(s => s.roleId !== role.id).map((s, i) => ({ ...s, invites: i === 0 ? 0 : s.invites })));
        const off = settings.enabled && steps.length < 2;
        await saveSettings(guild.id, { ...settings, steps, enabled: off ? false : settings.enabled });
        return interaction.reply({
          embeds: [successEmbed('Basamak Çıkarıldı', ladderText(guild, steps) + (off ? '\n\nEn az 2 rol kalmadığı için sistem kapatıldı.' : ''))],
          ephemeral: true,
        });
      }

      if (sub === 'liste') {
        const embed = new EmbedBuilder()
          .setTitle('Auto Rank Up')
          .setDescription(ladderText(guild, settings.steps))
          .addFields(
            { name: 'Durum', value: settings.enabled ? '🟢 Açık' : '🔴 Kapalı', inline: true },
            { name: 'Duyuru kanalı', value: settings.channelId ? `<#${settings.channelId}>` : 'Yok', inline: true },
            { name: 'Nasıl çalışır?', value: 'Üye bir rolü aldığı andan itibaren yaptığı davetler sayılır. Rank atlayınca davet sayacı **0**\'dan başlar.' },
          )
          .setColor(0x5865f2);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'durum') {
        const member = interaction.options.getMember('uye') || interaction.member;
        if (member.user.bot) return fail('Botlar rank atlamaz.');
        if (settings.steps.length < 2) return fail('Önce `/autorankup ekle` ile en az 2 rol ekle.');
        const st = await getStatus(guild, member, settings);
        if (st.idx < 0) {
          return interaction.reply({ embeds: [warningEmbed('Basamakta Değil', `**${member.user.tag}** listedeki rollerin hiçbirine sahip değil. Başlangıç rolü: **${roleLabel(guild, settings.steps[0].roleId)}**.`)], ephemeral: true });
        }
        const embed = new EmbedBuilder().setTitle(`${member.user.tag} - Rank Durumu`).setColor(0x5865f2)
          .addFields({ name: 'Şu anki rank', value: roleLabel(guild, st.current.roleId), inline: true });
        if (st.next) {
          embed.addFields(
            { name: 'Sıradaki rank', value: roleLabel(guild, st.next.roleId), inline: true },
            { name: 'Davet ilerlemesi', value: `${bar(st.count, st.next.invites)} **${st.count}/${st.next.invites}**\nRank atlayınca sayaç 0'dan başlar.` },
          );
        } else {
          embed.addFields({ name: 'Davet ilerlemesi', value: 'En üst ranktasın, sıradaki rank yok.' });
        }
        if (!settings.enabled) embed.setFooter({ text: 'Sistem şu an kapalı.' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === 'ac') {
        if (settings.steps.length < 2) return fail('Açmak için en az 2 rol gerekli (başlangıç rolü + bir üst rol). `/autorankup ekle` ile ekle.');
        if (settings.enabled) return interaction.reply({ embeds: [warningEmbed('Zaten Açık', 'Auto rank up zaten açık.')], ephemeral: true });
        await saveSettings(guild.id, { ...settings, enabled: true, enabledAt: new Date() });
        return interaction.reply({
          embeds: [successEmbed('Auto Rank Up Açıldı', 'Bundan sonra yapılan davetler sayılır. Önceden yapılan davetler sayılmaz.\n\n' + ladderText(guild, settings.steps))],
          ephemeral: true,
        });
      }

      if (sub === 'kapat') {
        if (!settings.enabled) return interaction.reply({ embeds: [warningEmbed('Zaten Kapalı', 'Auto rank up zaten kapalı.')], ephemeral: true });
        await saveSettings(guild.id, { ...settings, enabled: false });
        return interaction.reply({ embeds: [successEmbed('Auto Rank Up Kapatıldı', 'Liste duruyor, istediğinde `/autorankup ac` ile tekrar açabilirsin.')], ephemeral: true });
      }

      if (sub === 'kanal') {
        const channel = interaction.options.getChannel('kanal');
        if (channel && !channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
          return fail(`Botun ${channel} kanalında **Kanalı Gör** ve **Mesaj Gönder** yetkisi olmalı.`);
        }
        await saveSettings(guild.id, { ...settings, channelId: channel ? channel.id : null });
        return interaction.reply({
          embeds: [successEmbed('Duyuru Kanalı', channel ? `Rank atlayanlar ${channel} kanalında duyurulacak.` : 'Duyuru kapatıldı.')],
          ephemeral: true,
        });
      }

      if (sub === 'kontrol') {
        if (!settings.enabled) return fail('Önce `/autorankup ac` ile sistemi aç.');
        await interaction.deferReply({ ephemeral: true });
        const { checked, promoted } = await sweepGuild(guild);
        return interaction.editReply({ embeds: [successEmbed('Kontrol Bitti', `**${checked}** üye kontrol edildi, **${promoted}** üye rank atladı.`)] });
      }
    } catch (err) {
      if (err instanceof RankupError) return fail(err.message);
      throw err;
    }
  },
};
