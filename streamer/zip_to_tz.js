const https = require('https');
const { find } = require('geo-tz');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'retro-weather-rtmp/1.0' } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (c) => {
          data += c;
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

(async () => {
  const rawZip = (process.env.LOCATION || '60601').trim();
  const zip = rawZip.replace(/\D/g, '').slice(0, 5);
  if (zip.length !== 5) {
    process.exit(1);
  }

  const body = await httpsGet(`https://api.zippopotam.us/us/${zip}`);
  const j = JSON.parse(body);
  const place = j.places && j.places[0];
  if (!place) process.exit(1);

  const lat = parseFloat(place.latitude);
  const lon = parseFloat(place.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lon)) process.exit(1);

  const zones = find(lat, lon);
  if (!zones || !zones.length) process.exit(1);

  process.stdout.write(zones[0]);
})().catch(() => process.exit(1));
