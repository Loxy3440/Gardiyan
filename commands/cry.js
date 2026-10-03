const { SlashCommandBuilder } = require('discord.js');

const GIF_URL =
  'https://media.discordapp.net/attachments/1518964798514135080/1523457896552333362/image.gif?ex=6a5b577b&is=6a5a05fb&hm=099963d986dafe88fe4729683ba5a2bb35bccc9a059778a5bf1774edf0efece4&=';

module.exports = {
  data: new SlashCommandBuilder().setName('cry').setDescription('Aglama gifi gonderir'),

  async execute(interaction) {
    await interaction.reply(GIF_URL);
  },
};
