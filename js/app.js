(function () {
  document.getElementById('yr').textContent = new Date().getFullYear();

  // Nama kab/kota di data TPA ("Kabupaten X") -> nama di data batas ("X")
  var strip = function (n) { return n.replace(/^Kabupaten /, ''); };
  var withTPA = {};
  TPA.forEach(function (t) { withTPA[strip(t.kab)] = true; });

  // Statistik (dihitung dari data, jadi otomatis ikut jika data diubah)
  var nKab = Object.keys(withTPA).length;
  var totalKab = KAB.features.filter(function (f) { return f.properties.WADMKK; }).length;
  document.getElementById('stats').innerHTML =
    '<div class="stat"><b>' + TPA.length + '</b><span>TPA terpetakan</span></div>' +
    '<div class="stat"><b>' + nKab + '</b><span>Kab/Kota memiliki data TPA</span></div>' +
    '<div class="stat"><b>' + totalKab + '</b><span>Kab/Kota di Jawa Timur</span></div>';

  var map = L.map('map', { scrollWheelZoom: false });
  // Scroll mouse hanya zoom peta setelah peta diklik, supaya scroll halaman tidak "tersangkut"
  map.on('click', function () { map.scrollWheelZoom.enable(); });
  map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

  var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Citra &copy; Esri, Maxar, Earthstar Geographics' }).addTo(map);
  var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });

  var batas = L.geoJSON(KAB, {
    style: function (f) {
      var on = withTPA[f.properties.WADMKK];
      return { color: '#ffffff', weight: 1, fillColor: on ? '#f3c95e' : '#000', fillOpacity: on ? 0.28 : 0 };
    },
    onEachFeature: function (f, l) {
      if (f.properties.WADMKK) l.bindTooltip(f.properties.WADMKK, { sticky: true });
    }
  }).addTo(map);

  var markers = L.layerGroup().addTo(map);
  var byName = {};
  var list = document.getElementById('list');
  list.innerHTML = '<h4>Daftar TPA</h4>';

  TPA.slice().sort(function (a, b) { return a.kab.localeCompare(b.kab); }).forEach(function (t, i) {
    var html = '<div class="pop"><b>' + t.tpa + '</b>' +
      '<div>' + t.kab + '</div>' +
      (t.alamat ? '<div>' + t.alamat + '</div>' : '') +
      '<div>Koordinat: ' + t.lat.toFixed(5) + ', ' + t.lon.toFixed(5) +
      (t.n > 1 ? ' <em>(rata-rata dari ' + t.n + ' titik)</em>' : '') + '</div>' +
      '<img src="images/foto-tpa.png" alt="Foto ' + t.tpa + '" loading="lazy"></div>';
    var m = L.circleMarker([t.lat, t.lon], {
      radius: 9, color: '#fff', weight: 2, fillColor: '#d98e04', fillOpacity: 1
    }).bindTooltip(t.tpa).bindPopup(html, { minWidth: 220 }).addTo(markers);
    byName[i] = m;
    var b = document.createElement('button');
    b.innerHTML = t.tpa + '<small>' + t.kab + '</small>';
    b.onclick = function () {
      map.flyTo([t.lat, t.lon], 15, { duration: 0.8 });
      m.openPopup();
      document.getElementById('peta').scrollIntoView({ behavior: 'smooth' });
    };
    list.appendChild(b);
  });

  L.control.layers(
    { 'Citra Satelit (Esri)': sat, 'OpenStreetMap': osm },
    { 'Titik TPA': markers, 'Batas Kab/Kota': batas },
    { collapsed: false }
  ).addTo(map);

  map.fitBounds(batas.getBounds());
})();
