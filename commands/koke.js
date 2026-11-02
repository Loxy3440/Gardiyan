// Panelden "kod yazmadan" olusturuldu. Degistirmek icin panelden silip yeniden olustur.
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NAME = "koke";
const DESCRIPTION = "tamam";
const REPLY = "{user} adamsın";
const USE_EMBED = false;
const TITLE = "";
const COLOR = "#5865F2";
const EPHEMERAL = false;

const fill = (text, i) => String(text)
  .replace(/\{user\}/gi, "<@" + i.user.id + ">")
  .replace(/\{username\}/gi, i.user.username)
  .replace(/\{server\}/gi, i.guild ? i.guild.name : "DM")
  .replace(/\{members\}/gi, i.guild ? i.guild.memberCount.toLocaleString("tr-TR") : "0");

module.exports = {
  data: new SlashCommandBuilder().setName(NAME).setDescription(DESCRIPTION),
  async execute(interaction) {
    const text = fill(REPLY, interaction);
    const extra = EPHEMERAL ? { ephemeral: true } : {};
    if (USE_EMBED) {
      const embed = new EmbedBuilder().setDescription(text).setColor(COLOR);
      if (TITLE) embed.setTitle(fill(TITLE, interaction));
      return interaction.reply({ embeds: [embed], ...extra });
    }
    return interaction.reply({ content: text, ...extra });
  },
};
