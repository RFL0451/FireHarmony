(() => {
  'use strict';

  const csvCell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const toCsv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const download = (name, text) => {
    const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const iso = t => new Date(t).toISOString();
  const havKm = (a, b) => {
    const r = Math.PI / 180;
    const dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r;
    const x = Math.sin(dl/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;
    return 12742 * Math.asin(Math.sqrt(x));
  };

  function exportPoints({ m, v, pairs, hidePersistent }) {
    const um = new Set(pairs.map(x => x.m)), uv = new Set(pairs.map(x => x.v));
    const rows = [[
      'sensor','instrument','satellite','acq_date','acq_time_utc',
      'lat','lon','brightness_K','frp_MW','confidence','daynight',
      'matched','persistent','fire_likelihood','fire_likelihood_score'
    ]];
    const push = (p, label, matched) => {
      if (hidePersistent && p.persistent) return;
      const d = iso(p.t);
      const cf = window.Confidence ? Confidence.assess(p, { matched }) : { level: '', score: '' };
      rows.push([
        label, p.inst || label, p.sat || '',
        d.slice(0, 10), d.slice(11, 16),
        p.lat.toFixed(5), p.lon.toFixed(5),
        p.bt, p.frp, p.c, p.dn || 'D',
        matched ? 'yes' : 'no',
        p.persistent ? 'yes' : 'no',
        cf.level, cf.score,
      ]);
    };
    m.forEach(p => push(p, 'MODIS', um.has(p)));
    v.forEach(p => push(p, 'VIIRS', uv.has(p)));
    download('hotspots.csv', toCsv(rows));
  }

  function exportClusters({ pairs, hidePersistent }) {
    const rows = [[
      'cluster_id','centroid_lat','centroid_lon','time_start_utc','time_end_utc',
      'sum_frp_MW','sensors','delta_km','delta_hours',
      'modis_lat','modis_lon','modis_frp_MW','modis_conf',
      'viirs_lat','viirs_lon','viirs_frp_MW','viirs_conf',
    ]];
    pairs.forEach((x, i) => {
      if (hidePersistent && (x.m.persistent || x.v.persistent)) return;
      const cLat = (x.m.lat + x.v.lat) / 2, cLon = (x.m.lon + x.v.lon) / 2;
      const t0 = Math.min(x.m.t, x.v.t), t1 = Math.max(x.m.t, x.v.t);
      rows.push([
        i + 1, cLat.toFixed(5), cLon.toFixed(5),
        iso(t0), iso(t1),
        (x.m.frp + x.v.frp).toFixed(2), 'MODIS+VIIRS',
        havKm(x.m, x.v).toFixed(2), (Math.abs(x.m.t - x.v.t) / 36e5).toFixed(2),
        x.m.lat.toFixed(5), x.m.lon.toFixed(5), x.m.frp, x.m.c,
        x.v.lat.toFixed(5), x.v.lon.toFixed(5), x.v.frp, x.v.c,
      ]);
    });
    download('clusters.csv', toCsv(rows));
  }

  window.Exporter = { exportPoints, exportClusters };
})();