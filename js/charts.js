/* =====================================================================
   charts.js — modul grafik SVG ringan tanpa dependensi eksternal.
   Menyediakan:
     SimpleCharts.hbar(container, data, options)   -> bar horizontal
     SimpleCharts.donut(container, data, options)  -> donut + legenda
   data: [{label: String, value: Number, color?: String}]
   Semua nilai berasal dari data yang diberikan pemanggil (tidak ada
   angka yang dibuat di sini).
   ===================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function ensureTooltip(container) {
    var tip = container.querySelector('.chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      container.appendChild(tip);
    }
    return tip;
  }

  function bindHover(target, container, html) {
    var tip = ensureTooltip(container);
    target.addEventListener('mousemove', function (ev) {
      var r = container.getBoundingClientRect();
      tip.innerHTML = html;
      tip.style.left = (ev.clientX - r.left) + 'px';
      tip.style.top = (ev.clientY - r.top) + 'px';
      tip.classList.add('is-visible');
    });
    target.addEventListener('mouseleave', function () { tip.classList.remove('is-visible'); });
  }

  function empty(container, msg) {
    container.innerHTML = '<div class="chart-empty">' + esc(msg || 'Tidak ada data untuk ditampilkan.') + '</div>';
  }

  /* ---------------- Horizontal bar ---------------- */
  function hbar(container, data, opt) {
    opt = opt || {};
    container.innerHTML = '';
    if (!data || !data.length) return empty(container, opt.emptyText);

    var color = opt.color || '#0d5e4c';
    var rowH = opt.rowHeight || 26;
    var barH = opt.barHeight || 14;
    var labelW = opt.labelWidth || 120;
    var valueW = 36;
    var padT = 6, padB = 6;
    var width = opt.width || 360;
    var height = padT + padB + data.length * rowH;
    var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
    var plotW = width - labelW - valueW - 8;

    var svg = el('svg', { viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': opt.ariaLabel || 'Grafik batang' }, container);

    // garis grid tipis (recessive)
    var ticks = niceTicks(max, 4);
    ticks.forEach(function (t) {
      var x = labelW + (t / max) * plotW;
      el('line', { x1: x, x2: x, y1: padT, y2: height - padB, stroke: '#e3e9e5', 'stroke-width': 1 }, svg);
    });

    data.forEach(function (d, i) {
      var y = padT + i * rowH + (rowH - barH) / 2;
      var w = Math.max(2, (d.value / max) * plotW);
      var g = el('g', { class: 'bar-row' }, svg);
      var lbl = el('text', { x: labelW - 8, y: y + barH / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': 11.5, fill: '#3c4842' }, g);
      lbl.textContent = truncate(d.label, opt.maxLabel || 18);
      // hit area lebih besar dari mark
      var hit = el('rect', { x: labelW, y: padT + i * rowH, width: plotW + valueW, height: rowH, fill: 'transparent' }, g);
      el('rect', { class: 'bar-rect', x: labelW, y: y, width: w, height: barH, rx: 4, ry: 4, fill: d.color || color }, g);
      var val = el('text', { x: labelW + w + 6, y: y + barH / 2, 'dominant-baseline': 'middle', 'font-size': 11.5, 'font-weight': 700, fill: '#1c2420' }, g);
      val.textContent = d.value;
      var tipHtml = '<strong>' + esc(d.label) + '</strong><br>' + esc(d.value) + ' ' + esc(opt.unit || '');
      bindHover(g, container, tipHtml);
      if (opt.onClick) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', function () { opt.onClick(d); });
      }
      hit.setAttribute('aria-label', d.label + ': ' + d.value);
    });
    return svg;
  }

  /* ---------------- Donut ---------------- */
  function donut(container, data, opt) {
    opt = opt || {};
    container.innerHTML = '';
    var total = (data || []).reduce(function (s, d) { return s + d.value; }, 0);
    if (!data || !data.length || total === 0) return empty(container, opt.emptyText);

    var size = 180, cx = size / 2, cy = size / 2, r = 70, stroke = 22;
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '16px';
    wrap.style.flexWrap = 'wrap';
    container.appendChild(wrap);

    var svgWrap = document.createElement('div');
    svgWrap.style.width = size + 'px';
    svgWrap.style.flexShrink = '0';
    svgWrap.style.position = 'relative';
    wrap.appendChild(svgWrap);
    var svg = el('svg', { viewBox: '0 0 ' + size + ' ' + size, role: 'img', 'aria-label': opt.ariaLabel || 'Grafik donat' }, svgWrap);
    var circ = 2 * Math.PI * r;
    var offset = 0;
    var gap = 2; // px spacer antar segmen
    data.forEach(function (d) {
      var len = (d.value / total) * circ;
      var dash = Math.max(0, len - gap);
      var c = el('circle', {
        cx: cx, cy: cy, r: r, fill: 'none', stroke: d.color || '#0d5e4c', 'stroke-width': stroke,
        'stroke-dasharray': dash + ' ' + (circ - dash), 'stroke-dashoffset': -offset,
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')', 'stroke-linecap': 'butt', class: 'bar-rect'
      }, svg);
      var pct = Math.round((d.value / total) * 1000) / 10;
      bindHover(c, container, '<strong>' + esc(d.label) + '</strong><br>' + esc(d.value) + ' ' + esc(opt.unit || '') + ' (' + pct + '%)');
      offset += len;
    });
    var t1 = el('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: '#1c2420' }, svg);
    t1.textContent = total;
    var t2 = el('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': 11, fill: '#6b776f' }, svg);
    t2.textContent = opt.centerLabel || 'total';

    var legend = document.createElement('div');
    legend.className = 'chart-legend';
    legend.style.flexDirection = 'column';
    legend.style.gap = '6px';
    data.forEach(function (d) {
      var pct = Math.round((d.value / total) * 1000) / 10;
      var item = document.createElement('div');
      item.innerHTML = '<span class="swatch" style="background:' + esc(d.color || '#0d5e4c') + '"></span>' +
        esc(d.label) + ' — <strong>' + esc(d.value) + '</strong> ' + esc(opt.unit || '') + ' <span style="color:#6b776f">(' + pct + '%)</span>';
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
    return svg;
  }

  function niceTicks(max, n) {
    if (max <= 0) return [0];
    var step = Math.pow(10, Math.floor(Math.log10(max / n)));
    var err = (max / n) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [];
    for (var v = 0; v <= max; v += step) out.push(v);
    return out;
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  global.SimpleCharts = { hbar: hbar, donut: donut };
})(window);
