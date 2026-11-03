=====================================================================
SISTEM INFORMASI GEOSPASIAL SEBARAN TEMPAT PEMROSESAN AKHIR (TPA)
PROVINSI JAWA TIMUR
Balai Penegakan Hukum Lingkungan Hidup Jabalnusra
=====================================================================

1. CARA MENJALANKAN
---------------------------------------------------------------------
a) Lokal (tanpa server)
   - Buka berkas index.html dengan klik dua kali (Chrome, Edge, Firefox).
   - Seluruh data TPA, batas administrasi, library, ikon, dan grafik
     berjalan secara lokal (offline).
   - Basemap (OpenStreetMap, Esri World Imagery, Esri Topo, CARTO Light)
     dimuat dari layanan daring, sehingga MEMERLUKAN KONEKSI INTERNET.
     Tanpa internet, peta tetap menampilkan batas administrasi dan titik
     TPA di atas latar polos.

b) Lokal dengan server sederhana (opsional)
   - Python : python -m http.server 8000   -> buka http://localhost:8000
   - Node   : npx serve .

c) Deploy ke GitHub Pages
   1. Buat repository baru di GitHub.
   2. Unggah SELURUH isi folder ini (index.html harus berada di akar repo).
   3. Settings -> Pages -> Source: "Deploy from a branch",
      Branch: main, Folder: / (root) -> Save.
   4. Situs tersedia di https://<username>.github.io/<nama-repo>/
   Semua path bersifat relatif, sehingga tidak perlu konfigurasi tambahan.

2. STRUKTUR FOLDER
---------------------------------------------------------------------
WebGIS_TPA_Jawa_Timur/
├── index.html                      Halaman utama (dashboard WebGIS)
├── README.txt                      Berkas ini
├── css/
│   ├── style.css                   Desain antarmuka aplikasi
│   ├── leaflet.css                 Library Leaflet
│   ├── MarkerCluster*.css          Library clustering marker
│   ├── fontawesome-all.min.css     Ikon (Font Awesome 5 Free, lokal)
│   └── images/                     Aset gambar Leaflet
├── js/
│   ├── app.js                      Logika WebGIS (peta, filter, statistik,
│   │                               daftar lokasi, panel detail)
│   └── charts.js                   Modul grafik SVG ringan (tanpa dependensi)
├── libraries/
│   ├── leaflet.js                  Leaflet 1.9.x
│   └── leaflet.markercluster.js    Leaflet.markercluster
├── data/
│   ├── LokasiTPA_2.js              25 titik lokasi TPA (asli dari QGIS2Web,
│   │                               tidak diubah)
│   └── GarisAdministrasiKabKota_1.js  Batas administrasi kab/kota Jawa Timur
├── images/
│   ├── logo_kantor.png             Logo instansi
│   └── gambar_pendukung/           Foto lokasi yang dirujuk atribut "Foto"
├── legend/                         Simbol legenda asli ekspor QGIS2Web (arsip)
└── webfonts/                       Berkas font ikon

3. SUMBER DATA & PENGOLAHAN
---------------------------------------------------------------------
- Data TPA  : data/LokasiTPA_2.js hasil ekspor QGIS2Web (2 November 2026).
              Tidak ada perubahan pada koordinat maupun atribut.
              25 fitur = 14 TPA unik (kombinasi nama TPA + kab/kota)
              di 12 kabupaten/kota. Beberapa TPA memiliki lebih dari satu
              titik/zona (Selopuro 2, Mrican 4, Winongo 7, Blandongan 2);
              setiap titik ditampilkan sebagai marker terpisah.
- Batas administrasi : data/GarisAdministrasiKabKota_1.js.
              Berkas asli berukuran 158 MB dan mencakup seluruh Jawa-Bali
              (163 fitur) sehingga tidak dapat diunggah ke GitHub (batas
              100 MB) dan sangat berat di browser. Untuk aplikasi ini
              dilakukan:
                * pemfilteran ke fitur Provinsi Jawa Timur (40 fitur:
                  38 kab/kota + 2 fitur tanpa nama kab/kota dari sumber),
                * penyederhanaan geometri (Douglas-Peucker, toleransi
                  0,0004 derajat ~ 44 m) -> ~650 KB.
              Atribut (KDPKAB, KDPPUM, WADMKK, WADMPR, METADATA, UPDATED)
              dipertahankan utuh. Berkas asli tetap dapat dipakai kembali
              dengan menimpa berkas ini (nama variabel sama).
- Foto      : atribut "Foto" pada data sumber merujuk "Gambar/sampah-bangkalan.png"
              untuk seluruh titik. Berkas tersebut disalin ke
              images/gambar_pendukung/sampah-bangkalan.png. Untuk foto per
              lokasi, tambahkan berkas ke folder itu dan ubah nilai atribut
              "Foto" pada data/LokasiTPA_2.js.
- Catatan   : 6 titik (Mrican, Blandongan) memiliki catatan interpretasi
              koordinat dari data sumber; catatan ditampilkan pada panel
              detail lokasi yang bersangkutan.

4. FITUR
---------------------------------------------------------------------
- Dashboard statistik dinamis: jumlah titik, TPA unik, kab/kota, titik
  beralamat, titik berkoordinat (dihitung dari data, mengikuti filter).
- Peta Leaflet: 4 pilihan basemap, layer batas administrasi (wilayah
  dengan TPA diberi arsir toska; klik wilayah untuk memfilter), layer titik
  TPA dengan clustering, zoom, tampilan awal, layar penuh, geolokasi,
  skala, kontrol layer, legenda, highlight marker terpilih.
- Panel detail: nama TPA, kab/kota, titik/zona, alamat, latitude,
  longitude, koordinat sumber, catatan, foto; tombol zoom ke lokasi,
  salin koordinat, buka di Google Maps.
- Pencarian (nama TPA / kab-kota / alamat) dan filter kab/kota, dengan
  tombol reset. Peta, statistik, daftar, dan grafik diperbarui bersamaan.
- Daftar lokasi: tampilan kartu/tabel, pengurutan, pagination, terhubung
  dua arah dengan peta.
- Grafik: titik per kab/kota, TPA unik per kab/kota, distribusi
  kabupaten vs kota (SVG, mengikuti filter).
- Responsif untuk desktop, tablet, dan ponsel.

5. PENGEMBANGAN LANJUTAN
---------------------------------------------------------------------
- Mengganti/menambah data: edit data/LokasiTPA_2.js (format GeoJSON di
  dalam variabel json_LokasiTPA_2). Atribut yang dibaca aplikasi:
  ID, NO, KAB/KOTA, TPA, TITIK, LATITUDE, LONGITUDE, KOORD_ASLI, ALAMAT,
  CATATAN, Foto. Koordinat peta diambil dari geometry (lon, lat).
- Warna/identitas: ubah variabel CSS di bagian atas css/style.css.
- Grafik menggunakan modul SVG lokal (js/charts.js). Jika ingin memakai
  Chart.js, tambahkan berkas chart.umd.js ke folder libraries/ dan ganti
  fungsi renderCharts() pada js/app.js.
- Objek window.WebGIS (map, records, cluster, state, applyFilters, dll.)
  tersedia di konsol browser untuk keperluan debugging.

6. TEKNOLOGI
---------------------------------------------------------------------
HTML5, CSS3, JavaScript (ES5, tanpa build tool), Leaflet 1.9,
Leaflet.markercluster, GeoJSON, Font Awesome 5 Free, SVG.
Tidak ada API berbayar atau API key.
