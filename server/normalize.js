// Normalize MODIS and VIIRS CSV rows into one internal shape.
export function normalize(csv, sensor) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map(s => s.trim().toLowerCase());
  const idx = n => head.indexOf(n);
  const iLat = idx('latitude'), iLon = idx('longitude');
  const iDate = idx('acq_date'), iTime = idx('acq_time');
  const iConf = idx('confidence'), iFrp = idx('frp');
  const iSat = idx('satellite'), iDn = idx('daynight');
  const iBt = head.includes('bright_ti4') ? idx('bright_ti4') : idx('brightness');

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < head.length) continue;
    const acqTime = String(c[iTime] || '0000').padStart(4, '0');
    const t = Date.parse(`${c[iDate]}T${acqTime.slice(0, 2)}:${acqTime.slice(2)}:00Z`);
    if (!Number.isFinite(t)) continue;
    let conf = c[iConf];
    if (sensor === 'VIIRS') conf = ({ l: 20, n: 60, h: 90 })[String(conf).toLowerCase()] ?? Number(conf);
    out.push({
      s: sensor === 'MODIS' ? 'M' : 'V',
      lat: +c[iLat], lon: +c[iLon], t,
      bt: +(c[iBt] || 0),
      c: +conf || 0,
      frp: +(c[iFrp] || 0),
      sat: c[iSat] || sensor,
      inst: sensor,
      dn: c[iDn] || 'D',
      persistent: false,
    });
  }
  return out;
}