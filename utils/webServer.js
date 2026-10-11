const http = require('http');
const fs = require('fs');
const path = require('path');
const { getMemberCount, STATS_GUILD_ID } = require('./activityRotator');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function buildStats(client) {
  const guild = client.guilds.cache.get(STATS_GUILD_ID);
  return {
    ready: client.isReady(),
    guildName: guild?.name ?? null,
    guildIcon: guild?.iconURL({ size: 128 }) ?? null,
    members: getMemberCount(client),
    channels: guild?.channels.cache.size ?? null,
    roles: guild?.roles.cache.size ?? null,
    boosts: guild?.premiumSubscriptionCount ?? null,
    boostTier: guild?.premiumTier ?? null,
    totalGuilds: client.guilds.cache.size,
    commands: client.commands?.size ?? 0,
    ping: Math.round(client.ws.ping),
    uptime: Math.round(process.uptime()),
    bot: client.user ? { tag: client.user.tag, avatar: client.user.displayAvatarURL({ size: 128 }) } : null,
    time: Date.now(),
  };
}

function startWebServer(client) {
  const port = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/stats') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*', // dashboard GitHub Pages gibi başka yerden de açılabilsin
      });
      return res.end(JSON.stringify(buildStats(client)));
    }

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('ok');
    }

    // Statik dosyalar (public/). Klasör dışına çıkmayı engelle.
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      return res.end('Yasak');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Bulunamadi');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.listen(port, () => console.log(`[WEB] Port ${port} dinleniyor (dashboard + /api/stats).`));
  return server;
}

module.exports = { startWebServer };
