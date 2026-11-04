/* =====================================================================
   app.js — Sistem Informasi Geospasial Sebaran TPA Provinsi Jawa Timur
   Sumber data : data/LokasiTPA_2.js (json_LokasiTPA_2)
                 data/GarisAdministrasiKabKota_1.js (json_GarisAdministrasiKabKota_1)
   Library     : Leaflet 1.9 + Leaflet.markercluster (lokal), SimpleCharts (lokal)
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     0. Utilitas
  ------------------------------------------------------------------ */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var NA = 'Tidak tersedia';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }
  function val(v) { return isBlank(v) ? NA : String(v).trim(); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function fmt(n) { return (typeof n === 'number' && isFinite(n)) ? n.toFixed(6) : NA; }
  function kabKey(name) {
    // "Kabupaten Ngawi" -> "ngawi", "Kota Madiun" -> "kota madiun"
    return norm(name).replace(/^kabupaten\s+/, '').replace(/^kab\.?\s+/, '');
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  }
  function toast(msg, ms) {
    var el = $('#toast'); el.textContent = msg; el.classList.add('is-visible');
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove('is-visible'); }, ms || 2200);
  }
  function photoPath(p) {
    if (isBlank(p)) return null;
    var s = String(p).trim().replace(/\\/g, '/');
    // Data sumber menuliskan "Gambar/<nama>.png"; berkas disimpan di images/gambar_pendukung/
    s = s.replace(/^gambar\//i, 'images/gambar_pendukung/');
    if (!/^(images\/|https?:\/\/|data:)/i.test(s)) s = 'images/gambar_pendukung/' + s.split('/').pop();
    return s;
  }

  /* ------------------------------------------------------------------
     1. Pemuatan & normalisasi data
  ------------------------------------------------------------------ */
  if (typeof json_LokasiTPA_2 === 'undefined') {
    document.body.insertAdjacentHTML('afterbegin', '<div style="padding:20px;background:#fde9d7;color:#7a3e07">Data TPA (data/LokasiTPA_2.js) tidak ditemukan.</div>');
    return;
  }
  var ADM = (typeof json_GarisAdministrasiKabKota_1 !== 'undefined') ? json_GarisAdministrasiKabKota_1 : { type: 'FeatureCollection', features: [] };

  var records = json_LokasiTPA_2.features.map(function (f, i) {
    var p = f.properties || {};
    var g = f.geometry || {};
    var lon = null, lat = null;
    if (g.type === 'Point' && Array.isArray(g.coordinates)) { lon = Number(g.coordinates[0]); lat = Number(g.coordinates[1]); }
    if (!isFinite(lat) || !isFinite(lon)) {
      lat = Number(p.LATITUDE); lon = Number(p.LONGITUDE);
    }
    var hasCoord = isFinite(lat) && isFinite(lon);
    return {
      idx: i,
      id: val(p.ID) === NA ? String(i + 1) : String(p.ID),
      no: isBlank(p.NO) ? '' : String(p.NO),
      kab: isBlank(p['KAB/KOTA']) ? NA : String(p['KAB/KOTA']).trim(),
      tpa: isBlank(p.TPA) ? NA : String(p.TPA).trim(),
      titik: isBlank(p.TITIK) ? '' : String(p.TITIK).trim(),
      lat: hasCoord ? lat : null,
      lon: hasCoord ? lon : null,
      hasCoord: hasCoord,
      koordAsli: isBlank(p.KOORD_ASLI) ? '' : String(p.KOORD_ASLI).trim(),
      alamat: isBlank(p.ALAMAT) ? '' : String(p.ALAMAT).trim(),
      catatan: isBlank(p.CATATAN) ? '' : String(p.CATATAN).trim(),
      foto: photoPath(p.Foto),
      kabKey: kabKey(p['KAB/KOTA']),
      jenis: /^kota\b/i.test(String(p['KAB/KOTA'] || '')) ? 'Kota' : 'Kabupaten',
      marker: null
    };
  });
  records.forEach(function (r) {
    r.uniqueKey = norm(r.tpa) + '|' + r.kabKey;
    r.searchText = norm([r.tpa, r.kab, r.alamat, r.titik].join(' '));
  });

  var kabList = [];
  (function () {
    var seen = {};
    records.forEach(function (r) { if (r.kab !== NA && !seen[r.kabKey]) { seen[r.kabKey] = true; kabList.push({ key: r.kabKey, name: r.kab }); } });
    kabList.sort(function (a, b) { return a.name.localeCompare(b.name, 'id'); });
  })();
  var kabHasTpa = {};
  kabList.forEach(function (k) { kabHasTpa[k.key] = k.name; });

  // State aplikasi (dideklarasikan sebelum peta karena dipakai oleh style layer)
  var state = { q: '', kab: '', sort: 'kab-asc', page: 1, pageSize: 8, view: 'cards', selected: null, filtered: records.slice() };

  /* ------------------------------------------------------------------
     2. Peta
  ------------------------------------------------------------------ */
  var map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 19, preferCanvas: false });

  var baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  var baseEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });
  var baseLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });
  var baseTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS'
  });
  baseOSM.addTo(map);
  baseOSM.on('tileerror', function () {
    if (!baseOSM._warned) { baseOSM._warned = true; toast('Basemap tidak dapat dimuat — periksa koneksi internet. Data TPA tetap tersedia.', 4000); }
  });

  /* --- Layer batas administrasi --- */
  var admByKey = {};
  var admLayer = L.geoJSON(ADM, {
    style: admStyle,
    onEachFeature: function (feature, layer) {
      var p = feature.properties || {};
      var name = p.WADMKK || p.WADMPR || 'Batas administrasi';
      var key = norm(p.WADMKK);
      if (key) admByKey[key] = layer;
      var cnt = records.filter(function (r) { return r.kabKey === key; }).length;
      layer.bindTooltip('<strong>' + esc(name) + '</strong>' + (cnt ? '<br><span style="color:#1f9c8a">' + cnt + ' titik TPA</span>' : '<br><span style="color:#6b776f">Tidak ada data TPA</span>'),
        { sticky: true, className: 'adm-tip', direction: 'top', opacity: 1 });
      layer.on({
        mouseover: function (e) { e.target.setStyle({ weight: 2.4, fillOpacity: Math.min(0.45, admStyle(feature).fillOpacity + 0.15) }); if (e.target.bringToFront && !state.kab) e.target.bringToFront(); },
        mouseout: function (e) { admLayer.resetStyle(e.target); },
        click: function () {
          if (kabHasTpa[key]) { $('#kabFilter').value = key; applyFilters({ fit: true }); switchPanel('daftar', true); }
          else if (p.WADMKK) { toast('Tidak ada data TPA di ' + name + ' pada data sumber.'); }
        }
      });
    }
  }).addTo(map);
  // Tampilan awal difokuskan pada daratan Jawa Timur & Madura (pulau terluar tetap tersedia di layer).
  var JATIM_BOUNDS = L.latLngBounds([[-8.80, 110.85], [-6.75, 114.70]]);

  function admStyle(feature) {
    var key = norm(feature.properties && feature.properties.WADMKK);
    var selected = state.kab && key === state.kab;
    var has = !!kabHasTpa[key];
    if (selected) return { color: '#e8771e', weight: 2.6, fillColor: '#f28c28', fillOpacity: 0.22, dashArray: null };
    if (!feature.properties || !feature.properties.WADMKK) return { color: '#1e73d6', weight: 1, fillOpacity: 0, dashArray: '3 4' };
    return { color: '#1e73d6', weight: 1.1, fillColor: has ? '#2bb3a0' : '#2b8cf0', fillOpacity: has ? 0.22 : 0.03 };
  }

  /* --- Layer titik TPA (cluster) --- */
  var cluster = L.markerClusterGroup({
    maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 17,
    iconCreateFunction: function (c) {
      var n = c.getChildCount(); var size = n < 10 ? 'small' : (n < 50 ? 'medium' : 'large');
      return L.divIcon({ html: '<div><span>' + n + '</span></div>', className: 'marker-cluster marker-cluster-' + size, iconSize: L.point(40, 40) });
    }
  });

  function makeIcon(active) {
    return L.divIcon({
      className: 'tpa-marker' + (active ? ' is-active' : ''),
      html: '<div class="tpa-pin"><i class="fas fa-recycle"></i></div>',
      iconSize: [34, 48], iconAnchor: [17, 48], popupAnchor: [0, -44], tooltipAnchor: [0, -36]
    });
  }

  records.forEach(function (r) {
    if (!r.hasCoord) return;
    r.latlng = L.latLng(r.lat, r.lon);
    var m = L.marker(r.latlng, { icon: makeIcon(false), title: r.tpa + ' — ' + r.kab, riseOnHover: true });
    m.bindTooltip(esc(r.tpa) + (r.titik ? ' (' + esc(r.titik) + ')' : ''), { className: 'tpa-tip', direction: 'top', offset: [0, -4] });
    m.bindPopup(function () { return miniPopup(r); }, { closeButton: false, autoPan: true, autoPanPaddingTopLeft: [20, 20], autoPanPaddingBottomRight: [360, 20] });
    m.on('click', function () { selectRecord(r, { openDetail: true, pan: false }); });
    r.marker = m;
  });

  function miniPopup(r) {
    var div = document.createElement('div');
    div.className = 'mini-popup';
    div.innerHTML = '<div class="kicker">' + esc(r.kab) + '</div><h4>' + esc(r.tpa) + (r.titik ? ' <span class="badge">' + esc(r.titik) + '</span>' : '') + '</h4>' +
      '<p>' + esc(r.alamat || NA) + '</p><div class="mono">' + fmt(r.lat) + ', ' + fmt(r.lon) + '</div>' +
      '<button class="btn btn-primary"><i class="fas fa-info-circle"></i> Lihat detail</button>';
    div.querySelector('button').addEventListener('click', function () { openDetail(r); });
    return div;
  }

  map.addLayer(cluster);

  /* --- Kontrol peta --- */
  L.control.zoom({ position: 'topleft', zoomInTitle: 'Perbesar', zoomOutTitle: 'Perkecil' }).addTo(map);

  var MapButton = L.Control.extend({
    options: { position: 'topleft' },
    initialize: function (opts) { L.setOptions(this, opts); },
    onAdd: function () {
      var c = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      var b = L.DomUtil.create('a', 'map-ctl-btn', c);
      b.href = '#'; b.title = this.options.title; b.setAttribute('role', 'button'); b.setAttribute('aria-label', this.options.title);
      b.innerHTML = '<i class="fas ' + this.options.icon + '"></i>';
      L.DomEvent.on(b, 'click', L.DomEvent.stop).on(b, 'click', this.options.onClick, this);
      L.DomEvent.disableClickPropagation(c);
      this._btn = b; return c;
    }
  });

  // Tampilan awal (seluruh Jawa Timur)
  new MapButton({ icon: 'fa-home', title: 'Tampilan seluruh Jawa Timur', onClick: function () { fitAll(); } }).addTo(map);

  // Layar penuh
  var mapArea = $('#mapArea');
  var fsBtn = new MapButton({ icon: 'fa-expand', title: 'Layar penuh', onClick: toggleFullscreen }).addTo(map);
  function isFs() { return document.fullscreenElement === mapArea || mapArea.classList.contains('is-pseudo-fs'); }
  function toggleFullscreen() {
    if (!isFs()) {
      if (mapArea.requestFullscreen) { mapArea.requestFullscreen().catch(function () { pseudoFs(true); }); }
      else pseudoFs(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); else pseudoFs(false);
    }
  }
  function pseudoFs(on) {
    mapArea.classList.toggle('is-pseudo-fs', on);
    mapArea.style.position = on ? 'fixed' : ''; mapArea.style.inset = on ? '0' : ''; mapArea.style.zIndex = on ? '5000' : '';
    syncFs();
  }
  function syncFs() {
    var on = isFs();
    fsBtn._btn.innerHTML = '<i class="fas ' + (on ? 'fa-compress' : 'fa-expand') + '"></i>';
    fsBtn._btn.title = on ? 'Keluar layar penuh' : 'Layar penuh';
    setTimeout(function () { map.invalidateSize(); }, 150);
  }
  document.addEventListener('fullscreenchange', syncFs);

  // Geolokasi
  var locMarker = null, locCircle = null;
  var locBtn = new MapButton({ icon: 'fa-location-arrow', title: 'Lokasi saya', onClick: function () {
    if (!navigator.geolocation) { toast('Geolokasi tidak didukung oleh browser ini.'); return; }
    locBtn._btn.classList.add('is-loading'); locBtn._btn.innerHTML = '<i class="fas fa-sync"></i>';
    map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true, timeout: 10000 });
  } }).addTo(map);
  map.on('locationfound', function (e) {
    locBtn._btn.classList.remove('is-loading'); locBtn._btn.innerHTML = '<i class="fas fa-location-arrow"></i>'; locBtn._btn.classList.add('is-active');
    if (locMarker) { map.removeLayer(locMarker); map.removeLayer(locCircle); }
    locCircle = L.circle(e.latlng, { radius: e.accuracy / 2, color: '#1e73d6', weight: 1, fillOpacity: 0.12 }).addTo(map);
    locMarker = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#1e73d6', fillOpacity: 1 }).addTo(map)
      .bindTooltip('Lokasi Anda (akurasi ±' + Math.round(e.accuracy) + ' m)', { className: 'adm-tip' });
    toast('Lokasi Anda ditemukan.');
  });
  map.on('locationerror', function (e) {
    locBtn._btn.classList.remove('is-loading'); locBtn._btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
    toast('Lokasi tidak dapat ditentukan: ' + (e.message || 'izin ditolak / tidak tersedia.'), 3500);
  });

  // Kontrol layer
  L.control.layers(
    { 'OpenStreetMap': baseOSM, 'Esri World Imagery (citra satelit)': baseEsri, 'Esri World Topo': baseTopo, 'CARTO Light': baseLight },
    { 'Titik lokasi TPA': cluster, 'Batas administrasi kab/kota': admLayer },
    { position: 'topleft', collapsed: true }
  ).addTo(map);

  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 160 }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

  /* ------------------------------------------------------------------
     3. State, filter, dan pembaruan tampilan
  ------------------------------------------------------------------ */
  function filtered() {
    return records.filter(function (r) {
      if (state.kab && r.kabKey !== state.kab) return false;
      if (state.q && r.searchText.indexOf(state.q) === -1) return false;
      return true;
    });
  }

  function applyFilters(opts) {
    opts = opts || {};
    state.q = norm($('#searchInput').value);
    state.kab = $('#kabFilter').value;
    state.page = 1;
    state.filtered = filtered();
    $('#btnClearSearch').hidden = !state.q;

    // Marker
    cluster.clearLayers();
    cluster.addLayers(state.filtered.filter(function (r) { return r.marker; }).map(function (r) { return r.marker; }));
    if (state.selected && state.filtered.indexOf(state.selected) === -1) { clearSelection(); }

    // Batas administrasi
    admLayer.setStyle(admStyle);
    if (state.kab && admByKey[state.kab] && admByKey[state.kab].bringToFront) admByKey[state.kab].bringToFront();

    // Status filter
    var parts = [];
    if (state.kab) parts.push('Wilayah: <strong>' + esc(kabHasTpa[state.kab] || state.kab) + '</strong>');
    if (state.q) parts.push('Kata kunci: <strong>“' + esc($('#searchInput').value.trim()) + '”</strong>');
    $('#filterStatus').innerHTML = parts.length
      ? parts.join(' &middot; ') + ' &middot; ' + state.filtered.length + ' dari ' + records.length + ' titik'
      : 'Menampilkan seluruh <strong>' + records.length + '</strong> titik lokasi TPA di Jawa Timur.';

    updateStats(); renderSummary(); renderList(); renderCharts();
    $('#footerCount').textContent = records.length + ' titik lokasi TPA · ' + kabList.length + ' kab/kota';

    // Zoom ke hasil
    if (opts.fit !== false && (state.kab || state.q)) {
      var pts = state.filtered.filter(function (r) { return r.latlng; }).map(function (r) { return r.latlng; });
      if (pts.length) {
        var b = L.latLngBounds(pts);
        if (state.kab && admByKey[state.kab]) b.extend(admByKey[state.kab].getBounds());
        map.flyToBounds(b.pad(0.15), { maxZoom: 13, duration: 0.8 });
      }
    } else if (opts.fit === true) { fitAll(); }
  }

  function fitAll() { map.flyToBounds(JATIM_BOUNDS, { duration: 0.8 }); }

  function resetFilters() {
    $('#searchInput').value = ''; $('#kabFilter').value = '';
    clearSelection(); closeDetail();
    applyFilters({ fit: false }); fitAll();
    toast('Filter direset — menampilkan seluruh Jawa Timur.');
  }

  /* --- Statistik --- */
  function stats(list) {
    var kabs = {}, uniq = {}, alamat = 0, koord = 0;
    list.forEach(function (r) {
      if (r.kab !== NA) kabs[r.kabKey] = true;
      if (r.tpa !== NA) uniq[r.uniqueKey] = true;
      if (r.alamat) alamat++;
      if (r.hasCoord) koord++;
    });
    return { titik: list.length, kab: Object.keys(kabs).length, tpa: Object.keys(uniq).length, alamat: alamat, koord: koord };
  }
  function updateStats() {
    var s = stats(state.filtered);
    $('#statTitik').textContent = s.titik; $('#statTpaUnik').textContent = s.tpa; $('#statKab').textContent = s.kab;
    $('#statAlamat').textContent = s.alamat; $('#statKoord').textContent = s.koord;
    var multi = {};
    state.filtered.forEach(function (r) { multi[r.uniqueKey] = (multi[r.uniqueKey] || 0) + 1; });
    var multiNames = Object.keys(multi).filter(function (k) { return multi[k] > 1; }).map(function (k) {
      var r = state.filtered.filter(function (x) { return x.uniqueKey === k; })[0]; return r.tpa + ' (' + multi[k] + ' titik)';
    });
    $('#statNoteText').innerHTML = s.titik === s.tpa
      ? 'Pada data yang ditampilkan, setiap TPA diwakili tepat satu titik, sehingga jumlah titik sama dengan jumlah TPA unik.'
      : 'Satu TPA dapat terdiri dari beberapa titik/zona pengamatan, sehingga <strong>' + s.titik + ' titik</strong> mewakili <strong>' + s.tpa + ' TPA unik</strong>' +
        (multiNames.length ? '. TPA dengan lebih dari satu titik: ' + esc(multiNames.join(', ')) + '.' : '.');
  }

  function groupByKab(list) {
    var g = {};
    list.forEach(function (r) {
      if (!g[r.kabKey]) g[r.kabKey] = { key: r.kabKey, name: r.kab, jenis: r.jenis, titik: 0, uniq: {} };
      g[r.kabKey].titik++; g[r.kabKey].uniq[r.uniqueKey] = true;
    });
    return Object.keys(g).map(function (k) { var o = g[k]; o.tpa = Object.keys(o.uniq).length; return o; });
  }

  function renderSummary() {
    var rows = groupByKab(state.filtered).sort(function (a, b) { return b.titik - a.titik || a.name.localeCompare(b.name, 'id'); });
    var max = rows.length ? rows[0].titik : 1;
    var tb = $('#summaryTable tbody'); tb.innerHTML = '';
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="3" class="empty-state">Tidak ada data.</td></tr>'; return; }
    rows.forEach(function (o) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + esc(o.name) + '<div class="bar" style="width:' + Math.round(o.titik / max * 100) + '%"></div></td><td class="num">' + o.tpa + '</td><td class="num">' + o.titik + '</td>';
      tr.title = 'Klik untuk memfilter ' + o.name;
      tr.addEventListener('click', function () { $('#kabFilter').value = o.key; applyFilters({ fit: true }); });
      tb.appendChild(tr);
    });
  }

  /* --- Daftar lokasi --- */
  function sorted(list) {
    var s = state.sort.split('-'), key = s[0], dir = s[1] === 'desc' ? -1 : 1;
    return list.slice().sort(function (a, b) {
      var c = key === 'tpa' ? a.tpa.localeCompare(b.tpa, 'id') || a.kab.localeCompare(b.kab, 'id')
                            : a.kab.localeCompare(b.kab, 'id') || a.tpa.localeCompare(b.tpa, 'id');
      if (c === 0) c = (a.titik || '').localeCompare(b.titik || '', 'id', { numeric: true });
      return c * dir;
    });
  }
  function renderList() {
    var list = sorted(state.filtered);
    var total = list.length, pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize, pageItems = list.slice(start, start + state.pageSize);
    $('#listCount').textContent = total ? ('Menampilkan ' + (start + 1) + '–' + (start + pageItems.length) + ' dari ' + total + ' titik lokasi') : '';
    var c = $('#listContainer'); c.innerHTML = '';
    c.className = state.view === 'cards' ? 'list-cards' : 'table-wrap';
    if (!total) { c.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i>Tidak ada lokasi yang cocok dengan pencarian/filter.</div>'; $('#pagination').innerHTML = ''; return; }

    if (state.view === 'cards') {
      pageItems.forEach(function (r) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'loc-card' + (state.selected === r ? ' is-selected' : ''); b.dataset.idx = r.idx;
        b.innerHTML = '<div class="loc-num">' + esc(r.no || r.id) + '</div><div class="loc-body">' +
          '<div class="loc-title">' + esc(r.tpa) + (r.titik ? '<span class="badge">' + esc(r.titik) + '</span>' : '') + '</div>' +
          '<div class="loc-kab"><i class="fas fa-building"></i> ' + esc(r.kab) + '</div>' +
          '<div class="loc-addr">' + esc(r.alamat || NA) + '</div>' +
          '<div class="loc-coord">' + fmt(r.lat) + ', ' + fmt(r.lon) + '</div></div>' +
          '<span class="loc-zoom" title="Zoom ke lokasi"><i class="fas fa-search-plus"></i></span>';
        b.addEventListener('click', function () { selectFromList(r); });
        c.appendChild(b);
      });
    } else {
      var t = document.createElement('table'); t.className = 'data-table';
      t.innerHTML = '<thead><tr><th>Nama TPA</th><th>Kab/Kota</th><th>Alamat</th><th>Koordinat</th></tr></thead><tbody></tbody>';
      pageItems.forEach(function (r) {
        var tr = document.createElement('tr'); tr.className = state.selected === r ? 'is-selected' : ''; tr.dataset.idx = r.idx;
        tr.innerHTML = '<td><strong>' + esc(r.tpa) + '</strong>' + (r.titik ? '<br><span class="badge">' + esc(r.titik) + '</span>' : '') + '</td><td>' + esc(r.kab) + '</td>' +
          '<td style="font-size:12px">' + esc(r.alamat || NA) + '</td><td class="mono" style="font-size:11px;white-space:nowrap">' + fmt(r.lat) + '<br>' + fmt(r.lon) + '</td>';
        tr.addEventListener('click', function () { selectFromList(r); });
        t.querySelector('tbody').appendChild(tr);
      });
      c.appendChild(t);
    }

    var pg = $('#pagination'); pg.innerHTML = '';
    if (pages > 1) {
      var mk = function (label, page, active, disabled) {
        var b = document.createElement('button'); b.innerHTML = label; b.disabled = !!disabled; if (active) b.className = 'is-active';
        b.addEventListener('click', function () { state.page = page; renderList(); }); pg.appendChild(b);
      };
      mk('<i class="fas fa-angle-left"></i>', state.page - 1, false, state.page === 1);
      for (var i = 1; i <= pages; i++) mk(String(i), i, i === state.page);
      mk('<i class="fas fa-angle-right"></i>', state.page + 1, false, state.page === pages);
    }
  }

  function selectFromList(r) {
    selectRecord(r, { openDetail: true, pan: true });
    if (window.innerWidth <= 860) { $('#mapArea').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  /* --- Grafik --- */
  function renderCharts() {
    var rows = groupByKab(state.filtered).sort(function (a, b) { return b.titik - a.titik || a.name.localeCompare(b.name, 'id'); });
    var onClick = function (d) { $('#kabFilter').value = d.key; applyFilters({ fit: true }); };
    SimpleCharts.hbar($('#chartBar'), rows.map(function (o) { return { label: o.name, value: o.titik, key: o.key }; }),
      { color: '#0d5e4c', unit: 'titik', labelWidth: 130, maxLabel: 22, onClick: onClick, emptyText: 'Tidak ada data untuk filter ini.' });
    SimpleCharts.hbar($('#chartBarTpa'), rows.slice().sort(function (a, b) { return b.tpa - a.tpa || a.name.localeCompare(b.name, 'id'); }).map(function (o) { return { label: o.name, value: o.tpa, key: o.key }; }),
      { color: '#1f9c8a', unit: 'TPA unik', labelWidth: 130, maxLabel: 22, onClick: onClick, emptyText: 'Tidak ada data untuk filter ini.' });
    var jenis = { Kabupaten: 0, Kota: 0 };
    state.filtered.forEach(function (r) { jenis[r.jenis]++; });
    SimpleCharts.donut($('#chartDonut'), [
      { label: 'Wilayah Kabupaten', value: jenis.Kabupaten, color: '#0d5e4c' },
      { label: 'Wilayah Kota', value: jenis.Kota, color: '#2b8cf0' }
    ], { unit: 'titik', centerLabel: 'titik', emptyText: 'Tidak ada data untuk filter ini.' });
  }

  /* ------------------------------------------------------------------
     4. Seleksi & panel detail
  ------------------------------------------------------------------ */
  function clearSelection() {
    if (state.selected && state.selected.marker) state.selected.marker.setIcon(makeIcon(false));
    state.selected = null;
    $$('.loc-card.is-selected, .data-table tr.is-selected').forEach(function (e) { e.classList.remove('is-selected'); });
  }
  function selectRecord(r, opts) {
    opts = opts || {};
    if (state.selected !== r) {
      clearSelection(); state.selected = r;
      if (r.marker) r.marker.setIcon(makeIcon(true));
      $$('[data-idx="' + r.idx + '"]').forEach(function (e) { e.classList.add('is-selected'); });
    }
    if (opts.pan) zoomToRecord(r);
    if (opts.openDetail) openDetail(r);
  }
  function zoomToRecord(r) {
    if (!r.latlng || !r.marker) { toast('Koordinat lokasi ini tidak tersedia.'); return; }
    var target = Math.max(map.getZoom(), 15), done = false;
    var finish = function () {
      if (done) return; done = true;
      if (cluster.hasLayer(r.marker)) cluster.zoomToShowLayer(r.marker, function () { r.marker.openPopup(); });
      else r.marker.openPopup();
    };
    map.once('moveend', finish);
    map.flyTo(r.latlng, target, { duration: 0.9 });
    setTimeout(finish, 1200);
  }

  var detail = $('#detailPanel');
  function openDetail(r) {
    $('#detailKab').textContent = r.kab;
    $('#detailTpa').textContent = r.tpa;
    $('#detailTitik').innerHTML = r.titik ? '<span class="badge">' + esc(r.titik) + '</span>' : '';
    $('#detailAlamat').textContent = r.alamat || NA;
    $('#detailLat').textContent = fmt(r.lat);
    $('#detailLon').textContent = fmt(r.lon);
    $('#detailKoordAsli').textContent = r.koordAsli || NA;
    var note = $('#detailCatatan');
    if (r.catatan) { note.hidden = false; note.innerHTML = '<i class="fas fa-exclamation-triangle"></i><div><strong>Catatan data sumber:</strong> ' + esc(r.catatan) + '</div>'; }
    else { note.hidden = true; note.innerHTML = ''; }
    var ph = $('#detailPhoto');
    if (r.foto) {
      ph.innerHTML = '<img src="' + esc(r.foto) + '" alt="Foto ' + esc(r.tpa) + '"><div class="photo-caption">Foto: ' + esc(r.tpa) + ' — ' + esc(r.kab) + '</div>';
      ph.querySelector('img').addEventListener('error', function () { ph.innerHTML = '<div class="no-photo"><i class="fas fa-image"></i>Foto tidak dapat dimuat</div>'; });
    } else ph.innerHTML = '<div class="no-photo"><i class="fas fa-image"></i>Foto tidak tersedia</div>';
    var gm = $('#btnGmaps');
    if (r.hasCoord) { gm.href = 'https://www.google.com/maps?q=' + r.lat + ',' + r.lon; gm.style.display = ''; } else gm.style.display = 'none';
    detail.hidden = false;
    mapArea.classList.add('has-detail');
    detail.dataset.idx = r.idx;
    $('#btnCopyCoord').classList.remove('is-done');
    $('#btnCopyCoord').innerHTML = '<i class="fas fa-copy"></i> Salin koordinat';
  }
  function closeDetail() { detail.hidden = true; mapArea.classList.remove('has-detail'); }
  function current() { var i = detail.dataset.idx; return i === undefined ? null : records[Number(i)]; }

  $('#btnDetailClose').addEventListener('click', closeDetail);
  $('#btnZoomTo').addEventListener('click', function () { var r = current(); if (r) zoomToRecord(r); });
  $('#btnCopyCoord').addEventListener('click', function () {
    var r = current(); if (!r || !r.hasCoord) { toast('Koordinat tidak tersedia.'); return; }
    var text = fmt(r.lat) + ', ' + fmt(r.lon), btn = this;
    var ok = function () { btn.classList.add('is-done'); btn.innerHTML = '<i class="fas fa-check"></i> Tersalin'; toast('Koordinat disalin: ' + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text, ok); });
    else fallbackCopy(text, ok);
  });
  function fallbackCopy(text, ok) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { toast('Tidak dapat menyalin otomatis. Koordinat: ' + text, 4000); }
    document.body.removeChild(ta);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  /* ------------------------------------------------------------------
     5. UI: navigasi, sidebar, legenda, filter
  ------------------------------------------------------------------ */
  function switchPanel(name, keep) {
    $$('.nav-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.panel === name); });
    $$('.panel').forEach(function (p) { p.classList.toggle('is-active', p.dataset.panel === name); });
    if (!keep && window.innerWidth <= 860) $('#sidebar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if ($('#appMain').classList.contains('sidebar-collapsed')) toggleSidebar(false);
    if (name === 'grafik') renderCharts();
  }
  $$('.nav-btn').forEach(function (b) { b.addEventListener('click', function () { switchPanel(b.dataset.panel); }); });

  function toggleSidebar(force) {
    var main = $('#appMain');
    var collapse = typeof force === 'boolean' ? force : !main.classList.contains('sidebar-collapsed');
    main.classList.toggle('sidebar-collapsed', collapse);
    setTimeout(function () { map.invalidateSize(); }, 280);
  }
  $('#btnToggleSidebar').addEventListener('click', function () { toggleSidebar(); });

  $('#btnLegendToggle').addEventListener('click', function () {
    var box = $('#legendBox'); box.classList.toggle('is-collapsed');
    this.title = box.classList.contains('is-collapsed') ? 'Tampilkan legenda' : 'Ciutkan legenda';
  });

  // Isi dropdown kabupaten/kota
  (function () {
    var sel = $('#kabFilter');
    kabList.forEach(function (k) {
      var n = records.filter(function (r) { return r.kabKey === k.key; }).length;
      var o = document.createElement('option'); o.value = k.key; o.textContent = k.name + ' (' + n + ')'; sel.appendChild(o);
    });
  })();
  $('#kabFilter').addEventListener('change', function () { applyFilters({ fit: true }); if (!this.value) fitAll(); });
  $('#searchInput').addEventListener('input', debounce(function () { applyFilters({ fit: true }); if (!state.q && !state.kab) fitAll(); }, 250));
  $('#btnClearSearch').addEventListener('click', function () { $('#searchInput').value = ''; applyFilters({ fit: !!state.kab }); if (!state.kab) fitAll(); $('#searchInput').focus(); });
  $('#btnReset').addEventListener('click', resetFilters);
  $('#sortSelect').addEventListener('change', function () { state.sort = this.value; state.page = 1; renderList(); });
  $('#viewCards').addEventListener('click', function () { state.view = 'cards'; this.classList.add('is-active'); $('#viewTable').classList.remove('is-active'); renderList(); });
  $('#viewTable').addEventListener('click', function () { state.view = 'table'; this.classList.add('is-active'); $('#viewCards').classList.remove('is-active'); renderList(); });

  // Informasi "Tentang" dari metadata layer administrasi & catatan
  (function () {
    var f = ADM.features && ADM.features[0] && ADM.features[0].properties;
    $('#aboutAdmMeta').textContent = f ? ((f.METADATA || '-') + (f.UPDATED ? ' (' + f.UPDATED + ')' : '')) : NA;
    var n = records.filter(function (r) { return r.catatan; }).length;
    if (n) $('#aboutCatatan').textContent = n + ' dari ' + records.length + ' titik memiliki catatan interpretasi koordinat dari data sumber (misalnya label lintang/bujur tertukar). Catatan tersebut ditampilkan pada panel detail lokasi yang bersangkutan dan disarankan diverifikasi ke sumber data.';
  })();

  window.addEventListener('resize', debounce(function () { map.invalidateSize(); }, 200));
  if (window.innerWidth <= 860) { $('#legendBox').classList.add('is-collapsed'); $('#btnLegendToggle').title = 'Tampilkan legenda'; }

  /* ------------------------------------------------------------------
     6. Inisialisasi
  ------------------------------------------------------------------ */
  applyFilters({ fit: false });
  map.fitBounds(JATIM_BOUNDS);

  // Ekspos untuk pengujian/pengembangan lanjutan
  window.WebGIS = { map: map, records: records, cluster: cluster, admLayer: admLayer, state: state, applyFilters: applyFilters, selectRecord: selectRecord, resetFilters: resetFilters };
})();
