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

// ===== Efek halaman: progres scroll, reveal, counter, tilt, geser horizontal, scrollspy =====
(function () {
  var $ = function (s, c) { return (c || document).querySelector(s); }, $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var fine = matchMedia('(pointer:fine)').matches;

  // Statistik hero (dari data) + animasi hitung naik
  var kabSet = {}; TPA.forEach(function (t) { kabSet[t.kab] = 1; });
  $('#hstats').innerHTML = [[TPA.length, 'TPA terpetakan'], [Object.keys(kabSet).length, 'Kab/Kota berdata'], [38, 'Kab/Kota Jawa Timur']]
    .map(function (x) { return '<div><b data-n="' + x[0] + '">0</b><span>' + x[1] + '</span></div>'; }).join('');
  function count(el) {
    var n = +el.dataset.n, t0 = performance.now();
    (function s(t) { var p = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(s); })(t0);
  }
  setTimeout(function () { $$('#hstats b').forEach(count); }, 700);

  // Reveal saat di-scroll
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  $$('.rv').forEach(function (el) { io.observe(el); });

  // Nav: progres scroll, nav solid, scrollspy
  var bar = $('#bar'), nav = $('#nav'), links = $$('.nav nav a'), secs = links.map(function (a) { return $(a.getAttribute('href')); });
  function onScroll() {
    var h = document.documentElement, y = scrollY;
    bar.style.transform = 'scaleX(' + (y / (h.scrollHeight - innerHeight || 1)) + ')';
    nav.classList.toggle('solid', y > 40);
    var cur = -1; secs.forEach(function (s, i) { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = i; });
    links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if (fine) {
    // Cahaya mengikuti kursor + parallax judul hero + tilt kartu
    var glow = $('#glow');
    addEventListener('pointermove', function (e) {
      glow.style.opacity = 1; glow.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
      var d = $('[data-depth]'), k = +d.dataset.depth;
      d.style.transform = 'translate(' + (e.clientX / innerWidth - 0.5) * -k + 'px,' + (e.clientY / innerHeight - 0.5) * -k + 'px)';
    });
    $$('.tilt').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var b = c.getBoundingClientRect();
        c.style.setProperty('--ry', ((e.clientX - b.left) / b.width - 0.5) * 10 + 'deg');
        c.style.setProperty('--rx', ((e.clientY - b.top) / b.height - 0.5) * -10 + 'deg');
      });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  // Program: geser ke samping (scroll, tarik mouse, tombol) + indikator
  var hs = $('#hs'), hpi = $('#hpi'), down = false, sx = 0, sl = 0, moved = 0;
  function prog() { var m = hs.scrollWidth - hs.clientWidth; hpi.style.marginLeft = (m > 0 ? hs.scrollLeft / m * 80 : 0) + '%'; }
  hs.addEventListener('scroll', prog, { passive: true }); prog();
  hs.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = hs.scrollLeft; });
  addEventListener('pointermove', function (e) { if (!down) return; moved = e.clientX - sx; if (Math.abs(moved) > 4) hs.classList.add('drag'); hs.scrollLeft = sl - moved; });
  addEventListener('pointerup', function () { down = false; hs.classList.remove('drag'); });
  function by(d) { hs.scrollBy({ left: d * (hs.firstElementChild.offsetWidth + 22), behavior: 'smooth' }); }
  $('#prev').onclick = function () { by(-1); }; $('#next').onclick = function () { by(1); };
})();
